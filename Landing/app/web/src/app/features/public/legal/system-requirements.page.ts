import { Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SiteSettingsService } from '@core/services/site-settings.service';

@Component({
  selector: 'app-system-requirements',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="section legal-page">
      <div class="container">
        <div class="hb-title"><span>System Requirements</span></div>
        <p class="lead">
          What you need to take an India Mind League online assessment without interruption —
          check this before your exam window opens, not after it starts.
        </p>

        <article class="legal-body">
          <h2>Internet Connection</h2>
          <p>A stable connection matters more than a fast one — a steady 2 Mbps beats a fast connection that keeps dropping.</p>
          <div class="req-table-wrap">
            <table class="req-table">
              <thead><tr><th></th><th>Minimum</th><th>Recommended</th></tr></thead>
              <tbody>
                <tr><td>Download speed</td><td>2 Mbps</td><td>5 Mbps or higher</td></tr>
                <tr><td>Connection type</td><td>Stable mobile data (4G/5G) or broadband</td><td>Wired broadband, or Wi-Fi close to the router</td></tr>
                <tr><td>Backup</td><td>—</td><td>A second device or mobile hotspot on standby</td></tr>
              </tbody>
            </table>
          </div>

          <h2>Device</h2>
          <div class="req-table-wrap">
            <table class="req-table">
              <thead><tr><th></th><th>Minimum</th><th>Recommended</th></tr></thead>
              <tbody>
                <tr><td>Type</td><td>Smartphone (5" or larger)</td><td>Laptop or desktop computer</td></tr>
                <tr><td>Operating system</td><td>Android 9, iOS 14, Windows 10 or macOS 12 — or newer</td><td>The latest available update for your device</td></tr>
                <tr><td>Power</td><td>Fully charged, or a charger within reach</td><td>Plugged into power for the full exam</td></tr>
              </tbody>
            </table>
          </div>
          <p>A larger screen makes reading and navigating questions easier — use a laptop or desktop if one is available to you.</p>

          <h2>Supported Browsers</h2>
          <div class="req-table-wrap">
            <table class="req-table">
              <thead><tr><th>Browser</th><th>Minimum version</th></tr></thead>
              <tbody>
                <tr><td>Google Chrome</td><td>100 or newer</td></tr>
                <tr><td>Microsoft Edge</td><td>100 or newer</td></tr>
                <tr><td>Mozilla Firefox</td><td>100 or newer</td></tr>
                <tr><td>Safari (iOS / macOS)</td><td>15 or newer</td></tr>
              </tbody>
            </table>
          </div>
          <p>Internet Explorer is not supported. If you're unsure of your browser version, updating to the latest version before your exam resolves almost every compatibility issue.</p>

          <h2>Before You Begin</h2>
          <ul>
            <li>Close other tabs, apps and downloads that might slow your connection or distract you.</li>
            <li>Turn off any VPN — it can interfere with the connection to our servers.</li>
            <li>Keep your registered phone nearby — it's how we reach you if anything needs attention.</li>
            <li>Sign in a few minutes early so any browser or connection issue surfaces before your time starts.</li>
          </ul>

          <h2>If Something Goes Wrong During the Exam</h2>
          <p>
            If your connection drops or your device restarts, reconnect and sign back in as soon as you can, and
            contact the <a routerLink="/account/help-desk">Help Desk</a> right away so the team is aware while it's
            still happening — the sooner we know, the more we can do.
          </p>

          <p class="legal-contact">
            See also our <a routerLink="/terms">Terms &amp; Conditions</a> and
            <a routerLink="/faq">FAQ</a>. Still unsure? Write to
            <a [href]="'mailto:' + settings().contactEmail">{{ settings().contactEmail }}</a>.
          </p>
        </article>
      </div>
    </section>
  `,
})
export class SystemRequirementsPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly settings = inject(SiteSettingsService).settings;

  constructor() {
    this.title.setTitle('System Requirements — India Mind League');
    this.meta.updateTag({
      name: 'description',
      content: 'Minimum and recommended device, browser and internet requirements for taking an India Mind League online assessment.',
    });
  }
}
