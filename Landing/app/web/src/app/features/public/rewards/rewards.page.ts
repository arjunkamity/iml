import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../reveal.directive';

interface PrizeTier {
  medal: string;
  rank: string;
  amount: string;
}

const PRIZE_TIERS: PrizeTier[] = [
  { medal: '🥇', rank: 'IML Champion', amount: '₹51,000' },
  { medal: '🥈', rank: 'First Runner-up', amount: '₹31,000' },
  { medal: '🥉', rank: 'Second Runner-up', amount: '₹11,000' },
];

@Component({
  selector: 'app-rewards',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  template: `
    <section class="section rw-hero">
      <div class="container center">
        <span class="eyebrow">Celebrate Excellence. Unlock Your Future.</span>
        <h1 class="rw-h1">Rewards &amp; <span class="gold">Recognition</span></h1>
        <p class="lead">
          At India Mind League, every participant is recognised for their commitment to learning, leadership and personal
          growth. While winners receive prestigious awards, every student embarks on a journey of future readiness.
        </p>
      </div>
    </section>

    <section class="section" id="prize-pool">
      <div class="container">
        <div class="hb-title"><span>Cash Prize Pool</span></div>
        <div class="rw-prize-table" reveal>
          @for (t of prizeTiers; track t.rank) {
            <div class="rw-prize-row">
              <span class="rw-medal">{{ t.medal }}</span>
              <span class="rw-rank">{{ t.rank }}</span>
              <span class="rw-amount">{{ t.amount }}</span>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="section" id="every-participant">
      <div class="container">
        <div class="hb-title"><span>Every Participant Receives</span></div>
        <div class="i3-card rw-single" reveal>
          <p class="i3-p">Every registered participant who successfully completes Stage 1 will receive:</p>
          <ul class="i3-list">
            <li><i>✓</i> Digital Certificate of Participation</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section" id="bootcamp-benefits">
      <div class="container">
        <div class="hb-title"><span>Stage 3 — Leadership Bootcamp Qualifiers</span></div>
        <p class="lead">Students shortlisted for the Leadership Bootcamp receive a premium future-readiness experience designed to prepare them for success in the AI era.</p>

        <div class="grid grid-2 rw-grid">
          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Future Readiness Assessment Report</h3>
            <p class="i3-p">A personalised competency report covering:</p>
            <ul class="i3-list">
              <li><i>✓</i> Intellectual Intelligence (IQ)</li>
              <li><i>✓</i> Emotional Intelligence (EQ)</li>
              <li><i>✓</i> Spiritual Intelligence (SQ)</li>
              <li><i>✓</i> Leadership Intelligence (LQ)</li>
              <li><i>✓</i> Critical Thinking &amp; Creativity</li>
              <li><i>✓</i> Communication, Collaboration &amp; Decision-Making</li>
              <li><i>✓</i> Ethical Reasoning &amp; AI Era Readiness</li>
            </ul>
          </div>

          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Leadership Bootcamp</h3>
            <p class="i3-p">An immersive learning experience featuring:</p>
            <ul class="i3-list">
              <li><i>✓</i> Leadership Development Workshops</li>
              <li><i>✓</i> Emotional Intelligence Training</li>
              <li><i>✓</i> AI &amp; Future Skills Sessions</li>
              <li><i>✓</i> Critical Thinking Labs</li>
              <li><i>✓</i> Innovation Challenges</li>
              <li><i>✓</i> Public Speaking &amp; Communication</li>
              <li><i>✓</i> Design Thinking &amp; Team Leadership Exercises</li>
            </ul>
          </div>

          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Expert Mentor Sessions</h3>
            <p class="i3-p">Learn directly from:</p>
            <ul class="i3-list">
              <li><i>✓</i> Renowned Educators</li>
              <li><i>✓</i> Industry Leaders &amp; Entrepreneurs</li>
              <li><i>✓</i> Leadership Coaches</li>
              <li><i>✓</i> Psychologists &amp; Well-being Experts</li>
              <li><i>✓</i> AI &amp; Innovation Specialists</li>
            </ul>
          </div>

          <div class="i3-card" reveal>
            <h3 class="i3-h gold">Premium Recognition</h3>
            <p class="i3-p">Stage 3 qualifiers will also receive:</p>
            <ul class="i3-list">
              <li><i>✓</i> Leadership Bootcamp Certificate &amp; Mentor Feedback</li>
              <li><i>✓</i> Exclusive IML Merchandise (where applicable)</li>
              <li><i>✓</i> Recognition as Future Leaders</li>
              <li><i>✓</i> Eligibility for Scholarships &amp; Ambassador Programmes</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="grand-finale">
      <div class="container">
        <div class="hb-title"><span>Grand Finale Recognition</span></div>
        <p class="lead">National Finalists will compete for:</p>
        <div class="i3-card rw-single" reveal>
          <ul class="i3-list rw-finale-list">
            <li><i>✓</i> Championship Trophy</li>
            <li><i>✓</i> Cash Awards &amp; Medals</li>
            <li><i>✓</i> Excellence Certificates</li>
            <li><i>✓</i> Media Recognition</li>
            <li><i>✓</i> Leadership Honours &amp; Special Jury Awards</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section cta-banner-sec">
      <div class="container">
        <div class="cta-banner" reveal>
          <div class="cta-text">
            <p class="cta-small">Where Knowledge Meets Leadership.</p>
            <h2 class="cta-big">Beyond Rewards — <span class="gold">An Investment in Your Future.</span></h2>
          </div>
          <div class="cta-right">
            <a class="btn-gold-lg" routerLink="/register">Register Now →</a>
            <span class="cta-note">Every challenge strengthens your ability to think, lead and thrive.</span>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class RewardsPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly prizeTiers = PRIZE_TIERS;

  constructor() {
    this.title.setTitle('Rewards & Recognition — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'National cash prizes, Leadership Bootcamp benefits and grand finale recognition for India Mind League participants.',
    });
  }
}
