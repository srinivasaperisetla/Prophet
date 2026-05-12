
def american_to_decimal(american_odds: int | None) -> float | None:
  if american_odds is None:
    return None
  if american_odds < 0:
    return (100 / abs(american_odds)) + 1
  else:
    return (american_odds / 100) + 1

def decimal_to_prob(decimal_odds: float) -> float | None:
  if decimal_odds is None or decimal_odds <= 1.0:
    return None
  return 1.0 / decimal_odds

def devig_two_way(p_over: float, p_under: float) -> tuple[float, float] | None:
  if p_over is None or p_under is None:
    return None
  total = p_over + p_under
  if total <= 0:
    return None
  return p_over / total, p_under / total

def prob_to_american(p: float) -> int | None:
  if p is None or p <= 0 or p >= 1:
    return None
  if p >= 0.5:
    return int(round(-100 * p / (1 - p)))
  return int(round(100 * (1 - p) / p))