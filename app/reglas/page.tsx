"use client"

import { useTranslations } from "next-intl"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export default function ReglasPage() {
    const t = useTranslations("rules")

    const reglasGenerales = [
        { titulo: t("generalRule1Title"), descripcion: t("generalRule1Desc") },
        { titulo: t("generalRule2Title"), descripcion: t("generalRule2Desc") },
        { titulo: t("generalRule3Title"), descripcion: t("generalRule3Desc") },
        { titulo: t("generalRule4Title"), descripcion: t("generalRule4Desc") },
    ]

    const reglasDuel = [
        { titulo: t("duelRule1Title"), descripcion: t("duelRule1Desc") },
        { titulo: t("duelRule2Title"), descripcion: t("duelRule2Desc") },
        { titulo: t("duelRule3Title"), descripcion: t("duelRule3Desc") },
        { titulo: t("duelRule4Title"), descripcion: t("duelRule4Desc") },
    ]

    const reglasCA = [
        { titulo: t("caRule1Title"), descripcion: t("caRule1Desc") },
        { titulo: t("caRule2Title"), descripcion: t("caRule2Desc") },
        { titulo: t("caRule3Title"), descripcion: t("caRule3Desc") },
        { titulo: t("caRule4Title"), descripcion: t("caRule4Desc") },
    ]

    const reglasCompetitivo = [
        { titulo: t("compRule1Title"), descripcion: t("compRule1Desc") },
        { titulo: t("compRule2Title"), descripcion: t("compRule2Desc") },
        { titulo: t("compRule3Title"), descripcion: t("compRule3Desc") },
        { titulo: t("compRule4Title"), descripcion: t("compRule4Desc") },
        { titulo: t("compRule5Title"), descripcion: t("compRule5Desc") },
    ]

    const sanciones = [
        { nivel: t("sanction1Level"), descripcion: t("sanction1Desc") },
        { nivel: t("sanction2Level"), descripcion: t("sanction2Desc") },
        { nivel: t("sanction3Level"), descripcion: t("sanction3Desc") },
        { nivel: t("sanction4Level"), descripcion: t("sanction4Desc") },
    ]

    return (
        <div className="relative min-h-screen">
            <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1100px] pt-8 sm:pt-12">
                <div className="space-y-4 sm:space-y-6 animate-fade-up">

                    {/* Header */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <div>
                                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                                    {t("title")}
                                </h1>
                                <p className="text-xs text-foreground/40 mt-1">{t("subtitle")}</p>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6">
                            <p className="text-xs text-foreground/50 leading-relaxed">
                                {t("intro")}
                            </p>
                        </div>
                    </ContentContainer>

                    {/* Reglas Generales */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                {t("generalRules")}
                            </h2>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-4">
                            {reglasGenerales.map((regla, i) => (
                                <div key={i} className="border-l-2 border-foreground/30 pl-4">
                                    <h3 className="text-xs font-medium text-black/90 mb-1">{regla.titulo}</h3>
                                    <p className="text-[11px] text-foreground/50 leading-relaxed">{regla.descripcion}</p>
                                </div>
                            ))}
                        </div>
                    </ContentContainer>

                    {/* Reglas Duel */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <div className="flex items-center gap-2">
                                <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                    {t("duelTitle")}
                                </h2>
                                <span className="px-2 py-0.5 bg-foreground/15 text-[#333] text-[9px] uppercase rounded">{t("duelBadge")}</span>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-4">
                            {reglasDuel.map((regla, i) => (
                                <div key={i} className="border-l-2 border-foreground/30 pl-4">
                                    <h3 className="text-xs font-medium text-black/90 mb-1">{regla.titulo}</h3>
                                    <p className="text-[11px] text-foreground/50 leading-relaxed">{regla.descripcion}</p>
                                </div>
                            ))}
                        </div>
                    </ContentContainer>

                    {/* Reglas CA */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <div className="flex items-center gap-2">
                                <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                    {t("caTitle")}
                                </h2>
                                <span className="px-2 py-0.5 bg-foreground/15 text-[#333] text-[9px] uppercase rounded">{t("caBadge")}</span>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-4">
                            {reglasCA.map((regla, i) => (
                                <div key={i} className="border-l-2 border-foreground/30 pl-4">
                                    <h3 className="text-xs font-medium text-black/90 mb-1">{regla.titulo}</h3>
                                    <p className="text-[11px] text-foreground/50 leading-relaxed">{regla.descripcion}</p>
                                </div>
                            ))}
                        </div>
                    </ContentContainer>

                    {/* Reglas Competitivo */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <div className="flex items-center gap-2">
                                <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                    {t("tournamentsTitle")}
                                </h2>
                                <span className="px-2 py-0.5 bg-foreground/15 text-[#333] text-[9px] uppercase rounded">{t("tournamentsBadge")}</span>
                            </div>
                        </ContentHeader>

                        <div className="p-4 sm:p-6 space-y-4">
                            {reglasCompetitivo.map((regla, i) => (
                                <div key={i} className="border-l-2 border-foreground/30 pl-4">
                                    <h3 className="text-xs font-medium text-black/90 mb-1">{regla.titulo}</h3>
                                    <p className="text-[11px] text-foreground/50 leading-relaxed">{regla.descripcion}</p>
                                </div>
                            ))}
                        </div>
                    </ContentContainer>

                    {/* Sanciones */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                {t("sanctionsTitle")}
                            </h2>
                        </ContentHeader>

                        <div className="p-4 sm:p-6">
                            <div className="grid gap-3 sm:grid-cols-2">
                                {sanciones.map((sancion, i) => (
                                    <div key={i} className="p-3 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg">
                                        <h3 className="text-xs font-medium text-foreground/80 mb-1">{sancion.nivel}</h3>
                                        <p className="text-[10px] text-foreground/40">{sancion.descripcion}</p>
                                    </div>
                                ))}
                            </div>

                            <p className="text-[10px] text-foreground/30 mt-4 text-center">
                                {t("sanctionsNote")}
                            </p>
                        </div>
                    </ContentContainer>

                    {/* Footer */}
                    <div className="text-center py-4">
                        <p className="text-[10px] text-foreground/30">
                            {t("lastUpdated")}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    )
}
