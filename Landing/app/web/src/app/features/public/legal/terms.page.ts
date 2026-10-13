import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>Terms &amp; Conditions</span></div>
        <p class="legal-updated">Last updated: 12 August 2026</p>

        <article class="legal-body">
          <h2>Eligibility</h2>
          <ul>
            <li>Participation is open only to eligible students as notified by India Mind League.</li>
            <li>Submission of incorrect information may result in disqualification.</li>
          </ul>

          <h2>Registration</h2>
          <p>Registration becomes valid only after:</p>
          <ul>
            <li>Successful completion of the application</li>
            <li>Payment confirmation (where applicable)</li>
            <li>Acceptance of these Terms &amp; Conditions</li>
          </ul>

          <h2>Competition Rules</h2>
          <p>Participants must:</p>
          <ul>
            <li>Attempt assessments independently.</li>
            <li>Not use unfair means or unauthorized assistance.</li>
            <li>Follow the instructions provided during every stage.</li>
            <li>Maintain respectful conduct throughout the championship.</li>
          </ul>
          <p>Violation may lead to immediate disqualification.</p>

          <h2>Online Assessment</h2>
          <p>IML may use technology to monitor assessment integrity. Any suspicious activity including:</p>
          <ul>
            <li>Multiple logins</li>
            <li>Impersonation</li>
            <li>Screen sharing</li>
            <li>Automated tools</li>
            <li>Copying answers</li>
          </ul>
          <p>may result in cancellation of scores.</p>

          <h2>Evaluation</h2>
          <p>The decision of the Jury, Assessment Committee and Organizing Committee shall be final and binding. No correspondence regarding evaluation will be entertained.</p>

          <h2>Technical Issues</h2>
          <p>Participants are responsible for:</p>
          <ul>
            <li>Stable internet connection</li>
            <li>Compatible device</li>
            <li>Updated browser</li>
          </ul>
          <p>
            See our <a routerLink="/system-requirements">System Requirements</a> for the exact minimum and
            recommended specifications. IML shall not be responsible for interruptions caused by participant-side
            technical issues.
          </p>

          <h2>Schedule Changes</h2>
          <p>IML reserves the right to:</p>
          <ul>
            <li>Modify dates</li>
            <li>Reschedule rounds</li>
            <li>Change competition format</li>
            <li>Amend timelines</li>
          </ul>
          <p>without prior notice when necessary.</p>

          <h2>Certificates &amp; Awards</h2>
          <p>Certificates, rankings and awards are subject to successful verification of participant information. IML reserves the right to withhold awards in case of rule violations.</p>

          <h2>Intellectual Property</h2>
          <p>All assessment questions, graphics, videos, branding, study material and competition content remain the intellectual property of India Mind League. No content may be copied, reproduced or distributed without written permission.</p>

          <h2>Limitation of Liability</h2>
          <p>IML shall not be liable for indirect losses arising from technical failures, internet issues, force majeure events or circumstances beyond reasonable control.</p>

          <h2>Governing Law</h2>
          <p>These Terms shall be governed by the laws of India. Any disputes shall be subject to the jurisdiction of competent courts.</p>

          <p class="legal-contact">
            See also our <a routerLink="/privacy-policy">Privacy Policy</a>, <a routerLink="/refund-policy">Refund Policy</a> and
            <a routerLink="/faq">FAQ</a>.
          </p>
        </article>
      </div>
    </section>
  `,
})
export class TermsPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle('Terms & Conditions — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'Eligibility, registration, competition rules and evaluation terms for the India Mind League championship.',
    });
  }
}
