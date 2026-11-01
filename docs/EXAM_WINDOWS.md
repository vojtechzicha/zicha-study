# Window terms and exam venues

Some exams have no fixed date: the student takes them on any day of a range, in a testing centre
that publishes its opening days in batches. At ČZU PEF this is the **Testovací centrum PEF** (TC):
the teacher opens the test in Moodle for a range of days, the student books a PC seat in the
course's Moodle (up to 2 hours ahead, no walk-ins), and registers for the exam in UIS separately
(the seat booking is not a registration). In the exam period the TC is open every day and fills up
weeks ahead, so the day is worth planning early.

## Model

- **Window term**: an `exam_terms` row with `window_end` (the range is `date` … `window_end`,
  inclusive) and optionally `venue` (`tc_pef`). It covers its `part_ids` like any term, so a split
  exam can have a window for the written part (TC) and ordinary terms for the oral. A window is
  never locked.
- **Booked slot**: when the student has booked a seat, the slot is recorded as an ordinary locked
  term with `window_id` = the window. While such a term exists, the window isn't offered; deleting
  it brings the window back.
- **Venue days**: `venue_days` (`_id` = `<venue>:<date>`: `open_from`, `open_to`, `occupancy` %)
  and `app_settings.venue_calendars.<venue>.published_through`. Days up to that date that aren't
  listed are closed; later days are unknown and assumed open with the venue's usual hours
  (`EXAM_VENUE_INFO`), marked tentative.
- **Day gap between parts**: `exam_parts.<subject>.min_gap_days` (e.g. MKR: the oral at least a
  day after the TC test). Finance needs only the order (test, then oral; same day allowed).

## Scheduling (`lib/exam-scheduler/windows.ts`)

The solver works with concrete slots, so the scheduler page expands each window into candidate
slots: on the days the same study has other candidate terms (the test then shares that trip and
costs nothing extra), in the slot (venue opening or closing time) that doesn't collide with those
terms, plus the window's first and last open day as a fallback. Offering every day of a five-week
window made the exhaustive search take over a minute; with this and per-study solving (studies are
solved separately unless their optima collide) a full winter season takes a fraction of a second.

Slot ids are `<window id>@<date>T<HH:MM>`. In the plan, a picked slot shows "Rezervovat místo v TC
PEF (obsazeno n %)" and its lock button reads **Mám rezervaci**: pressing it creates the booked
term and releases other locks of the same parts.

## Importing venue days

`POST /api/venue-days/import`, the same bearer token as the exam term import
(`EXAM_IMPORT_TOKEN_SHA256`, docs/EXAM_IMPORT.md):

```jsonc
{ "venue": "tc_pef", "dry_run": false,
  "days": [{ "date": "2026-11-02", "open_from": "08:00", "open_to": "20:00", "occupancy": 45 }] }
```

The list is everything the venue currently shows. Days between its first and last date that are
missing were closed and are removed; earlier days are kept. The response lists `added`, `removed`
and `changed` (hours) dates and `published_through`, so the importer can announce newly opened
days. The importer is `exam-watch` in agents-study (source `tc`, the public page
https://tc.pef.czu.cz/aktualni-oteviraci-doba-testovaciho-centra-pef-czu/).

MCP: `list_venue_days`; window fields on `create_/update_exam_term` (`window_end`, `venue`,
`window_id`).

## Not done yet

How UIS lists the exam terms of TC subjects (one per attempt? a date range?) is not known until
the first one appears; the import never adopts a window, so such a term arrives as an ordinary
synced term next to the window. Revisit when a TC subject opens.
