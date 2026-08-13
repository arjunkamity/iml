import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>Privacy Policy</span></div>
        <p class="legal-updated">Last updated: 12 August 2026</p>

        <article class="legal-body">
          <p>
            India Mind League ("IML") is committed to protecting the privacy of every student, parent, teacher and school
            participating in the championship. This Privacy Policy explains how information is collected, used, stored and
            protected.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We may collect:</p>
          <ul>
            <li>Student Name</li>
            <li>Date of Birth</li>
            <li>Class &amp; Section</li>
            <li>School Name</li>
            <li>Board of Education</li>
            <li>Parent / Guardian Details</li>
            <li>Mobile Number</li>
            <li>Email Address</li>
            <li>City &amp; State</li>
            <li>Photograph (where applicable)</li>
            <li>Competition Scores</li>
            <li>Assessment Reports</li>
            <li>Certificates</li>
            <li>Payment Details (processed through secure payment partners)</li>
            <li>Device and browser information for platform security</li>
          </ul>

          <h2>2. Why We Collect Information</h2>
          <p>Information is collected to:</p>
          <ul>
            <li>Register participants</li>
            <li>Verify eligibility</li>
            <li>Conduct online assessments</li>
            <li>Prepare rankings and results</li>
            <li>Generate certificates</li>
            <li>Communicate competition updates</li>
            <li>Issue awards and recognition</li>
            <li>Improve the competition platform</li>
            <li>Ensure fairness and prevent malpractice</li>
          </ul>

          <h2>3. Data Security</h2>
          <p>
            IML implements reasonable technical and administrative safeguards to protect participant information against
            unauthorized access, misuse or disclosure.
          </p>

          <h2>4. Data Sharing</h2>
          <p>Participant information will never be sold. Information may be shared only with:</p>
          <ul>
            <li>Authorized IML officials</li>
            <li>Assessment partners</li>
            <li>Technology partners</li>
            <li>Payment gateway providers</li>
            <li>Schools (where applicable)</li>
            <li>Government authorities if legally required</li>
          </ul>

          <h2>5. Photography &amp; Media Consent</h2>
          <p>
            During various stages of the competition, photographs, videos and interviews may be recorded. By participating,
            students and parents consent to the use of such content for educational, promotional and media purposes unless
            otherwise requested in writing.
          </p>

          <h2>6. Cookies</h2>
          <p>The website may use cookies to improve user experience, login security and analytics.</p>

          <h2>7. Participant Rights</h2>
          <p>Participants may request correction of inaccurate information by contacting the IML support team.</p>

          <h2>8. Policy Updates</h2>
          <p>
            IML reserves the right to modify this Privacy Policy whenever required. Updated versions will be published on
            the official website.
          </p>

          <p class="legal-contact">
            Questions about this policy? Reach us at <a href="mailto:indiamindleague&#64;gmail.com">indiamindleague&#64;gmail.com</a>
            or visit our <a routerLink="/faq">FAQ</a>.
          </p>
        </article>
      </div>
    </section>
  `,
})
export class PrivacyPolicyPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle('Privacy Policy — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'How India Mind League collects, uses and protects participant information across the championship.',
    });
  }
}
