class DiscordPublisher:
  def publish_top(self, bets):
    for b in bets[:3]:
      print(f"[stub] would post: {b.player} {b.side} {b.line}")