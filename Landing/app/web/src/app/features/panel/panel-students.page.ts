import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PanelApi, PortalStudent, errText } from './panel-api.service';
import { PANEL_CSS } from './panel-ui';

@Component({
  selector: 'app-panel-students',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="pn-wrap">
      <a class="pn-back" routerLink="/panel">← Your stages</a>
      <h1 class="pn-h1">Stage {{ stage()?.position }}: {{ stage()?.name }}</h1>
      <p class="pn-sub">{{ total() }} student{{ total() === 1 ? '' : 's' }} to rate. Choose “Assess now” to open the rating form.</p>

      <div class="pn-row">
        <input class="grow" type="search" placeholder="Search name or code" [(ngModel)]="search" (ngModelChange)="load()" aria-label="Search" />
        <select [(ngModel)]="school" (ngModelChange)="load()" aria-label="School">
          <option value="">All schools</option>
          @for (s of schools(); track s) { <option [value]="s">{{ s }}</option> }
        </select>
        <select [(ngModel)]="status" (ngModelChange)="load()" aria-label="Status">
          <option value="">Any status</option>
          <option value="Not started">Not started</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
        </select>
      </div>

      @if (error()) { <div class="pn-err">{{ error() }}</div> }
      <div class="pn-list">
        @for (s of rows(); track s.registrationId) {
          <div class="pn-item">
            <div>
              <b>{{ s.name }}</b>
              <span class="pn-muted">{{ s.code }} · grade {{ s.grade }}{{ s.school ? ' · ' + s.school : '' }}</span>
            </div>
            <div class="pn-row" style="margin:0">
              <span class="pn-pill" [class.go]="s.status === 'Submitted'" [class.wait]="s.status === 'Draft'">{{ s.status }}</span>
              <a class="pn-btn" [class.gold]="s.status !== 'Submitted'" [routerLink]="['/panel/stages', stageId, 'students', s.registrationId]">{{ s.status === 'Submitted' ? 'View' : 'Assess now' }}</a>
            </div>
          </div>
        } @empty {
          <p class="pn-muted">{{ loading() ? 'Loading…' : 'No students match.' }}</p>
        }
      </div>
    </div>
  `,
  styles: [PANEL_CSS],
})
export class PanelStudentsPage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly route = inject(ActivatedRoute);
  protected stageId = 0;
  protected readonly stage = signal<{ position: number; name: string } | null>(null);
  protected readonly rows = signal<PortalStudent[]>([]);
  protected readonly schools = signal<string[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected search = '';
  protected school = '';
  protected status = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.stageId = Number(this.route.snapshot.paramMap.get('stageId'));
    this.fetch();
  }

  protected load(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fetch(), 250);
  }

  private fetch(): void {
    this.api.students(this.stageId, { search: this.search.trim(), school: this.school, status: this.status }).subscribe({
      next: (r) => {
        this.stage.set(r.stage);
        this.rows.set(r.rows);
        this.total.set(r.total);
        if (!this.schools().length) this.schools.set(r.schools);
        this.loading.set(false);
        this.error.set('');
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }
}
