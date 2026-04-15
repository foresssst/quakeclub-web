"use client"

import { useTranslations } from "next-intl"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import Image from "next/image"

export default function AboutPage() {
    const t = useTranslations("about")

    return (
        <div className="relative min-h-screen">
            <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1100px] pt-8 sm:pt-12">
                {/* Logo centrado - fuera del contenedor */}
                <div className="flex justify-center pb-8">
                    <Image
                        src="/branding/logo.png"
                        alt="Quake Club Logo"
                        width={280}
                        height={280}
                        className="object-contain w-[180px] h-[180px] sm:w-[280px] sm:h-[280px]"
                    />
                </div>

                <ContentContainer className="animate-scale-fade">
                    <ContentHeader>
                        <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                            {t("title")}
                        </h1>
                    </ContentHeader>

                    <div className="p-4 sm:p-6 space-y-6 text-sm text-foreground/60 leading-relaxed">
                        <p>
                            {t.rich("intro", { quakeClub: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
                        </p>

                        <p>
                            {t.rich("teamIntro", {
                                forest: (chunks) => <strong className="text-foreground/80">{chunks}</strong>,
                                hexen: (chunks) => <strong className="text-foreground/80">{chunks}</strong>,
                                pez: (chunks) => <strong className="text-foreground/80">{chunks}</strong>,
                                geze: (chunks) => <strong className="text-foreground/80">{chunks}</strong>
                            })}
                        </p>

                        <h2 className="text-foreground font-bold text-base uppercase tracking-wide pt-4">
                            {t("infraTitle")}
                        </h2>
                        <p>
                            {t("infraIntro")}
                        </p>

                        <ul className="space-y-4 pl-1">
                            <li className="flex items-start gap-3">
                                <span className="text-foreground mt-1">•</span>
                                <div>
                                    <strong className="text-foreground/80">{t("infraData")}</strong> {t("infraDataDesc")}
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-foreground mt-1">•</span>
                                <div>
                                    <strong className="text-foreground/80">{t("infraServers")}</strong> {t("infraServersDesc")}
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-foreground mt-1">•</span>
                                <div>
                                    <strong className="text-foreground/80">{t("infraDigital")}</strong> {t("infraDigitalDesc")}
                                </div>
                            </li>
                        </ul>

                        <p className="pt-2">
                            {t.rich("closing", { quake: (chunks) => <strong className="text-foreground/70">{chunks}</strong> })}
                        </p>
                    </div>
                </ContentContainer>

                {/* Bottom Ad - Display */}
                <div className="pt-6">
                </div>
            </div>
        </div>
    )
}
