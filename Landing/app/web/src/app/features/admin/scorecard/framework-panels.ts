import { Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_UI_CSS } from '../admin-ui';
import {
  FrameworkCompetency,
  FrameworkConfig,
  FrameworkDimension,
  FrameworkScale,
  standardEdpaScale,
} from './scorecard-admin.service';

const cleanKey = (raw: string, max: number) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, max);

const PANEL_CSS = `
  .note { color: var(--muted, #9fb0d0); font-size: 0.86rem; margin: 0 0 1rem; max-width: 80ch; }
  .lock-note { background: rgba(232, 182, 74, 0.12); border: 1px solid rgba(232, 182, 74, 0.4); color: var(--gold-2, #f5cc5a); padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin-bottom: 1rem; }
  fieldset.row { border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 14px; padding: 0.9rem 1rem 0.5rem; margin: 0 0 0.8rem; min-width: 0; background: rgba(0,0,0,0.14); }
  fieldset.row:disabled { opacity: 0.8; }
  .grid-in { display: grid; gap: 0.7rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); margin-bottom: 0.7rem; }
  .grid-in .wide { grid-column: 1 / -1; }
  .fld label { display: block; font-size: 0.72rem; font-weight: 700; color: var(--muted, #9fb0d0); margin-bottom: 0.25rem; }
  .fld input, .fld select, .fld textarea { width: 100%; padding: 0.5rem 0.7rem; border-radius: 9px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color: var(--text, #eef2fb); }
  .fld textarea { min-height: 56px; resize: vertical; }
  .fld select option { background: var(--panel-2, #10254a); }
  .row-actions { display: flex; gap: 0.5rem; margin: 0 0 0.6rem; flex-wrap: wrap; align-items: center; }
  .muted { color: var(--faint, #6e7f9e); font-size: 0.8rem; }
`;

// --------------------------------------------------------------- dimensions

@Component({
  selector: 'app-fw-dimensions',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="note">A dimension is one of the broad capacities a student is profiled on (for example THINK, FEEL, CONNECT, LEAD). Every competency belongs to exactly one.</p>
    @if (locked()) {
      <div class="lock-note">This framework is published and locked. Use "Make a new version" to change it.</div>
    }
    @for (d of cfg().dimensions; track $index; let i = $index) {
      <fieldset class="row" [disabled]="locked()">
        <div class="grid-in">
          <div class="fld"><label>Key</label><input type="text" [ngModel]="d.key" (ngModelChange)="d.key = clean($event)" maxlength="20" placeholder="THINK" /></div>
          <div class="fld"><label>Label</label><input type="text" [(ngModel)]="d.label" maxlength="60" /></div>
          <div class="fld"><label>Subtitle <small>(e.g. Intellectual Intelligence)</small></label><input type="text" [(ngModel)]="d.subtitle" maxlength="120" /></div>
          <div class="fld wide"><label>Description</label><textarea [(ngModel)]="d.description"></textarea></div>
        </div>
        <div class="row-actions">
          <span class="muted">{{ usedBy(d.key) }} competencies</span>
          <button class="btn btn-sm btn-danger" (click)="remove(i)">Remove</button>
        </div>
      </fieldset>
    } @empty {
      <div class="card empty">No dimensions yet.</div>
    }
    @if (!locked()) {
      <button class="btn btn-sm" (click)="add()">+ Add dimension</button>
    }
  `,
  styles: [ADMIN_UI_CSS, PANEL_CSS],
})
export class FrameworkDimensionsPanel {
  readonly cfg = input.required<FrameworkConfig>();
  readonly locked = input(false);

  protected clean(raw: string): string {
    return cleanKey(raw, 20);
  }
  protected usedBy(key: string): number {
    return this.cfg().competencies.filter((c) => c.dimension === key).length;
  }
  protected add(): void {
    this.cfg().dimensions.push({ key: '', label: '', subtitle: '', description: '' } as FrameworkDimension);
  }
  protected remove(i: number): void {
    const d = this.cfg().dimensions[i];
    const n = this.usedBy(d.key);
    if (n && !confirm(`${n} competenc${n === 1 ? 'y is' : 'ies are'} mapped to ${d.key || 'this dimension'}. They will need another dimension before you can publish. Remove it?`)) return;
    this.cfg().dimensions.splice(i, 1);
  }
}

// ------------------------------------------------------------------- levels

@Component({
  selector: 'app-fw-levels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="note">
      A scale turns a score into a level (for example Emerging to Advanced). <b>Minimum %</b> is the lowest percentage that earns the level — judged on the exact score,
      so 79.9% never becomes 80%. <b>Roll-up average</b> is the same idea for averaging levels across stages (each level counts its points).
    </p>
    @if (locked()) {
      <div class="lock-note">This framework is published and locked. Use "Make a new version" to change it.</div>
    }
    @for (s of cfg().scales; track $index; let si = $index) {
      <fieldset class="row" [disabled]="locked()">
        <div class="grid-in">
          <div class="fld"><label>Scale key</label><input type="text" [ngModel]="s.key" (ngModelChange)="renameScale(s, $event)" maxlength="30" /></div>
          <div class="fld"><label>Name</label><input type="text" [(ngModel)]="s.name" maxlength="80" /></div>
          <div class="fld"><label>"Moving towards" margin</label><input type="number" step="0.05" min="0" [(ngModel)]="s.movingTowardsMargin" /></div>
          <div class="fld">
            <label>Default scale</label>
            <label class="radio"><input type="radio" name="defaultScale" [checked]="cfg().defaultScale === s.key" (change)="cfg().defaultScale = s.key" /> Use this by default</label>
          </div>
        </div>

        <div class="bar-prev" aria-hidden="true">
          @for (l of sorted(s); track l.key; let li = $index) {
            <span [style.flex]="width(s, li)" [class]="'seg c' + (li % 4)"><b>{{ l.label }}</b> {{ l.minPercent }}%+</span>
          }
        </div>

        <div class="lv-head"><span>Key</span><span>Label</span><span>Points</span><span>Min %</span><span>Roll-up avg</span><span>Meaning</span><span></span></div>
        @for (l of s.levels; track $index; let li = $index) {
          <div class="lv">
            <input type="text" [ngModel]="l.key" (ngModelChange)="l.key = clean($event)" maxlength="30" aria-label="Level key" />
            <input type="text" [(ngModel)]="l.label" maxlength="40" aria-label="Level label" />
            <input type="number" [(ngModel)]="l.points" aria-label="Points" />
            <input type="number" min="0" max="100" step="0.1" [(ngModel)]="l.minPercent" aria-label="Minimum percent" />
            <input type="number" step="0.05" [(ngModel)]="l.minAverage" aria-label="Roll-up average" />
            <input type="text" [(ngModel)]="l.meaning" aria-label="Meaning" />
            <button class="opt-remove" [disabled]="s.levels.length <= 2" (click)="s.levels.splice(li, 1)" aria-label="Remove level">✕</button>
          </div>
        }
        <div class="row-actions">
          <button class="btn btn-sm" (click)="addLevel(s)">+ Add level</button>
          <button class="btn btn-sm btn-danger" [disabled]="cfg().scales.length <= 1" (click)="removeScale(si)">Remove scale</button>
        </div>
      </fieldset>
    } @empty {
      <div class="card empty">No scales yet.</div>
    }
    @if (!locked()) {
      <div class="row-actions">
        <button class="btn btn-sm" (click)="addStandard()">+ Add the standard IML scale</button>
        <button class="btn btn-sm" (click)="addBlank()">+ Add a blank scale</button>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    PANEL_CSS,
    `
      .radio { display: flex; align-items: center; gap: 0.4rem; font-weight: 500 !important; color: var(--text, #eef2fb) !important; padding-top: 0.45rem; cursor: pointer; }
      .radio input { width: auto; accent-color: var(--gold, #e8b64a); }
      .bar-prev { display: flex; gap: 2px; margin: 0.2rem 0 0.9rem; border-radius: 8px; overflow: hidden; min-height: 30px; }
      .bar-prev .seg { padding: 0.35rem 0.5rem; font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
      .c0 { background: #475569; } .c1 { background: #2563eb; } .c2 { background: #059669; } .c3 { background: #b7791f; }
      .lv-head, .lv { display: grid; grid-template-columns: 1.1fr 1fr 0.55fr 0.65fr 0.75fr 2.6fr 34px; gap: 0.4rem; align-items: center; }
      .lv-head { font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint, #6e7f9e); font-weight: 800; padding: 0 0.1rem 0.3rem; }
      .lv { margin-bottom: 0.45rem; }
      .lv input { width: 100%; min-width: 0; padding: 0.45rem 0.55rem; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color: var(--text, #eef2fb); }
      @media (max-width: 900px) {
        .lv-head { display: none; }
        .lv { grid-template-columns: 1fr 1fr; padding: 0.6rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; }
        .lv input:nth-child(6) { grid-column: 1 / -1; }
      }
    `,
  ],
})
export class FrameworkLevelsPanel {
  readonly cfg = input.required<FrameworkConfig>();
  readonly locked = input(false);

  protected clean(raw: string): string {
    return cleanKey(raw, 30);
  }
  protected sorted(s: FrameworkScale) {
    return s.levels.slice().sort((a, b) => a.minPercent - b.minPercent);
  }
  protected width(s: FrameworkScale, i: number): number {
    const l = this.sorted(s);
    const end = i + 1 < l.length ? l[i + 1].minPercent : 100;
    return Math.max(8, end - l[i].minPercent);
  }
  protected renameScale(s: FrameworkScale, raw: string): void {
    const old = s.key;
    s.key = cleanKey(raw, 30);
    if (this.cfg().defaultScale === old) this.cfg().defaultScale = s.key;
  }
  protected addLevel(s: FrameworkScale): void {
    const top = s.levels.reduce((m, l) => Math.max(m, l.points), 0);
    s.levels.push({ key: '', label: '', points: top + 1, minPercent: Math.min(100, Math.max(...s.levels.map((l) => l.minPercent), 0) + 10), minAverage: null, meaning: '' });
  }
  protected removeScale(i: number): void {
    const s = this.cfg().scales[i];
    if (!confirm(`Remove the scale "${s.name || s.key}"?`)) return;
    this.cfg().scales.splice(i, 1);
    if (!this.cfg().scales.some((x) => x.key === this.cfg().defaultScale)) this.cfg().defaultScale = this.cfg().scales[0]?.key ?? '';
  }
  protected addStandard(): void {
    const s = standardEdpaScale();
    while (this.cfg().scales.some((x) => x.key === s.key)) s.key += '2';
    this.cfg().scales.push(s);
    if (!this.cfg().defaultScale) this.cfg().defaultScale = s.key;
  }
  protected addBlank(): void {
    this.cfg().scales.push({
      key: '',
      name: '',
      movingTowardsMargin: null,
      levels: [
        { key: '', label: '', points: 1, minPercent: 0, minAverage: null, meaning: '' },
        { key: '', label: '', points: 2, minPercent: 50, minAverage: null, meaning: '' },
      ],
    });
  }
}

// ------------------------------------------------------------ competencies

@Component({
  selector: 'app-fw-competencies',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="note">
      The shared list of competencies used across every stage. Each belongs to one dimension and has a weight (how much it counts when its dimension is rolled up).
      Where a stage calls the same competency something slightly different, add that name under "Names by stage".
    </p>
    @if (locked()) {
      <div class="lock-note">This framework is published and locked. Use "Make a new version" to change it.</div>
    }
    <fieldset class="row" [disabled]="locked()">
      <div class="grid-in">
        <div class="fld">
          <label>Minimum questions for an area percentage</label>
          <input type="number" min="1" max="200" [ngModel]="cfg().autoScore?.minQuestionsPerArea ?? 5" (ngModelChange)="setMinimum($event)" />
        </div>
      </div>
      <p class="muted" style="margin:0 0 0.6rem">An exam area (for example Logical Reasoning) with fewer questions than this shows "not enough questions" instead of a percentage and level.</p>
    </fieldset>
    <div class="row-actions">
      <input class="search" placeholder="Search competencies" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select class="filter" [ngModel]="dimFilter()" (ngModelChange)="dimFilter.set($event)" aria-label="Dimension">
        <option value="">All dimensions</option>
        @for (d of cfg().dimensions; track d.key) {
          <option [value]="d.key">{{ d.label || d.key }}</option>
        }
      </select>
      <span class="muted">{{ shown().length }} of {{ cfg().competencies.length }}</span>
    </div>

    @for (k of shown(); track k) {
      <fieldset class="row" [disabled]="locked()">
        <div class="grid-in">
          <div class="fld"><label>Key</label><input type="text" [ngModel]="k.key" (ngModelChange)="k.key = clean($event)" maxlength="40" /></div>
          <div class="fld"><label>Name</label><input type="text" [(ngModel)]="k.name" maxlength="80" /></div>
          <div class="fld">
            <label>Dimension</label>
            <select [(ngModel)]="k.dimension">
              <option value="">Choose…</option>
              @for (d of cfg().dimensions; track d.key) {
                <option [value]="d.key">{{ d.label || d.key }}</option>
              }
            </select>
          </div>
          <div class="fld"><label>Weight</label><input type="number" min="0.1" max="10" step="0.1" [(ngModel)]="k.weight" /></div>
          <div class="fld wide">
            <label>Exam categories <small>(auto-scored stages: the question categories whose answers are scored into this competency, e.g. LR)</small></label>
            <input type="text" [ngModel]="(k.examCategories || []).join(', ')" (ngModelChange)="setCategories(k, $event)" placeholder="Leave empty for panel-rated competencies" />
          </div>
        </div>
        <details [open]="hasStageNames(k)">
          <summary>Names by stage <span class="muted">{{ stageSummary(k) }}</span></summary>
          <div class="grid-in" style="margin-top:0.6rem">
            @for (n of stageNumbers(); track n) {
              <div class="fld">
                <label>Stage {{ n }}</label>
                <input type="text" [ngModel]="k.stageNames[n] || ''" (ngModelChange)="setStageName(k, n, $event)" [placeholder]="k.name || 'Same as the name'" />
              </div>
            }
          </div>
        </details>
        <div class="row-actions" style="margin-top:0.6rem">
          <button class="btn btn-sm btn-danger" (click)="remove(k)">Remove</button>
        </div>
      </fieldset>
    } @empty {
      <div class="card empty">{{ cfg().competencies.length ? 'No competencies match.' : 'No competencies yet.' }}</div>
    }
    @if (!locked()) {
      <div class="row-actions">
        <button class="btn btn-sm" (click)="add()">+ Add competency</button>
        <button class="btn btn-sm" [disabled]="stages() >= 12" (click)="stages.set(stages() + 1)">+ Show another stage column</button>
      </div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    PANEL_CSS,
    `
      details summary { cursor: pointer; font-size: 0.84rem; font-weight: 700; color: var(--muted, #9fb0d0); }
      details summary .muted { margin-left: 0.5rem; font-weight: 500; }
    `,
  ],
})
export class FrameworkCompetenciesPanel {
  readonly cfg = input.required<FrameworkConfig>();
  readonly locked = input(false);

  protected readonly q = signal('');
  protected readonly dimFilter = signal('');
  protected readonly stages = signal(4);

  // A method, not a computed: the competencies are edited in place, which a computed would not notice.
  protected stageNumbers(): string[] {
    const used = this.cfg().competencies.flatMap((c) => Object.keys(c.stageNames ?? {}).map(Number));
    const n = Math.min(12, Math.max(this.stages(), ...used, 1));
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }

  protected shown(): FrameworkCompetency[] {
    const text = this.q().trim().toLowerCase();
    const dim = this.dimFilter();
    return this.cfg().competencies.filter(
      (c) => (!dim || c.dimension === dim) && (!text || c.name.toLowerCase().includes(text) || c.key.toLowerCase().includes(text)),
    );
  }
  protected clean(raw: string): string {
    return cleanKey(raw, 40);
  }
  protected setCategories(k: FrameworkCompetency, raw: string): void {
    k.examCategories = raw.split(',').map((x) => x.trim()).filter(Boolean);
  }
  protected setMinimum(raw: number | string): void {
    this.cfg().autoScore = { minQuestionsPerArea: Number(raw) };
  }
  protected hasStageNames(k: FrameworkCompetency): boolean {
    return Object.values(k.stageNames ?? {}).some((v) => !!v);
  }
  protected stageSummary(k: FrameworkCompetency): string {
    const e = Object.entries(k.stageNames ?? {}).filter(([, v]) => v);
    return e.length ? e.map(([s, v]) => `S${s}: ${v}`).join(' · ') : '';
  }
  protected setStageName(k: FrameworkCompetency, stage: string, value: string): void {
    k.stageNames = { ...(k.stageNames ?? {}) };
    if (value.trim()) k.stageNames[stage] = value;
    else delete k.stageNames[stage];
  }
  protected add(): void {
    this.cfg().competencies.push({ key: '', name: '', dimension: this.dimFilter(), weight: 1, stageNames: {} });
  }
  protected remove(k: FrameworkCompetency): void {
    if (!confirm(`Remove "${k.name || k.key || 'this competency'}"?`)) return;
    const list = this.cfg().competencies;
    list.splice(list.indexOf(k), 1);
  }
}
