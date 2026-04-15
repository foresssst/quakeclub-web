"use client"

import { useTranslations } from "next-intl"
import { ConfigManager } from "@/components/config-manager"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export function ConfigsPageClient() {
  const t = useTranslations("configs")

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-[1400px] pt-4 sm:pt-10">
        <div className="max-w-[1080px] mx-auto space-y-3 animate-fade-up">
          {/* Top Ad - In-Feed */}

          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex-col items-stretch gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                    {t("title")}
                  </h1>
                  <p className="text-[10px] text-[#666] mt-0.5">{t("subtitle")}</p>
                </div>
              </div>
            </ContentHeader>

            <div className="p-3 sm:p-4">
              <ConfigManager />
            </div>
          </ContentContainer>

          {/* Bottom Ad - Display */}
        </div>
      </div>
    </div>
  )
}
