import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Narrative, PanelApi, errText } from './panel-api.service';
import { PANEL_CSS } from './panel-ui';

@Component({
  selector: 'app-panel-note',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="pn-wrap">
      <a class="pn-back" [routerLink]="['/panel/stages', stageId, 'notes']">← Observer notes</a>
      @if (n(); as x) {
        <h1 class="pn-h1">{{ x.student.name }}</h1>
        <p class="pn-sub">{{ x.student.code }}. Edit the draft so it says what you observed, then approve it.</p>
        @if (x.gaps.length) {
          <div class="pn-err" style="background:rgba(232,182,74,0.12);border-color:rgba(232,182,74,0.5);color:#f5cc5a">The library has no approved wording for: {{ x.gaps.join('; ') }}. Fill those in yourself.</div>
        }
        @if (error()) { <div class="pn-err">{{ error() }}</div> }
        @if (x.approvedText) {
          <div class="pn-ok">Approved {{ x.approvedAt | date: 'd MMM y, h:mm a' }} by {{ x.approvedByName }}. @if (x.approvedText !== text) { Your draft below is different and is not used until you approve it again. }</div>
        }
        <div class="pn-card">
          <h3>Note for the report</h3>
          <textarea class="pn-text" rows="12" [(ngModel)]="text" aria-label="Observer note"></textarea>
          <div class="pn-row" style="margin:0.9rem 0 0">
            <button class="pn-btn" (click)="save()" [disabled]="busy()">Save draft</button>
            <button class="pn-btn gold" (click)="approve()" [disabled]="busy() || !text.trim()">Approve for the report</button>
            <button class="pn-btn" (click)="resetToSystem()" [disabled]="busy()">Start again from the system draft</button>
          </div>
        </div>
      } @else if (error()) {
        <div class="pn-err">{{ error() }}</div>
      } @else {
        <p class="pn-muted">Loading…</p>
      }
    </div>
  `,
  styles: [PANEL_CSS],
})
export class PanelNotePage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly route = inject(ActivatedRoute);
  protected stageId = 0;
  private reg = 0;
  protected readonly n = signal<Narrative | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected text = '';

  ngOnInit(): void {
    this.stageId = Number(this.route.snapshot.paramMap.get('stageId'));
    this.reg = Number(this.route.snapshot.paramMap.get('reg'));
    this.api.narrative(this.stageId, this.reg).subscribe({ next: (x) => this.apply(x), error: (e) => this.error.set(errText(e)) });
  }

  private apply(x: Narrative): void {
    this.n.set(x);
    this.text = x.draftText;
  }

  private run(req: import('rxjs').Observable<Narrative>): void {
    this.busy.set(true);
    this.error.set('');
    req.subscribe({
      next: (x) => {
        this.busy.set(false);
        this.apply(x);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected save(): void {
    this.run(this.api.saveNarrative(this.stageId, this.reg, this.text));
  }

  protected approve(): void {
    this.busy.set(true);
    this.api.saveNarrative(this.stageId, this.reg, this.text).subscribe({
      next: () => {
        this.busy.set(false);
        this.run(this.api.approveNarrative(this.stageId, this.reg));
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errText(e));
      },
    });
  }

  protected resetToSystem(): void {
    const x = this.n();
    if (x && confirm('Replace your text with the system draft?')) this.text = x.systemDraft;
  }
}
