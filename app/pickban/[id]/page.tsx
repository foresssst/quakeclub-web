"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { StandalonePickBan } from "@/components/standalone-pickban"
import Link from "next/link"

export default function PickBanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()

  const teamParam = searchParams.get("team") as "a" | "b" | null
  const streamMode = searchParams.get("stream") === "1"

  // Validate team param
  const teamSide = teamParam === "a" || teamParam === "b" ? teamParam : null

  return (
    <div className={streamMode ? "relative flex min-h-screen justify-center" : "relative min-h-screen"}>
      <div
        className={
          streamMode
            ? "mx-auto flex w-full max-w-[1020px] justify-center px-4 py-6 sm:px-6 sm:py-8"
            : "mx-auto w-full max-w-[1040px] px-3 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-5"
        }
      >
        {!streamMode && (
          <div className="mb-3 flex justify-end sm:mb-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              ← Volver a QuakeClub
            </Link>
          </div>
        )}
        <div className={streamMode ? "w-full" : undefined}>
          <StandalonePickBan sessionId={id} teamSide={streamMode ? null : teamSide} />
        </div>
      </div>
    </div>
  )
}
