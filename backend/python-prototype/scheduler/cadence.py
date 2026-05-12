from datetime import datetime, timezone

NBA_RULES = [
  (-3, 60),  # live -> poll every 60 seconds for rapid updates
  (24, 300), # 24h from comence time → poll every 5 min
]

# NFL_RULES = [
#   (-3, 60),
#   (1, 120),
#   (6, 300),
#   (24, 900),
#   (72, 1800),
#   (168, 3600),
# ]

RULES = {
  "basketball_nba": NBA_RULES,
  # "basketball_ncaab": NBA_RULES,
  # "basketball_wnba": NBA_RULES,
  # "americanfootball_nfl": NFL_RULES,
  # ...
}

def cadence_seconds(sport: str, commence_time: datetime) -> int:
  """Returns polling interval in seconds, or 0 if event is out of window."""
  now = datetime.now(timezone.utc)
  hours_until = (commence_time - now).total_seconds() / 3600
  rules = RULES.get(sport, [])
  for max_h, cadence in rules:
    if hours_until <= max_h:
      return cadence
  return 0  # out of window — don't poll

