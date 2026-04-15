"use client"

import { EsportView } from "@/components/esport/esport-view"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

export default function EsportPage() {
  const t = useTranslations("esport")
  const { data: session } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return { user: null }
      return res.json()
    },
  })

  return (
    <div className="relative min-h-screen">

      <div className="pt-4 sm:pt-10 mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12">
        <div className="max-w-[1080px] mx-auto space-y-3">
          {/* Top Ad - In-Feed */}

          <ContentContainer className="animate-scale-fade [animation-delay:200ms]">
            <ContentHeader className="flex items-center justify-between relative">

              <div>
                <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-0.5 text-[10px] text-[var(--qc-text-muted)]">{t("subtitle")}</p>
              </div>
            </ContentHeader>

            <EsportView />
          </ContentContainer>

          {/* Bottom Ad - Display */}
        </div>
      </div>

    </div>
  )
}
