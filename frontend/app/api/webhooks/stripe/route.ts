import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    console.error('[stripe webhook] missing stripe-signature header')
    return new Response('Missing signature', { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe webhook] missing STRIPE_WEBHOOK_SECRET env var')
    return new Response('Server misconfigured', { status: 500 })
  }

  // 1. Get raw body and verify signature
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log(`[stripe webhook] received: ${event.type}`)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(sub)
        break
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoice(invoice)
        break
      }

      default:
        console.log(`[stripe webhook] unhandled event type: ${event.type}`)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

// ============================================================
// SUBSCRIPTION HANDLER
// ============================================================
async function handleSubscriptionChange(sub: Stripe.Subscription) {
  // Resolve Clerk user ID from subscription metadata (preferred)
  // or fall back to customer metadata
  let clerkUserId = sub.metadata?.clerk_user_id

  if (!clerkUserId) {
    const customer = await stripe.customers.retrieve(sub.customer as string)
    if (customer.deleted) {
      console.error('[stripe webhook] customer was deleted:', sub.customer)
      return
    }
    clerkUserId = customer.metadata?.clerk_user_id
  }

  if (!clerkUserId) {
    console.error('[stripe webhook] no clerk_user_id for subscription:', sub.id)
    return
  }

  const item = sub.items.data[0]

	const { error } = await supabaseAdmin.from('subscriptions').upsert({
		user_id: clerkUserId,
		stripe_customer_id: sub.customer as string,
		stripe_subscription_id: sub.id,
		stripe_price_id: item?.price.id ?? null,
		status: sub.status,
		current_period_start: item
			? new Date(item.current_period_start * 1000).toISOString()
			: null,
		current_period_end: item
			? new Date(item.current_period_end * 1000).toISOString()
			: null,
		cancel_at_period_end: sub.cancel_at_period_end,
		updated_at: new Date().toISOString(),
	})

  if (error) {
    console.error('[stripe webhook] subscription upsert failed:', error)
    throw error
  }

  console.log(`[stripe webhook] upserted subscription for user ${clerkUserId} (status=${sub.status})`)
}

// ============================================================
// INVOICE HANDLER
// ============================================================
async function handleInvoice(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Try subscriptions table first (fast path)
  let clerkUserId: string | null = null
  
  const { data: subRow } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (subRow?.user_id) {
    clerkUserId = subRow.user_id
  } else {
    // Fallback: subscription webhook may not have fired yet.
    // Pull from Stripe customer metadata directly.
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted) {
      clerkUserId = customer.metadata?.clerk_user_id ?? null
    }
  }

  if (!clerkUserId) {
    console.error('[stripe webhook] no user found for customer:', customerId)
    return
  }

  if (!invoice.id) {
    console.error('[stripe webhook] invoice has no ID, skipping')
    return
  }

  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id ?? null

  const { error } = await supabaseAdmin.from('invoices').upsert({
    id: invoice.id,
    user_id: clerkUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status ?? 'unknown',
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    period_start: invoice.period_start
      ? new Date(invoice.period_start * 1000).toISOString()
      : null,
    period_end: invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null,
  })

  if (error) {
    console.error('[stripe webhook] invoice upsert failed:', error)
    throw error
  }

  console.log(`[stripe webhook] upserted invoice ${invoice.id} for user ${clerkUserId}`)
}