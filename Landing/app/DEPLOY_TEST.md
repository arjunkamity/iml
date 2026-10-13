# Deploy pipeline canary

This file exists only to trigger and verify the rollback-enabled
`Deploy Production` GitHub Actions workflow. It has no effect on the API
or web app — it lives outside `api/` and `web/`, so it isn't touched by
`npm ci` / `npm run build` in either project.

Last canary push: 2026-08-13 08:53 UTC — confirming a normal (non-failing)
deploy completes green before we test the rollback path.
