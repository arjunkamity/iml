import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteSettingsService } from '@core/services/site-settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly siteSettings = inject(SiteSettingsService);
  protected readonly loaded = this.siteSettings.loaded;
  protected readonly settings = this.siteSettings.settings;

  ngOnInit(): void {
    this.siteSettings.load().subscribe();
  }
}
