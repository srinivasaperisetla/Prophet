"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Trophy } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import UserButtonWithBilling from "@/components/UserButtonWithBilling"

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 no-underline"
        >
          <Trophy className="h-5 w-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Prophet Odds
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="DFS Optimizer"
                >
                  <Link href="/dashboard">
                    <BarChart3 />
                    <span>DFS Optimizer</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center px-2 py-1.5">
          <UserButtonWithBilling />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
