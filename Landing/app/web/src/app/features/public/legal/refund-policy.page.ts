import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SiteSettingsService } from '@core/services/site-settings.service';

@Component({
  selector: 'app-refund-policy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>Refund Policy</span></div>
        <p class="legal-updated">Last updated: 12 August 2026</p>

        <article class="legal-body">
          <h2>Registration Fees</h2>
          <p>Registration fees are generally non-refundable. Refund requests shall be considered only under exceptional circumstances.</p>

          <h2>Refunds May Be Considered If</h2>
          <ul>
            <li>Duplicate payment</li>
            <li>Multiple transactions</li>
            <li>Payment deducted but registration not completed</li>
            <li>Competition cancelled by IML before commencement</li>
          </ul>

          <h2>Refunds Will Not Be Granted For</h2>
          <ul>
            <li>Change of mind</li>
            <li>Student withdrawal</li>
            <li>Failure to attend</li>
            <li>Incorrect registration details</li>
            <li>Device or internet issues</li>
            <li>Missed deadlines</li>
            <li>Disqualification due to rule violations</li>
          </ul>

          <h2>Refund Timeline</h2>
          <p>Approved refunds shall normally be processed within 7–15 working days through the original payment method. Payment gateway charges or processing fees, where applicable, may be deducted.</p>

          <p class="legal-contact">
            For a refund request, write to <a [href]="'mailto:' + settings().contactEmail">{{ settings().contactEmail }}</a> with your
            registration ID. See also our <a routerLink="/terms">Terms &amp; Conditions</a>.
          </p>
        </article>
      </div>
    </section>
  `,
})
export class RefundPolicyPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly settings = inject(SiteSettingsService).settings;

  constructor() {
    this.title.setTitle('Refund Policy — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'When refunds are and are not available for India Mind League registration fees, and how to request one.',
    });
  }
}
