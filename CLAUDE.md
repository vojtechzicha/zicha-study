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
- **Dynamic Theming** that extracts colors from study logos

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
7. **Sharing Dialogs Design**: All sharing/publish dialogs (materials, study notes) must follow the same design pattern:
   - Consistent dialog layout with max-width of 500px
   - URL slug input with real-time validation and status messages
   - Visual URL preview in a colored box (blue for valid, red for invalid)
   - Gradient-styled action buttons (blue-to-indigo gradient)
   - Clear visual feedback for URL availability
   - When disabling public access, clear the public_slug to null

## Development Notes

- The project uses ESLint for code quality with Next.js and TypeScript support
- ESLint is configured with moderate rules to catch common issues without being overly strict
- Build process ignores ESLint and TypeScript errors (configured in next.config.js)
- Environment variables are stored in .env (Supabase URL and keys required)
- No test suite is configured
- The project auto-syncs with v0.dev deployments

## Study Notes Feature

Study notes allow users to upload DOCX files to OneDrive and display them as beautifully formatted HTML with:
- On-demand DOCX to HTML conversion using Mammoth.js (Vercel compatible)
- Math expression rendering with KaTeX
- Automatic table of contents generation
- Image extraction and serving
- Smart caching with OneDrive timestamp comparison

### Architecture
- API route `/api/study-notes/[slug]/convert` handles DOCX conversion
- API route `/api/study-notes/[slug]/media/[...path]` serves extracted images
- Converted HTML and media are cached in database for optimal performance
- Client-side KaTeX rendering for math expressions
- Regeneration triggered by OneDrive file changes or ?flush=1 parameter

### OneDrive Token Management
The app uses Microsoft OAuth for OneDrive access. There are known limitations with Supabase's OAuth integration:
- Supabase may not always expose the provider refresh token
- Access tokens expire after 1 hour
- Refresh token support requires setting environment variables (see `.env.example`)
- The auth callback logs token availability for debugging
- If refresh tokens aren't available, users need to re-authenticate periodically

## Dynamic Theming System

The application features a dynamic theming system that automatically extracts colors from study logos and applies them throughout the UI.

### How It Works
1. **Color Extraction**: Uses Canvas API to analyze logo images and extract dominant colors
2. **Theme Generation**: Creates a full color palette (50-900 shades) from the extracted color
3. **CSS Variables**: Sets custom properties on the document root (--primary-50 to --primary-900)
4. **Automatic Application**: Tailwind classes automatically use these CSS variables

### Standard Theming Rules
**ALWAYS use theme colors for UI elements, never hardcode blue/indigo colors:**

#### Buttons and Primary Actions
- **Gradient Buttons**: `bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800`
- **Solid Buttons**: `bg-primary-600 hover:bg-primary-700`
- **Ghost Buttons**: `text-primary-600 hover:text-primary-700`

#### Backgrounds
- **Light Backgrounds**: `bg-primary-50` (very light) or `bg-primary-100` (light)
- **Hover States**: `hover:bg-primary-100`
- **Selected States**: `bg-primary-100`

#### Text and Borders
- **Primary Text**: `text-primary-600` or `text-primary-700`
- **Borders**: `border-primary-200` or `border-primary-300`
- **Focus Rings**: `focus:ring-primary-500`

#### Badges and Status Indicators
- **Primary Badge**: `bg-primary-600 text-white`
- **Secondary Badge**: `bg-primary-100 text-primary-700`
- **Outline Badge**: `border-primary-200 text-primary-600`

### Implementation Example
```tsx
// ❌ OLD - Hardcoded colors
<Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">

// ✅ NEW - Dynamic theme colors
<Button className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800">
```

### Files Involved
- `/hooks/use-logo-theme.ts` - Hook that manages color extraction
- `/lib/color-extraction.ts` - Color extraction and theme generation utilities
- Components should use Tailwind's `primary-*` color classes

### Important Implementation Details
**CSS Variables Format**: The CSS variables store HSL values WITHOUT the `hsl()` wrapper:
- ✅ CORRECT: `--primary-600: 217, 91%, 55%`
- ❌ WRONG: `--primary-600: hsl(217, 91%, 55%)`

This is because Tailwind wraps the values in `hsl()` when using them. The color generation ensures:
- `primary-600` has maximum 50% lightness for sufficient contrast with white text
- `primary-700` has maximum 40% lightness
- `primary-800` has maximum 30% lightness

When using CSS variables directly in inline styles, wrap them in `hsl()`:
```tsx
style={{ backgroundColor: "hsl(var(--primary-600))" }}
```
- No new typescript build errors should be added (change previous guidance, make sure we do not change UI components but add error labels)
- Respect the linter. Is hould show no errors and preferrably no warnings.