import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase-server"
import RankedBets from "@/components/RankedBets"
import UnsubscribedCTA from "@/components/UnsubscribedCTA"

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle()

  const isActive =
    sub &&
    ["active", "trialing"].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date())

  if (!isActive) {
    return <UnsubscribedCTA />
  }

  return <RankedBets />
}
