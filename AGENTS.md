# AGENTS.md

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm lint         # must stay clean
pnpm lint:fix
pnpm test:run     # Vitest, single run (pnpm test = watch mode)
pnpm exec tsc --noEmit
```

## Overview

A personal tracker for university and high-school studies: Next.js 16 (App Router), React 19, TypeScript,
MongoDB Atlas, Auth.js (NextAuth v5) with Microsoft Entra ID personal accounts, Tailwind + shadcn/ui, Vitest.
Study materials and notes live in the user's OneDrive. The UI is in Czech. Deployed on Vercel.

## Code map

```
auth.ts                   Auth.js config: Entra ID provider, ALLOWED_EMAILS check, token refresh
middleware.ts             subdomain share links → 308 to path form; redirects signed-out users away from /studies, /tasks
app/
  [slug]/, [slug]/[materialSlug]/   public study, material and note pages
  studies/[id]/{edit,settings,statistics,notes/[noteId]}, studies/new
  tasks/, exam-scheduler/           cross-study tasks and the exam scheduler
  api/                    auth, OneDrive (files, search, picker, share), study-note conversion + media,
                          Markdown-note media, logos, diplomas, version
components/
  ui/                     shadcn/ui, don't modify
  subjects/               per-kind (university / high school) subject lists, forms and statistics
  markdown-notes/         TipTap editor for in-app Markdown notes
  *.tsx                   feature components
lib/
  mongodb/connection.ts   cached MongoClient
  mongodb/db.ts           all database access
  actions/                Server Actions used by client components
  exam-scheduler/         scheduling algorithm (with tests)
  constants.ts            enums, labels and badge classes
  study-kind.ts           university vs high-school terminology
  highschool/grades.ts    1–5 grading
  utils/                  OneDrive helpers and backup, share URLs, slugs, Excel export, note conversion
```

## Data

MongoDB collections: `studies`, `subjects`, `final_exams`, `materials`, `subject_materials`, `study_notes`
(Word, Obsidian and Markdown notes, told apart by `note_type`; linked subjects/exams are denormalized into
`linked_subjects[]` / `linked_final_exams[]`), `study_notes_cache` and `study_notes_media` (converted HTML and
images), `study_note_versions` and `markdown_note_media` (Markdown notes), `tasks`, `exam_periods`, `exam_terms`,
`exam_options`, `app_settings`.

Data isn't scoped per user. It is a single-user app: `ALLOWED_EMAILS` in `auth.ts` decides who can sign in.
Middleware only redirects signed-out users away from `/studies` and `/tasks`; Server Actions don't call `auth()`
themselves (except in `lib/actions/markdown-notes.ts`).

## Patterns

1. **Auth**: `useSession()` on the client, `auth()` on the server.
2. **Data access**: `lib/mongodb/db.ts` in server components and API routes; Server Actions from `lib/actions/`
   in client components. Never import the MongoDB driver in client code.
3. **Forms**: controlled components with `useState` and a local `error` string (see `components/task-dialog.tsx`).
4. **UI components**: reuse `components/ui/` before writing new ones.
5. **Constants**: every enum-like value (study types, forms, statuses, subject and completion types) is defined
   once in `lib/constants.ts` and imported. Many of these values are stored in MongoDB; never change a stored value
   to fix wording, change its display label instead.
6. **Study kinds**: kind-specific UI goes through the registries in `components/subjects/` and the terminology in
   `lib/study-kind.ts`, not inline `if (highSchool)` checks.
7. **Sharing dialogs** (materials, notes, study settings) look and read the same: max-width 500px, address input
   with live availability check, preview box of the full address, gradient primary button, `dark:` variants.
   Turning sharing off sets `public_slug` to `null`.
8. **Share URLs**: build every public link (copy buttons, previews, exports) with `getShareUrl()` /
   `getShareOrigin()` from `lib/utils/share-url.ts`, never from `window.location.origin`. In production they render
   `https://<study>.zicha.study/<rest>`, locally `http://localhost:3000/<study>/<rest>`.
9. **Footer attribution**: owner name, photo, byline and home-link labels come from `lib/site-config.ts`.
10. **Commit attribution**: when Codex creates a commit, end it with the trailer
    `Co-authored-by: codex <codex@openai.com>`, exactly.

## UI text (Czech)

- Short and plain. No descriptions that repeat a dialog or card title, no helper text that repeats a label, no
  filler ("úspěšně", "prosím", "vaše"). Required fields are marked `*`; don't also mark optional ones.
- Errors: "Nepodařilo se uložit předmět." Toasts: title only unless the description adds something.
- Confirm dialogs: the title asks ("Smazat předmět?"), the description states the consequence
  ("Předmět „X“ se trvale smaže.").
- Loading labels: "Ukládání…", "Mazání…", "Načítání…".
- Say "adresa", never "slug" or "URL adresa". Say "termín", not "deadline".
- Typography: „…“ quotes, en dash for ranges and separators (`3–50`, `Úprava – X`), the `…` character,
  a space before units (`5 MB`, `500 Kč`), correct plurals (`czPlural` in `lib/utils/task-format.ts`).
- Icon-only buttons need an `aria-label`. When a dialog has no `DialogDescription`, pass
  `aria-describedby={undefined}` to `DialogContent`.

## Study notes

Three kinds, all in `study_notes`:
- **Word**: a DOCX on OneDrive, converted with Mammoth by `/api/study-notes/[slug]/convert`. HTML and extracted
  images are cached in MongoDB and regenerated when the OneDrive file changes or with `?flush=1`.
- **Obsidian**: a read-only Markdown file from an Obsidian vault on OneDrive (`lib/utils/obsidian-convert.ts`).
- **Markdown**: written in the in-app TipTap editor (`components/markdown-notes/`), autosaved with version history.

Math renders with KaTeX; the table of contents is built from headings.

## OneDrive

Microsoft tokens live in the Auth.js JWT and are refreshed in the `jwt` callback 60 s before expiry. The access
token is on `session.accessToken`. In API routes use `getOneDriveToken()` / `makeGraphRequest()` from
`lib/utils/onedrive.ts`. Added materials and notes are copied to a backup folder (`lib/utils/onedrive-cache.ts`,
"Záloha souborů" in the UI) so public links survive deletion of the original.

## Build and checks

- `next.config.mjs` sets `typescript.ignoreBuildErrors`, so the build won't catch type errors. Run
  `pnpm exec tsc --noEmit` and add no new errors. Don't edit `components/ui/` to fix type errors.
- `pnpm lint` must show no errors, and preferably no warnings.
- Vitest suites live next to the code (`*.test.ts`, `lib/exam-scheduler/__tests__/`).
- Environment variables: `.env.local` (see `.env.example`); `vercel env pull .env.local` fetches them.

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
