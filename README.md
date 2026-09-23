# zicha-study

A personal tracker for university and high-school studies. You sign in with a Microsoft account. Data is stored in MongoDB Atlas, and study materials and notes come from OneDrive. The UI is in Czech.

## Features

- Studies of two kinds: university (bachelor's, master's, ...) and high school (Střední škola)
- University subjects: semesters, credits, completion type, grades on the ECTS scale, credit-weighted average
- High-school subjects: one grade per pololetí on the 1–5 scale, shown as a subjects × pololetí grid, unweighted average
- Final exams: státní závěrečná zkouška (university) and maturitní zkouška (high school)
- Statistics per study, and Excel export
- Study materials and notes from OneDrive: DOCX files rendered as HTML, and read-only Obsidian vault notes
- Markdown notes written in an in-app editor
- Exam scheduler that finds a conflict-free set of exam dates across studies
- Task list
- Public, read-only sharing of a study, its materials and its notes
- Colour theme taken from each study's logo, plus light and dark mode

The app is built for a single user. Any account that can sign in can see and edit all data, so restrict sign-in with `ALLOWED_EMAILS` in any deployment others can reach.

## Stack

Next.js 16 (App Router), React 19, TypeScript, MongoDB Atlas, Auth.js (NextAuth v5) with Microsoft Entra ID, Tailwind CSS with shadcn/ui, Vitest. It is deployed on Vercel.

## Local setup

You need:

- Node.js 20.9 or newer (required by Next.js 16) and pnpm
- A MongoDB Atlas cluster
- A Microsoft Entra ID app registration. See [docs/ONEDRIVE_OAUTH_SETUP.md](docs/ONEDRIVE_OAUTH_SETUP.md).

```bash
git clone https://github.com/vojtechzicha/zicha-study.git
cd zicha-study
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

If you have access to the Vercel project, `vercel env pull .env.local` fetches the environment variables instead.

### Environment variables

`.env.example` documents every variable. These are the ones you must set:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `AUTH_SECRET` | Signs and encrypts session tokens. Generate it with `openssl rand -base64 32`. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID of the Entra app |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Client secret of the Entra app |

These are optional:

- `MONGODB_DB` (defaults to `zicha-study`)
- `ALLOWED_EMAILS`
- `AUTH_REDIRECT_PROXY_URL` (Vercel preview deployments only)
- The share URL variables described below
- Build metadata overrides

### Commands

```bash
pnpm dev         # development server
pnpm build       # production build
pnpm start       # serve the production build
pnpm lint        # ESLint
pnpm lint:fix    # ESLint with auto-fix
pnpm test        # Vitest in watch mode
pnpm test:run    # Vitest, single run
```

The production build ignores TypeScript errors (`typescript.ignoreBuildErrors` in `next.config.mjs`). Run `pnpm lint` and `pnpm exec tsc --noEmit` yourself.

## Public share URLs

Public pages live at `/<study-slug>` and `/<study-slug>/<material-or-note-slug>`. Two build-time variables control how the app displays these links in copy buttons and previews:

- `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS`: set it to `true` to show the study slug as a subdomain, for example `https://newton.zicha.study/mat`.
- `NEXT_PUBLIC_SHARE_BASE_DOMAIN`: the domain used in that form, for example `zicha.study`.

Leave both unset locally. Links then use the current origin, such as `http://localhost:3000/newton/mat`.

When someone opens a subdomain link, `middleware.ts` answers with a 308 redirect to the path form on the main domain. It also accepts older multi-level links such as `mat.newton.zicha.study`. The domain `zicha.study` is hard-coded in `middleware.ts`, so a fork with its own domain must change it there too.

Code that builds a public link must call `getShareUrl()` from `lib/utils/share-url.ts`.

## Footer attribution

The footer shows an owner name, a profile photo, a short byline, and home-link labels. All of these are set in [`lib/site-config.ts`](lib/site-config.ts). Change them before you deploy a fork:

- `footerAttribution.name`, `imageAlt` and `description`
- `footerAttribution.imageSrc`: a path under `public/`, such as `/profile.jpg`. To change only the photo, replace `public/profile.jpg`.
- `footerHomeLabel` and `publicFooterHomeLabel`

## Deployment

The app runs on Vercel. Production builds from `main`, and every pull request gets a preview deployment. [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) covers environment variables, sign-in on preview deployments, and the DNS setup for share URLs.

## License

[MIT](LICENSE)
