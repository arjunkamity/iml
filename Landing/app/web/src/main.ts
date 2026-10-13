import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// This app has never intentionally shipped a service worker. If one is
// somehow registered (an old build did — see public/ngsw-worker.js for
// the full story), unregister it so this client stops being served a
// stale cached app shell. Belt-and-braces alongside the self-destructing
// ngsw-worker.js itself, which is the primary fix for clients where an
// old worker is already intercepting every request including this one.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) registration.unregister();
  });
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
