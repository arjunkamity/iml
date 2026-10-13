import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { RevealDirective } from '../reveal.directive';

interface GalleryItem {
  code: string;
  name: string;
  date: string | null;
  cover: string | null;
  description: string | null;
}

interface NewsItem {
  code: string;
  title: string;
  category: string | null;
  author: string | null;
  publishOn: string | null;
  photo: string | null;
  summary: string | null;
}

interface AnnouncementItem {
  code: string;
  title: string;
  category: string | null;
  audience: string | null;
  publishOn: string | null;
  pinned: boolean;
  message: string | null;
}

interface DemoQuestion {
  q: string;
  options: string[];
  answer: string;
}

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    q: 'A teammate takes credit for your idea in front of the class. What shows the strongest leadership?',
    options: ['Call them out publicly', 'Talk to them privately and refocus on the team goal', 'Say nothing and feel resentful', 'Complain to others about it'],
    answer: 'Talk to them privately and refocus on the team goal',
  },
  {
    q: 'Which skill can Artificial Intelligence NOT fully replace?',
    options: ['Basic arithmetic', 'Ethical, values-based decision-making', 'Storing large data', 'Searching the web'],
    answer: 'Ethical, values-based decision-making',
  },
  {
    q: 'Your group project is behind schedule two days before the deadline. What is the wisest first step?',
    options: ['Panic and work alone', 'Blame a teammate', 'Re-plan the remaining tasks together and reprioritise', 'Ignore it and hope it works out'],
    answer: 'Re-plan the remaining tasks together and reprioritise',
  },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, RevealDirective, DatePipe],
  template: `
    <!-- HERO -->
    <section class="hero-slider" id="top">
      <div class="hs-row">
        <div class="hs-copy hero-copy">
          <img class="hero-amity-logo up d1" src="img/amity-group-logo.png" alt="Amity Group of Schools" />
          <p class="hero-presents up d1">Presents</p>
          <img class="hero-iml-logo up d1" src="img/iml-logo-gold.png" alt="India Mind League" />
          <h1 class="hero-h1 up d2">Where <span class="gold">Knowledge</span> Meets <span class="gold">Leadership</span>.</h1>
          <div class="hero-iq-grid up d3" aria-label="The four intelligences we assess">
            <div class="hiq">
              <img class="hiq-ic" src="img/icon-iq.png" alt="" />
              <b>IQ</b><em class="hiq-label">Intellectual Intelligence</em><small>Think Beyond<br />The Ordinary</small>
            </div>
            <div class="hiq">
              <img class="hiq-ic" src="img/icon-eq.png" alt="" />
              <b>EQ</b><em class="hiq-label">Emotional Intelligence</em><small>Feel Deeply<br />Lead with Heart</small>
            </div>
            <div class="hiq">
              <img class="hiq-ic" src="img/icon-sq.png" alt="" />
              <b>SQ</b><em class="hiq-label">Spiritual Social Intelligence</em><small>Live Your Values<br />Find Your Purpose</small>
            </div>
            <div class="hiq">
              <img class="hiq-ic" src="img/icon-lq.png" alt="" />
              <b>LQ</b><em class="hiq-label">Leadership Intelligence</em><small>Inspire Others<br />Create Impact</small>
            </div>
          </div>
        </div>
        <div class="hs-info up">
          <div class="hero-banner"><img src="img/hero-students.png" alt="India Mind League students" /></div>
          <div class="hs-caption">
            <p class="hs-tagline up d3"><span class="gold">India's Largest School</span><br /><span class="hs-tagline-sub">Intellectual &amp; Leadership Championship</span></p>
            <div class="hs-cta up d4">
              <a class="btn btn-gold-solid btn-lg" routerLink="/register">Register Now →</a>
              <a class="btn btn-ghost btn-lg" routerLink="/" [fragment]="'how'">Know More →</a>
            </div>
          </div>
        </div>
      </div>
      <a class="hs-scroll" routerLink="/" [fragment]="'how'">Scroll ↓</a>
    </section>

    <!-- MOBILE HERO -->
    <section class="mobile-hero">
      <img class="hero-amity-logo mh-amity-logo" src="img/amity-group-logo.png" alt="Amity Group of Schools" />
      <span class="mh-presents">Presents</span>
      <img class="hero-iml-logo mh-iml-logo" src="img/iml-logo-gold.png" alt="India Mind League" />
      <span class="hero-kicker-box mh-kicker-box">India's Largest School Championship</span>
      <h1 class="mh-title">Where <span class="gold">Knowledge</span> Meets <span class="gold">Leadership</span>.</h1>
      <div class="hero-iq-grid mh-iq-grid" aria-label="The four intelligences we assess">
        <div class="hiq">
          <img class="hiq-ic" src="img/icon-iq.png" alt="" />
          <b>IQ</b><em class="hiq-label">Intellectual Intelligence</em><small>Think Beyond<br />The Ordinary</small>
        </div>
        <div class="hiq">
          <img class="hiq-ic" src="img/icon-eq.png" alt="" />
          <b>EQ</b><em class="hiq-label">Emotional Intelligence</em><small>Feel Deeply<br />Lead with Heart</small>
        </div>
        <div class="hiq">
          <img class="hiq-ic" src="img/icon-sq.png" alt="" />
          <b>SQ</b><em class="hiq-label">Spiritual Social Intelligence</em><small>Live Your Values<br />Find Your Purpose</small>
        </div>
        <div class="hiq">
          <img class="hiq-ic" src="img/icon-lq.png" alt="" />
          <b>LQ</b><em class="hiq-label">Leadership Intelligence</em><small>Inspire Others<br />Create Impact</small>
        </div>
      </div>
      <div class="mh-banner"><img src="img/hero-students.png" alt="India Mind League students" /></div>
    </section>

    <!-- REGISTRATION COUNTDOWN -->
    <section class="countdown-strip" id="countdown" reveal>
      <div class="container cd-row">
        <span class="cd-label">⏳ Stage 1 registrations close in</span>
        <div class="cd-timer">
          <div class="cd-part"><b>{{ countdown().days }}</b><small>Days</small></div>
          <div class="cd-part"><b>{{ countdown().hours }}</b><small>Hrs</small></div>
          <div class="cd-part"><b>{{ countdown().minutes }}</b><small>Min</small></div>
          <div class="cd-part"><b>{{ countdown().seconds }}</b><small>Sec</small></div>
        </div>
        <a class="btn btn-gold-solid btn-sm" routerLink="/register">Secure Your Spot →</a>
      </div>
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
          <img src="img/Dr-MS-Chauhan.jpg" alt="Dr. (Mrs.) Amita Chauhan" loading="lazy" />
        </div>
        <div class="vis-body" reveal>
          <span class="eyebrow">Message from the Visionary</span>
          <h2>Dr. (Mrs.) Amita Chauhan</h2>
          <p class="vis-role">Chairperson, Amity Group of Schools</p>
          <p class="vis-quote">"In an AI-driven world, education must go beyond imparting knowledge. It must nurture young minds that can think critically, feel deeply, lead ethically, and create a positive impact on society."</p>
          <p class="vis-intro">India Mind League integrates <b>Intellectual (IQ)</b>, <b>Emotional (EQ)</b>, <b>Spiritual/Social (SQ)</b> and <b>Leadership (LQ)</b> Intelligence to prepare students to think wisely, adapt courageously and lead responsibly.</p>
          <button type="button" class="btn btn-primary btn-lg" style="margin-top:0.4rem;" (click)="visionaryOpen.set(true)">Read Vision →</button>
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
            <div class="pl-txt"><h3>IQ</h3><span class="pl-sub">Intellectual Intelligence</span><p>Test Your Knowledge. Prove Your Potential.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-pink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg></div>
            <div class="pl-txt"><h3>EQ</h3><span class="pl-sub">Emotional Intelligence</span><p>Understand. Empathize. Lead with Heart.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <div class="pl-txt"><h3>LQ</h3><span class="pl-sub">Leadership Intelligence</span><p>Collaborate. Communicate. Create Impact.</p></div>
          </div>
          <div class="pillar" reveal>
            <div class="pl-ring c-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4-2-6-6-6-9a6 6 0 0 1 6-6 6 6 0 0 1 6 6c0 3-2 7-6 9Z"/><path d="M12 13a5 5 0 0 1-5-5 5 5 0 0 1 5 5Z"/><path d="M12 13a5 5 0 0 0 5-5 5 5 0 0 0-5 5Z"/></svg></div>
            <div class="pl-txt"><h3>SQ</h3><span class="pl-sub">Spiritual / Social Intelligence</span><p>Empathize. Connect. Act with Integrity.</p></div>
          </div>
        </div>
        <p class="pillars-note">Life Skills — critical thinking, adaptability &amp; real-world problem-solving — is the outcome every pillar builds toward.</p>
      </div>
    </section>

    <!-- WHY IML -->
    <section class="section" id="why">
      <div class="container">
        <div class="hb-title"><span>Why India Mind League</span></div>
        <p class="lead">Not just another quiz — a future-readiness platform preparing students to lead in the age of AI.</p>
        <div class="why-grid">
          <div class="why-card" reveal>
            <span class="why-ic">🏆</span>
            <h3>Recognition</h3>
            <p>Earn recognition as one of India's emerging young thinkers and leaders through a prestigious championship.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🤖</span>
            <h3>AI Era Readiness</h3>
            <p>Critical thinking, creativity and emotional intelligence — the human skills AI cannot replace.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🎯</span>
            <h3>Leadership Development</h3>
            <p>Experiential challenges, team activities and decision-making simulations that build confidence.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🧑‍🏫</span>
            <h3>Expert Mentorship</h3>
            <p>Learn directly from educators, industry leaders, psychologists and innovation specialists.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">📈</span>
            <h3>Comprehensive Performance Report</h3>
            <p>A personalised competency report across IQ, EQ, SQ, LQ, creativity, communication and more.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🎓</span>
            <h3>Scholarships &amp; Special Opportunities</h3>
            <p>Outstanding performers may earn scholarships, internships, ambassador roles and advanced leadership programmes.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">📣</span>
            <h3>National Platform &amp; Visibility</h3>
            <p>Top performers gain live championship rounds, national showcases and recognition among leading schools and experts.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🏅</span>
            <h3>Certificates &amp; Awards</h3>
            <p>Every participant is certified; top performers earn medals, trophies and national rankings.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🚀</span>
            <h3>Future-Ready Learning Experience</h3>
            <p>Leadership bootcamps, AI-enabled learning and innovation challenges beyond traditional exams.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🤝</span>
            <h3>Build a Powerful Network</h3>
            <p>Connect with talented students, inspiring mentors and future innovators — building friendships and lifelong opportunities.</p>
          </div>
          <div class="why-card" reveal>
            <span class="why-ic">🧭</span>
            <h3>Discover Your True Potential</h3>
            <p>Understand not just what you know, but how you think, lead, collaborate and grow.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4 STAGES -->
    <section class="section" id="how">
      <div class="container">
        <div class="hb-title"><span>4 Stage Selection Process</span></div>
        <div class="stages">
          <div class="stage" [class.expanded]="expandedStage() === 1" reveal>
            <div class="st-ring c-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
            <span class="st-label st-1">Stage 1</span>
            <h3 (click)="toggleStage(1)">Online Challenge</h3>
            <p>Online assessment — every participant earns a digital Participation Certificate. Top 200 shortlisted.</p>
            <span class="st-fee">₹500 · Online Registration</span>
          </div>
          <div class="st-arrow a1"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" [class.expanded]="expandedStage() === 2" reveal>
            <div class="st-ring c-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <span class="st-label st-2">Stage 2</span>
            <h3 (click)="toggleStage(2)">Zoom Showdown</h3>
            <p>Live quiz, critical thinking &amp; leadership challenges. Top 60 selected.</p>
          </div>
          <div class="st-arrow a2"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" [class.expanded]="expandedStage() === 3" reveal>
            <div class="st-ring c-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
            <span class="st-label st-3">Stage 3</span>
            <h3 (click)="toggleStage(3)">Amity Leadership Bootcamp</h3>
            <p>Certified expert training in IQ, EQ, SQ &amp; LQ, AI &amp; future skills and public speaking — includes your personalised Future Readiness Report.</p>
            <span class="st-fee">₹3,500 · Bootcamp Fee</span>
          </div>
          <div class="st-arrow a3"><svg viewBox="0 0 46 22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h38m-9-8 9 8-9 8"/></svg></div>
          <div class="stage" [class.expanded]="expandedStage() === 4" reveal>
            <div class="st-ring c-gold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg></div>
            <span class="st-label st-4">Stage 4</span>
            <h3 (click)="toggleStage(4)">Amity YouTube Grand Show</h3>
            <p>4 groups of 15 — top 3 from each qualify. 12 Grand Finalists, one champion.</p>
          </div>
        </div>
        <p class="stages-hint">Tap a stage to expand ↑</p>
      </div>
    </section>

    <!-- STATS BAR -->
    <section class="stats-bar">
      <div class="container">
        <div class="sb-grid">
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="sb-tx"><b>5000+</b><small>Participants</small></div></div>
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><div class="sb-tx"><b>4-Stage</b><small>Championship</small></div></div>
          <div class="sb-item"><span class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></span><div class="sb-tx"><b>1</b><small>Winner</small></div></div>
        </div>
      </div>
    </section>

    <!-- REWARDS TEASER -->
    <section class="section rw-teaser-sec">
      <div class="container">
        <div class="rw-teaser" reveal>
          <div class="rw-teaser-copy">
            <span class="eyebrow">Celebrate Excellence</span>
            <h2>₹1,00,000 Cash Prize Pool</h2>
            <p class="lead" style="margin-left:0;">Digital certificates for every participant, and Stage 3 qualifiers unlock a personalised Future Readiness Report with full Bootcamp &amp; mentor-session benefits.</p>
          </div>
          <a class="btn btn-gold-solid btn-lg" routerLink="/rewards">See Full Rewards →</a>
        </div>
      </div>
    </section>

    <!-- WHO / WHY / WATCH -->
    <section class="section" id="join">
      <div class="container">
        <div class="i3-grid">
          <div class="i3-card" reveal>
            <h3 class="i3-h gold">{{ siteSettings.settings().participateTitle }}</h3>
            <p class="i3-p">{{ siteSettings.settings().participateIntro }}</p>
            <ul class="i3-list" style="margin-top:0;">
              @for (item of bullets(siteSettings.settings().participateBullets); track item) {
                <li><i>✓</i> {{ item }}</li>
              }
            </ul>
            @if (isInternalLink(siteSettings.settings().participateBtnLink)) {
              <a class="btn-gold" [routerLink]="linkPath(siteSettings.settings().participateBtnLink)" [fragment]="linkFragment(siteSettings.settings().participateBtnLink)">{{ siteSettings.settings().participateBtnText }}</a>
            } @else {
              <a class="btn-gold" [href]="siteSettings.settings().participateBtnLink" target="_blank" rel="noopener">{{ siteSettings.settings().participateBtnText }}</a>
            }
            <img class="i3-photo" [src]="siteSettings.settings().participatePhotoUrl" alt="Students" loading="lazy" />
          </div>
          <div class="i3-card" reveal>
            <h3 class="i3-h gold">{{ siteSettings.settings().whyJoinTitle }}</h3>
            <ul class="i3-list">
              @for (item of bullets(siteSettings.settings().whyJoinBullets); track item) {
                <li><i>✓</i> {{ item }}</li>
              }
            </ul>
            @if (isInternalLink(siteSettings.settings().whyJoinBtnLink)) {
              <a class="btn-gold" [routerLink]="linkPath(siteSettings.settings().whyJoinBtnLink)" [fragment]="linkFragment(siteSettings.settings().whyJoinBtnLink)">{{ siteSettings.settings().whyJoinBtnText }}</a>
            } @else {
              <a class="btn-gold" [href]="siteSettings.settings().whyJoinBtnLink" target="_blank" rel="noopener">{{ siteSettings.settings().whyJoinBtnText }}</a>
            }
          </div>
          <div class="i3-card i3-watch" reveal>
            <video class="i3-vid" autoplay muted loop playsinline preload="none"><source [src]="siteSettings.settings().videoUrl" type="video/mp4"></video>
            <span class="i3-play"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
            <span class="i3-cap">{{ siteSettings.settings().videoCaption }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- MENTORS -->
    <section class="section" id="mentors">
      <div class="container">
        <div class="hb-title"><span>Learn From Our Mentors</span></div>
        <p class="lead">Stage 3 Bootcamp qualifiers train directly with experts across every field of future readiness.</p>
        <div class="mentor-grid">
          <div class="mentor-card" reveal><span class="mentor-ic">🎓</span><span>Renowned Educators</span></div>
          <div class="mentor-card" reveal><span class="mentor-ic">💼</span><span>Industry Leaders</span></div>
          <div class="mentor-card" reveal><span class="mentor-ic">🚀</span><span>Entrepreneurs</span></div>
          <div class="mentor-card" reveal><span class="mentor-ic">🧭</span><span>Leadership Coaches</span></div>
          <div class="mentor-card" reveal><span class="mentor-ic">🧠</span><span>Psychologists &amp; Well-being Experts</span></div>
          <div class="mentor-card" reveal><span class="mentor-ic">🤖</span><span>AI &amp; Innovation Specialists</span></div>
        </div>
      </div>
    </section>

    <!-- NEWS -->
    @if (newsItems().length > 0) {
      <section class="section" id="news">
        <div class="container">
          <div class="hb-title"><span>News</span></div>
          <p class="lead">The latest from India Mind League.</p>
          <div class="card-slider" reveal>
            @for (n of newsItems(); track n.code) {
              <article class="slide-card news-card">
                <div class="slide-card-img">
                  <img [src]="n.photo || 'img/cta-5-1.png'" [alt]="n.title" loading="lazy" />
                  @if (n.category) { <span class="slide-card-tag">{{ n.category }}</span> }
                </div>
                <div class="slide-card-body">
                  @if (n.publishOn) { <span class="slide-card-date">{{ n.publishOn | date: 'mediumDate' }}</span> }
                  <h3>{{ n.title }}</h3>
                  @if (n.summary) { <p>{{ n.summary }}</p> }
                  @if (n.author) { <span class="slide-card-meta">{{ n.author }}</span> }
                </div>
              </article>
            }
          </div>
        </div>
      </section>
    }

    <!-- GALLERY -->
    @if (gallery().length > 0) {
      <section class="section" id="gallery">
        <div class="container">
          <div class="hb-title"><span>Gallery</span></div>
          <p class="lead">Moments from the India Mind League journey.</p>
          <div class="gallery-grid">
            @for (g of gallery(); track g.code) {
              <figure class="gallery-item" reveal>
                <img [src]="g.cover || 'img/cta-5-1.png'" [alt]="g.name" loading="lazy" />
                <figcaption>{{ g.name }}</figcaption>
              </figure>
            }
          </div>
        </div>
      </section>
    }

    <!-- ANNOUNCEMENTS -->
    @if (announcementItems().length > 0) {
      <section class="section" id="announcements">
        <div class="container">
          <div class="hb-title"><span>Announcements</span></div>
          <p class="lead">Stay up to date with what's happening next.</p>
          <div class="card-slider" reveal>
            @for (a of announcementItems(); track a.code) {
              <article class="slide-card announcement-card">
                @if (a.pinned) { <span class="slide-card-pin">📌 Pinned</span> }
                <div class="slide-card-body">
                  @if (a.category) { <span class="slide-card-tag standalone">{{ a.category }}</span> }
                  @if (a.publishOn) { <span class="slide-card-date">{{ a.publishOn | date: 'mediumDate' }}</span> }
                  <h3>{{ a.title }}</h3>
                  @if (a.message) { <p>{{ a.message }}</p> }
                  @if (a.audience) { <span class="slide-card-meta">{{ a.audience }}</span> }
                </div>
              </article>
            }
          </div>
        </div>
      </section>
    }

    <!-- SAMPLE QUIZ -->
    <section class="section" id="demo">
      <div class="container">
        <div class="hb-title"><span>Try a Sample Challenge</span></div>
        <p class="lead">Three quick questions — see what the qualifier feels like.</p>
        <div class="demo-quiz" reveal>
          @if (!demoDone()) {
            @let q = demoQuestions[demoIndex()];
            <div class="dq-progress">Question {{ demoIndex() + 1 }} of {{ demoQuestions.length }}</div>
            <h3 class="dq-q">{{ q.q }}</h3>
            <div class="dq-opts">
              @for (opt of q.options; track opt) {
                <button type="button" class="dq-opt" [class.correct]="demoAnswered() && opt === q.answer" [class.wrong]="demoAnswered() && demoSelected() === opt && opt !== q.answer" [disabled]="demoAnswered()" (click)="answerDemo(opt)">{{ opt }}</button>
              }
            </div>
            @if (demoAnswered()) {
              <button type="button" class="btn btn-gold-solid btn-sm" style="margin-top:1rem;" (click)="nextDemo()">{{ demoIndex() + 1 < demoQuestions.length ? 'Next →' : 'See Score →' }}</button>
            }
          } @else {
            <div class="dq-result">
              <h3>You scored {{ demoScore() }} / {{ demoQuestions.length }}!</h3>
              <p>Ready for the real thing?</p>
              <a class="btn btn-gold-solid btn-lg" routerLink="/register">Register for the Qualifier →</a>
              <button type="button" class="btn btn-ghost btn-sm" style="margin-top:0.6rem;" (click)="resetDemo()">Try Again</button>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- CTA BANNER -->
    <section class="section cta-banner-sec">
      <div class="container">
        <div class="cta-banner" reveal>
          <div class="cta-text">
            <p class="cta-small">Think. Collaborate. Rise. Shine.</p>
            <h2 class="cta-big">Your Leadership Journey <span class="gold">Begins Here.</span></h2>
          </div>
          <div class="cta-right">
            <a class="btn-gold-lg" routerLink="/register">Register Now →</a>
            <span class="cta-note">Are you ready to rule your mind?</span>
          </div>
        </div>
      </div>
    </section>

    <!-- SOCIAL MEDIA FEED -->
    <section class="section" id="social">
      <div class="container">
        <div class="hb-title"><span>Follow Our Journey</span></div>
        <p class="lead">Live updates from India Mind League on Facebook.</p>
        <div class="social-feed-wrap" reveal>
          <div class="social-feed-frame">
            <div
              class="fb-page"
              data-href="https://www.facebook.com/profile.php?id=61592481944258"
              data-tabs="timeline"
              data-width="500"
              data-height="640"
              data-small-header="false"
              data-adapt-container-width="true"
              data-hide-cover="false"
              data-show-facepile="true"
              data-color-scheme="dark"
            >
              <blockquote cite="https://www.facebook.com/profile.php?id=61592481944258" class="fb-xfbml-parse-ignore">
                <a href="https://www.facebook.com/profile.php?id=61592481944258" target="_blank" rel="noopener">India Mind League on Facebook</a>
              </blockquote>
            </div>
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
            <p>"In an AI-driven world, education must go beyond imparting knowledge. It must nurture young minds that can think critically, feel deeply, lead ethically, and create a positive impact on society."</p>
            <p>As Artificial Intelligence transforms the way we learn, work, and solve problems, the qualities that will define future leaders are not information alone, but wisdom, emotional resilience, integrity, creativity, and the ability to make compassionate decisions.</p>
            <p>With this vision, <b>India Mind League</b> has been conceived as a pioneering national championship that prepares students for the future by integrating <b>Intellectual Intelligence (IQ)</b>, <b>Emotional Intelligence (EQ)</b>, <b>Spiritual/Social Intelligence (SQ)</b>, and <b>Leadership Intelligence (LQ)</b>.</p>
            <p>More than a competition, India Mind League is a movement to identify and nurture young changemakers who possess not only sharp minds but also strong character, empathy, self-awareness, ethical judgment, and a spirit of service.</p>
            <p>The future will not belong only to those who know more. It will belong to those who can think wisely, adapt courageously, connect compassionately, and lead responsibly — empowering India's youth to become future-ready leaders for a Viksit Bharat and a better world.</p>
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
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly siteSettings = inject(SiteSettingsService);

  readonly visionaryOpen = signal(false);
  readonly expandedStage = signal<number | null>(1);

  readonly countdown = signal(this.computeCountdown());
  readonly gallery = signal<GalleryItem[]>([]);
  readonly newsItems = signal<NewsItem[]>([]);
  readonly announcementItems = signal<AnnouncementItem[]>([]);

  readonly demoQuestions = DEMO_QUESTIONS;
  readonly demoIndex = signal(0);
  readonly demoSelected = signal<string | null>(null);
  readonly demoAnswered = signal(false);
  readonly demoScore = signal(0);
  readonly demoDone = signal(false);

  constructor() {
    this.title.setTitle("India Mind League — India's Largest School Intellectual & Leadership Championship");
    this.meta.updateTag({
      name: 'description',
      content: 'A national Intellectual & Leadership Championship for Classes IX–XII developing IQ, EQ, SQ and Leadership Intelligence. Register for the Stage 1 online qualifier today.',
    });

    const timer = setInterval(() => this.countdown.set(this.computeCountdown()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    this.api.get<GalleryItem[]>('/public/gallery').subscribe({
      next: (rows) => this.gallery.set(Array.isArray(rows) ? rows.slice(0, 8) : []),
      error: () => this.gallery.set([]),
    });

    this.api.get<NewsItem[]>('/public/news').subscribe({
      next: (rows) => this.newsItems.set(Array.isArray(rows) ? rows : []),
      error: () => this.newsItems.set([]),
    });

    this.api.get<AnnouncementItem[]>('/public/announcements').subscribe({
      next: (rows) => this.announcementItems.set(Array.isArray(rows) ? rows : []),
      error: () => this.announcementItems.set([]),
    });

    this.loadFacebookSdk();
  }

  /**
   * Meta's official Page Plugin — a free, no-API-key live embed of the
   * Facebook page's timeline. Loaded lazily (only on this page, not
   * site-wide) since it's third-party JS. If the SDK is already present
   * (e.g. a soft SPA re-navigation back to this page), re-parse the DOM
   * instead of re-injecting the script.
   */
  private loadFacebookSdk(): void {
    const w = window as unknown as { FB?: { XFBML: { parse: () => void } } };
    if (w.FB) {
      w.FB.XFBML.parse();
      return;
    }
    if (document.getElementById('facebook-jssdk')) return; // already loading
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div');
      root.id = 'fb-root';
      document.body.prepend(root);
    }
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
  }

  toggleStage(n: number) {
    this.expandedStage.update((cur) => (cur === n ? null : n));
  }

  answerDemo(opt: string) {
    if (this.demoAnswered()) return;
    this.demoSelected.set(opt);
    this.demoAnswered.set(true);
    if (opt === this.demoQuestions[this.demoIndex()].answer) {
      this.demoScore.update((s) => s + 1);
    }
  }

  nextDemo() {
    if (this.demoIndex() + 1 < this.demoQuestions.length) {
      this.demoIndex.update((i) => i + 1);
      this.demoSelected.set(null);
      this.demoAnswered.set(false);
    } else {
      this.demoDone.set(true);
    }
  }

  resetDemo() {
    this.demoIndex.set(0);
    this.demoSelected.set(null);
    this.demoAnswered.set(false);
    this.demoScore.set(0);
    this.demoDone.set(false);
  }

  /** Admin-edited bullet lists are stored one item per line. */
  protected bullets(raw: string): string[] {
    return (raw ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  }

  /** Admin-edited card buttons can point in-app ("/terms", "/#why") or out ("https://..."). */
  protected isInternalLink(link: string): boolean {
    return (link ?? '').startsWith('/');
  }

  protected linkPath(link: string): string {
    return link.split('#')[0] || '/';
  }

  protected linkFragment(link: string): string | undefined {
    const i = link.indexOf('#');
    return i >= 0 ? link.slice(i + 1) : undefined;
  }

  private computeCountdown() {
    const deadline = new Date(this.siteSettings.settings().registrationDeadline).getTime();
    const diff = Math.max(0, (Number.isNaN(deadline) ? 0 : deadline) - Date.now());
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { days: pad(days), hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) };
  }
}
