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

This is a Next.js 15 app with MongoDB Atlas backend for tracking university studies. The application uses:

- **Next.js App Router** for pages and routing
- **NextAuth.js v5** for authentication with Microsoft Entra ID (personal accounts)
- **MongoDB Atlas** for database (single-user app, auth enforced by NextAuth middleware)
- **Shadcn/ui** component library (47 pre-built components in components/ui/)
- **TypeScript** throughout with path aliases (@/ prefix)
- **Tailwind CSS** for styling with CSS variables
- **Dynamic Theming** that extracts colors from study logos

## Key Code Structure

```
auth.ts                  # NextAuth.js v5 config (Microsoft Entra ID provider, JWT token refresh)
app/
├── [slug]/              # Public study view (dynamic route)
├── api/auth/[...nextauth]/ # NextAuth API route handler
├── studies/             # Protected study management (guarded by middleware)
│   ├── [id]/           # Individual study routes
│   │   ├── edit/       # Edit study details
│   │   ├── settings/   # Study settings
│   │   └── statistics/ # Study analytics
│   └── new/            # Create new study

components/
├── ui/                  # Shadcn/ui components (don't modify)
└── *.tsx               # Feature components

lib/
├── mongodb/            # MongoDB Atlas connection and data access
│   ├── connection.ts   # Cached MongoClient singleton (survives HMR)
│   └── db.ts           # Server-side data access layer (typed async functions for all collections)
├── actions/            # Next.js Server Actions (client-side data layer)
│   ├── studies.ts      # Study CRUD operations
│   ├── subjects.ts     # Subject CRUD operations
│   ├── materials.ts    # Material and subject material operations
│   ├── study-notes.ts  # Study notes + linked subjects/exams
│   ├── final-exams.ts  # Final exam operations
│   ├── exam-options.ts # Exam scheduler options
│   └── logos.ts        # Logo upload/delete (stored as Binary in MongoDB)
└── utils/
    └── onedrive.ts     # OneDrive token from NextAuth session + Graph API helper
```

## Database Schema

MongoDB Atlas collections (auth enforced by NextAuth middleware):

- **studies**: User's university programs (_id, user_id, name, type, years, status, is_public, public_slug, logo_data, logo_mime_type)
- **subjects**: Courses within studies (_id, study_id, name, semester, credits, subject_type, completion_type, grade, final_date, hours)
- **final_exams**: State final exams (_id, study_id, name, shortcut, grade, exam_date)
- **materials**: Study materials from OneDrive (_id, study_id, name, onedrive_id, is_public, public_slug)
- **subject_materials**: Subject-specific materials (_id, study_id, subject_id, name, onedrive_id)
- **study_notes**: DOCX study notes with denormalized linked_subjects[] and linked_final_exams[] arrays
- **study_notes_cache**: Cached HTML conversions (_id, study_note_id, html_content)
- **study_notes_media**: Extracted images stored as Binary (_id, cache_id, file_path, file_data)
- **exam_options**: Exam scheduler options (_id, subject_id, date, start_time, duration_minutes)

Note: study_note_subjects and study_note_final_exams join tables from PostgreSQL are denormalized into study_notes.linked_subjects[] and study_notes.linked_final_exams[] arrays.

## Important Patterns

1. **Authentication**: All /studies/* routes require authentication via NextAuth.js middleware. Use `useSession()` on client, `auth()` on server.
2. **Data Access**: Use `lib/mongodb/db.ts` functions directly in server components/API routes. Use Server Actions from `lib/actions/` in client components (never import MongoDB driver in client code).
3. **Forms**: Use react-hook-form with zod validation (see existing forms for patterns)
4. **UI Components**: Always check components/ui/ for existing components before creating new ones
5. **Public Sharing**: Studies can be shared via public_slug at /[slug] routes
6. **Constants**: ALWAYS use centralized constants from `lib/constants.ts` - never hardcode enum values across multiple files. This includes study types, forms, subject types, completion types, etc. All enum-like values must be defined once and imported everywhere.
7. **Sharing Dialogs Design**: All sharing/publish dialogs (materials, study notes) must follow the same design pattern:
   - Consistent dialog layout with max-width of 500px
   - URL slug input with real-time validation and status messages
   - Visual URL preview in a colored box (blue for valid, red for invalid)
   - Gradient-styled action buttons (`from-primary-600 to-primary-700`)
   - Both preview boxes and the dialog contents must have `dark:` variants (see Theming)
   - Clear visual feedback for URL availability
   - When disabling public access, clear the public_slug to null
8. **Footer Attribution**: Use `lib/site-config.ts` for footer owner attribution, profile image path, byline, and footer home-link labels. Do not hardcode deployer-specific attribution in components.
9. **Public Share URLs**: Always build shareable URLs (clipboard copies, preview boxes, exports) via `getShareUrl()` from `lib/utils/share-url.ts`. It honors `NEXT_PUBLIC_USE_SUBDOMAIN_SHARE_URLS` + `NEXT_PUBLIC_SHARE_BASE_DOMAIN` so production renders `https://<study>.zicha.study/<rest>` while local stays on `${window.location.origin}/<study>/<rest>`. Never concatenate `window.location.origin` manually for share URLs.

## Development Notes

- The project uses ESLint for code quality with Next.js and TypeScript support
- ESLint is configured with moderate rules to catch common issues without being overly strict
- Build process ignores ESLint and TypeScript errors (configured in next.config.js)
- Environment variables are stored in .env / .env.local (MONGODB_URI and MONGODB_DB required); `vercel env pull .env.local` fetches them
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
OneDrive access tokens are managed by NextAuth.js:
- Microsoft OAuth tokens are stored in the NextAuth JWT
- Token refresh is handled automatically in the `jwt` callback (60s before expiry)
- Use `getOneDriveToken()` or `makeGraphRequest()` from `lib/utils/onedrive.ts` in API routes
- The access token is exposed on the session via `session.accessToken`

## Theming: Logo Palette + Dark Mode

The UI has two independent theming axes that every component must respect:

1. **Dynamic logo palette** – `primary-50…950` are generated at runtime from the study logo.
2. **Light / dark mode** – the whole app (private screens, public pages, study notes, dialogs) renders in both.

Both are mandatory for any new or changed UI. A PR that adds a light-only element (white card, gray text,
hex colour) is incomplete.

### How the logo palette works
1. **Color Extraction**: Canvas API analyses the logo (`lib/color-extraction.ts`) and picks the dominant colour.
2. **Theme Generation**: `generateColorTheme()` builds the `--primary-50…950` ladder from it.
3. **CSS Variables**: `hooks/use-logo-theme.ts` writes them inline on `<html>`; pages that never mount the hook
   (login, tasks, exam scheduler) get identical `:root` fallbacks from `app/globals.css`. Keep the two in sync.
   The effect in `useLogoTheme` must stay free of "skip if unchanged" ref guards: under React Strict Mode
   (dev) effects run mount → cleanup → mount, and such a guard cancels the first extraction and skips the
   second, so the palette is never applied. The dependency array is the only de-duplication.
4. **Tailwind**: `primary-*` classes (`tailwind.config.ts`) resolve to those variables. The ladder is the SAME in
   light and dark mode (inline styles beat `.dark {}`), so dark-mode usage is expressed with `dark:` variants,
   exactly like Tailwind's built-in palettes.

Ladder guarantees (relied on by the dark-mode rules): 50/100 are very light tints (96 % / 94 %), 300/400 are
≥ 80 % / ≥ 75 % lightness (readable as text on dark), 600 ≤ 50 %, 700 ≤ 40 %, 800 ≤ 30 %, 900 ≤ 22 %, 950 = 12 %
(a dark tinted surface). `--primary-foreground` is derived from the logo colour so `bg-primary` buttons are
readable in both modes.

### How dark mode works
- `next-themes` with `attribute="class"` (Tailwind `darkMode: ["class"]`), `defaultTheme="system"`,
  `storageKey="zs_theme"` – configured once in `app/layout.tsx`.
- **Exactly two user-facing states**, light and dark (no "system" menu). With nothing stored, the theme follows
  `prefers-color-scheme` live; the first click on the toggle pins `light` or `dark` into `localStorage.zs_theme`
  and stops following the OS. (Same model as zicha-travel's `useAppTheme`.)
- `hooks/use-app-theme.ts` (`useAppTheme()` → `{ theme, toggleTheme, mounted }`) is the ONLY place that imports
  `next-themes`. Components never import `next-themes` directly.
- `components/theme-toggle.tsx` (`<ThemeToggle size="sm" />`) is the one-button Moon/Sun switch. It lives ONLY in
  the two footers (`TitlePageFooter` for private screens, `PublicPageFooter` for public ones) – never in headers,
  never twice on a page. Every full-page screen must render one of those footers, so a new page gets the switch
  by rendering the footer, not by placing the toggle itself.
- `color-scheme` is set on `:root` / `.dark` so native controls and scrollbars follow.
- Dark tokens live in the `.dark` block of `app/globals.css` (cool deep neutral: background `224 20% 8%`,
  card `224 18% 11%`, muted `224 14% 16%`, border `224 12% 20%`, muted-foreground `220 10% 68%`). Change them there,
  never per component.

### Standard Theming Rules (light AND dark)

#### Neutrals: use semantic tokens, never gray/white classes
The shadcn tokens flip automatically, so they need no `dark:` variant.

| Never write                                | Write instead                                     |
|--------------------------------------------|---------------------------------------------------|
| `bg-white` (cards, panels, headers, rows)  | `bg-card`                                         |
| `bg-white` (page level)                    | `bg-background`                                   |
| `bg-white/80 backdrop-blur` (sticky bars)  | `bg-card/80 backdrop-blur`                        |
| `bg-gray-50` / `bg-gray-100`               | `bg-muted/50` / `bg-muted`                        |
| `hover:bg-gray-50` / `hover:bg-gray-100`   | `hover:bg-muted/60` / `hover:bg-muted`            |
| `text-gray-900`, `text-gray-800`           | `text-foreground`                                 |
| `text-gray-700`                            | `text-foreground/80` (secondary: `text-muted-foreground`) |
| `text-gray-600`, `text-gray-500`           | `text-muted-foreground`                           |
| `text-gray-400` (placeholders, icons)      | `text-muted-foreground/70`                        |
| `text-gray-300` (disabled)                 | `text-muted-foreground/50`                        |
| `border-gray-200/300`, `divide-gray-*`     | `border-border` / `divide-border`                 |
| `border-white/20` (glass headers)          | `border-border/40`                                |
| `bg-popover`-style custom tooltips/menus   | `bg-popover text-popover-foreground border-border`|

#### Primary tints: Tailwind idiom, add the `dark:` variant
| Light                                   | Add                                        |
|-----------------------------------------|--------------------------------------------|
| `bg-primary-50`                         | `dark:bg-primary-950`                      |
| `bg-primary-100`                        | `dark:bg-primary-900/50`                   |
| `bg-primary-200`                        | `dark:bg-primary-800/60`                   |
| `hover:bg-primary-50` / `-100`          | `dark:hover:bg-primary-900/40` / `/60`     |
| `text-primary-600`                      | `dark:text-primary-400`                    |
| `text-primary-700`                      | `dark:text-primary-300`                    |
| `text-primary-800` / `-900`             | `dark:text-primary-200` / `-100`           |
| `border-primary-100/200/300`            | `dark:border-primary-900/800/700`          |
| Page shell `bg-gradient-to-br from-primary-50 to-primary-100` | `dark:from-primary-950 dark:to-background` |
| `bg-primary-600/700 text-white`, gradient buttons `from-primary-600 to-primary-700`, `focus:ring-primary-500` | unchanged – they already work in dark |

#### Status colours (green / red / amber / yellow / orange / purple / indigo / blue): same idiom
`bg-<c>-50` → `dark:bg-<c>-950/40`, `bg-<c>-100` → `dark:bg-<c>-900/40`, `text-<c>-600` → `dark:text-<c>-400`,
`text-<c>-700` → `dark:text-<c>-300`, `text-<c>-800/900` → `dark:text-<c>-200`, `border-<c>-200` →
`dark:border-<c>-800`, gradients `via-white to-white` → `via-card to-card`, coloured shadows → `dark:shadow-none`.
Solid `bg-<c>-500/600 text-white` badges stay as they are.

Class strings that live in `lib/` (`lib/status-utils.ts`, `lib/constants.ts`, `lib/highschool/grades.ts`) must
carry their `dark:` variants inside the helper, so every consumer gets them. Never patch consumers instead.

#### Buttons and Primary Actions
- **Gradient Buttons**: `bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800`
- **Solid Buttons**: `bg-primary-600 hover:bg-primary-700`
- **Ghost Buttons**: `text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300`

#### Badges and Status Indicators
- **Primary Badge**: `bg-primary-600 text-white`
- **Secondary Badge**: `bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300`
- **Outline Badge**: `border-primary-200 text-primary-600 dark:border-primary-800 dark:text-primary-400`

#### CSS files and inline styles
- `--primary-*` (and all shadcn tokens) are bare, **space-separated** HSL triples: `--primary-600: 217 91% 55%`.
  Never the comma form (`217, 91%, 55%`) – it breaks Tailwind opacity modifiers such as `bg-primary-900/50`.
- Always wrap them: `hsl(var(--primary-600))`, `hsl(var(--primary-50) / 0.5)`. A bare `var(--primary-600)` used as a
  colour is invalid CSS and renders nothing. Fallbacks use the space form: `hsl(var(--primary-50, 217 100% 95%))`.
- In `.css` files use tokens (`hsl(var(--card))`, `hsl(var(--foreground))`, `hsl(var(--muted-foreground))`,
  `hsl(var(--border))`) instead of hex neutrals, and add `.dark .selector { … }` overrides for tinted colours
  following the same 50→950 / 600→400 mapping. `app/study-note-content.css` (DOCX notes) and the `.tiptap-note`
  block in `app/globals.css` (Markdown notes) are the reference implementations.
- Data-driven colours (doodle strokes, diploma paper, QR/scan surfaces) keep their data; make the *surface* explicit
  (e.g. an always-light "paper" background) so the content stays visible in both modes. Never invert images.

#### Dark-mode checklist for any UI change
Before finishing, switch the toggle to dark and check: text contrast (AA), borders on cards/inputs/tables visible,
hover/selected/disabled/active states visible, skeletons and empty/error states not white, dialog/popover/tooltip/
toast contents readable, focus rings visible, charts (axes, grid, tooltips, fills) readable, KaTeX and note
content readable, no `bg-white`/`text-gray-*`/hex colours introduced (`grep -nP "bg-white|text-gray-|#[0-9a-fA-F]{6}\b"`).

### Files Involved
- `app/globals.css` – light/dark tokens, `--primary-*` fallbacks, `.tiptap-note` note styles
- `app/study-note-content.css` – DOCX note styles (light + `.dark` overrides)
- `tailwind.config.ts` – `primary-50…950` scale
- `hooks/use-logo-theme.ts`, `lib/color-extraction.ts` – palette extraction and generation
- `hooks/use-app-theme.ts`, `components/theme-toggle.tsx`, `components/theme-provider.tsx`, `app/layout.tsx` – dark mode
- `lib/status-utils.ts`, `lib/constants.ts` – shared status/badge class strings (with `dark:` variants)

### Implementation Example
```tsx
// ❌ Light-only, hardcoded
<div className="bg-white border border-gray-200 text-gray-900">
  <span className="text-blue-600">Detail</span>
  <span className="bg-primary-50 text-primary-700">Aktivní</span>
</div>

// ✅ Tokens + dark variants
<div className="bg-card border border-border text-foreground">
  <span className="text-primary-600 dark:text-primary-400">Detail</span>
  <span className="bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300">Aktivní</span>
</div>
```

- No new typescript build errors should be added (change previous guidance, make sure we do not change UI components but add error labels)
- Respect the linter. Is hould show no errors and preferrably no warnings.
