import os
import logging
from supabase import create_client
from engine.edge import RankedBet

log = logging.getLogger(__name__)

class SupabaseStore:
  def __init__(self):
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    self.client = create_client(url, key)

  
  def upsert_ranked_bets(self, bets: list[RankedBet]):
    if not bets:
      return
    
    seen = {}
    for b in bets:
      key = (b.player, b.market, b.line, b.side.value, b.dfs_book)
      seen[key] = b  # later entries overwrite earlier
    
    deduped = list(seen.values())
    if len(deduped) < len(bets):
      log.info("deduped %d → %d bets", len(bets), len(deduped))
    
    rows = [{
      "player": b.player,
      "market": b.market,
      "line": float(b.line),
      "side": b.side.value,
      "dfs_book": b.dfs_book,
      "fair_prob": float(b.fair_prob),
      "edge": float(b.edge),
      "fair_american": b.fair_american,
      "num_books": b.num_books,
      "matchup": b.matchup,
      "commence_time": b.commence_time.isoformat(),
      "snapshot_at": b.snapshot_at.isoformat(),
    } for b in bets]
  
    try:
      self.client.table("ranked_bets").upsert(rows, on_conflict="player,market,line,side,dfs_book").execute()
      log.info("upserted %d bets to supabase", len(rows))
    except Exception:
      log.exception("supabase upsert failed")