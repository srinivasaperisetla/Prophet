import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function UnsubscribedCTA() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
        Subscribe to see live picks
      </h1>
      <p className="max-w-md text-muted-foreground">
        Get real-time +EV picks powered by sharp sportsbook consensus
      </p>
      <Button asChild size="lg" className="cursor-pointer">
        <Link href="/pricing">View pricing</Link>
      </Button>
    </div>
  )
}
