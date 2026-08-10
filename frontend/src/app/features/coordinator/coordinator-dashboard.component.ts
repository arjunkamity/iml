import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-coordinator-dashboard',
  imports: [RouterLink],
  template: `
    <h1>School Dashboard</h1>
    @if (school(); as s) {
      <div class="card">
        <div class="spread">
          <div>
            <h3>{{ s.Name }}</h3>
            <p class="muted">{{ s.City }}, {{ s.State }}</p>
          </div>
          <div class="stat" style="text-align:right;">
            <span class="num">{{ s.SchoolCode }}</span>
            <span class="label">School Code</span>
          </div>
        </div>
      </div>
    }
    <div class="grid cols-3" style="margin-top:1rem;">
      <div class="card stat"><span class="num">{{ studentCount() }}</span><span class="label">Registered Students</span></div>
      <a class="card stat" routerLink="../students"><span class="num">→</span><span class="label">Manage Students</span></a>
      <a class="card stat" routerLink="../results"><span class="num">→</span><span class="label">View Results</span></a>
    </div>
  `,
})
export class CoordinatorDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  school = signal<any | null>(null);
  studentCount = signal(0);

  ngOnInit() {
    const schoolId = this.auth.user()?.schoolId;
    if (schoolId) {
      this.api.get<any>(`/schools/${schoolId}`).subscribe((s) => this.school.set(s));
    }
    this.api.get<any[]>('/students').subscribe((r) => this.studentCount.set(r.length));
  }
}
