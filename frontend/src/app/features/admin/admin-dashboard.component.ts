import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';

interface Overview {
  Schools: number;
  ActiveSchools: number;
  Students: number;
  PublishedQuizzes: number;
  CompletedAttempts: number;
  InProgressAttempts: number;
}

@Component({
  selector: 'app-admin-dashboard',
  template: `
    <h1>Dashboard</h1>
    @if (data(); as d) {
      <div class="grid cols-3">
        <div class="card stat"><span class="num">{{ d.Schools }}</span><span class="label">Schools ({{ d.ActiveSchools }} active)</span></div>
        <div class="card stat"><span class="num">{{ d.Students }}</span><span class="label">Registered Students</span></div>
        <div class="card stat"><span class="num">{{ d.PublishedQuizzes }}</span><span class="label">Published Quizzes</span></div>
        <div class="card stat"><span class="num">{{ d.CompletedAttempts }}</span><span class="label">Completed Attempts</span></div>
        <div class="card stat"><span class="num">{{ d.InProgressAttempts }}</span><span class="label">In Progress</span></div>
      </div>
    } @else {
      <div class="loading">Loading…</div>
    }
  `,
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  data = signal<Overview | null>(null);

  ngOnInit() {
    this.api.get<Overview>('/reports/overview').subscribe((d) => this.data.set(d));
  }
}
