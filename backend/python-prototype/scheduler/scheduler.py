import heapq
import logging
import time
import threading
import signal
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from oddsprovider.provider import Event
from scheduler.cadence import cadence_seconds
from scheduler.windows import is_in_polling_window, is_expired
from markets.markets import markets_for_sport
from engine.edge import compute_ranked_bets

log = logging.getLogger(__name__)


@dataclass(order=True)
class ScheduledEvent:
  next_poll: float
  event: Event = field(compare=False)
  sport: str = field(compare=False)

class Scheduler:
  DISCOVERY_INTERVAL = 300
  MAX_WORKERS = 10
  QUOTA_LOW_THRESHOLD = 500
  HEARTBEAT_INTERVAL = 30  # seconds between "still running" logs

  def __init__(self, provider, store, publisher, config):
    self.provider = provider
    self.store = store
    self.publisher = publisher
    self.config = config
    self.queue : list[ScheduledEvent] = []
    self.queue_lock = threading.Lock()
    self.tracked_ids: set[str] = set()
    self.tracked_lock = threading.Lock()
    self.last_discovery = 0.0
    self.last_heartbeat = 0.0
    self.start_time = time.time()
    self.total_polls = 0
    self.total_credits_spent = 0
    self.running = True
    signal.signal(signal.SIGINT, self.shutdown)
    signal.signal(signal.SIGTERM, self.shutdown)

  def run(self):
    # Startup logging — know your starting state
    quota = self.provider.get_quota()
    if quota:
      log.info("=" * 60)
      log.info("SCHEDULER STARTING")
      log.info("  Quota: used=%d remaining=%d", quota.used, quota.remaining)
      log.info("  Sports enabled: %s", self.config.get("sports_enabled", []))
      log.info("  Max workers: %d  |  Discovery interval: %ds",
           self.MAX_WORKERS, self.DISCOVERY_INTERVAL)
      log.info("=" * 60)
    else:
      log.warning("could not fetch initial quota")

    with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as pool:
      while self.running:
        now = time.time()

        if now - self.last_discovery > self.DISCOVERY_INTERVAL:
          self.discover()
          self.last_discovery = now

        due = self.pop_due(now)
        for sched in due:
          pool.submit(self.poll_event_safe, sched)

        # Heartbeat: log every HEARTBEAT_INTERVAL seconds when nothing happened
        if not due and now - self.last_heartbeat > self.HEARTBEAT_INTERVAL:
          self.log_heartbeat(now)
          self.last_heartbeat = now

        time.sleep(1)
      log.info("scheduler stopped after %.0fs | %d polls | %d credits spent",
           time.time() - self.start_time, self.total_polls, self.total_credits_spent)

  def log_heartbeat(self, now):
    with self.queue_lock:
      queue_size = len(self.queue)
      next_poll_in = (self.queue[0].next_poll - now) if self.queue else None
    uptime = now - self.start_time
    next_str = f"next poll in {next_poll_in:.0f}s" if next_poll_in is not None else "queue empty"
    log.info("running... uptime=%.0fs queue=%d polls=%d credits_spent=%d | %s",
         uptime, queue_size, self.total_polls, self.total_credits_spent, next_str)

  def discover(self):
    discovered = 0
    for sport in self.config["sports_enabled"]:
      try:
        events = self.provider.get_events(sport)
      except Exception:
        log.exception("discovery failed for %s", sport)
        continue

      for event in events:
        if not is_in_polling_window(event.commence_time):
          continue
        with self.tracked_lock:
          if event.id in self.tracked_ids:
            continue
          self.tracked_ids.add(event.id)
        self.push(ScheduledEvent(next_poll=time.time(), event=event, sport=sport))
        log.info("tracking %s @ %s (starts %s)",
             event.away_team, event.home_team, event.commence_time)
        discovered += 1

    if discovered == 0:
      log.info("discovery cycle: no new events")
    else:
      log.info("discovery cycle: %d new events added", discovered)

  def pop_due(self, now):
    due = []
    with self.queue_lock:
      while self.queue and self.queue[0].next_poll <= now:
        due.append(heapq.heappop(self.queue))
    return due

  def push(self, sched):
    with self.queue_lock:
      heapq.heappush(self.queue, sched)

  def poll_event_safe(self, sched):
    try:
      self.poll_event(sched)
    except Exception:
      log.exception("unexpected error in poll_event for %s", sched.event.id[:8])
      self.reschedule(sched)

  def poll_event(self, sched):
    if is_expired(sched.event.commence_time):
      with self.tracked_lock:
        self.tracked_ids.discard(sched.event.id)
      log.info("event expired, dropping: %s @ %s",
           sched.event.away_team, sched.event.home_team)
      return

    poll_start = time.time()
    outcomes = self.provider.get_event_odds(
      sport=sched.sport, event_id=sched.event.id,
      markets=markets_for_sport(sched.sport),
      regions=["us", "us_dfs"],
    )
    fetch_ms = (time.time() - poll_start) * 1000

    # Update counters
    self.total_polls += 1
    quota = self.provider.get_quota()
    if quota:
      self.total_credits_spent += quota.last_cost

    if not outcomes:
      log.info("polled %s: empty response (%.0fms) | cost=%d remaining=%d",
           sched.event.id[:8], fetch_ms,
           quota.last_cost if quota else -1,
           quota.remaining if quota else -1)
      self.reschedule(sched)
      return

    ranked = compute_ranked_bets(outcomes, sched.event)
    if ranked:
      self.store.upsert_ranked_bets(ranked)
      self.publisher.publish_top(ranked)

    top_edge = ranked[0].edge * 100 if ranked else 0
    log.info(
      "polled %s (%s@%s): %d outcomes, %d ranked, top_edge=%.2f%% (%.0fms) | "
      "cost=%d used=%d remaining=%d",
      sched.event.id[:8],
      sched.event.away_team[:3].upper(),
      sched.event.home_team[:3].upper(),
      len(outcomes), len(ranked), top_edge, fetch_ms,
      quota.last_cost if quota else -1,
      quota.used if quota else -1,
      quota.remaining if quota else -1,
    )

    # Low quota warning
    if quota and quota.remaining < self.QUOTA_LOW_THRESHOLD:
      log.warning("QUOTA LOW: %d remaining (threshold=%d)",
            quota.remaining, self.QUOTA_LOW_THRESHOLD)

    self.reschedule(sched)

  def reschedule(self, sched):
    cadence = cadence_seconds(sched.sport, sched.event.commence_time)
    if cadence == 0:
      with self.tracked_lock:
        self.tracked_ids.discard(sched.event.id)
      log.info("dropping %s @ %s (out of polling window)",
           sched.event.away_team, sched.event.home_team)
      return

    sched.next_poll = time.time() + cadence
    self.push(sched)

  def shutdown(self, *args):
    log.info("shutdown signal received")
    self.running = False