import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStage, PanelApi, errText } from './panel-api.service';
import { PANEL_CSS } from './panel-ui';

@Component({
  selector: 'app-panel-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pn-wrap">
      <h1 class="pn-h1">Your stages</h1>
      <p class="pn-sub">The competitions and stages you have been asked to rate.</p>
      @if (error()) { <div class="pn-err">{{ error() }}</div> }
      @if (loading()) {
        <p class="pn-muted">Loading…</p>
      } @else if (!stages().length) {
        <div class="pn-card"><p class="pn-muted" style="margin:0">You are not on a panel yet. You will see your stages here once an administrator adds you.</p></div>
      } @else {
        <div class="pn-grid">
          @for (s of stages(); track s.stageId) {
            <div class="pn-card">
              <span class="pn-pill" [class.go]="s.label === 'Rate now'" [class.wait]="s.label === 'Not open yet'" [class.done]="s.label === 'Closed'">{{ s.label }}</span>
              <h3 style="margin-top:0.6rem">{{ s.competitionTitle }}</h3>
              <div class="pn-muted">Stage {{ s.stage }}: {{ s.stageName }}</div>
              <div class="pn-bar"><i [style.width.%]="percent(s)"></i></div>
              <div class="pn-muted">{{ s.progress.rated }} of {{ s.progress.total }} rated@if (s.progress.drafts) { · {{ s.progress.drafts }} draft{{ s.progress.drafts === 1 ? '' : 's' }} }</div>
              <div class="pn-row" style="margin:0.9rem 0 0">
                @if (s.canRate) {
                  <a class="pn-btn gold" [routerLink]="['/panel/stages', s.stageId]">Assess now</a>
                } @else if (s.label === 'Closed') {
                  <a class="pn-btn" [routerLink]="['/panel/stages', s.stageId, 'notes']">Observer notes</a>
                } @else {
                  <span class="pn-muted">Opens when an administrator starts the stage.</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [PANEL_CSS],
})
export class PanelDashboardPage implements OnInit {
  private readonly api = inject(PanelApi);
  protected readonly stages = signal<DashboardStage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.api.dashboard().subscribe({
      next: (s) => {
        this.stages.set(s);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }

  protected percent(s: DashboardStage): number {
    return s.progress.total ? Math.round((s.progress.rated / s.progress.total) * 100) : 0;
  }
}
