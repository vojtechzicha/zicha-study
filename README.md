# University Study Tracker

A comprehensive web application for tracking university studies, subjects, and academic progress.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/zicha-dev/v0-university-study-tracker)

## Overview

This is a Next.js application that allows students to track their university studies, manage subjects, monitor academic progress, and share their study plans publicly. The application uses Supabase for authentication and data storage.

**Features:**
- Create and manage multiple university studies
- Track subjects with grades, credits, and completion status
- View detailed statistics and analytics
- Share study plans publicly via unique URLs
- Responsive design with dark/light mode support

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Backend:** Supabase (PostgreSQL with Row Level Security)
- **Styling:** Tailwind CSS with shadcn/ui components
- **Authentication:** Supabase Auth
- **Deployment:** Vercel

> **Note:** This project was initially scaffolded with v0.dev but is now actively developed and maintained using Claude Code.

## Development

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account and project
- Git for version control

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd university-study-tracker
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment setup:**
   Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

   The application will be available at `http://localhost:3000`.

### Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Run linting with auto-fix
pnpm lint:fix
```

### Code Quality

The project uses ESLint with Next.js and TypeScript support for code quality. The linter is configured with moderate rules to catch common issues without being overly strict.

## Deployment

The application is deployed on Vercel. Any changes pushed to the main branch will automatically trigger a new deployment.

## Contributing

This project is actively developed using Claude Code. All code generation and modifications are handled through AI assistance, ensuring consistent code quality and patterns throughout the application.
