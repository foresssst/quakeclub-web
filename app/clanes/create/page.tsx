"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

export default function CreateClanPage() {
    const router = useRouter()
    const { toast } = useToast()
    const t = useTranslations("clans")
    const [formData, setFormData] = useState({
        name: "",
        tag: "",
        description: "",
    })
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) return { user: null }
            return res.json()
        },
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            if (formData.name.length < 1) {
                setError(t("errClanNameMin"))
                setLoading(false)
                return
            }

            if (formData.tag.length < 1 || formData.tag.length > 6) {
                setError(t("errClanTagLength"))
                setLoading(false)
                return
            }

            const response = await fetch("/api/clans/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || t("errCreateClan"))
                setLoading(false)
                return
            }

            toast({
                title: t("clanCreatedSuccess"),
                description: `${formData.name} ${t("clanCreatedDesc")}`,
            })

            router.push(`/clanes/${data.clan.slug}`)
        } catch (err) {
            setError(t("errConnection"))
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen">
            <div className="container mx-auto px-3 sm:px-4 max-w-[1100px] pb-16 pt-8 sm:pt-12">
                {/* Back Button */}
                <Link
                    href="/clanes"
                    className="inline-flex items-center gap-2 text-xs text-foreground/40 hover:text-foreground transition-colors mb-4 uppercase tracking-wider"
                >
                    ← {t("backToClans")}
                </Link>

                <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                    {/* Main Form */}
                    <ContentContainer className="animate-scale-fade">
                        <ContentHeader>
                            <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                                {t("createClanTitle")}
                            </h1>
                            <p className="text-xs text-foreground/40 mt-1">{t("createClanSubtitle")}</p>
                        </ContentHeader>

                        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-500">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                                    {t("clanName")} <span className="text-foreground">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t("clanNamePlaceholder")}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    maxLength={50}
                                    className="w-full px-3 py-2.5 bg-foreground/[0.03] border border-foreground/[0.06] rounded text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/50 focus:outline-none transition-all"
                                />
                                <p className="text-[10px] text-foreground/30">{t("clanNameHint")}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                                    {t("clanTag")} <span className="text-foreground">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t("clanTagPlaceholder")}
                                    value={formData.tag}
                                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                                    required
                                    maxLength={6}
                                    className="w-full px-3 py-2.5 bg-foreground/[0.03] border border-foreground/[0.06] rounded text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/50 focus:outline-none font-mono uppercase tracking-wider transition-all"
                                />
                                <p className="text-[10px] text-foreground/30">{t("clanTagHint")}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                                    {t("description")}
                                </label>
                                <textarea
                                    placeholder={t("descriptionPlaceholder")}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    maxLength={500}
                                    className="w-full px-3 py-2.5 bg-foreground/[0.03] border border-foreground/[0.06] rounded text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/50 focus:outline-none resize-none transition-all"
                                />
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-foreground/30">{t("optional")}</p>
                                    <p className="text-[10px] text-foreground/30">{formData.description.length}/500</p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-foreground/[0.06]">
                                <button
                                    type="submit"
                                    disabled={loading || !formData.name || !formData.tag}
                                    className="flex-1 rounded bg-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? t("creating") : t("createClan")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    disabled={loading}
                                    className="px-4 py-2.5 bg-foreground/[0.05] border border-foreground/[0.06] text-foreground/60 font-medium uppercase tracking-wider text-xs rounded hover:bg-black/10 hover:text-foreground transition-all disabled:opacity-50"
                                >
                                    {t("cancel")}
                                </button>
                            </div>
                        </form>
                    </ContentContainer>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Preview */}
                        <ContentContainer className="animate-fade-up">
                            <ContentHeader>
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                                    {t("preview")}
                                </h3>
                            </ContentHeader>
                            <div className="p-4">
                                <div className="bg-foreground/[0.02] border border-foreground/[0.06] rounded p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-black/5 rounded flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-foreground/40">
                                                {formData.tag ? formData.tag.substring(0, 2) : "??"}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-foreground uppercase tracking-wide truncate">
                                                [{formData.tag || "TAG"}]
                                            </div>
                                            <div className="text-sm text-foreground/70 truncate">
                                                {formData.name || t("clanNameDefault")}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 p-3 bg-foreground/[0.02] border border-foreground/[0.06] rounded">
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mb-1">
                                        {t("yourNameWillLookLike")}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-foreground font-bold">[{formData.tag || "TAG"}]</span>
                                        <span className="text-foreground">{authData?.user?.username || "TuNombre"}</span>
                                    </div>
                                </div>
                            </div>
                        </ContentContainer>

                        {/* Info */}
                        <ContentContainer className="animate-fade-up [animation-delay:100ms]">
                            <ContentHeader>
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                                    {t("importantInfo")}
                                </h3>
                            </ContentHeader>
                            <div className="p-4 space-y-2 text-[11px] text-foreground/50">
                                <div className="flex items-start gap-2">
                                    <span className="text-foreground font-bold">1.</span>
                                    <p>{t("infoOneClan")}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-foreground font-bold">2.</span>
                                    <p>{t("infoFounder")}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-foreground font-bold">3.</span>
                                    <p>{t("infoAutoElo")}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-foreground font-bold">4.</span>
                                    <p>{t("infoInvite")}</p>
                                </div>
                            </div>
                        </ContentContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
