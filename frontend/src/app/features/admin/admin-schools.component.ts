import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-admin-schools',
  imports: [FormsModule],
  template: `
    <div class="section-title"><h1>Schools</h1></div>

    <div class="grid cols-2">
      <div class="card">
        <h3>Onboard a school</h3>
        @if (error()) { <div class="alert error">{{ error() }}</div> }
        @if (created()) { <div class="alert ok">Created — School Code: <b>{{ created() }}</b></div> }
        <label>School Name</label>
        <input [(ngModel)]="name" />
        <div class="grid cols-2">
          <div><label>City</label><input [(ngModel)]="city" /></div>
          <div><label>State</label><input [(ngModel)]="state" /></div>
        </div>
        <h3 style="margin-top:1rem;">Coordinator login</h3>
        <label>Full Name</label><input [(ngModel)]="coordName" />
        <div class="grid cols-2">
          <div><label>Email</label><input type="email" [(ngModel)]="coordEmail" /></div>
          <div><label>Password</label><input type="password" [(ngModel)]="coordPassword" /></div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:1rem;" [disabled]="busy()" (click)="create()">
          {{ busy() ? 'Saving…' : 'Create school' }}
        </button>
      </div>

      <div class="card">
        <h3>Registered schools</h3>
        @if (schools().length) {
          <table class="table">
            <thead><tr><th>Code</th><th>Name</th><th>City</th><th>Students</th><th>Status</th></tr></thead>
            <tbody>
              @for (s of schools(); track s.SchoolId) {
                <tr>
                  <td><b>{{ s.SchoolCode }}</b></td>
                  <td>{{ s.Name }}</td>
                  <td class="muted">{{ s.City }}</td>
                  <td>{{ s.StudentCount }}</td>
                  <td><span class="badge green">{{ s.Status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        } @else { <div class="loading">No schools yet.</div> }
      </div>
    </div>
  `,
})
export class AdminSchoolsComponent implements OnInit {
  private api = inject(ApiService);
  schools = signal<any[]>([]);
  name = ''; city = ''; state = '';
  coordName = ''; coordEmail = ''; coordPassword = '';
  busy = signal(false);
  error = signal<string | null>(null);
  created = signal<string | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.api.get<any[]>('/schools').subscribe((r) => this.schools.set(r));
  }

  create() {
    this.error.set(null);
    this.created.set(null);
    this.busy.set(true);
    this.api.post<{ schoolCode: string }>('/schools', {
      name: this.name, city: this.city, state: this.state,
      coordinator: { fullName: this.coordName, email: this.coordEmail, password: this.coordPassword },
    }).subscribe({
      next: (r) => {
        this.created.set(r.schoolCode);
        this.busy.set(false);
        this.name = this.city = this.state = this.coordName = this.coordEmail = this.coordPassword = '';
        this.load();
      },
      error: (e) => { this.error.set(e?.error?.message ?? 'Failed'); this.busy.set(false); },
    });
  }
}
