'use server'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export type BillingSubscription = {
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_price_id: string | null
  stripe_customer_id: string | null
}

export type BillingInvoice = {
  id: string
  amount_paid: number
  currency: string
  status: string
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  period_start: string | null
  period_end: string | null
}

export type BillingData = {
  subscription: BillingSubscription | null
  invoices: BillingInvoice[]
  isActive: boolean
}

export async function getBillingData(): Promise<BillingData> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Unauthorized')
  }

  const { data: subscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select(
      'status, current_period_end, cancel_at_period_end, stripe_price_id, stripe_customer_id'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (subError) {
    console.error('[billing] subscription fetch failed:', subError)
    throw new Error('Failed to load subscription')
  }

  const { data: invoices, error: invError } = await supabaseAdmin
    .from('invoices')
    .select(
      'id, amount_paid, currency, status, hosted_invoice_url, invoice_pdf, period_start, period_end'
    )
    .eq('user_id', userId)
    .order('period_end', { ascending: false })
    .limit(20)

  if (invError) {
    console.error('[billing] invoices fetch failed:', invError)
    throw new Error('Failed to load invoices')
  }

  const isActive = Boolean(
    subscription &&
      ['active', 'trialing'].includes(subscription.status) &&
      (!subscription.current_period_end ||
        new Date(subscription.current_period_end) > new Date())
  )

  return {
    subscription: subscription
      ? {
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
          stripe_price_id: subscription.stripe_price_id,
          stripe_customer_id: subscription.stripe_customer_id,
        }
      : null,
    invoices: (invoices as BillingInvoice[]) ?? [],
    isActive,
  }
}

export async function createBillingPortalSession() {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Unauthorized')
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!subscription?.stripe_customer_id) {
    throw new Error('No Stripe customer found. Subscribe first.')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl}/dashboard`,
  })

  if (!session.url) {
    throw new Error('Failed to create billing portal session')
  }

  redirect(session.url)
}
