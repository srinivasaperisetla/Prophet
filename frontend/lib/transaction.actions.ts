'use server'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function checkout() {
  // 1. Verify user is authenticated
  const { userId } = await auth()
  if (!userId) {
    throw new Error('Unauthorized')
  }

  // 2. Get user details from Clerk
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress
  if (!email) {
    throw new Error('User has no email')
  }

  // 3. Check if we already have a Stripe customer for this user
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  // 4. Block if they already have an active subscription
  if (existing && ['active', 'trialing'].includes(existing.status)) {
    throw new Error('Already subscribed')
  }

  // 5. Get or create a Stripe customer
  let customerId: string

  if (existing?.stripe_customer_id) {
    customerId = existing.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        clerk_user_id: userId,
      },
    })
    customerId = customer.id
  }

  // 6. Create the Checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=1`,
    metadata: {
      clerk_user_id: userId,
    },
    subscription_data: {
      metadata: {
        clerk_user_id: userId,
      },
    },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  // 7. Redirect the user to Stripe — must be outside try/catch
  redirect(session.url)
}