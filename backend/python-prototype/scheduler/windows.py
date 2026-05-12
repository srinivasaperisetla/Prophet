from datetime import datetime, timezone, timedelta

def is_in_polling_window(commence_time: datetime, lookahead_hours: int = 24) -> bool:
  """True if event is between -3h (still live) and +lookahead_hours (upcoming)."""
  now = datetime.now(timezone.utc)
  return (now - timedelta(hours=3)) < commence_time < (now + timedelta(hours=lookahead_hours))

def is_expired(commence_time: datetime) -> bool:
  """True if event is so old it can be dropped from the queue."""
  now = datetime.now(timezone.utc)
  return commence_time < (now - timedelta(hours=4))