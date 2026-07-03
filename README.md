# PizzaFlow — Stage 3 Full-Stack Live App

Production web app that replaces SliceMatic's Google Form: a Next.js
ordering UI, a Supabase Postgres backend, a Supabase-Auth-gated admin
view, and three OpenRouter-powered AI features scoped in the team's own
Stage 1 discovery document.

## Architecture

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind), deployed on Vercel.
- **Backend**: Next.js Route Handlers under `src/app/api/**`. All order
  writes go through `POST /api/orders` -- never a direct browser-to-
  Supabase insert -- because it re-validates every field server-side and
  re-fetches menu prices fresh from the DB, so a tampered client payload
  can never be persisted.
- **Database**: Supabase Postgres. The 3 tables the brief requires
  (`menu_items`, `orders`, `order_items` -- see `supabase/schema.sql`),
  plus a 4th, `app_settings`, added for the live-editable discount
  threshold described below. Row Level Security is the actual security
  boundary: `menu_items`/`app_settings` are publicly readable (counter
  staff order without logging in, and the order flow needs the live
  threshold to price a bill), `orders`/`order_items` allow public
  INSERT but restrict SELECT to `authenticated` -- that single policy is
  what gates the entire admin view. `app_settings` restricts UPDATE to
  `authenticated` the same way. No service-role key is used anywhere at
  runtime.
- **Auth**: Supabase Auth (email/password), via `@supabase/ssr`.
  `src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`)
  refreshes the session and redirects unauthenticated visitors away
  from `/admin/*`.
- **AI**: OpenRouter, called only from server-side route handlers --
  the API key never reaches the browser.

## Stage 2 logic preservation

Every Stage 2 rule is ported byte-for-byte (same constants, same regex,
same error text) rather than re-implemented, so there is no drift:

| Stage 2 rule | Stage 3 file |
|---|---|
| Name/phone/quantity/payment-mode validation | `src/lib/validators.ts` (ported from `validators.py`) |
| GST/discount billing math | `src/lib/billing.ts` (ported from `billing.py`) |
| Menu file loading | `supabase/schema.sql` + `supabase/seed.sql` (DB tables replace the `.txt` files) |
| Order logging | `orders` + `order_items` tables replace `orders_log.txt` |

**One documented adaptation**: Stage 2's "enter item number 1-N, reject
out-of-range" console prompt becomes a web `<select>` bound to real
`menu_items.id` values -- there's no numeric index to range-check on
the client. The equivalent defense-in-depth check happens server-side
in `POST /api/orders`, which re-fetches the 3 selected ids from Supabase
and rejects the request if any id doesn't resolve to an active row of
the expected category.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- from your Supabase project settings.
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` -- from openrouter.ai.
3. In the Supabase Dashboard SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
   - If you already ran these against an existing project before the `app_settings` table was added, run `supabase/add_settings.sql` instead (idempotent, safe to run once against an already-seeded project without duplicating menu/order data).
4. In Supabase Dashboard → Authentication → Users, manually create one admin user (email + password) for the `/admin` login.
5. `npm run dev`, open `http://localhost:3000`.

## The three AI features

Stage 1's own design philosophy governs all three: *"Input validation,
discount logic, and GST calculation are deterministic business rules --
solving them with plain code is faster, cheaper, and 100% reliable...
AI is used only where judgment, language understanding, or
pattern-summarization add real value."* None of the three AI features
below sit in the critical path of computing a bill or validating input
-- they are strictly advisory, and each has a fallback so an OpenRouter
outage never blocks the core ordering flow or breaks an admin page
(directly answering the brief's own sample question: *"If the
OpenRouter API goes down during peak hours, what does the system fall
back to?"*).

### 1. Smart Order Assistant

**Problem** (Stage 1, Opportunity 1): untrained staff make inconsistent
recommendations or mis-enter orders during a rush.
**What it does**: a non-blocking chat panel beside the order form
(`src/components/order/AssistantPanel.tsx` → `POST /api/ai/assistant`)
that answers menu questions and flags likely mistakes in conversation.
**System prompt**: see `buildSystemPrompt()` in
`src/app/api/ai/assistant/route.ts` -- it explicitly tells the model it
has no authority to place/modify orders, must never invent menu items
or prices, and must stay to 2-4 sentences.
**Fallback**: if OpenRouter fails or times out (8s), the endpoint still
returns HTTP 200 with a canned "assistant temporarily unavailable"
reply tagged `source: "fallback"` -- the panel renders it in an
"Offline mode" style bubble. The order form itself never reads from or
depends on this endpoint.

### 2. Anomaly / Error Flagging

**Problem** (Stage 1, Opportunity 3): silent billing errors (missed
discount, missed GST) go undetected.
**What it does**: `src/lib/anomaly.ts` runs deterministic checks
(discount-vs-quantity, GST-vs-post-discount-total, grand-total
reconciliation) against every order fetched in the admin Orders table --
zero network calls, so the badge itself never depends on OpenRouter
being up. Clicking a flagged order's badge calls
`POST /api/ai/anomaly-explain`, whose system prompt turns the already-
correct rule codes into a one- or two-sentence plain-English note.
**Fallback**: if the LLM call fails, the badge shows the rule's own
message text prefixed "(Automated explanation unavailable)" -- the flag
is never hidden or delayed by an OpenRouter outage.
**Demo data**: `supabase/seed.sql` seeds two deliberately broken
historical orders ("Test Anomaly One/Two") so this feature has
guaranteed, real hits to show live rather than hoping one occurs.

### 3. Sales & Ops Insights Dashboard

**Problem** (Stage 1, Opportunity 2): Rajan can't currently answer
basic business questions from his data.
**What it does**: `src/lib/insights.ts` computes best-selling pizza,
peak order day/hour, and discount-cost totals directly from the order
history (application-side aggregation -- a dedicated SQL view would be
over-engineering at this dataset size). `narrateInsights()` sends only
those pre-computed numbers to OpenRouter to be restated in plain
English; the model is explicitly told not to recompute or alter any
number.
**Fallback**: the numeric stat cards render unconditionally, computed
straight from Postgres; the "AI Summary" panel simply shows an
unavailable message instead of prose if OpenRouter fails -- nothing
about the page depends on the LLM.
**Demo data**: Stage 1's own risk log flagged that real order history
would be sparse this early, so `supabase/seed.sql` seeds ~35 historical
orders spread over 2 weeks with a genuine Saturday 19:00-21:00 bias, so
"peak hour" reflects a real pattern rather than seed-data noise.

### Model choice

`OPENROUTER_MODEL` is an env var, not hardcoded -- currently set to
**`openai/gpt-4o-mini`**. All three features issue short, low-token
completions (a chat reply, a one-line anomaly explanation, a short
summary), so a fast/cheap instruct model was prioritized over a larger
reasoning model: gpt-4o-mini is inexpensive, has low latency (matters
for the 8s timeout budget in `lib/openrouter.ts`), and is more than
capable of following a short, constrained system prompt. Swap it by
changing one env var, no code changes needed.

## Admin-configurable discount threshold

The bulk-discount quantity threshold (default 5, i.e. "5+ pizzas gets
10% off") is **not** a hardcoded constant that requires a code deploy to
change -- it lives in the `app_settings` table and is editable live from
`/admin/settings` (`src/app/admin/settings/page.tsx` +
`src/components/admin/SettingsForm.tsx` → `PATCH /api/admin/settings`).
The change takes effect immediately for the next order placed, no
redeploy:

- `src/lib/settings.ts`'s `getDiscountQtyThreshold()` reads the live
  value (falling back to the hardcoded default in `billing.ts` if the
  read ever fails -- a config read must never block checkout, same
  philosophy as the AI fallbacks above).
- Both the order page's live bill preview and the `/api/orders` route's
  authoritative computation call this same function, so what the
  customer sees while building an order always matches what the server
  actually charges.
- The admin Orders table's anomaly detection (`lib/anomaly.ts`) also
  reads the live threshold -- see the limitation below.

## Known simplifications

- No automated test suite -- verified manually per the checklist below.
- JS `Math.round` vs Python's banker's rounding (`round()`) in the
  original Stage 2 code can theoretically diverge at exact half-paise
  boundaries; not observed in practice with this price list.
- Insights Dashboard aggregates are computed in JS over the fetched
  order history rather than a dedicated SQL view/RPC -- fine at this
  dataset size, would need revisiting at real production volume.
- Demo-day order history includes seeded historical data (see above) --
  Stage 1's own risk log names this limitation explicitly rather than
  overstating organic traction this early.
- Anomaly detection re-evaluates orders against the *current*
  `app_settings` discount threshold, not the threshold that was active
  when each order was placed. If the threshold changes (e.g. 5 → 3), an
  older order placed with quantity 4 -- correctly undiscounted under the
  old rule -- will now appear as a `DISCOUNT_MISMATCH`. A production
  system would snapshot the applicable threshold per order; this
  project intentionally doesn't, to keep the schema small. (This is
  also an honest answer to "what's the single biggest weakness of the
  system you built today?")

## Deployment

- Public Vercel URL: **[fill in after deploying]**
- Supabase project URL: **[fill in]** (shared read-only with the grader)
- Env vars to set in Vercel project settings: same 4 as `.env.local.example`.

## Demo checklist

- [ ] Place a normal order end-to-end (happy path)
- [ ] Trigger one input-validation edge case live (e.g. quantity 11)
- [ ] Log into `/admin`, show the Orders table
- [ ] Click an anomaly badge on one of the seeded "Test Anomaly" orders
- [ ] Show the Insights Dashboard's stat cards + AI summary
- [ ] Explain what happens if OpenRouter is unreachable (see Fallback
      sections above) -- can demonstrate live with a temporarily-invalid
      `OPENROUTER_API_KEY`
- [ ] Change the discount threshold live from `/admin/settings` (e.g.
      5 → 3), then place a qty-3 order on the main page to show the new
      discount applies immediately with no redeploy
