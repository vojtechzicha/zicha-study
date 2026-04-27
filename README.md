# zicha-study

A web application for tracking university studies, subjects, and academic progress.

## Overview

zicha-study allows students to track their university studies, manage subjects, monitor academic progress, and share their study plans publicly. It also supports study notes (DOCX files served via OneDrive), exam scheduling, and detailed statistics.

**Features:**

- Create and manage multiple university studies
- Track subjects with grades, credits, and completion status
- View detailed statistics and analytics
- Share study plans publicly via unique URLs
- Upload and display study notes from OneDrive (DOCX to HTML)
- Exam scheduling with conflict detection
- Dynamic theming based on study logos
- Responsive design with dark/light mode support

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** MongoDB Atlas
- **Styling:** Tailwind CSS with shadcn/ui components
- **Authentication:** NextAuth.js v5 + Microsoft Entra ID (personal accounts)
- **Deployment:** Vercel

## Development

### Prerequisites

- Node.js 18+ and pnpm
- MongoDB Atlas account and cluster
- Azure App Registration for Microsoft login and OneDrive integration

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vojtechzicha/zicha-study.git
   cd zicha-study
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment setup:**
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

### Public share URLs

Studies, materials, and study notes can be shared at public URLs. Two
optional environment variables control how those URLs render in copy
buttons and preview boxes:

- `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS` — when `true`, the study slug is
  rendered as a subdomain (e.g. `https://newton.zicha.study/mat`).
  Leave unset/`false` locally so previews stay on
  `http://localhost:3001/<slug>`.
- `NEXT_PUBLIC_SHARE_BASE_DOMAIN` — apex domain used for the subdomain
  form, e.g. `zicha.study`.

The middleware in `middleware.ts` rewrites incoming subdomain requests
back to path form (and accepts deeper subdomain segments for
back-compat), so the redirect target is unchanged regardless of how the
link is presented. Any new code that builds a public URL must go through
`getShareUrl()` in `lib/utils/share-url.ts` rather than concatenating
`window.location.origin` manually.

### Customize footer attribution

Forks and third-party deployments should update the footer attribution before publishing. The visible name, profile image, attribution text, and footer home-link labels are centralized in [`lib/site-config.ts`](lib/site-config.ts).

- Change `footerAttribution.name` to the deployer's name
- Change `footerAttribution.imageSrc` to a file in `public/` such as `/profile.jpg`
- Change `footerAttribution.description` for the short footer byline
- Change `footerHomeLabel` and `publicFooterHomeLabel` if the deployment uses a different site name

If you only want to replace the photo, keep `imageSrc` as `/profile.jpg` and replace `public/profile.jpg`.

### Commands

```bash
pnpm install     # Install dependencies
pnpm dev         # Run development server
pnpm build       # Build for production
pnpm lint        # Run linting
pnpm lint:fix    # Run linting with auto-fix
pnpm test        # Run tests
```

## Deployment

The application is deployed on Vercel. See [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for details.

## License

[MIT](LICENSE)
