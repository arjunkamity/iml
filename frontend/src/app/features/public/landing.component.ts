import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

interface LeaderRow {
  Rnk: number | string;
  FullName: string;
  SchoolName: string;
  Score: number;
  AccuracyPct: number;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  template: `
    <div class="aurora">
      <!-- NAV -->
      <header class="nav">
        <div class="container nav-inner">
          <div class="brand"><span class="b1">INDIA</span><span class="b2">MIND</span><span class="b1">LEAGUE</span></div>
          <nav class="nav-links">
            <a href="#how">How it works</a>
            <a href="#why">Why join</a>
            <a routerLink="/login">Login</a>
            <a class="btn btn-primary btn-sm" routerLink="/register">Register</a>
          </nav>
        </div>
      </header>

      <!-- HERO -->
      <section class="hero">
        <div class="orb"></div>
        <div class="container hero-inner">
          <div class="eyebrow fade-up">Amity Group of Schools · Presents</div>
          <h1 class="hero-title fade-up d1">
            India <span class="gradient-text">Mind</span> League
          </h1>
          <p class="hero-sub fade-up d2">
            A flagship intellectual championship testing <b>IQ</b>, <b>EQ</b> and <b>core values</b> —
            moving students beyond marks toward thinking, leadership and real-world problem solving.
          </p>
          <div class="hero-cta fade-up d3">
            <a class="btn btn-primary" routerLink="/register">Register for the Qualifier →</a>
            <a class="btn btn-ghost" routerLink="/login">Participant / School Login</a>
          </div>
          <div class="trust fade-up d4">
            <span>● Delhi NCR &amp; beyond</span>
            <span>● Timed digital qualifier</span>
            <span>● Live leaderboard</span>
          </div>
        </div>
      </section>

      <!-- PILLARS -->
      <section class="container">
        <div class="grid cols-3 pillars">
          <div class="card hover"><div class="pill-ic">IQ</div><h3>Intelligence</h3><p>Logical reasoning, pattern-finding and structured problem solving.</p></div>
          <div class="card hover"><div class="pill-ic cyan">EQ</div><h3>Emotion</h3><p>Empathy, self-awareness and social judgement under pressure.</p></div>
          <div class="card hover"><div class="pill-ic pink">VAL</div><h3>Values</h3><p>Ethics, integrity and responsible decision-making.</p></div>
        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section class="section" id="how">
        <div class="container">
          <div class="center">
            <div class="eyebrow">The Journey</div>
            <h2>How it works</h2>
            <p class="lead">Three stages that carry the sharpest minds from screen to national stage.</p>
          </div>
          <div class="grid cols-3 steps">
            <div class="card hover step">
              <div class="step-no">01</div>
              <h3>Digital Qualifier</h3>
              <p>An online assessment measuring IQ, EQ and values — your entry into the league.</p>
            </div>
            <div class="card hover step">
              <div class="step-no">02</div>
              <h3>School Round</h3>
              <p>Top qualifiers compete in teams at their schools, building collaboration and critical thinking.</p>
            </div>
            <div class="card hover step">
              <div class="step-no">03</div>
              <h3>University Bootcamp</h3>
              <p>Finalists join an immersive leadership, mentorship and networking experience.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- WHY JOIN -->
      <section class="section why" id="why">
        <div class="container">
          <div class="center">
            <div class="eyebrow">The Reward</div>
            <h2>Reasons to join</h2>
          </div>
          <div class="grid cols-3">
            <div class="card hover">
              <div class="ic">🏆</div>
              <h3>National Exposure</h3>
              <p>Showcase your talent on a national platform alongside India's brightest peers.</p>
            </div>
            <div class="card hover">
              <div class="ic">🚀</div>
              <h3>Leadership Development</h3>
              <p>Gain the skills, mentorship and confidence to lead and inspire others.</p>
            </div>
            <div class="card hover">
              <div class="ic">⭐</div>
              <h3>Recognition</h3>
              <p>Earn certificates and be acknowledged for your exceptional abilities.</p>
            </div>
          </div>
        </div>
      </section>

      @if (leaders().length) {
        <section class="section">
          <div class="container">
            <div class="center"><div class="eyebrow">Real-time</div><h2>Live Leaderboard</h2></div>
            <div class="card lb">
              <table class="table">
                <thead><tr><th>Rank</th><th>Participant</th><th>School</th><th>Score</th><th>Accuracy</th></tr></thead>
                <tbody>
                  @for (r of leaders(); track r.Rnk) {
                    <tr>
                      <td><span class="rank">#{{ r.Rnk }}</span></td>
                      <td>{{ r.FullName }}</td>
                      <td class="muted">{{ r.SchoolName }}</td>
                      <td><b>{{ r.Score }}</b></td>
                      <td>{{ r.AccuracyPct }}%</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      }

      <!-- CTA -->
      <section class="container">
        <div class="cta card">
          <div class="cta-glow"></div>
          <h2>Ready to test your mind?</h2>
          <p class="lead">Secure your spot in the Digital Qualifier and unlock your potential.</p>
          <a class="btn btn-primary" routerLink="/register">Register now →</a>
        </div>
      </section>

      <footer class="footer">
        <div class="container spread footer-inner">
          <div class="brand"><span class="b1">INDIA</span><span class="b2">MIND</span><span class="b1">LEAGUE</span></div>
          <span class="faint">© {{ year }} Amity Group of Schools · India Mind League</span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .nav { position: sticky; top: 0; z-index: 20; background: rgba(7,6,19,.6); backdrop-filter: blur(16px); border-bottom: 1px solid var(--glass-border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; }
    .nav-links { display: flex; align-items: center; gap: 1.4rem; }
    .nav-links a { color: var(--muted); font-weight: 600; font-size: .92rem; }
    .nav-links a:hover { color: #fff; }
    @media (max-width: 640px) { .nav-links a:not(.btn) { display: none; } }

    .hero { position: relative; text-align: center; padding: 6rem 0 4rem; overflow: hidden; }
    .hero-inner { position: relative; z-index: 2; }
    .orb {
      position: absolute; top: -8rem; left: 50%; transform: translateX(-50%);
      width: 52rem; height: 52rem; border-radius: 50%; z-index: 0; pointer-events: none;
      background: radial-gradient(circle at 50% 45%, rgba(139,92,246,.4), rgba(34,211,238,.18) 35%, transparent 62%);
      filter: blur(30px); animation: pulseGlow 6s ease-in-out infinite;
    }
    .hero-title { font-size: clamp(2.8rem, 8vw, 5.5rem); font-weight: 800; margin: .6rem 0 1.2rem; }
    .hero-sub { max-width: 660px; margin: 0 auto; font-size: 1.15rem; color: var(--muted); }
    .hero-sub b { color: var(--text); }
    .hero-cta { display: flex; gap: .9rem; justify-content: center; margin: 2rem 0 1.4rem; flex-wrap: wrap; }
    .trust { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; color: var(--faint); font-size: .85rem; font-weight: 600; }
    .trust span { color: var(--muted); }

    .pillars { margin-top: 1rem; }
    .pill-ic { width: 3rem; height: 3rem; border-radius: 14px; display: grid; place-items: center; font-family: "Sora"; font-weight: 800; font-size: .9rem;
      background: rgba(139,92,246,.16); color: var(--violet-2); border: 1px solid rgba(139,92,246,.35); margin-bottom: .9rem; }
    .pill-ic.cyan { background: rgba(34,211,238,.14); color: var(--cyan); border-color: rgba(34,211,238,.35); }
    .pill-ic.pink { background: rgba(236,72,153,.14); color: var(--pink); border-color: rgba(236,72,153,.35); }

    .lead { max-width: 620px; margin: .5rem auto 0; }
    .steps, .why .grid { margin-top: 2rem; }
    .step { padding-top: 2.4rem; }
    .step-no { position: absolute; top: 1rem; right: 1.25rem; font-family: "Sora"; font-weight: 800; font-size: 2.4rem;
      background: var(--grad-brand); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; opacity: .85; }
    .ic { font-size: 1.8rem; margin-bottom: .6rem; }

    .lb { margin-top: 2rem; overflow-x: auto; }
    .rank { font-family: "Sora"; font-weight: 800; color: var(--violet-2); }

    .cta { text-align: center; padding: 3.5rem 1.5rem; overflow: hidden; }
    .cta-glow { position: absolute; inset: 0; z-index: -1; background: radial-gradient(40rem 20rem at 50% 0%, rgba(139,92,246,.22), transparent 70%); }
    .cta .btn { margin-top: 1.2rem; }

    .footer { border-top: 1px solid var(--glass-border); margin-top: 4rem; padding: 2rem 0; }
    .footer-inner { flex-wrap: wrap; gap: 1rem; }
  `],
})
export class LandingComponent implements OnInit {
  private api = inject(ApiService);
  leaders = signal<LeaderRow[]>([]);
  year = new Date().getFullYear();

  ngOnInit() {
    this.api.get<LeaderRow[]>('/leaderboard/2').subscribe({
      next: (r) => this.leaders.set(r ?? []),
      error: () => this.leaders.set([]),
    });
  }
}
