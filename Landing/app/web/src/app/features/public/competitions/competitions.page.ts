import { Component, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { formatDate, formatINR } from '../../account/format';

interface CompRow {
  code: string;
  title: string;
  status: string;
  grades: string;
  startDate: string;
  endDate: string;
  description: string | null;
  photoUrl: string | null;
  isFree: boolean;
  price: number;
}

@Component({
  selector: 'app-competitions',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section" id="competitions">
      <div class="container">
        <div class="hb-title"><span>Competitions</span></div>
        <p class="comps-lead">Every championship currently open for registration — pick one and secure your spot.</p>

        @if (loading()) {
          <p class="comps-empty">Loading competitions…</p>
        } @else if (rows().length === 0) {
          <p class="comps-empty">
            <span class="comps-empty-ic">🏁</span>
            No competitions are open for registration right now — check back soon.
          </p>
        } @else {
          <div class="comps-grid">
            @for (c of rows(); track c.code) {
              <article class="card hover comps-card">
                @if (c.photoUrl) {
                  <div class="comps-media"><img [src]="c.photoUrl" alt="" /></div>
                }
                <div class="comps-body">
                  <div class="comps-top">
                    <span class="comps-status" [class.live]="c.status === 'Live'" [class.open]="c.status === 'Open'">{{ c.status }}</span>
                    <span class="comps-fee">{{ c.isFree ? 'Free to enter' : formatINR(c.price) + ' entry fee' }}</span>
                  </div>
                  <h3 class="comps-title">{{ c.title }}</h3>
                  @if (c.description) {
                    <p class="comps-desc">{{ c.description }}</p>
                  }
                  <div class="comps-meta">
                    <span><b>Grades</b> {{ c.grades }}</span>
                    <span><b>Window</b> {{ formatDate(c.startDate) }} – {{ formatDate(c.endDate) }}</span>
                  </div>
                  <a class="btn btn-gold-solid btn-block" [routerLink]="['/register']" [queryParams]="{ comp: c.code }">
                    Register for {{ c.code }} →
                  </a>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .comps-lead { text-align: center; color: var(--muted); margin-top: -0.4rem; }
      .comps-empty { text-align: center; color: var(--muted); padding: 2.6rem 1rem; font-size: 1rem; line-height: 1.7; }
      .comps-empty-ic { display: block; font-size: 2.4rem; margin-bottom: 0.7rem; }
      .comps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.6rem; margin-top: 2.4rem; }
      .comps-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
      .comps-media { aspect-ratio: 16/9; overflow: hidden; }
      .comps-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .comps-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; flex: 1; }
      .comps-top { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
      .comps-status { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.25rem 0.6rem; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); }
      .comps-status.live { background: rgba(52, 211, 153, 0.14); border-color: rgba(52, 211, 153, 0.4); color: #34d399; }
      .comps-status.open { background: rgba(96, 165, 250, 0.14); border-color: rgba(96, 165, 250, 0.4); color: #60a5fa; }
      .comps-fee { font-size: 0.82rem; color: var(--muted); font-weight: 600; }
      .comps-title { font-family: var(--display); font-weight: 700; font-size: 1.25rem; line-height: 1.3; }
      .comps-desc { color: var(--muted); font-size: 0.92rem; line-height: 1.6; flex: 1; }
      .comps-meta { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--muted); }
      .comps-meta b { color: var(--text); font-weight: 600; margin-right: 0.35rem; }
    `,
  ],
})
export class CompetitionsPage {
  private readonly api = inject(ApiService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly formatINR = formatINR;
  protected readonly formatDate = formatDate;

  readonly rows = signal<CompRow[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.title.setTitle('Competitions — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'Browse every India Mind League championship currently open for registration and pick your competition.',
    });

    this.api.get<CompRow[]>('/public/competitions').subscribe({
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
}
