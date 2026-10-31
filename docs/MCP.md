# Claude connector (remote MCP)

The app serves a remote [MCP](https://modelcontextprotocol.io) server at `/api/mcp`. Add it to Claude once and
every Claude session (claude.ai chat, Claude Code on the web and in the terminal, mobile) can read and edit the
production data, including sessions working in other repositories.

## Connect

**claude.ai** (covers chat, mobile and Claude Code cloud sessions): Settings → Connectors → Add custom connector,
URL `https://www.zicha.study/api/mcp`. Claude opens the app's consent page; sign in with Microsoft, choose
"Číst i upravovat" or "Jen číst", and approve. New sessions pick the connector up when they start.

**Claude Code in a terminal:**

```bash
claude mcp add --transport http --scope user zicha-study https://www.zicha.study/api/mcp
```

Then run `/mcp` in Claude Code and authenticate.

The dashboard's robot icon ("Připojení Claude") shows the connector address and every connected app. "Odpojit"
revokes an app immediately.

## What agents can do

| Area | Tools |
| --- | --- |
| Studies | `list_studies`, `get_study`, `create_study`, `update_study`, `delete_study` |
| Subjects | `list_subjects`, `get_subject`, `create_subject`, `update_subject`, `delete_subject` |
| Final exams | `list_final_exams`, `create_final_exam`, `update_final_exam`, `delete_final_exam` |
| Tasks | `list_tasks`, `create_task`, `update_task`, `delete_task` |
| Exam scheduler | `list_exam_periods`, `create_/update_/delete_exam_period`, `create_/update_/delete_exam_term` |
| Notes | `list_notes`, `get_note`, `create_markdown_note`, `update_note`, `set_markdown_note_content`, `delete_note`, `link_note`, `unlink_note` |
| Procvičování | `get_practice_module`, `update_practice_module`, `get_practice_page`, `update_practice_page`, `delete_practice_page`, `set_practice_progress`, `create_practice_upload`, `revoke_practice_upload` (enable with `update_subject` `practice_enabled`) |
| History | `list_recent_changes` |

Left to the app, because it needs OneDrive (a Microsoft token the server doesn't keep) or file uploads: materials,
Word/Obsidian note content, logos, diplomas, the materials folder. `delete_study` and `delete_note` refuse records
that have OneDrive backup copies, and `delete_note` only deletes Markdown notes.

Every tool goes through `lib/mongodb/db.ts`, like the Server Actions, so cascades and checks (repeat chains, slug
availability) behave the same. Inputs are validated with zod against the values in `lib/constants.ts`; unknown
fields are rejected. Update and delete tools take `dry_run`.

## Procvičování uploads

Practice pages are too large for tool arguments, so content goes in over HTTP:

1. `update_subject` with `practice_enabled: true` creates the subject's module (address
   `/<study>/procvicovani/<subject note address>`), `update_practice_module` adjusts it.
2. `create_practice_upload` returns a token (30 min, 200 requests) and `upload_base_url`
   (`https://www.zicha.study/api/practice/upload`).
3. `PUT <base>/module` with a JSON manifest (`intro_html`, `intro_blocks`, `closing_blocks`,
   `groups: [{key, title, description, pages: [slug…]}]`) sets the index texts and page order.
4. `PUT <base>/pages/<slug>` with a generator page (`Content-Type: text/html`, `?strict=1` requires
   `data-key` on every example) or a JSON envelope. Pages are upserted by slug; the previous content
   is kept as a version (newest 3); an identical upload changes nothing.

Send the token as `Authorization: Bearer <token>`. It stops working when the connection is revoked,
the email leaves `ALLOWED_EMAILS` or practice is turned off for the subject; `revoke_practice_upload`
ends it early. All HTML is sanitized (`lib/practice/sanitize.ts`): unknown classes and styles are
removed with a warning; light-only colours, unknown CSS variables and links to other files fail.
Responses: `201`/`200` with links and warnings, `401`/`403` token problems, `413` over 1.5 MB, `415`
wrong content type, `422` rejected content (with `errors`), `409` concurrent upload of the same page.

## Safety

- **Audit log**: every write is stored in `mcp_audit` with the record before and after, readable through
  `list_recent_changes`. Use it to review or undo an agent's change. Practice uploads are logged as
  `practice_upload` with slug, revision and content hash (the page versions hold the content).
- **Markdown notes**: `set_markdown_note_content` keeps the replaced content in the note's version history.
- **Scopes**: `study:read` or `study:read study:write`, chosen on the consent page. Read-only connections don't
  see write tools at all. Tools are annotated read-only / destructive, so Claude asks before deleting.
- **Tokens**: access tokens last 1 hour, refresh tokens 60 days and rotate on every use. Reusing an old refresh
  token revokes the whole connection. Codes and tokens are stored only as SHA-256 hashes.
- **Who**: sign-in goes through Auth.js, so `ALLOWED_EMAILS` applies. It is checked again on every MCP request,
  so removing an address also cuts off its connectors.
- **Redirects**: clients may only register Claude's callbacks (`https://claude.ai/api/mcp/auth_callback`,
  `https://claude.com/api/mcp/auth_callback`) and loopback addresses (Claude Code). `MCP_EXTRA_REDIRECT_URIS`
  adds more, e.g. for the MCP Inspector.

## How it works

```
Claude ── POST /api/mcp (Bearer) ──▶ app/api/mcp/route.ts ─▶ lib/mcp/server.ts ─▶ lib/mcp/tools/* ─▶ lib/mongodb/db.ts
   │ 401 + resource_metadata
   ├─▶ /.well-known/oauth-protected-resource/api/mcp   (RFC 9728)
   ├─▶ /.well-known/oauth-authorization-server         (RFC 8414)
   ├─▶ POST /api/mcp/oauth/register                    (dynamic client registration, RFC 7591)
   ├─▶ /oauth/authorize                                (Microsoft sign-in + consent, PKCE S256)
   ├─▶ POST /api/mcp/oauth/token                       (authorization_code, refresh_token)
   └─▶ POST /api/mcp/oauth/revoke                      (RFC 7009)
```

- `lib/mcp/oauth.ts`: authorization server (registration, codes, tokens, verification).
- `lib/mcp/tool-kit.ts`: tool definition, scope filtering, error handling, audit and dry-run helpers.
- `lib/mcp/tools/`: one file per area.
- `lib/actions/mcp.ts`: Server Actions for the consent page and the "Připojení Claude" dialog.
- Collections: `mcp_clients`, `mcp_auth_codes`, `mcp_grants` (one per connected app), `mcp_tokens`, `mcp_audit`,
  `practice_upload_tokens`. TTL indexes on `expires_at` prune expired codes and tokens.
- `lib/practice/upload.ts`, `lib/practice/upload-handlers.ts`, `app/api/practice/upload/`: the practice upload
  endpoint.

The endpoint is stateless (a new MCP server per request, JSON responses), which fits Vercel functions.

The issuer and resource URLs come from the request host. Set `MCP_PUBLIC_URL` if a proxy hides it. Tokens are
bound to the origin that issued them, so a token from production doesn't work on a preview deployment.

## Testing locally

```bash
pnpm dev
npx @modelcontextprotocol/inspector
```

In the Inspector, connect to `http://localhost:3000/api/mcp` with Streamable HTTP. Its callback is a
loopback address, so it may register without extra configuration.

Tests: `lib/mcp/__tests__/` (OAuth flow and the endpoint, with an in-memory store).
