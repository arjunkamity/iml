import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import { ConfigChange, ConfigDiff, ScorecardAdminApi, errText } from './scorecard-admin.service';

export interface DiffChoice {
  code: string;
  label: string;
}

const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

/** "What changed between two versions" for a framework or a report template (#87). */
@Component({
  selector: 'app-config-diff',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-root" (click)="closed.emit()">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="m-head"><h3>What changed</h3><button class="m-x" (click)="closed.emit()" aria-label="Close">✕</button></div>
        <div class="m-body">
          @if (error()) { <div class="err">{{ error() }}</div> }
          @if (choices().length) {
            <div class="f">
              <label for="df-against">Compare {{ code() }} with</label>
              <select id="df-against" [ngModel]="against()" (ngModelChange)="pick($event)">
                <option value="">The version it was copied from</option>
                @for (c of choices(); track c.code) {
                  <option [value]="c.code">{{ c.label }}</option>
                }
              </select>
            </div>
          }
          @if (diff(); as d) {
            <p class="sum">
              <b>{{ d.from.code }}</b> (v{{ d.from.version }}, {{ d.from.status }}) → <b>{{ d.to.code }}</b> (v{{ d.to.version }}, {{ d.to.status }}):
              {{ d.changes.length ? d.changes.length + ' change' + (d.changes.length === 1 ? '' : 's') : 'no differences' }}
            </p>
            <div class="rows">
              @for (c of d.changes; track $index) {
                <div class="row" [class]="c.kind">
                  <span class="k">{{ c.kind === 'added' ? 'Added' : c.kind === 'removed' ? 'Removed' : 'Changed' }}</span>
                  <code class="p">{{ c.path }}</code>
                  <span class="v">
                    @if (c.kind !== 'added') { <span class="was">{{ text(c.before) }}</span> }
                    @if (c.kind === 'changed') { <span class="arrow">→</span> }
                    @if (c.kind !== 'removed') { <span class="now">{{ text(c.after) }}</span> }
                  </span>
                </div>
              }
            </div>
          } @else if (!error()) {
            <div class="empty">Loading…</div>
          }
        </div>
        <div class="m-foot"><button class="btn" (click)="closed.emit()">Close</button></div>
      </div>
    </div>
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .sum { color: var(--muted, #9fb0d0); font-size: 0.88rem; margin: 0.8rem 0; }
      .rows { display: grid; gap: 0.4rem; max-height: 52vh; overflow: auto; }
      .row { display: grid; grid-template-columns: 4.6rem minmax(0, 14rem) minmax(0, 1fr); gap: 0.6rem; align-items: start; padding: 0.5rem 0.65rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; font-size: 0.84rem; }
      .row.added { border-color: rgba(52, 211, 153, 0.4); }
      .row.removed { border-color: rgba(251, 113, 133, 0.45); }
      .row.changed { border-color: rgba(232, 182, 74, 0.4); }
      .k { font-weight: 800; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 0.1rem; }
      .p { background: none; padding: 0; overflow-wrap: anywhere; color: var(--gold-2, #f5cc5a); }
      .v { overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; }
      .was { text-decoration: line-through; color: var(--faint, #6e7f9e); }
      .now { font-weight: 600; }
      .arrow { color: var(--muted, #9fb0d0); }
      @media (max-width: 640px) { .row { grid-template-columns: 1fr; gap: 0.2rem; } }
    `,
  ],
})
export class ConfigDiffDialog implements OnInit {
  private readonly api = inject(ScorecardAdminApi);

  readonly kind = input.required<'framework' | 'template'>();
  readonly code = input.required<string>();
  /** Other versions of the same thing, to compare with. */
  readonly choices = input<DiffChoice[]>([]);
  readonly closed = output<void>();

  protected readonly diff = signal<ConfigDiff | null>(null);
  protected readonly error = signal('');
  protected readonly against = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected pick(code: string): void {
    this.against.set(code);
    this.load();
  }

  private load(): void {
    this.diff.set(null);
    this.error.set('');
    const req = this.kind() === 'framework' ? this.api.frameworkDiff(this.code(), this.against() || undefined) : this.api.templateDiff(this.code(), this.against() || undefined);
    req.subscribe({ next: (d) => this.diff.set(d), error: (e) => this.error.set(errText(e)) });
  }

  protected text(v: unknown): string {
    const s = show(v);
    return s.length > 240 ? s.slice(0, 240) + '…' : s;
  }
}

export type { ConfigChange };
