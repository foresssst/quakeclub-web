"use client"

import React from "react"

import { usePathname, useSearchParams } from "next/navigation"
import { AppSidebar } from "./app-sidebar"
import { MobileHeader } from "./mobile-header"
import { FooterV2 } from "./footer-v2"
import { LatestNewsBanner } from "./latest-news-banner"

// Páginas que NO deben mostrar navbar/footer
const excludedPaths = [
  "/login",
  "/admin",
]

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Verificar si la ruta actual está excluida
  const isExcluded = excludedPaths.some(path =>
    pathname === path || pathname.startsWith(path + "/")
  )
  const isStreamPickban = pathname.startsWith("/pickban/") && searchParams.get("stream") === "1"

  if (isExcluded || isStreamPickban) {
    return <>{children}</>
  }

  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <AppSidebar />
      {/* Mobile header - visible on < lg */}
      <MobileHeader />

      {/* Main content area */}
      <div className="lg:pl-[300px] min-h-screen flex flex-col pt-14 lg:pt-0 relative">
        {pathname === "/" && <LatestNewsBanner />}
        <div className="relative flex-1 sidebar-content overflow-hidden">
          <div className="relative">
            {children}
          </div>
        </div>
        <FooterV2 />
      </div>
    </>
  )
}
