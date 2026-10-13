import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-coordinator-students',
  imports: [DatePipe],
  template: `
    <div class="section-title"><h1>Students</h1></div>
    <div class="card">
      @if (students().length) {
        <table class="table">
          <thead><tr><th>Name</th><th>Class</th><th>Phone</th><th>Parent</th><th>City</th><th>Registered</th></tr></thead>
          <tbody>
            @for (s of students(); track s.UserId) {
              <tr>
                <td>{{ s.FullName }}</td>
                <td>{{ s.Grade }}{{ s.Section ? '-' + s.Section : '' }}</td>
                <td>{{ s.Phone }}</td>
                <td class="muted">{{ s.ParentName }} · {{ s.ParentPhone }}</td>
                <td>{{ s.City }}</td>
                <td class="muted">{{ s.CreatedAt | date:'mediumDate' }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else { <div class="loading">No students registered yet.</div> }
    </div>
  `,
})
export class CoordinatorStudentsComponent implements OnInit {
  private api = inject(ApiService);
  students = signal<any[]>([]);
  ngOnInit() {
    this.api.get<any[]>('/students').subscribe((r) => this.students.set(r));
  }
}
