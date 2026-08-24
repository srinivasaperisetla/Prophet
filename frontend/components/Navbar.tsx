import Link from "next/link"
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs"
import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import UserButtonWithBilling from "@/components/UserButtonWithBilling"

const Navbar = () => {
  return (
    <nav className="navbar">
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <Trophy className="h-8 w-8 text-primary" />
        <span className="text-lg font-semibold italic max-sm:hidden">
          Prophet Odds
        </span>
      </Link>

      <div className="flex items-center gap-6">
        <Link
          href="/pricing"
          className="text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          Pricing
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="ghost" className="cursor-pointer">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button className="cursor-pointer">Sign Up</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButtonWithBilling />
        </Show>
      </div>
    </nav>
  )
}

export default Navbar
