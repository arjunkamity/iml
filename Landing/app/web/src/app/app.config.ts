import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthInterceptor } from '@core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Without this, Angular's newer default scheduler doesn't automatically
    // pick up state changed from a plain (non-signal) field inside an async
    // callback (e.g. an HTTP .subscribe()) — the view stayed on "Loading…"
    // until some unrelated DOM event happened to trigger a render. This
    // explicitly restores zone.js-driven change detection app-wide.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Without this, Angular leaves the browser's scroll offset untouched on
      // navigation — clicking a link while scrolled down (e.g. footer links)
      // landed the new page still scrolled to that same offset, showing its
      // footer instead of its top. This resets to top on a plain route change
      // and still jumps to the target element for fragment links (#pillars).
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Default 'ignore' means a same-route, fragment-only navigation (e.g.
      // clicking "Stages" while already on "/", just scrolled elsewhere)
      // never fires NavigationEnd at all — nothing scrolls. 'reload' makes
      // it a real navigation so both the anchor scroll above and our own
      // fragment handler in PublicShell actually run.
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
};
