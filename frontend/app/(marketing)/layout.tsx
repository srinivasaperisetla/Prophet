import Navbar from "@/components/Navbar"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 lg:px-14">
        © {new Date().getFullYear()} Prophet Odds. All rights reserved.
      </footer>
    </div>
  )
}
