import Link from "next/link"
import { Button } from "@/components/ui/button"
import PricingCard from "@/components/PricingCard"

const steps = [
  {
    title: "Scrape 20+ books",
    description:
      "We pull lines from sharp sportsbooks and DFS platforms in real time.",
  },
  {
    title: "Find mispricings",
    description:
      "Consensus fair odds surface +EV edges before they disappear.",
  },
  {
    title: "Get live alerts",
    description:
      "Watch the feed update as new edges appear across markets.",
  },
]

export default function HomePage() {
  return (
    <main className="gap-16">
      <section className="flex flex-col items-start gap-6 py-8 sm:py-12">
        <h1 className="text-gradient-brand max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Prophet Odds
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Real-time +EV DFS picks powered by sharp book consensus
        </p>
        <Button asChild size="lg" className="cursor-pointer">
          <Link href="/pricing">View pricing</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="surface flex flex-col gap-3 p-6"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-primary">
                Step {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-6 pb-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Pricing
          </h2>
          <p className="text-muted-foreground">
            One plan. Full access to live picks.
          </p>
        </div>
        <PricingCard />
      </section>
    </main>
  )
}
