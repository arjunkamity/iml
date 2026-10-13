import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SecurityContext,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Minimal WYSIWYG editor for question text — bold/italic/underline, bulleted
 * and numbered lists, indent/outdent. Built on contenteditable +
 * document.execCommand rather than pulling in a rich-text library: the
 * formatting need here is narrow (client asked specifically for "proper
 * bullet, indented formatting"), and every other editing surface in this
 * admin is hand-rolled the same way (see MediaLibraryModal).
 *
 * Emits sanitized HTML (via Angular's own DomSanitizer) on every change —
 * this is what gets stored in Question.prompt and, later, rendered with
 * [innerHTML] in the exam room, which sanitizes again at render time, so
 * the content is safe end to end regardless of what a paste or a stray
 * edit introduces.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  // document.execCommand (insertUnorderedList, indent, etc.) builds its
  // <ul>/<ol>/<li> elements directly via the browser's own editing engine,
  // not through Angular's template rendering — so those elements never get
  // stamped with Angular's emulated-encapsulation [_ngcontent-*] attribute,
  // and scoped styles silently never match them (list-style/padding rules
  // below would otherwise do nothing). Selectors are still scoped by the
  // .rte-* class prefixes, so disabling encapsulation here is safe.
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="rte">
      <div class="rte-toolbar" (mousedown)="$event.preventDefault()">
        <button type="button" class="rte-btn" title="Bold" (click)="exec('bold')"><b>B</b></button>
        <button type="button" class="rte-btn" title="Italic" (click)="exec('italic')"><i>I</i></button>
        <button type="button" class="rte-btn" title="Underline" (click)="exec('underline')"><u>U</u></button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" title="Bulleted list" (click)="exec('insertUnorderedList')">&#8226; List</button>
        <button type="button" class="rte-btn" title="Numbered list" (click)="exec('insertOrderedList')">1. List</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" title="Indent" (click)="exec('indent')">&#8677;</button>
        <button type="button" class="rte-btn" title="Outdent" (click)="exec('outdent')">&#8676;</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" title="Clear formatting" (click)="exec('removeFormat')">Clear</button>
      </div>
      <div
        #editor
        class="rte-body"
        contenteditable="true"
        [attr.data-placeholder]="placeholder"
        (input)="onInput()"
        (blur)="onInput()"
        (paste)="onPaste($event)"
      ></div>
    </div>
  `,
  styles: [`
    .rte { border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; overflow: hidden;
      background: rgba(0, 0, 0, 0.3); }
    .rte-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem; padding: 0.4rem 0.5rem;
      border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); background: rgba(255, 255, 255, 0.03); }
    .rte-btn { border: 1px solid transparent; background: none; color: var(--text, #eef2fb);
      font: inherit; font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.55rem; border-radius: 7px;
      cursor: pointer; line-height: 1; }
    .rte-btn:hover { background: rgba(255, 255, 255, 0.08); border-color: var(--line, rgba(255,255,255,0.09)); }
    .rte-sep { width: 1px; align-self: stretch; background: var(--line, rgba(255,255,255,0.09)); margin: 0 0.15rem; }
    .rte-body { min-height: 120px; max-height: 320px; overflow-y: auto; padding: 0.6rem 0.8rem;
      color: var(--text, #eef2fb); font-size: 0.92rem; line-height: 1.5; outline: none; }
    .rte-body:focus { box-shadow: inset 0 0 0 2px rgba(232, 182, 74, 0.35); }
    .rte-body:empty::before { content: attr(data-placeholder); color: var(--faint, #6e7f9e); }
    .rte-body ul { margin: 0.3rem 0; padding-left: 1.4rem; list-style: disc; }
    .rte-body ol { margin: 0.3rem 0; padding-left: 1.4rem; list-style: decimal; }
    .rte-body li { display: list-item; }
    .rte-body p { margin: 0 0 0.5rem; }
  `],
})
export class RichTextEditorComponent implements AfterViewInit, OnChanges {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() value = '';
  @Input() placeholder = '';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('editor') private editorRef!: ElementRef<HTMLDivElement>;

  private lastEmitted = '';

  ngAfterViewInit(): void {
    this.editorRef.nativeElement.innerHTML = this.value || '';
    this.lastEmitted = this.value || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only resync the DOM when the value changed from OUTSIDE this editor
    // (e.g. the modal populated a different row's prompt into the same
    // field) — resyncing on every keystroke would fight the browser's own
    // cursor position inside a contenteditable region.
    if (changes['value'] && this.editorRef && this.value !== this.lastEmitted) {
      this.editorRef.nativeElement.innerHTML = this.value || '';
      this.lastEmitted = this.value || '';
    }
  }

  protected exec(cmd: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(cmd, false);
    this.onInput();
  }

  protected onInput(): void {
    const raw = this.editorRef.nativeElement.innerHTML;
    const clean = this.sanitizer.sanitize(SecurityContext.HTML, raw) ?? '';
    this.lastEmitted = clean;
    this.valueChange.emit(clean);
  }

  // Paste as plain text only — pasted HTML (especially from Word/Docs)
  // tends to carry heavy inline styles/classes that would pollute stored
  // question text. Formatting is still available afterward via the
  // toolbar; this just keeps what lands in the editor clean.
  protected onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }
}
