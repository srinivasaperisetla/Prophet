from dataclasses import dataclass
from oddsprovider.provider import Side, Outcome, Event
from engine.consensus import ConsensusKey, compute_consensus
from engine.devig import prob_to_american
from datetime import datetime, timezone

DFS_BREAKEVEN = 0.5

@dataclass(frozen=True)
class RankedBet:
  player: str
  market: str
  line: float
  side: Side
  dfs_book: str
  fair_prob: float
  edge: float
  fair_american: int | None
  num_books: int
  matchup: str
  commence_time: datetime
  snapshot_at: datetime

def compute_ranked_bets(outcomes: list[Outcome], event: Event) -> list[RankedBet]:
  consensus_map = compute_consensus(outcomes)
  matchup = f"{event.away_team} @ {event.home_team}"
  snapshot = datetime.now(timezone.utc)

  ranked: list[RankedBet] = []
  for o in outcomes:
    if not o.is_dfs:
      continue
    if not (0.99 <= o.multiplier <= 1.01):
      continue
  
    key = ConsensusKey(market=o.market, player=o.player, line=o.line)
    consensus = consensus_map.get(key)
    if consensus is None: 
      continue

    fair_prob = (consensus.fair_p_over if o.side == Side.OVER else consensus.fair_p_under)
    edge = fair_prob - DFS_BREAKEVEN

    ranked.append(RankedBet(
      player=o.player, market=o.market, line=o.line, side=o.side,
      dfs_book=o.book, fair_prob=fair_prob, edge=edge,
      fair_american=prob_to_american(fair_prob),
      num_books=consensus.num_books,
      matchup=matchup, commence_time=event.commence_time,
      snapshot_at=snapshot,
    ))

  ranked.sort(key=lambda r: r.edge, reverse=True)
  return ranked
      


