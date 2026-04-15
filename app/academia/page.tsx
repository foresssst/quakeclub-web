"use client"

import { useTranslations } from "next-intl"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export default function AcademiaPage() {
  const t = useTranslations("academy")

  return (
    <div className="relative min-h-screen">

      <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1400px] pt-8 sm:pt-12">
        <div className="max-w-[1100px] mx-auto space-y-4 sm:space-y-6 animate-fade-up">
          {/* Top Ad - In-Feed */}

          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex items-center justify-between relative">

              <div>
                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                  {t("title")}
                </h1>
                <p className="text-xs text-foreground/40 mt-1">{t("subtitle")}</p>
              </div>
            </ContentHeader>

            <div className="px-4 sm:px-6 py-12">
              <div className="text-center">
                <p className="text-foreground/30 text-sm">{t("comingSoon")}</p>
              </div>
            </div>
          </ContentContainer>

          {/* Bottom Ad - Display */}
        </div>
      </div>

    </div>
  )
}
