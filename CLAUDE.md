# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies (using pnpm)
pnpm install

# Run development server (port 3001)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Run linting with auto-fix
pnpm lint:fix
```

## Architecture Overview

This is a Next.js 15 app with Supabase backend for tracking university studies. The application uses:

- **Next.js App Router** for pages and routing
- **Supabase** for authentication and PostgreSQL database with Row Level Security
- **Shadcn/ui** component library (47 pre-built components in components/ui/)
- **TypeScript** throughout with path aliases (@/ prefix)
- **Tailwind CSS** for styling with CSS variables

## Key Code Structure

```
app/
├── [slug]/              # Public study view (dynamic route)
├── studies/             # Protected study management
│   ├── [id]/           # Individual study routes
│   │   ├── edit/       # Edit study details
│   │   ├── settings/   # Study settings
│   │   └── statistics/ # Study analytics
│   └── new/            # Create new study
└── auth/callback/       # Supabase auth callback

components/
├── ui/                  # Shadcn/ui components (don't modify)
└── *.tsx               # Feature components

lib/
├── supabase/           # Supabase client configs
│   ├── client.ts       # Client-side Supabase
│   └── server.ts       # Server-side Supabase
└── utils/              # Helper functions
```

## Database Schema

Two main tables with RLS policies:

- **studies**: User's university programs (id, user_id, name, type, years, status, is_public, public_slug)
- **subjects**: Courses within studies (id, study_id, name, semester, credits, is_mandatory, completion_type, grade, exam_date, hours)

## Important Patterns

1. **Authentication**: All /studies/* routes require authentication via Supabase
2. **Data Access**: Use server-side Supabase client for initial data fetching in server components
3. **Forms**: Use react-hook-form with zod validation (see existing forms for patterns)
4. **UI Components**: Always check components/ui/ for existing components before creating new ones
5. **Public Sharing**: Studies can be shared via public_slug at /[slug] routes
6. **Constants**: ALWAYS use centralized constants from `lib/constants.ts` - never hardcode enum values across multiple files. This includes study types, forms, subject types, completion types, etc. All enum-like values must be defined once and imported everywhere.

## Development Notes

- The project uses ESLint for code quality with Next.js and TypeScript support
- ESLint is configured with moderate rules to catch common issues without being overly strict
- Build process ignores ESLint and TypeScript errors (configured in next.config.js)
- Environment variables are stored in .env (Supabase URL and keys required)
- No test suite is configured
- The project auto-syncs with v0.dev deployments