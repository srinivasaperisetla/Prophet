import requests
from datetime import datetime, timezone
from oddsprovider.provider import Event, Outcome, Quota, Side

DFS_BOOKS = {"prizepicks", "underdog", "pick6", "betr_us_dfs"}

class OddsApiProvider:
  BASE_URL = "https://api.the-odds-api.com/v4"

  def __init__(self, api_key: str):
    self.api_key = api_key
    self.last_quota: Quota | None = None

  def get_events(self, sport) -> list[Event]:
    response = requests.get(f"{self.BASE_URL}/sports/{sport}/events", params={"apiKey": self.api_key}, timeout=10)
    self.track_quota(response)
    response.raise_for_status()
    return [self.parse_event(event) for event in response.json()]
  
  def parse_event(self, event) -> Event:
    return Event(
      id = event['id'],
      sport_key = event['sport_key'],
      sport_title = event['sport_title'],
      home_team = event['home_team'],
      away_team = event['away_team'],
      commence_time = datetime.fromisoformat(event['commence_time'].replace("Z", "+00:00"))
    )
    
  def get_event_odds(self, sport, event_id, markets, regions) -> list[Outcome]:
    response = requests.get(
      f"{self.BASE_URL}/sports/{sport}/events/{event_id}/odds",
      params={
        "apiKey": self.api_key,
        "regions": ",".join(regions),
        "markets": ",".join(markets),
        "oddsFormat": "decimal",
        "includeMultipliers": "true",
      },
      timeout=10,
    )
    self.track_quota(response)
    if response.status_code == 404:
      return []
    response.raise_for_status()
    return self.parse_outcomes(response.json())

  def parse_outcomes(self, response) -> list[Outcome]:
    rows = []
    for book in response.get("bookmakers", []):
      book_key = book["key"]
      is_dfs = book_key in DFS_BOOKS

      for market in book.get("markets", []):
        last_update_str = market.get("last_update") or book.get("last_update")
        last_update = (
          datetime.fromisoformat(last_update_str.replace("Z", "+00:00"))
          if last_update_str
          else datetime.now(timezone.utc)
        )

        for outcome in market.get("outcomes", []):
          if outcome.get("name") not in ("Over", "Under"):
            continue
          if outcome.get("description") is None or outcome.get("point") is None:
            continue
          
          rows.append(Outcome(
            book=book_key,
            is_dfs=is_dfs,
            market=market["key"],
            player=outcome["description"],
            line=float(outcome["point"]),
            side=Side(outcome["name"]),
            price_decimal=float(outcome["price"]),
            multiplier=float(outcome["multiplier"]) if outcome.get("multiplier") is not None else 1.0,
            last_update=last_update,
          ))
    return rows

  def track_quota(self, response):
    try:
      self.last_quota = Quota(
        used=int(response.headers.get("x-requests-used", 0)),
        remaining=int(response.headers.get("x-requests-remaining", 0)),
        last_cost=int(response.headers.get("x-requests-last", 0)),
      )
    except (TypeError, ValueError):
      pass

  def get_quota(self) -> Quota | None:
    if not self.last_quota:
      response = requests.get(f"{self.BASE_URL}/sports", params={"apiKey": self.api_key}, timeout=10)
      self.track_quota(response)
    return self.last_quota


