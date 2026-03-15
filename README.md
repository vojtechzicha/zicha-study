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
