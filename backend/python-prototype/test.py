"""Manual end-to-end smoke test for the prop-betting pipeline."""

from dataclasses import asdict, fields
from datetime import datetime
import csv
import os

from dotenv import load_dotenv

from oddsprovider.oddsapi.client import OddsApiProvider
from engine.edge import compute_ranked_bets, RankedBet


def section(title: str) -> None:
    print(f"\n{'=' * 60}\n  {title}\n{'=' * 60}")


def main() -> None:
    load_dotenv()
    client = OddsApiProvider(api_key=os.environ["ODDS_API_KEY"])

    # ---- Quota before --------------------------------------------------
    section("QUOTA (before)")
    quota_before = client.get_quota()
    print(quota_before)

    # ---- Events --------------------------------------------------------
    section("EVENTS — basketball_nba")
    events = client.get_events("basketball_nba")
    print(f"{len(events)} events returned")
    for e in events[:5]:
        print(f"  {e.id}  {e.away_team} @ {e.home_team}  ({e.commence_time})")

    if not events:
        print("No events; aborting.")
        return

    # ---- Event odds (player_points only) -------------------------------
    evt = events[0]
    section(f"EVENT ODDS — {evt.away_team} @ {evt.home_team}  ({evt.id})")
    outcomes = client.get_event_odds(
        sport="basketball_nba",
        event_id=evt.id,
        markets=["player_points"],
        regions=["us", "us_dfs"],
    )
    print(f"{len(outcomes)} outcomes")
    print(f"  DFS:        {sum(1 for o in outcomes if o.is_dfs)}")
    print(f"  Regulated:  {sum(1 for o in outcomes if not o.is_dfs)}")
    print(f"  Books:      {sorted({o.book for o in outcomes})}")
    print(f"  Markets:    {sorted({o.market for o in outcomes})}")
    if outcomes:
        print(f"  Sample:     {outcomes[0]}")

    # ---- Ranked bets ---------------------------------------------------
    section("RANKED BETS")
    ranked = compute_ranked_bets(outcomes, evt)
    print(f"{len(ranked)} ranked bets")
    print()
    print(f"{'edge':>7}  {'player':<25} {'mkt':<15} {'side':<5} {'line':>6}  {'fair':>6}  {'bks':>3}  book")
    print("-" * 90)
    for r in ranked[:20]:
        print(
            f"{r.edge:+7.3f}  {r.player:<25.25} {r.market:<15.15} "
            f"{r.side.value:<5} {r.line:>6.1f}  {r.fair_prob:>6.3f}  {r.num_books:>3}  {r.dfs_book}"
        )

    # ---- CSV export ----------------------------------------------------
    section("CSV EXPORT")
    out_path = f"ranked_bets_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"
    fieldnames = [f.name for f in fields(RankedBet)]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in ranked:
            row = asdict(r)
            row["side"] = r.side.value  # Side is a StrEnum; serialize the string
            writer.writerow(row)
    print(f"Wrote {len(ranked)} rows to {out_path}")

    # ---- Quota after ---------------------------------------------------
    section("QUOTA (after)")
    quota_after = client.get_quota()
    print(quota_after)
    if quota_before and quota_after:
        used = quota_after.used - quota_before.used
        print(f"Spent {used} credits this run "
              f"(remaining: {quota_after.remaining})")


if __name__ == "__main__":
    main()