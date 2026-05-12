from typing import Protocol
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

class Side(StrEnum):
  OVER = "Over"
  UNDER = "Under"

@dataclass(frozen=True)
class Event:
  id: str
  sport_key: str
  sport_title: str
  home_team: str
  away_team: str
  commence_time: datetime

@dataclass(frozen=True)
class Outcome:
  book: str
  is_dfs: bool
  market: str
  player: str
  line: float
  side: Side
  price_decimal: float
  multiplier: float
  last_update: datetime

@dataclass(frozen=True)
class Quota:
  used: int
  remaining: int
  last_cost: int

class OddsProvider(Protocol):
  def get_events(self, sport: str) -> list[Event]: ...

  def get_event_odds(self, sport: str, event_id: str, markets: list[str], regions: list[str],) -> list[Outcome]: ...

  def get_quota(self) -> Quota | None: ...
