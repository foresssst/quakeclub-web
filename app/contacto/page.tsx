import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
    title: "Contacto",
    description: "Contacta con el equipo de QuakeClub para soporte, dudas y coordinación dentro de la comunidad de Quake Live en Chile.",
    path: "/contacto",
    keywords: ["contacto", "soporte", "comunidad quakeclub"],
})

export default async function ContactoPage() {
    const t = await getTranslations("contact")

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
                                <p className="text-xs text-foreground/40 mt-1">{t("subtitle")}</p>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-6">
                            {/* Intro */}
                            <p className="text-sm text-foreground/60 leading-relaxed">
                                {t("intro")}
                            </p>

                            {/* Contact via Discord */}
                            <div className="space-y-3">
                                <h2 className="text-sm font-bold text-foreground/80">{t("discord")}</h2>
                                <p className="text-xs text-foreground/50">
                                    {t("discordIntro")}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {["foresssst", "hexencl", "geze5204", "pez_cao"].map((username) => (
                                        <div key={username} className="px-3 py-2 bg-foreground/[0.02] border border-foreground/[0.06] rounded-lg">
                                            <span className="text-xs font-medium text-foreground/70">{username}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Team Section */}
                            <div className="pt-4 border-t border-foreground/[0.06]">
                                <h2 className="text-sm font-bold text-foreground/80 mb-4">{t("teamTitle")}</h2>
                                <p className="text-xs text-foreground/50 mb-4">
                                    {t("teamDesc")}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {["Forest", "Hexen", "Pez", "Geze"].map((name) => (
                                        <div key={name} className="text-center p-3 bg-foreground/[0.02] rounded-lg">
                                            <span className="text-xs font-medium text-foreground/70">{name}</span>
                                            <p className="text-[10px] text-foreground mt-0.5">{t("founderRole")}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ContentContainer>
                </div>
            </div>
        </div>
    )
}
