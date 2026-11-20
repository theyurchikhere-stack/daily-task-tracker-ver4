# AGENTS.md

## Architecture

- **Frontend**: React 19 + Vite SPA in `src/`, built to `dist/`. No client router — tabs are React state in `src/App.tsx`. UI text is Russian.
- **Backend**: Netlify Server at `netlify/server/index.ts` (Hono app exported as default). It only handles `/api/*` (`export const config`). Do not add a catch-all SPA rewrite that would shadow `/api/*`.
- **Database**: Netlify Database via Drizzle (`drizzle-orm/netlify-db`). Schema in `db/schema.ts`, client in `db/index.ts`, migrations in `netlify/database/migrations/` (generated with `npx drizzle-kit generate --name <name>`; never hand-edit or apply them).

## Key files

- `src/api.ts` — fetch wrapper; every request sends `x-device-id`.
- `src/stats.ts` — streak ("огонёк") logic: a day counts if ≥1 task planned for that date is completed.
- `src/alarm.ts` — Web Audio alarm loop, due-reminder detection, snooze/fired bookkeeping in localStorage, `.ics` export with VALARM.
- `src/components/*View.tsx` — the four screens: Today, Calendar, Stats, Reminders.
- `netlify/server/calendar.ts` — fetches & parses external `.ics` feeds (ical.js: RRULE, EXDATE, RECURRENCE-ID, VTIMEZONE) with SSRF guard and 5-min in-memory cache. `netlify/server/ics.ts` — builds the task subscription feed.
- `src/external.ts` — places iPhone calendar occurrences on local days; `src/components/IphoneSync.tsx` — connect/disconnect UI (inside Reminders tab).
- `src/styles.css` — whole dark theme; CSS variables at the top.

## Non-obvious decisions

- **No accounts**: tasks are scoped by an anonymous device id (UUID in localStorage). The Reminders screen shows it as a "sync code" that can be entered on another device. Server validates it with `/^[a-zA-Z0-9-]{8,64}$/` and every query filters by it.
- Dates are stored as local `YYYY-MM-DD` text and time as `HH:MM` text, so the user's timezone never shifts a task to another day.
- Alarms ring client-side only while the app is open (checked every 10s); reminders whose time is before the task's creation are ignored. Fired/snoozed state is per-device in localStorage.
- Allowed categories/priorities are duplicated in `netlify/server/index.ts` and `src/types.ts` — keep them in sync.
- **iPhone integration** has two one-way links, since web apps can't read the iOS calendar or Clock app directly:
  - *iPhone → app*: the user publishes an iCloud calendar ("Public Calendar" link, `webcal://…icloud.com/published/…`) and pastes it; stored in `calendar_feeds` per device. Events are read-only, never counted in streaks/progress. Timed occurrences come back as UTC ISO (or floating wall time), all-day as dates with exclusive end.
  - *app → iPhone*: `/api/feed/<deviceId>.ics` is a subscribed-calendar feed with VALARMs for tasks with reminders (floating local times). The device id is the secret in that URL.
