"use client"

import { useEffect, useState, useTransition } from "react"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { CreditCard, ExternalLink, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  createBillingPortalSession,
  getBillingData,
  type BillingData,
} from "@/lib/billing.actions"
import { checkout } from "@/lib/transaction.actions"

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

export default function BillingPanel() {
  const [data, setData] = useState<BillingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const billing = await getBillingData()
        if (!cancelled) setData(billing)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load billing")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading billing…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-6 text-sm text-destructive">
        {error ?? "Unable to load billing information."}
      </div>
    )
  }

  const { subscription, invoices, isActive } = data

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Plan */}
      <section className="flex flex-col gap-3">
        <h1 className="text-base font-semibold">Plan</h1>

        {isActive && subscription ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="font-medium">Pro</p>
                <p className="text-sm text-muted-foreground">$19 / month</p>
              </div>
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                {statusLabel(subscription.status)}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {subscription.current_period_end && (
                <p>
                  {subscription.cancel_at_period_end
                    ? "Access until"
                    : "Renews on"}{" "}
                  {formatDate(subscription.current_period_end)}
                </p>
              )}
              {subscription.cancel_at_period_end && (
                <p className="text-amber-500">
                  Cancellation scheduled at period end
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-medium">No active plan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Subscribe to Pro ($19/month) for live +EV DFS picks.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isActive ? (
            <Button
              className="cursor-pointer"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createBillingPortalSession()
                  } catch (err) {
                    if (isRedirectError(err)) throw err
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not open billing portal"
                    )
                  }
                })
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Manage subscription
            </Button>
          ) : (
            <Button
              className="cursor-pointer"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await checkout()
                  } catch (err) {
                    if (isRedirectError(err)) throw err
                    setError(
                      err instanceof Error ? err.message : "Checkout failed"
                    )
                  }
                })
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Subscribe to Pro
            </Button>
          )}

          {/* Past subscriber with Stripe customer but inactive — still allow portal */}
          {!isActive && subscription?.stripe_customer_id && (
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createBillingPortalSession()
                  } catch (err) {
                    if (isRedirectError(err)) throw err
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not open billing portal"
                    )
                  }
                })
              }
            >
              Billing portal
            </Button>
          )}
        </div>

        {isActive && (
          <p className="text-xs text-muted-foreground">
            Use Manage subscription to update your payment method, cancel, or
            change your plan in Stripe&apos;s secure portal.
          </p>
        )}
      </section>

      {/* Invoices */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Invoices</h2>

        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="flex list-none flex-col gap-2 pl-0">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {formatMoney(invoice.amount_paid, invoice.currency)}
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {statusLabel(invoice.status)} ·{" "}
                    {formatDate(invoice.period_end ?? invoice.period_start)}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {invoice.hosted_invoice_url && (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View invoice"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {invoice.invoice_pdf && (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Download PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
