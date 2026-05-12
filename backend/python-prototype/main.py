# main.py
import logging
import os
from dotenv import load_dotenv
from oddsprovider.oddsapi.client import OddsApiProvider
from store.supabase import SupabaseStore
from store.discord import DiscordPublisher  # (or publisher/discord.py after moving)
from scheduler.scheduler import Scheduler

def main():
  load_dotenv()
  logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
  )
  provider = OddsApiProvider(api_key=os.environ["ODDS_API_KEY"])
  store = SupabaseStore()
  publisher = DiscordPublisher()
  config = {"sports_enabled": ["basketball_nba"]}
  scheduler = Scheduler(provider, store, publisher, config)
  scheduler.run()

if __name__ == "__main__":
    main()