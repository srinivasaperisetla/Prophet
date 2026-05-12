from dataclasses import dataclass
from oddsprovider.provider import Side, Outcome
from engine.devig import decimal_to_prob, devig_two_way
from collections import defaultdict

BOOK_WEIGHTS = {
  "pinnacle": 3.0,
  "draftkings": 2.0, "fanduel": 2.0, "betmgm": 1.5,
  "betrivers": 1.0, "bovada": 1.0, "betonlineag": 1.0, "fanatics": 1.0, "betus": 1.0
}

@dataclass(frozen = True)
class ConsensusKey:
  market: str
  player: str
  line: float

@dataclass(frozen = True)
class Consensus:
  fair_p_over: float
  fair_p_under: float
  num_books: int

def compute_consensus(outcomes: list[Outcome]) -> dict[ConsensusKey, Consensus]:
  pairs: dict[tuple[str, ConsensusKey], dict[Side, float]] = defaultdict(dict)

  for o in outcomes:
    if o.is_dfs:
      continue
    key = ConsensusKey(market=o.market, player=o.player, line=o.line)
    pairs[(o.book, key)][o.side] = o.price_decimal

  accumulators: dict[ConsensusKey, dict] = defaultdict(
    lambda: {"weighted_p_over": 0.0, "weighted_p_under": 0.0, "weight_sum": 0.0, "books": set()}
  )

  for (book, key), sides in pairs.items():
    p_o_raw = decimal_to_prob(sides.get(Side.OVER))
    p_u_raw = decimal_to_prob(sides.get(Side.UNDER))

    devigged = devig_two_way(p_o_raw, p_u_raw)
    if devigged is None:
      continue
    p_o, p_u = devigged

    acc = accumulators[key]
    w = BOOK_WEIGHTS.get(book, 1.0)
    acc["weighted_p_over"] += p_o * w
    acc["weighted_p_under"] += p_u * w
    acc["weight_sum"] += w
    acc["books"].add(book)
  
  return {
    key: Consensus(
      fair_p_over=acc["weighted_p_over"] / acc["weight_sum"],
      fair_p_under=acc["weighted_p_under"] / acc["weight_sum"],
      num_books=len(acc["books"]),
    )
    for key, acc in accumulators.items()
    if acc["weight_sum"] > 0
  }