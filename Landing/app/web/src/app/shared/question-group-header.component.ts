import { Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** What a Question Group shows above its sub-questions. */
export interface GroupHeader {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/;

/**
 * The header card shown above every sub-question of a Question Group in the
 * exam, and in the admin's group preview (so both look the same). Purely
 * presentational: it owns no state — the page says whether it is collapsed.
 *
 * The description is plain text (line breaks kept, never rendered as HTML).
 * A YouTube link is embedded using only its 11-character video id, so an
 * arbitrary URL can never end up in the iframe.
 */
@Component({
  selector: 'app-question-group-header',
  standalone: true,
  template: `
    <section class="qg" [class.qg-collapsed]="collapsed()" aria-label="Question group">
      <button type="button" class="qg-head" [attr.aria-expanded]="!collapsed()" (click)="toggled.emit()">
        <span class="qg-text">
          <span class="qg-eyebrow">{{ part() ? 'Part ' + part()!.n + ' of ' + part()!.of : 'Question group' }}</span>
          <span class="qg-title">{{ group().title }}</span>
        </span>
        <span class="qg-toggle">{{ collapsed() ? 'Show' : 'Hide' }}</span>
      </button>

      @if (!collapsed()) {
        <div class="qg-body">
          @if (embed(); as src) {
            <div class="qg-media qg-video"><iframe [src]="src" title="Group video" loading="lazy" allowfullscreen></iframe></div>
          } @else if (group().videoUrl) {
            <div class="qg-media qg-video"><video [src]="group().videoUrl!" controls preload="metadata"></video></div>
          }
          @if (group().imageUrl) {
            <div class="qg-media"><img [src]="group().imageUrl!" [alt]="group().title" /></div>
          }
          @if (group().description) {
            <p class="qg-desc">{{ group().description }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .qg { border: 1px solid var(--line-2, rgba(255, 255, 255, 0.16)); border-left: 3px solid var(--gold, #e8b64a);
        border-radius: 14px; background: rgba(255, 255, 255, 0.035); margin: 0.9rem 0 0.3rem; overflow: hidden; }
      .qg-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
        padding: 0.8rem 1rem; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .qg-head:focus-visible { outline: 2px solid var(--gold, #e8b64a); outline-offset: -2px; }
      .qg-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
      .qg-eyebrow { font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: var(--gold, #e8b64a); }
      .qg-title { font-family: var(--display, inherit); font-weight: 700; font-size: 1.02rem; line-height: 1.3; color: var(--text, #eef2fb); text-wrap: balance; }
      .qg-toggle { flex: 0 0 auto; font-size: 0.78rem; font-weight: 600; color: var(--muted, #aab0d6);
        padding: 0.25rem 0.6rem; border-radius: 8px; border: 1px solid var(--line-2, rgba(255, 255, 255, 0.16)); }
      .qg-body { padding: 0 1rem 1rem; display: grid; gap: 0.8rem; }
      .qg-media { border-radius: 10px; overflow: hidden; background: rgba(0, 0, 0, 0.25); }
      .qg-media img { display: block; width: 100%; max-height: 46vh; object-fit: contain; }
      .qg-video iframe, .qg-video video { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; background: #000; }
      .qg-desc { margin: 0; color: var(--text, #eef2fb); opacity: 0.92; font-size: 0.95rem; line-height: 1.6; white-space: pre-line; max-width: 75ch; }
      @media (max-width: 700px) {
        .qg-media img { max-height: 30vh; }
        .qg-head { padding: 0.7rem 0.85rem; }
        .qg-body { padding: 0 0.85rem 0.85rem; }
      }
    `,
  ],
})
export class QuestionGroupHeaderComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly group = input.required<GroupHeader>();
  /** e.g. { n: 2, of: 4 } renders "Part 2 of 4". */
  readonly part = input<{ n: number; of: number } | null>(null);
  readonly collapsed = input(false);
  readonly toggled = output<void>();

  protected readonly embed = computed<SafeResourceUrl | null>(() => {
    const m = (this.group().videoUrl ?? '').match(YOUTUBE_ID);
    return m ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${m[1]}`) : null;
  });
}
