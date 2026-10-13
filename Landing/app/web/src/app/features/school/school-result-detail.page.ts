import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { SchoolDataService, SchoolResultDetail, SchoolResultQuestion } from './school-data.service';
import { ADMIN_UI_CSS } from '@admin/admin-ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

@Component({
  selector: 'app-school-result-detail',
  standalone: true,
  imports: [RouterLink, NgClass],
  template: `
    @if (loading()) {
      <div class="empty">Loading…</div>
    } @else if (detail(); as d) {
      <div class="rd-head">
        <div>
          <a routerLink="/schools/results" class="rd-back">← Results</a>
          <h2 style="margin:0.4rem 0 0.2rem;">{{ d.student }} <small style="color:var(--faint,#6e7f9e);font-weight:600;">({{ d.studentCode }})</small></h2>
          <p style="margin:0;color:var(--muted,#9fb0d0);">
            {{ d.competition }} &middot; {{ d.stage ?? 'Qualifier' }} &middot; Attempt {{ d.code }}
            &middot; {{ d.finishedAt ? when(d.finishedAt) : 'In progress' }}
          </p>
        </div>
        @if (d.certificateNumber) {
          <a class="btn btn-gold" [href]="certUrl(d.certificateNumber)" target="_blank" rel="noopener">Download Certificate (PDF)</a>
        }
      </div>

      <div class="grid g4-auto" style="margin:1.2rem 0 1.4rem;">
        <div class="card stat"><b>{{ d.percent }}%</b><small>Score</small></div>
        <div class="card stat"><b>{{ d.score }} / {{ d.total }}</b><small>Correct answers</small></div>
        <div class="card stat"><b>{{ d.passMark }}%</b><small>Pass mark</small></div>
        <div class="card stat">
          @if (d.qualified === true) {
            <span class="bdg green">Qualified</span>
          } @else if (d.qualified === false) {
            <span class="bdg red">Not qualified</span>
          } @else {
            <span class="bdg grey">—</span>
          }
        </div>
      </div>

      <h3 style="margin:0 0 0.7rem;">Question History</h3>
      <div style="display:grid;gap:0.8rem;">
        @for (q of d.questions; track $index; let i = $index) {
          @if (q.groupTitle && (i === 0 || d.questions[i - 1].groupCode !== q.groupCode)) {
            <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--gold-2,#f5cc5a);margin-top:0.4rem;">&#9638; Question group: {{ q.groupTitle }}</div>
          }
          <div class="card" [style.border-color]="q.isCorrect ? '' : 'rgba(251,113,133,0.35)'">
            <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.5rem;">
              <span class="bdg blue">{{ q.category }}</span>
              <span style="color:var(--faint,#6e7f9e);font-size:0.82rem;">Q{{ i + 1 }}</span>
              <span class="bdg" [ngClass]="q.isCorrect ? 'green' : 'red'" style="margin-left:auto;">
                {{ q.isCorrect ? 'Correct' : q.given.length ? 'Incorrect' : 'Not answered' }}
              </span>
            </div>
            <p style="font-weight:700;margin:0.4rem 0 0.7rem;">{{ q.prompt }}</p>
            <div style="display:grid;gap:0.4rem;">
              @for (opt of asOptions(q.options); track $index; let oi = $index) {
                <div
                  style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.7rem;border-radius:9px;border:1px solid var(--line,rgba(255,255,255,0.09));background:rgba(0,0,0,0.22);"
                  [style.border-color]="q.correct.includes(oi) ? 'rgba(52,211,153,0.5)' : q.given.includes(oi) ? 'rgba(251,113,133,0.5)' : ''"
                >
                  <span style="width:22px;height:22px;flex:0 0 auto;border-radius:6px;display:grid;place-items:center;font-weight:800;font-size:0.78rem;background:rgba(255,255,255,0.06);">{{ keyOf(oi) }}</span>
                  <span style="flex:1;font-size:0.9rem;">{{ opt }}</span>
                  @if (q.correct.includes(oi)) {
                    <span style="color:#34d399;font-weight:800;">✓</span>
                  } @else if (q.given.includes(oi)) {
                    <span style="color:#fb7185;font-weight:800;">✕</span>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="empty">Result not found.</div>
    }
  `,
  styles: [
    ADMIN_UI_CSS,
    `
      .rd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
      .rd-back { color: var(--gold-2, #f5cc5a); font-weight: 600; font-size: 0.85rem; }
      .stat { text-align: center; }
      .stat b { display: block; font-size: 1.3rem; font-weight: 800; }
      .stat small { color: var(--muted, #9fb0d0); font-size: 0.78rem; }
    `,
  ],
})
export class SchoolResultDetailPage implements OnInit {
  private readonly data = inject(SchoolDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly detail = signal<SchoolResultDetail | null>(null);
  protected readonly KEYS = KEYS;

  ngOnInit(): void {
    const code = String(this.route.snapshot.paramMap.get('code') ?? '');
    this.data.resultDetail(code).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.detail.set(null);
        this.loading.set(false);
      },
    });
  }

  protected asOptions(options: unknown): string[] {
    return Array.isArray(options) ? (options as string[]) : [];
  }

  protected keyOf(i: number): string {
    return KEYS[i] ?? `${i + 1}`;
  }

  protected when(iso: string): string {
    return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—';
  }

  /** Public, unauthenticated endpoint — same one the student/admin sides use. */
  protected certUrl(certificateNumber: string): string {
    return `/api/v1/public/certificates/${certificateNumber}/download`;
  }
}
