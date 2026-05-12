NBA_MARKETS = [
  "player_points", 
  # "player_points_q1", "player_rebounds", "player_rebounds_q1" ,
  # "player_assists", "player_assists_q1",
  # "player_threes", "player_blocks", "player_steals", "player_blocks_steals", "player_turnovers",
  # "player_points_rebounds_assists", "player_points_rebounds", "player_points_assists", "player_rebounds_assists",
  # "player_field_goals", "player_frees_made", "player_frees_attempts",
]

REGISTRY = {
  "basketball_nba": NBA_MARKETS,
  # "basketball_ncaab": NBA_MARKETS,  # same markets
  # "basketball_wnba": NBA_MARKETS,
  # "americanfootball_nfl": NFL_MARKETS,
  # "americanfootball_ncaaf": NFL_MARKETS,
  # "baseball_mlb": MLB_MARKETS,
  # ...
}

def markets_for_sport(sport: str) -> list[str]:
  return REGISTRY.get(sport, [])