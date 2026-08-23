"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkout } from "@/lib/transaction.actions"

const features = [
  "Real-time +EV bet detection",
  "Arbitrage finder across 20+ books",
  "Unlimited alerts",
  "Priority Discord access",
]

const PricingCard = () => {
  return (
    <div className="surface flex w-full max-w-sm flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Pro
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">$19</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
        <p className="text-sm text-muted-foreground">
          For serious bettors who want every edge.
        </p>
      </div>

      <ul className="flex flex-col gap-3 list-none pl-0">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button size="lg" className="w-full cursor-pointer" onClick={() => checkout()}>
        Get started
      </Button>
    </div>
  )
}

export default PricingCard