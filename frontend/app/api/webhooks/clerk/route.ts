import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)
  } catch (err) {
    console.error('[clerk webhook] verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log(`[clerk webhook] received: ${evt.type}`)

  try {
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const { id, email_addresses } = evt.data

      const { error } = await supabaseAdmin.from('users').upsert({
        id,
        email: email_addresses[0]?.email_address ?? null,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[clerk webhook] upsert failed:', error)
        return new Response('Database error', { status: 500 })
      }

      console.log(`[clerk webhook] upserted user ${id}`)
    } else if (evt.type === 'user.deleted') {
      const { id } = evt.data
      if (!id) {
        console.error('[clerk webhook] user.deleted with no id')
        return new Response('No user id', { status: 400})
      }

      const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
      if (error) {
        console.error('[clerk webhook] delete failed:', error)
        return new Response('Database error', { status: 500 })
      }

      console.log(`[clerk webhook] deleted user ${id}`)
    } else {
      console.log(`[clerk webhook] unhandled event type: ${evt.type}`)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[clerk webhook] handler error:', err)
    return new Response('Internal error', { status: 500 })
  }
}