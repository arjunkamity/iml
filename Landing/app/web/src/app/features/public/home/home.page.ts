import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  template: `
    <!-- HERO -->
    <section class="hero-slider" id="top">
      <div class="hs-row">
        <div class="hs-info up">
          <div class="hero-banner"><img src="img/banner_groups_01.png" alt="India Mind League champions" /></div>
        </div>
        <div class="hs-copy hero-copy">
          <p class="hero-kicker up d1">India's Flagship</p>
          <h1 class="hero-h1 up d2"><span class="gold">Intellectual</span> Championship</h1>
          <span class="hero-rule up d2"></span>
          <p class="hero-tag up d3">Intention &nbsp;·&nbsp; Focus &nbsp;·&nbsp; Wisdom</p>
          <p class="hero-sub up d3">4 Stages. 1 Ultimate Goal.<br /><span class="gold">Limitless Possibilities.</span></p>
          <div class="hs-cta up d4">
            <a class="btn btn-gold-solid btn-lg" routerLink="/register">Register Now →</a>
            <a class="btn btn-ghost btn-lg" routerLink="/" [fragment]="'how'">Know More →</a>
          </div>
        </div>
      </div>
      <div class="hs-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 130" preserveAspectRatio="none">
          <defs>
            <linearGradient id="iml-wave-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#2563eb"/>
              <stop offset="0.5" stop-color="#7c3aed"/>
              <stop offset="1" stop-color="#ec4899"/>
            </linearGradient>
          </defs>
          <path class="w-l1" d="M0,44 C360,88 880,18 1440,48 L1440,130 L0,130 Z"/>
          <path class="w-l2" d="M0,62 C420,20 900,80 1440,34 L1440,130 L0,130 Z"/>
          <path class="w-l3" d="M0,54 C520,98 1000,32 1440,60 L1440,130 L0,130 Z"/>
          <path class="w-fill" d="M0,74 C440,118 940,26 1440,62 L1440,130 L0,130 Z"/>
          <path class="w-edge" d="M0,74 C440,118 940,26 1440,62"/>
        </svg>
      </div>
      <a class="hs-scroll" routerLink="/" [fragment]="'how'">Scroll ↓</a>
    </section>

    <!-- MOBILE HERO -->
    <section class="mobile-hero">
      <span class="mh-eyebrow">India's Flagship</span>
      <h1 class="mh-title"><span class="gold">Intellectual</span> Championship</h1>
      <span class="hero-rule mh-rule"></span>
      <p class="mh-tag">Intention · Focus · Wisdom</p>
      <p class="mh-sub">4 Stages. 1 Ultimate Goal. <span class="gold">Limitless Possibilities.</span></p>
      <div class="mh-cta">
        <a class="btn btn-gold-solid" routerLink="/register">Register Now →</a>
        <a class="btn btn-ghost" routerLink="/" [fragment]="'how'">Know More →</a>
      </div>
      <div class="mh-banner"><img src="img/banner_groups_01.png" alt="India Mind League champions" /></div>
    </section>

    <!-- ABOUT -->
    <section class="section" id="about">
      <div class="container about-wrap">
        <div class="about-left" reveal>
          <span class="eyebrow">Where India Thinks Forward</span>
          <h2 class="about-h">The future will not belong to those who <span class="gold">know more</span>. It will belong to those who <span class="gold">think better</span>.</h2>
          <span class="about-rule"></span>
        </div>
        <div class="about-right" reveal>
          <p class="about-p">We are living in an age where information is available instantly. Artificial Intelligence can answer questions, solve equations and process vast amounts of data within seconds. Yet the world continues to face challenges that cannot be solved by information alone. The future will belong to those who can think critically, make wise decisions, lead with empathy and act with integrity.</p>
          <p class="about-p"><b>India Mind League (IML)</b> is India's first <b>Holistic Intelligence Championship</b> — designed to discover and nurture young minds who possess not only knowledge but also emotional intelligence, leadership ability, ethical judgment and real-world problem-solving skills. It is more than a competition; it is a national movement to identify the thinkers, innovators and future leaders who will shape tomorrow's India.</p>
        </div>
      </div>
    </section>

    <!-- VISIONARY -->
    <section class="section" id="visionary">
      <div class="container vis-grid">
        <div class="vis-photo" reveal>
          <img src="img/Dr-MS-Chauhan.jpg" alt="Dr. (Mrs.) Amita Chauhan" />
        </div>
        <div class="vis-body" reveal>
          <span class="eyebrow">Message from the Visionary</span>
          <h2>Dr. (Mrs.) Amita Chauhan</h2>
          <p class="vis-role">Chairperson, Amity Group of Schools</p>
          <p class="vis-quote">"In an AI-driven world, education must nurture both intellect and values — minds that think, feel and lead."</p>
          <p class="vis-intro">India Mind League is envisioned as a new-age championship for today's AI-driven world — developing <b>Emotional Intelligence (EQ)</b>, <b>Spiritual Intelligence (SQ)</b> and core values in students.</p>
          <button type="button" class="btn btn-primary btn-lg" style="margin-top:0.4rem;" (click)="visionaryOpen.set(true)">Read Full Message →</button>
        </div>
      </div>
    </section>

    <!-- PILLARS -->
    <section class="section" id="pillars">
      <div class="container">
        <div class="hb-title"><span>A League That Builds</span></div>
        <div class="pillars">
          <div class="pillar" reveal>
            <div class="pl-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg></div>
            <div class="pl-txt"><h3>IQ</h3><span class="pl-sub">Knowledge</span><p>Test Your Knowledge. Prove Your Potential.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg></div>
            <div class="pl-txt"><h3>EQ</h3><span class="pl-sub">Emotional Intelligence</span><p>Understand. Empathize. Lead with Heart.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <div class="pl-txt"><h3>LQ</h3><span class="pl-sub">Leadership</span><p>Collaborate. Communicate. Create Impact.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>
            <div class="pl-txt"><h3>Life Skills</h3><span class="pl-sub">&amp; More</span><p>Think Critically. Solve Real-World Challenges.</p></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4 STAGES -->
    <section class="section" id="how">
      <div class="container">
        <div class="hb-title"><span>4 Stage Selection Process</span></div>
        <div class="stages">
          <div class="stage" reveal>
            <div class="st-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
            <span class="st-label st-1">Stage 1</span>
            <h3>Online Challenge</h3>
            <p>Online assessment with a digital participation certificate. Top 200 shortlisted.</p>
          </div>
          <div class="st-arrow a1"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" reveal>
            <div class="st-ring c-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <span class="st-label st-2">Stage 2</span>
            <h3>Zoom Showdown</h3>
            <p>Live quiz, critical thinking &amp; leadership challenges. Top 60 selected.</p>
          </div>
          <div class="st-arrow a2"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" reveal>
            <div class="st-ring c-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
            <span class="st-label st-3">Stage 3</span>
            <h3>Amity Leadership Bootcamp</h3>
            <p>Certified expert training in IQ, EQ, SQ &amp; LQ, AI &amp; future skills, and public speaking.</p>
          </div>
          <div class="st-arrow a3"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" reveal>
            <div class="st-ring c-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg></div>
            <span class="st-label st-4">Stage 4</span>
            <h3>Amity YouTube Grand Show</h3>
            <p>4 groups of 15 — top 3 from each qualify. 12 Grand Finalists, one champion.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- STATS BAR -->
    <section class="stats-bar">
      <div class="container">
        <div class="sb-grid">
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 18 0M5 21V9l7-5 7 5v12"/><path d="M9 21v-5h6v5M9 12h.01M15 12h.01"/></svg></span><div class="sb-tx"><b>1000+</b><small>Schools</small></div></div>
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="sb-tx"><b>1 Lakh+</b><small>Participants</small></div></div>
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></span><div class="sb-tx"><b>1</b><small>Champion</small></div></div>
        </div>
      </div>
    </section>

    <!-- WHO / WHY / WATCH -->
    <section class="section" id="rewards">
      <div class="container">
        <div class="i3-grid">
          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Who Can Participate?</h3>
            <p class="i3-p">Curious, ambitious and creative students ready to challenge themselves:</p>
            <ul class="i3-list" style="margin-top:0;">
              <li><i>✓</i> Students of <b>&nbsp;Classes 9 to 12</b></li>
              <li><i>✓</i> Recognized schools across Delhi NCR</li>
              <li><i>✓</i> Individual or school-nominated</li>
              <li><i>✓</i> Young leaders, innovators &amp; thinkers</li>
            </ul>
            <a class="btn-gold" routerLink="/register">Eligibility Details →</a>
            <img class="i3-photo" src="img/cta-5-1.png" alt="Students" loading="lazy" />
          </div>
          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Why Join IML?</h3>
            <ul class="i3-list">
              <li><i>✓</i> Enhance Knowledge &amp; Skills</li>
              <li><i>✓</i> National Level Exposure</li>
              <li><i>✓</i> Exciting Rewards &amp; Recognition</li>
              <li><i>✓</i> Build Lifelong Connections</li>
            </ul>
            <a class="btn-gold" routerLink="/" [fragment]="'pillars'">Explore More →</a>
          </div>
          <div class="i3-card i3-watch" reveal>
            <video class="i3-vid" autoplay muted loop playsinline preload="none"><source src="videos/school_campus.mp4" type="video/mp4"></video>
            <span class="i3-play"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
            <span class="i3-cap">Watch IML in Action</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA BANNER -->
    <section class="section cta-banner-sec">
      <div class="container">
        <div class="cta-banner" reveal>
          <div class="cta-text">
            <p class="cta-small">Think. Collaborate. Rise. Shine.</p>
            <h2 class="cta-big">The Future Leaders <span class="gold">Start Here!</span></h2>
          </div>
          <div class="cta-right">
            <a class="btn-gold-lg" routerLink="/register">Register Now →</a>
            <span class="cta-note">Are you ready to rule your mind?</span>
          </div>
        </div>
      </div>
    </section>

    <!-- VISIONARY MODAL -->
    @if (visionaryOpen()) {
      <div class="modal" style="display:block">
        <div class="modal-backdrop" (click)="visionaryOpen.set(false)"></div>
        <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Message from the Visionary">
          <button class="modal-close" (click)="visionaryOpen.set(false)" aria-label="Close">&times;</button>
          <div class="vm-head">
            <div class="vm-photo">
              <div class="hs-frame" style="width:104px;animation:none"><div class="inner" style="border-radius:50%">
                <img src="img/Dr-MS-Chauhan.jpg" alt="Dr. (Mrs.) Amita Chauhan" />
              </div></div>
            </div>
            <div>
              <span class="eyebrow">Meet the Visionary</span>
              <h2 style="margin:.2rem 0;">Dr. (Mrs.) Amita Chauhan</h2>
              <p class="vm-role">Chairperson, Amity Group of Schools</p>
            </div>
          </div>
          <div class="vm-text">
            <p>Under the visionary guidance of <b>Dr. (Mrs.) Amita Chauhan</b>, Chairperson, Amity Group of Schools.</p>
            <p><b>India Mind League</b> is envisioned as a new-age championship aligned with today's AI-driven world.</p>
            <p>While AI can process knowledge, it cannot feel or make value-based decisions.</p>
            <p>With the belief that education must nurture both intellect and values, this initiative focuses on developing <b>Emotional Intelligence (EQ)</b> and <b>Spiritual Intelligence (SQ)</b> in students.</p>
          </div>
          <div class="vm-cta"><a class="btn btn-primary btn-lg" routerLink="/register" (click)="visionaryOpen.set(false)">Be part of it →</a></div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .modal { position: fixed; inset: 0; z-index: 200; }
      .modal-backdrop { position: absolute; inset: 0; background: rgba(4, 4, 12, 0.86); animation: fadeUp 0.3s; }
      .modal-panel {
        position: relative; width: min(780px, 92vw); margin: 6vh auto; max-height: 88vh; overflow-y: auto;
        background: linear-gradient(180deg, rgba(28, 26, 58, 0.98), rgba(11, 10, 29, 0.99));
        border: 1px solid var(--line-2); border-radius: 24px; padding: clamp(1.5rem, 4vw, 2.6rem);
        box-shadow: var(--shadow); animation: modalIn 0.38s cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      @keyframes modalIn { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: none; } }
      .modal-close {
        position: absolute; top: 0.9rem; right: 0.9rem; width: 42px; height: 42px; border-radius: 50%;
        border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.06); color: #fff;
        font-size: 1.6rem; line-height: 1; cursor: pointer; display: grid; place-items: center; transition: 0.25s;
      }
      .modal-close:hover { background: rgba(248, 113, 133, 0.3); transform: rotate(90deg); }
      .vm-head { display: flex; gap: 1.2rem; align-items: center; margin-bottom: 1.4rem; flex-wrap: wrap; }
      .vm-photo .hs-frame { width: 104px; animation: none; }
      .vm-role { color: var(--violet-2); font-family: var(--display); font-weight: 600; }
      .vm-text p { color: var(--muted); line-height: 1.75; margin-bottom: 1rem; }
      .vm-text b { color: var(--text); }
      .vm-cta { margin-top: 0.4rem; }
    `,
  ],
})
export class HomePage {
  readonly visionaryOpen = signal(false);
}
