import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PanelApi, errText } from './panel-api.service';
import { PANEL_CSS } from './panel-ui';

@Component({
  selector: 'app-panel-notes',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pn-wrap">
      <a class="pn-back" routerLink="/panel">← Your stages</a>
      <h1 class="pn-h1">Observer notes — Stage {{ stage()?.position }}: {{ stage()?.name }}</h1>
      <p class="pn-sub">After a stage closes, write or edit the note that appears in each student's report, then approve it. The system suggests a first draft from the ratings and the notes panelists recorded; nothing is used in a report until you approve it.</p>
      @if (error()) { <div class="pn-err">{{ error() }}</div> }
      <div class="pn-list">
        @for (r of rows(); track r.registrationId) {
          <div class="pn-item">
            <div><b>{{ r.name }}</b><span class="pn-muted">{{ r.code }}{{ r.school ? ' · ' + r.school : '' }}</span></div>
            <div class="pn-row" style="margin:0">
              <span class="pn-pill" [class.go]="r.status === 'Approved'" [class.wait]="r.status !== 'Approved' && r.status !== 'Not started'">{{ r.status }}</span>
              <a class="pn-btn" [routerLink]="['/panel/stages', stageId, 'students', r.registrationId, 'note']">{{ r.status === 'Approved' ? 'View' : 'Write note' }}</a>
            </div>
          </div>
        } @empty {
          <p class="pn-muted">{{ loading() ? 'Loading…' : 'No students.' }}</p>
        }
      </div>
    </div>
  `,
  styles: [PANEL_CSS],
})
export class PanelNotesPage implements OnInit {
  private readonly api = inject(PanelApi);
  private readonly route = inject(ActivatedRoute);
  protected stageId = 0;
  protected readonly stage = signal<{ position: number; name: string } | null>(null);
  protected readonly rows = signal<{ registrationId: number; code: string; name: string; school: string | null; status: string }[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.stageId = Number(this.route.snapshot.paramMap.get('stageId'));
    this.api.notes(this.stageId).subscribe({
      next: (r) => {
        this.stage.set(r.stage);
        this.rows.set(r.rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errText(e));
        this.loading.set(false);
      },
    });
  }
}
