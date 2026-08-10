import { Component } from '@angular/core';

@Component({
  selector: 'app-account-dashboard',
  standalone: true,
  template: `
    <section>
      <h1>Student Dashboard</h1>
      <p>Rank, points, streak, badges, qualifier progress (new design, replaces dashboard.html).</p>
    </section>
  `,
})
export class AccountDashboardPage {}
