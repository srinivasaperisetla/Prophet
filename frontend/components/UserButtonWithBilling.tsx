"use client"

import { UserButton } from "@clerk/nextjs"
import { CreditCard } from "lucide-react"
import BillingPanel from "@/components/BillingPanel"

export default function UserButtonWithBilling() {
  return (
    <UserButton>
      <UserButton.UserProfilePage
        label="Billing"
        labelIcon={<CreditCard className="size-4" />}
        url="billing"
      >
        <BillingPanel />
      </UserButton.UserProfilePage>
    </UserButton>
  )
}
