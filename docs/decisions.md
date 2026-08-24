# Architecture Decision Records

Short log of major choices in Prophet Odds. Each entry is something I should be able to defend in an interview.

Format: **Context → Decision → Consequences**.

---

## ADR-001: Python for the scheduler prototype (not Go first)

**Context.** The hard problems early on were pricing math (de-vig, consensus, edge) and scheduling policy (cadence, windows, credit budget)—not raw throughput.

**Decision.** Build the first scheduler and engine in Python 3.11 under `backend/python-prototype/`.

**Consequences.**

- Fast iteration on formulas and fixtures; pure `engine/` modules stay easy to test.
- Runtime is fine for an NBA-focused prototype; multi-sport 24/7 load is the signal to port.
- Planned Go port reuses the same boundaries: provider → engine → store, with goroutines replacing the thread pool.

---

## ADR-002: `OddsProvider` Protocol instead of calling The Odds API everywhere

**Context.** Odds vendors change endpoints, regions, and credit models. Binding the scheduler to one HTTP client would make a vendor switch a rewrite.

**Decision.** Define `OddsProvider` (`get_events`, `get_event_odds`, quota) as a Protocol; implement The Odds API behind it.

**Consequences.**

- Scheduler and engine depend on `Event` / `Outcome` dataclasses, not JSON.
- A second vendor is a new module implementing the Protocol (~one file), not edits across `scheduler/` and `engine/`.

---

## ADR-003: Pure functions in `engine/`

**Context.** Pricing bugs are expensive if they only appear after a live poll.

**Decision.** `devig`, `consensus`, and `edge` take in-memory outcomes/events and return structures. No I/O, no env, no globals.

**Consequences.**

- Unit tests = fixtures in, assertions out.
- Scheduler is the only place that knows about HTTP and Supabase.

---

## ADR-004: Adaptive cadence instead of fixed-interval polling

**Context.** Naive 60s polling on all discovered events burns API credits. Far-out games do not need live-frequency updates.

**Decision.** Cadence from hours-until-commence (NBA: 60s live / near tip, 5 min within 24h, else skip). Priority queue keyed by `next_poll`.

**Consequences.**

- Credit spend concentrates on tip and live windows.
- Sport-specific rules can be added without changing the heap loop.
- See [`architecture.md`](architecture.md).

---

## ADR-005: Clerk + Supabase third-party auth (not app-only JWT templates alone)

**Context.** The product is paid. Frontend checks can be skipped or buggy; the database must still refuse unpaid reads.

**Decision.**

- Clerk owns identity and sessions.
- Webhook syncs minimal `users` rows.
- Supabase validates Clerk JWTs; RLS uses `auth.jwt() ->> 'sub'`.
- `ranked_bets` policy requires `subscriptions.status in ('active','trialing')` and valid period end.

**Consequences.**

- Paywall is defense-in-depth: UI gate + RLS.
- Backend writes use the service role (bypass RLS) by design; never expose that key to the browser.

---

## ADR-006: Stripe webhooks as source of truth for billing state

**Context.** Checkout success redirects are not reliable (user closes tab; network fails). Invoice and subscription state must come from Stripe.

**Decision.** Persist `subscriptions` and `invoices` from Stripe webhooks; dashboard and Billing tab read Supabase; Customer Portal for cancel / card / plan changes.

**Consequences.**

- Local/prod need `stripe listen` or Dashboard endpoints and signing secrets.
- Deleting a Clerk user currently does **not** auto-cancel Stripe (known gap: cancel subscription in the `user.deleted` webhook if desired).

---

## ADR-007: Server actions for app→server; route handlers for webhooks

**Context.** Next.js can expose both Server Actions and Route Handlers. Mixing them without a rule creates duplicate endpoints.

**Decision.**

- **Route handlers** — Clerk and Stripe webhooks (external POSTs, raw body, signatures).
- **Server actions** — `checkout`, billing portal session, billing data for the UserButton panel.

**Consequences.**

- Clear boundary for auth (`auth()` inside actions) vs signature verification (webhooks).
- Less boilerplate for UI-triggered flows.

---

## ADR-008: Route groups for marketing vs app chrome

**Context.** Public landing/pricing need a top navbar; the product needs a sidebar and different auth expectations.

**Decision.** Next.js route groups `(marketing)` and `(app)` with separate layouts; URLs stay `/`, `/pricing`, `/dashboard`.

**Consequences.**

- Layout concerns stay out of page components.
- Dashboard can enforce Clerk + subscription without wrapping marketing pages.

---

## Open follow-ups

- Cancel Stripe (and clean `subscriptions`) on Clerk `user.deleted`.
- Pin Stripe API version explicitly in all environments.
- Add `requirements.txt` / `.env.example` if missing so README setup is one-copy.
