import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { buildMetadata } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
    title: "Términos de Servicio",
    description: "Términos y condiciones de uso de QuakeClub para la comunidad y plataforma de Quake Live en Chile.",
    path: "/terminos",
    keywords: ["terminos", "condiciones", "servicio"],
})

export default async function TerminosPage() {
    const t = await getTranslations("terms")

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
                                <p>{t("section1Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section2Title")}</h2>
                                <p>{t("section2Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section2Item1")}</li>
                                    <li>{t("section2Item2")}</li>
                                    <li>{t("section2Item3")}</li>
                                    <li>{t("section2Item4")}</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section3Title")}</h2>
                                <p>{t("section3Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section3Item1")}</li>
                                    <li>{t("section3Item2")}</li>
                                    <li>{t("section3Item3")}</li>
                                    <li>{t("section3Item4")}</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section4Title")}</h2>
                                <p>{t("section4Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section4Item1")}</li>
                                    <li>{t("section4Item2")}</li>
                                    <li>{t("section4Item3")}</li>
                                    <li>{t("section4Item4")}</li>
                                    <li>{t("section4Item5")}</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section5Title")}</h2>
                                <p>{t("section5Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section5Item1")}</li>
                                    <li>{t("section5Item2")}</li>
                                    <li>{t("section5Item3")}</li>
                                    <li>{t("section5Item4")}</li>
                                </ul>
                                <p>{t("section5Note")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section6Title")}</h2>
                                <p>{t("section6Text1")}</p>
                                <p>{t("section6Text2")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section7Title")}</h2>
                                <p>{t("section7Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section8Title")}</h2>
                                <p>{t("section8Intro")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>{t("section8Item1")}</li>
                                    <li>{t("section8Item2")}</li>
                                    <li>{t("section8Item3")}</li>
                                    <li>{t("section8Item4")}</li>
                                </ul>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section9Title")}</h2>
                                <p>{t("section9Text")}</p>
                            </section>

                            <section className="space-y-3">
                                <h2 className="text-sm font-medium text-foreground/80">{t("section10Title")}</h2>
                                <p>{t("section10Text")}</p>
                                <ul className="list-disc pl-5 space-y-1 text-foreground/50">
                                    <li>foresssst</li>
                                    <li>hexencl</li>
                                    <li>geze5204</li>
                                    <li>pez_cao</li>
                                </ul>
                            </section>

                        </div>
                    </ContentContainer>
                </div>
            </div>
        </div>
    )
}
