-- ============================================================
-- Prophet Odds — Supabase Schema
-- ============================================================
-- This file documents the complete database schema for reference
-- and future re-provisioning. It represents the current production
-- state as of the last update.
--
-- Run order: enums → tables → indexes → RLS enable → policies
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================
-- Mirrors Stripe's exact subscription status values.
-- Webhook writes these directly from Stripe event payloads.
-- ============================================================
create type subscription_status as enum (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused'
);


-- ============================================================
-- USERS TABLE
-- ============================================================
-- Minimal mirror of Clerk user identity.
-- Only stores fields needed for SQL joins/queries (email).
-- Full user data lives in Clerk; fetched via API when needed.
--
-- Synced from Clerk via webhook: app/api/webhooks/clerk/route.ts
-- Events handled: user.created, user.updated, user.deleted
-- ============================================================
create table public.users (
    id text primary key,                -- Clerk user ID, e.g. "user_2abc..."
    email text,                         -- cached from Clerk for SQL convenience
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_users_email on public.users(email);


-- ============================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================
-- One row per user. Status drives access control via RLS.
-- Synced from Stripe via webhook: app/api/webhooks/stripe/route.ts
--
-- Events handled:
--   customer.subscription.created / updated / deleted
--
-- FK to users with cascade delete: removing a user removes
-- their subscription and invoices automatically.
-- ============================================================
create table public.subscriptions (
    user_id text primary key
        references public.users(id) on delete cascade,
    stripe_customer_id text not null unique,
    stripe_subscription_id text unique,
    stripe_price_id text,
    status subscription_status not null,
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_subscriptions_status on public.subscriptions(status);
create index idx_subscriptions_customer on public.subscriptions(stripe_customer_id);


-- ============================================================
-- INVOICES TABLE
-- ============================================================
-- Stripe invoice history. One row per Stripe invoice.
-- Synced from Stripe via webhook.
--
-- Events handled:
--   invoice.paid, invoice.payment_failed
--
-- Amount stored in cents (Stripe convention) — never use floats
-- for money. Display as ${amount / 100}.
-- ============================================================
create table public.invoices (
    id text primary key,                -- Stripe invoice ID, e.g. "in_..."
    user_id text not null
        references public.users(id) on delete cascade,
    stripe_customer_id text not null,
    stripe_subscription_id text,
    amount_paid integer not null,       -- cents
    currency text not null default 'usd',
    status text not null,               -- 'paid', 'open', 'void', 'uncollectible'
    hosted_invoice_url text,
    invoice_pdf text,
    period_start timestamptz,
    period_end timestamptz,
    created_at timestamptz not null default now()
);

create index idx_invoices_user on public.invoices(user_id, created_at desc);


-- ============================================================
-- RANKED_BETS TABLE
-- ============================================================
-- Live +EV DFS picks produced by the Python scheduler.
-- Written by the backend scheduler using the service role key
-- (bypasses RLS). Read by frontend via authenticated Supabase
-- client using Clerk JWT (subject to RLS).
--
-- Unique constraint prevents duplicate bets across snapshots —
-- the scheduler upserts on every poll, keeping one row per
-- (player, market, line, side, dfs_book) combination.
-- ============================================================
create table public.ranked_bets (
    id uuid primary key default gen_random_uuid(),
    player text not null,
    market text not null,               -- e.g. 'player_points', 'player_rebounds'
    line numeric not null,
    side text not null,                 -- 'Over' or 'Under'
    dfs_book text not null,             -- 'prizepicks', 'underdog', etc.
    fair_prob numeric not null,         -- 0.0-1.0, from de-vigged sportsbook consensus
    edge numeric not null,              -- fair_prob - 0.50 (DFS breakeven)
    fair_american integer,              -- fair prob converted to American odds
    num_books integer not null,         -- how many sportsbooks contributed to consensus
    matchup text not null,              -- "Away @ Home"
    commence_time timestamptz not null,
    snapshot_at timestamptz not null default now(),

    unique (player, market, line, side, dfs_book)
);

create index idx_ranked_bets_edge on public.ranked_bets(edge desc);
create index idx_ranked_bets_commence on public.ranked_bets(commence_time);
create index idx_ranked_bets_snapshot on public.ranked_bets(snapshot_at desc);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- All tables have RLS enabled. Backend writes use the service
-- role key which bypasses RLS. Frontend reads use the Clerk
-- session token (via third-party auth integration) — RLS reads
-- the Clerk user ID from auth.jwt() ->> 'sub'.
--
-- Third-party auth setup: configured in Supabase Studio →
-- Authentication → Sign In / Providers → Clerk.
-- ============================================================

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.ranked_bets enable row level security;


-- ============================================================
-- POLICIES
-- ============================================================

-- Users can only read their own user row.
create policy "Users can read own row"
on public.users
for select
to authenticated
using (id = auth.jwt() ->> 'sub');


-- Users can only read their own subscription.
create policy "Users can read own subscription"
on public.subscriptions
for select
to authenticated
using (user_id = auth.jwt() ->> 'sub');


-- Users can only read their own invoices.
create policy "Users can read own invoices"
on public.invoices
for select
to authenticated
using (user_id = auth.jwt() ->> 'sub');


-- Ranked bets are readable only by users with an active or
-- trialing subscription whose period hasn't expired.
-- This is the paywall enforcement — the data is protected at
-- the database layer, not just the app layer.
create policy "Active subscribers can read ranked bets"
on public.ranked_bets
for select
to authenticated
using (
    exists (
        select 1 from public.subscriptions
        where user_id = auth.jwt() ->> 'sub'
        and status in ('active', 'trialing')
        and (current_period_end is null or current_period_end > now())
    )
);


-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
-- Enable Supabase Realtime on ranked_bets so the frontend
-- receives push updates when the scheduler inserts/updates rows.
-- Frontend subscribes via supabase.channel('ranked_bets_changes').
-- ============================================================
alter publication supabase_realtime add table public.ranked_bets;
