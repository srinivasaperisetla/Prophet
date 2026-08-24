import PricingCard from "@/components/PricingCard"

export default function PricingPage() {
  return (
    <main className="flex flex-col items-center gap-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Simple pricing
        </h1>
        <p className="text-muted-foreground">
          One plan. Full access to live +EV DFS picks.
        </p>
      </div>
      <PricingCard />
    </main>
  )
}
