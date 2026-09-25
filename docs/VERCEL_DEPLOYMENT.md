# Deploying on Vercel

The app uses Vercel's Git integration. There is no `vercel.json` and no deploy workflow in GitHub Actions. Pushes to `main` build production. Every other branch, including pull request branches, builds a preview deployment. Vercel comments the preview URL on the pull request. Keep Preview Deployments enabled under Settings > Git.

Before you deploy a fork, update the footer attribution in `lib/site-config.ts` (see the README). If you use your own domain, also change `zicha.study` in `middleware.ts`, and use your domain wherever this document says `zicha.study`.

## Environment variables

Set these under Settings > Environment Variables. Preview deployments use the same MongoDB database as production. Anything you do on a preview changes live data.

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | required | same value | |
| `MONGODB_DB` | optional | same value | Defaults to `zicha-study`. |
| `AUTH_SECRET` | required | same value | Must be identical in both environments, because the redirect proxy verifies the OAuth state with it. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | required | same value | Same Entra app in both environments. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | required | same value | |
| `ALLOWED_EMAILS` | set it | same value | If it is empty, any Microsoft personal account can sign in and edit all data. |
| `AUTH_REDIRECT_PROXY_URL` | `https://www.zicha.study/api/auth` | `https://www.zicha.study/api/auth` | Lets previews sign in. See below. |
| `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS` | `true` | unset | Previews show path-form share links. |
| `NEXT_PUBLIC_SHARE_BASE_DOMAIN` | `zicha.study` | unset | |

Vercel applies changed variables only to new builds, so redeploy after you change one. For `NEXT_PUBLIC_*` variables this matters twice: their values are compiled into the client bundle at build time.

You do not need to set the build metadata variables (`NEXT_PUBLIC_COMMIT_SHA`, `NEXT_PUBLIC_BUILD_TIME`). `next.config.mjs` reads the commit from `VERCEL_GIT_COMMIT_SHA`.

## Sign-in on preview deployments

Entra ID accepts only redirect URIs that are registered in advance. Preview hostnames such as `zicha-study-git-<branch>-<scope>.vercel.app` change with every branch. To avoid registering each one, the app uses the Auth.js redirect proxy (`redirectProxyUrl` in `auth.ts`, set from `AUTH_REDIRECT_PROXY_URL`):

1. You sign in on a preview. Auth.js puts the preview URL into the OAuth `state` and gives Microsoft the production callback URL.
2. Microsoft redirects to `https://www.zicha.study/api/auth/callback/microsoft-entra-id`.
3. Production verifies the `state` with the shared `AUTH_SECRET` and forwards the session back to the preview.

For this to work:

- `AUTH_REDIRECT_PROXY_URL` must be set on both Production and Preview. Production handles the callback, so it needs the value too.
- `AUTH_SECRET` must be the same in both environments.
- The Entra app must list `https://www.zicha.study/api/auth/callback/microsoft-entra-id` as a redirect URI.

Use the `www` origin in both the variable and the Azure redirect URI. Auth.js acts as the proxy only when the origin of `AUTH_REDIRECT_PROXY_URL` exactly matches the origin of the incoming request. The apex `zicha.study` redirects (307) to `www.zicha.study`. If you use the apex, the callback arrives on `www`, the origins differ, and sign-in fails with `error=Configuration`.

`middleware.ts` handles only real `*.zicha.study` subdomains. On a preview host or on localhost it serves the page itself and does not redirect to production.

## Share URL domains

For subdomain share links (`https://newton.zicha.study/mat`) to work, add a wildcard domain `*.zicha.study` to the same Vercel project. `middleware.ts` answers requests on a study subdomain with a 308 redirect to the path form, for example `https://zicha.study/newton/mat`. It skips `www` and `/api/*` requests.

## Upload size

Logos and diploma scans are uploaded through Server Actions. The body limit is 4 MB (`serverActions.bodySizeLimit` in `next.config.mjs`), which is below Vercel's request limit of about 4.5 MB. Larger files fail.
