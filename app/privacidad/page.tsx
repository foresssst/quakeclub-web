"use client"

import { useTranslations } from "next-intl"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export default function PrivacidadPage() {
    const t = useTranslations("privacy")

    return (
        <div className="relative min-h-screen">
            <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1100px] pt-8 sm:pt-12">
                <div className="space-y-4 sm:space-y-6 animate-fade-up">
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <div>
                                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                                    {t("title")}
                                </h1>
                                <p className="text-xs text-foreground/40 mt-1">{t("lastUpdated")}</p>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-6 text-xs text-foreground/60 leading-relaxed">

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section1Title")}</h2>
                                <p>{t("section1Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li><strong className="text-foreground/70">{t("section1SteamId")}</strong> {t("section1SteamIdDesc")}</li>
                                    <li><strong className="text-foreground/70">{t("section1ProfileName")}</strong> {t("section1ProfileNameDesc")}</li>
                                    <li><strong className="text-foreground/70">{t("section1Avatar")}</strong> {t("section1AvatarDesc")}</li>
                                    <li><strong className="text-foreground/70">{t("section1Country")}</strong> {t("section1CountryDesc")}</li>
                                </ul>
                                <p>{t("section1Extra")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section2Title")}</h2>
                                <p>{t("section2Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section2Item1")}</li>
                                    <li>{t("section2Item2")}</li>
                                    <li>{t("section2Item3")}</li>
                                    <li>{t("section2Item4")}</li>
                                    <li>{t("section2Item5")}</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section3Title")}</h2>
                                <p>{t("section3Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section4Title")}</h2>
                                <p>{t("section4Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section5Title")}</h2>
                                <p>{t("section5Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section6Title")}</h2>
                                <p>{t("section6Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section7Title")}</h2>
                                <p>{t("section7Text")}</p>
                            </section>

                        </div>
                    </ContentContainer>
                </div>
            </div>
        </div>
    )
}
