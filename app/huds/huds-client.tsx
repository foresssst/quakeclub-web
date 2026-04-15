"use client"

import { useTranslations } from "next-intl"
import { HudsManager } from "@/components/huds-manager"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export function HudsPageClient() {
  const t = useTranslations("huds")

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1400px] pt-8 sm:pt-10">
        <div className="max-w-[1100px] mx-auto space-y-4 sm:space-y-5 animate-fade-up">
          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex-col items-stretch gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                    {t("title")}
                  </h1>
                  <p className="text-xs text-foreground/40 mt-1">{t("subtitle")}</p>
                </div>
              </div>
            </ContentHeader>

            <div className="p-4 sm:p-5">
              <HudsManager />
            </div>
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
