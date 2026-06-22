# Vercel Deployment Notes

## Deployment Customization

Before deploying a fork, review `lib/site-config.ts`. Footer attribution and footer home-link labels are centralized there so each deployment can use its own owner name, profile image, short byline, and site label without editing footer components.

Profile images should live in `public/` and be referenced with an absolute public path such as `/profile.jpg`.

## Preview deployments (per-PR)

Every pull request gets its own preview deployment so changes can be reviewed
in a running app before they reach `main`/production. This relies on Vercel's
native Git integration — no GitHub Action is required.

### One-time Vercel setup

1. In the Vercel project, **Settings → Git**, connect the GitHub repository and
   keep "Preview Deployments" enabled (on by default). Vercel then builds every
   push to a non-production branch and comments the preview URL on the PR.
2. Production builds from the production branch (`main`); all other branches
   build as Preview.

### Environment variables by environment

Set these in **Settings → Environment Variables** and scope each one to the
right environment(s). Preview deployments intentionally point at the **same
MongoDB database** as production (this is a single-user app), so a preview can
read/write live data — keep that in mind when testing destructive changes.

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | ✅ (same value) | Shared database, per request. |
| `MONGODB_DB` | ✅ | ✅ (same value) | |
| `AUTH_SECRET` | ✅ | ✅ (**same value**) | Must be identical — the proxy signs/verifies state with it. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | ✅ | ✅ (same value) | Same Azure app for both. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | ✅ | ✅ (same value) | |
| `ALLOWED_EMAILS` | ✅ | ✅ (same value) | |
| `AUTH_REDIRECT_PROXY_URL` | ✅ `https://www.zicha.study/api/auth` | ✅ `https://www.zicha.study/api/auth` | Enables OAuth on dynamic preview URLs. Must be the canonical origin (`www`) — see caution below. |
| `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS` | `true` | leave **unset** | Previews use path-form share URLs. |
| `NEXT_PUBLIC_SHARE_BASE_DOMAIN` | `zicha.study` | leave **unset** | |

### Authentication on previews (how it works)

Microsoft Entra ID only accepts pre-registered OAuth **redirect URIs**, but
preview deployments get dynamic hostnames like
`zicha-study-git-<branch>-<scope>.vercel.app`. Registering each is impractical.

Instead the app uses the Auth.js **redirect proxy** (`redirectProxyUrl` in
`auth.ts`, fed by `AUTH_REDIRECT_PROXY_URL`):

1. A user signs in on a preview deployment. Auth.js stores the preview's URL in
   the OAuth `state` and sends Microsoft the **production** callback URL.
2. Microsoft redirects back to `https://www.zicha.study/api/auth/callback/microsoft-entra-id`.
3. Production recognizes itself as the proxy, verifies the `state` with the
   shared `AUTH_SECRET`, and forwards the authenticated session back to the
   originating preview URL.

Requirements for this to work:

- `AUTH_REDIRECT_PROXY_URL` set to `https://www.zicha.study/api/auth` on **both**
  Production and Preview, and production redeployed so it picks up the value
  (Vercel applies env vars only to new builds). Production is the deployment
  that receives the callback and does the forwarding, so it must have the var.
- **The same `AUTH_SECRET`** across Production and Preview.
- The Entra app registration must list the redirect URI
  `https://www.zicha.study/api/auth/callback/microsoft-entra-id`.

> **Caution — canonical origin / no redirects.** Auth.js treats the current
> deployment as "the proxy" only when `new URL(AUTH_REDIRECT_PROXY_URL).origin`
> **exactly equals** the incoming request origin (`@auth/core` `init.js`). The
> apex `zicha.study` 307-redirects to `www.zicha.study`, so if the proxy URL or
> the Azure redirect URI uses the apex, Microsoft's callback lands on `www`
> after a redirect, the origins no longer match, the proxy step is skipped, and
> sign-in fails with `?error=Configuration` on
> `https://www.zicha.study/api/auth/error`. Always use the canonical `www`
> origin (the one that answers with 200 and no redirect) in both the env var
> and the Azure redirect URI.

### Middleware note

`middleware.ts` only rewrites genuine `*.zicha.study` study subdomains. Preview
hosts (`*.vercel.app`) and `localhost` are explicitly excluded, so a preview
deployment serves its own pages instead of 308-redirecting to production.

## Public share URLs

Production deployments render share-link previews using the study slug
as a single subdomain (e.g. `https://newton.zicha.study/mat`). The
behavior is controlled by two `NEXT_PUBLIC_*` variables that are
inlined at build time:

| Variable | Production | Preview / Local |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS` | `true` | unset (path form) |
| `NEXT_PUBLIC_SHARE_BASE_DOMAIN` | `zicha.study` | unset |

Set them once in the Vercel dashboard (or via
`vercel env add NAME production`). Because they are inlined at build
time, changing them only takes effect after the next production build.

### DNS / middleware

For the subdomain form to resolve, the apex domain needs a wildcard
record (`*.zicha.study`) routed to the same Vercel project. Incoming
requests are caught by `middleware.ts`, which rewrites
`<slug>.zicha.study/<rest>` to `/<slug>/<rest>` before any route
matching. The middleware also supports the legacy multi-level form
(`mat.newton.zicha.study` → `/newton/mat`) for back-compat with older
copied links.

### Code rule

Components must build public URLs through `getShareUrl()` in
`lib/utils/share-url.ts` so the path/subdomain switch stays centralized.
Avoid hand-built `${window.location.origin}/...` strings for shareable
URLs.

## Study Notes DOCX Conversion

The study notes feature uses Mammoth.js for converting DOCX files to HTML, which is fully compatible with Vercel's deployment environment.

### How it works:

1. **Local Development**: Full functionality with on-demand conversion
2. **Vercel Production**: Full functionality with on-demand conversion
   - Converts DOCX files to HTML using Mammoth.js
   - Caches conversions in the database for performance
   - Supports regeneration with `?flush=1` parameter

### Features:

1. **Automatic conversion**: DOCX files are converted on-demand when accessed
2. **Smart caching**: Checks OneDrive timestamps to determine if regeneration is needed
3. **Media handling**: Extracts and stores images from DOCX files
4. **TOC generation**: Automatically generates table of contents from headings

### Database caching:

All converted documents are stored in the database with:
- HTML content
- Media files (images) 
- Metadata (title, timestamps)
- Cache keys for versioning

This provides optimal performance while maintaining the ability to regenerate content when source files are updated.
