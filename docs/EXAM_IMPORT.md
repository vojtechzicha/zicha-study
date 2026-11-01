# Exam term import

`POST /api/exam-terms/import` keeps the exam scheduler's candidate terms in sync with a university
system. The importer runs elsewhere: it logs into the system as the student, reads the exam terms,
normalizes them and posts a full snapshot here. The importer is `exam-watch` in the private
`agents-study` repo, one source per study:

| `source` | System | Study |
|---|---|---|
| `uis` | UIS at ČZU (`is.czu.cz`, exam terms page) | Ing. PEF ČZU |
| `stag` | IS/STAG at UHK (`stagws.uhk.cz`, web service `terminy/getTerminyProStudenta`) | Ing. FIM UHK |

This app matches the terms to its own subjects and periods and decides what to write; it doesn't
care which system they came from.

## Auth

`Authorization: Bearer zsi_…`. Vercel holds only the token's SHA-256 in
`EXAM_IMPORT_TOKEN_SHA256` (lowercase hex; comma-separated for rotation). Without it the endpoint
answers 503. Make a token and its hash with:

```sh
token="zsi_$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
printf %s "$token" | shasum -a 256 | cut -d' ' -f1
```

## Request

```jsonc
{
  "study_id": "…",          // zicha.study study id
  "source": "uis",
  "complete": true,         // the list is everything the system shows; enables removals
  "dry_run": false,         // true = return the plan, write nothing
  "terms": [{
    "external_id": "123456",            // the system's own term id, stable across edits
    "subject_code": "EUE81E",           // matched to subjects.abbreviation of the study
    "subject_name": "Velkoobchod a maloobchod",
    "date": "2026-12-13", "start_time": "15:45", "end_time": null,
    "assessment": "exam",               // "credit" (zápočet) | "exam" | null
    "form": "písemná",                  // matched to the period's exam parts
    "attempt": "regular",               // "regular" | "resit" | "pre_term" | "any" | null
    "status": "available",              // "registered" | "available" | "unavailable"
    "status_note": null,
    "kind": "zkouška (písemná)", "term_type": "řádný",   // raw labels, for display
    "room": "AII", "examiners": "…", "listed_by": "…",
    "capacity": 30, "registered_count": 4,
    "registration_from": "2026-11-30T00:00",            // Prague time
    "registration_to": "2026-12-11T23:59",
    "deregistration_to": "2026-12-12T12:00"
  }]
}
```

Body limit 512 kB, at most 500 terms. Unknown fields are rejected.

## Response

`counts` (`created`, `updated`, `deleted`, `unchanged`, `skipped`), `events` (what changed, for
notifications), `skipped` (term and reason) and `warnings`. Every run is also stored in
`app_settings.exam_import_runs.<study_id>`.

| Event | Meaning |
|---|---|
| `created` | a new candidate term |
| `adopted` | a term entered by hand (same subject, period and day) became the synced one |
| `rescheduled` | date or time changed (`changes`) |
| `registered` / `deregistered` | the student signed up / off |
| `removed` | gone from the system; the unlocked term was deleted |
| `removed_locked` | gone from the system; the locked term was kept and flagged (`external.removed_at`) |
| `restored` | a flagged term is listed again |

## Rules

Synced terms carry `source`, `external_id` and `external` (the system's details as last seen, see
`ExamTermExternal` in `lib/constants.ts`). The planner is `lib/exam-import/plan.ts`.

1. **Known term** (same `source` + `external_id`): date, time, předtermín flag, parts (if the
   subject is split) and `external` are updated; the period, note and online flag stay as they
   are. The duration changes only when the system gives an end time. Changes that only refresh
   `registered_count` or `status_note` are written without an audit entry.
2. **New term**:
   - Resits (`attempt: "resit"`) are skipped: they only open after a failed attempt.
   - Subject: by code, case-insensitive. Two subjects with one code (a repeated subject): the one
     a current period lists.
   - Period: among the study's current periods (due date today or later) that list the subject.
     A period whose name says "Zápočet" only takes credits, "Zkoušky"/"Zkouškové" only exams.
     If several remain: the one named for the assessment, then the one whose window contains the
     date, then the nearest one that starts after the date (a předtermín). Otherwise skipped.
   - A hand-made term of the same subject, period and day is adopted: it gets the sync fields,
     the system's time and `is_tentative: false`, and keeps its lock, note and duration.
   - Otherwise a term is created, locked if the student is already registered.
3. **Registration**: when the student signs up, an unlocked term is locked
   (`external.auto_locked`). Signing off releases only that automatic lock. As soon as the user
   changes the lock by hand (toggle, editor, MCP), it is the user's and stays
   (`lib/exam-import/lock.ts`).
4. **Removal** (only with `complete: true`): an upcoming synced term of a current period that is
   missing from the snapshot is deleted if unlocked, or flagged if locked. Past terms are never
   touched (the system stops listing them). An empty snapshot removes nothing and returns a warning.
5. **Deleted by the user**: deleting a synced term (UI or MCP) records it in
   `exam_term_dismissals`, and later imports skip it (`dismissed`).

A unique index on `(study_id, source, external_id)` (synced terms only) keeps overlapping imports
from creating a term twice; the loser skips the term with a warning.

Every write is logged in `mcp_audit` with `tool: "exam_import"` and `client_name: "UIS sync"` / `"STAG sync"`, so
`list_recent_changes` shows synced changes next to the connector's.
