import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

function errText(err: unknown): string {
  const e = err as { error?: { message?: string | string[] }; message?: string };
  const m = e?.error?.message;
  if (Array.isArray(m)) return m[0] ?? 'Something went wrong.';
  return m ?? e?.message ?? 'Something went wrong.';
}

// Landing page for an admin-generated school login link
// (https://…/schools/link/<token>) — signs the school straight in, same
// idea as the student ?sid=&token= link but its own page since schools
// sign in under /schools.
@Component({
  selector: 'app-school-link',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="bg-aurora"></div>
    <div class="bg-grid"></div>
    <main class="auth" style="grid-template-columns: 1fr; place-items: center;">
      <div class="auth-card" style="grid-template-columns: 1fr; max-width: 440px; text-align: center; padding: 2.5rem 2rem;">
        @if (!error()) {
          <p style="font-size:2rem;margin:0 0 0.6rem">🔑</p>
          <h1 class="af-title">Signing you in…</h1>
          <p class="af-lead">Opening your school portal.</p>
        } @else {
          <p style="font-size:2rem;margin:0 0 0.6rem">⚠️</p>
          <h1 class="af-title">Link unavailable</h1>
          <p class="af-lead">{{ error() }}</p>
          <a class="btn btn-gold-solid" routerLink="/schools/login" style="margin-top:1rem;display:inline-block">Log in normally →</a>
        }
      </div>
    </main>
  `,
})
export class SchoolLinkPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly error = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('This link is invalid.');
      return;
    }
    this.auth.consumeSchoolLink(token).subscribe({
      next: () => this.router.navigate(['/schools']),
      error: (e) => this.error.set(errText(e)),
    });
  }
}
