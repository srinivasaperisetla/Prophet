# How the adaptive scheduler works

This note zooms in on one piece of Prophet Odds: the Python scheduler that decides **which events to poll, when, and how often**, so API credits go to games that matter.

Code lives under `backend/python-prototype/scheduler/`.

---

## Goal

Maximize coverage of live and near-tip markets while staying inside The Odds API monthly credit budget. Polling every event every 60 seconds does not scale; polling far-out games every minute wastes budget that should go to tip-off and live windows.

---

## Components

| Piece | File | Role |
|-------|------|------|
| Cadence rules | `cadence.py` | Map hours-until-tip → poll interval (seconds), or `0` = do not poll |
| Polling windows | `windows.py` | Expire / in-window helpers |
| Scheduler loop | `scheduler.py` | Discovery, priority queue, thread pool, quota heartbeat |
| Pricing | `engine/edge.py` | Called after a successful odds fetch |

---

## Cadence (NBA)

From `cadence.py` (simplified):

```
hours until tip     poll every
─────────────────   ──────────
≤ −3 (live / just tipped)    60s
≤ 24h                        300s (5 min)
> 24h                        0  → skip (out of window)
```

Other sports can plug into the same `RULES` dict with different breakpoints (NFL stubs are commented in-repo).

---

## Priority queue

Each tracked event is a `ScheduledEvent` with:

- `next_poll` — Unix timestamp (sort key)
- `event` — Odds API event metadata
- `sport` — e.g. `basketball_nba`

The queue is a **min-heap** on `next_poll`. The main loop:

1. Pop the earliest due event (or sleep briefly if nothing is due).
2. Fetch odds on a worker from a fixed-size thread pool.
3. Run `compute_ranked_bets` and write to Supabase.
4. Recompute cadence from current commence time; push a new `next_poll = now + cadence` (or drop if cadence is 0 / expired).

Discovery runs on an interval (e.g. every 5 minutes): list events, add new IDs to the tracked set and heap, without refetching odds for every event on every tick.

```
                    ┌─────────────┐
   discovery ─────▶ │ tracked IDs │
                    └──────┬──────┘
                           │ push ScheduledEvent(next_poll=…)
                           ▼
                    ┌─────────────┐
                    │  min-heap   │  ← pop when next_poll ≤ now
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           worker       worker       worker
           fetch        fetch        fetch
              │            │            │
              └──── engine + store ─────┘
                           │
                           └── re-queue or drop
```

---

## Why this shape

- **Heap + timestamp** — O(log n) schedule updates; no scan of all events each second.
- **Cadence as data** — Sport-specific rules without forking the loop.
- **Thread pool** — Bound concurrent Odds API calls; protect remaining quota (scheduler tracks usage and logs heartbeats).
- **Separation from engine** — Scheduler owns *when*; `engine/` owns *what the fair price is*. Either can change independently.

---

## Failure modes to keep in mind

- **Quota exhaustion** — Scheduler should slow or stop when remaining credits are low (threshold logged at startup).
- **Stale tracked set** — Games tip and end; window/expiry must remove them or they waste workers.
- **Upsert races** — Unique key on `ranked_bets` makes repeated polls idempotent for the same prop identity.

---

## Related reading

- [`decisions.md`](decisions.md) — Why Python first, why provider abstraction
- [`schema.sql`](schema.sql) — `ranked_bets` unique constraint and Realtime
