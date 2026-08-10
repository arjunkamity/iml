import { Component, inject, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';

interface LbRow {
  rank: number;
  attemptCode: string;
  student: string;
  studentCode: string;
  grade: string;
  school: string | null;
  score: number;
  total: number;
  stage: string | null;
  finishedAt: string;
}

interface Comp {
  code: string;
  title: string;
  status: string;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [],
  template: `
    <section class="section" id="leaderboard">
      <div class="container">
        <div class="hb-title"><span>Leaderboard</span></div>
        <p class="lb-lead">Top thinkers, ranked by score. Will your name make the podium?</p>

        <div class="lb-tabs" role="tablist" aria-label="Leaderboard competition">
          <button type="button" class="lb-tab" [class.active]="comp() === ''" (click)="select('')">All</button>
          @for (c of comps(); track c.code) {
            <button type="button" class="lb-tab" [class.active]="comp() === c.code" (click)="select(c.code)">{{ c.code }}</button>
          }
        </div>

        <div class="lb2">
          <div class="lb2-card">
            @if (loading()) {
              <p class="lb-empty">Loading leaderboard…</p>
            } @else if (rows().length === 0) {
              <p class="lb-empty">
                <span class="lb-empty-ic">🏆</span>
                No attempts ranked yet — the leaderboard opens once the first qualifier results are in.
              </p>
            } @else {
              @let top = rows().slice(0, 3);
              @let rest = rows().slice(3);
              <div class="podium">
                @for (p of [top[1], top[0], top[2]]; track $index) {
                  @if (p) {
                    <div class="pod pod-{{ p.rank }}" [style.order]="p.rank === 2 ? 1 : p.rank === 3 ? 3 : 2">
                      <span class="crown">{{ p.rank === 1 ? '👑' : '' }}</span>
                      <span class="pod-av"><span>{{ initials(p.student) }}</span><span class="rankbadge">{{ p.rank }}</span></span>
                      <span class="pod-name">{{ p.student }}</span>
                      <span class="pod-score">{{ p.score }}</span>
                      <span class="pod-user">{{ p.grade }}{{ p.school ? ' · ' + p.school : '' }}</span>
                    </div>
                  }
                }
              </div>
              <div class="lb-list2">
                @for (r of rest; track r.attemptCode) {
                  <div class="lb-item">
                    <span class="lb-av"><span>{{ initials(r.student) }}</span></span>
                    <div class="lb-meta"><b>{{ r.rank }}. {{ r.student }}</b><span>{{ r.grade }}{{ r.school ? ' · ' + r.school : '' }}</span></div>
                    <div class="lb-end">{{ r.score }}/{{ r.total }}</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .lb-lead { text-align: center; color: var(--muted); margin-top: -0.4rem; }
      .lb-empty { text-align: center; color: var(--muted); padding: 2.6rem 1rem; font-size: 1rem; line-height: 1.7; }
      .lb-empty-ic { display: block; font-size: 2.4rem; margin-bottom: 0.7rem; }
    `,
  ],
})
export class LeaderboardPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<LbRow[]>([]);
  readonly comps = signal<Comp[]>([]);
  readonly comp = signal('');
  readonly loading = signal(true);

  constructor() {
    this.api.get<Comp[]>('/public/competitions').subscribe({
      next: (r) => this.comps.set(Array.isArray(r) ? r : []),
      error: () => this.comps.set([]),
    });
    this.load();
  }

  select(code: string) {
    this.comp.set(code);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<LbRow[]>('/public/leaderboard', this.comp() ? { comp: this.comp() } : {}).subscribe({
      next: (r) => {
        this.rows.set(Array.isArray(r) ? r : []);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
