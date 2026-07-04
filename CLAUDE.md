# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

PizzaFlow: a Next.js 16 + Supabase pizza-ordering app for a counter/kiosk staff workflow, with a Supabase-Auth-gated admin section and three OpenRouter-backed AI features. See `README.md` for full architecture narrative, the three AI features' problem/fallback rationale, and the demo checklist — this file covers commands and things that require reading multiple files to piece together.

## Commands

- `npm install`
- `npm run dev` — Turbopack dev server on :3000
- `npm run build` / `npm run start` — production build/run
- `npm run lint` — eslint
- `npx tsc --noEmit` — type-check (no dedicated script; this is the way to verify types without a full build)
- **No automated test suite exists** — there is no test script and no test files anywhere in the repo; changes are verified manually.
- Adding a UI primitive: `npx shadcn@latest add <name>` — don't hand-write files under `src/components/ui/`, that directory is CLI-managed.

## Database (Supabase)

There is no migration tool — everything is plain SQL run manually in the Supabase SQL Editor. For a **fresh** project, only two files are needed: `supabase/schema.sql` then `supabase/seed.sql` — `schema.sql` is kept in sync with the end-state of every incremental migration below, so a new project never needs to replay history.

For an **existing** project that predates a given feature, also run the matching idempotent migration (safe to rerun): `add_settings.sql`, `fix_policies.sql`, `tighten_order_insert.sql`, `add_roles.sql`, `add_menu_admin_write.sql`, `add_place_order_rpc.sql`. When adding a new migration file, also fold its end-state into `schema.sql` in the same change, following that existing pattern.

Env vars (`.env.local`, copy from `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.

## Architecture

### Auth and roles — read before touching any page or route

- One shared Supabase Auth login (`/login`) gates both `/` (order-taking) and `/admin/*`.
- `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) delegates to `src/lib/supabase/middleware.ts`, which redirects unauthenticated visitors to `/login?next=<path>` and redirects `staff`-role visitors away from `/admin/*` back to `/`.
- Role (`staff`, the default, vs `admin`) lives in Supabase Auth's `app_metadata`, **not a database table** — read server-side via `src/lib/auth.ts`'s `getUserRole()`, and inside Postgres RLS policies via `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. Promoting a user requires a manual `update auth.users set raw_app_meta_data = ...` (see README), and that user must log out/in before the new role takes effect (the JWT is fixed at sign-in).
- The proxy/middleware check is deliberately only an *optimistic* UX redirect — RLS is the real authorization boundary everywhere. Every write-capable table has a matching RLS policy; there is no service-role key anywhere in the runtime.

### Order submission: one atomic RPC, not two inserts

`POST /api/orders` (`src/app/api/orders/route.ts`) never trusts the client: it re-runs every field through the same validators the client used (`src/lib/validators.ts`) and re-fetches menu item prices fresh from Supabase before computing the bill. It then calls the `place_order()` Postgres function (defined in `schema.sql`) which inserts the `orders` row and its `order_items` rows inside one transaction. Do not revert this to two separate `.insert()` calls — that was the original design and it could leave an order row with no line items if the second insert failed; the RPC exists specifically to close that gap.

### AI features are additive-only, never load-bearing

All three OpenRouter-backed features (Smart Order Assistant, anomaly explanation, insights narration) share `src/lib/openrouter.ts`'s `callOpenRouter()` (8s timeout, returns `{ok, text} | {ok: false, reason}`, never throws). Billing, validation, and anomaly detection are all deterministic code with zero LLM dependency — when touching AI-adjacent code, preserve the invariant that any of these three features can fail entirely (timeout, bad key, malformed JSON) and the rest of the app keeps working unaffected.

- The Smart Order Assistant (`src/components/order/AssistantPanel.tsx` → `/api/ai/assistant`) also extracts structured order fields from the conversation using `callOpenRouter(msgs, { jsonMode: true })`, surfaced as a "Fill order form" button. The model's raw output is never trusted directly: base/pizza/topping names are re-resolved against the real menu list server-side, and name/phone/quantity/payment-mode are re-run through the same validators as manual entry — anything that doesn't resolve/validate is silently dropped. Applying a fill only edits client-side form state; the actual submit still goes through the untouched, fully-validated `/api/orders` path.

### UI stack: shadcn/ui (Base UI, not Radix) + Tailwind v4 + lucide-react

`src/components/ui/*` are shadcn/ui components generated via the CLI's "Nova" preset, built on `@base-ui/react` — not classic Radix, despite looking similar. Tailwind v4's config is entirely CSS-first in `src/app/globals.css`'s `@theme inline` block — there is no `tailwind.config.ts`.

- Brand color is `--primary` (pizza-sauce red, `#c0392b`). shadcn's own `--accent` token is a separate, intentionally-neutral token used internally by components for hover/focus states — do not repoint `--accent` to the brand color; that collision happened once already and silently broke hover states on generated components.
- The app is deliberately **always light-themed** (counter/kiosk app, contrast shouldn't depend on a customer's OS setting) — `.dark`-class variables exist in `globals.css` from the shadcn scaffold but are unused; don't wire up a dark-mode toggle.
- The base/pizza/topping pickers intentionally use a plain native `<select>` restyled to match `Input`, not shadcn's Base UI `Select` — a popover-based listbox is unjustified complexity for a flat "pick one item" dropdown.

### Order model and money

The order model is single-combo: one base + one pizza + one topping + a quantity (the same combo repeated N times) — there is no multi-line cart. `src/lib/billing.ts`'s `computeBill()` is the single source of GST (18%, hardcoded) and bulk-discount math, called identically from the client-side live bill preview and the server route, both reading the same live discount-threshold value (`src/lib/settings.ts`, backed by the `app_settings` table, editable at `/admin/settings` with no deploy — see README's "Admin-configurable discount threshold").

### Stage 2 parity is a design constraint, not legacy cruft

`src/lib/validators.ts`'s rules — e.g. phone numbers must start with 6/7/8/9 — are explicitly-commented, byte-for-byte ports of an original Python `validators.py`, chosen to match real Indian mobile numbering, not arbitrary restrictions. Don't "fix" these to be more permissive without confirming with the user first; this exact rule has already been mistaken for a bug once.
