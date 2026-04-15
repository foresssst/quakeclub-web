"use client"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

interface BannerConfig {
    mode: "latest" | "specific" | "motd"
    newsId?: string
    motdText?: string
}

const inputCls = "w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"

export default function BannerControlPage() {
    const [config, setConfig] = useState<BannerConfig>({ mode: "latest" })
    const [selectedNewsId, setSelectedNewsId] = useState("")
    const [motdText, setMotdText] = useState("")
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin")
                throw new Error("Not authenticated")
            }
            const data = await res.json()
            if (!data.user.isAdmin) {
                router.push("/admin")
                throw new Error("Not authorized")
            }
            return data
        },
        staleTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: newsData } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => {
            const res = await fetch("/api/news/list")
            if (!res.ok) throw new Error("Failed to fetch news")
            const data = await res.json()
            return data.news || []
        },
        enabled: !!authData?.user,
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: bannerConfig } = useQuery({
        queryKey: ["admin", "banner-config"],
        queryFn: async () => {
            const res = await fetch("/api/admin/banner-config")
            if (!res.ok) throw new Error("Failed to fetch config")
            return res.json()
        },
        enabled: !!authData?.user,
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    useEffect(() => {
        if (bannerConfig) {
            setConfig(bannerConfig)
            if (bannerConfig.mode === "specific" && bannerConfig.newsId) {
                setSelectedNewsId(bannerConfig.newsId)
            }
            if (bannerConfig.mode === "motd" && bannerConfig.motdText) {
                setMotdText(bannerConfig.motdText)
            }
        }
    }, [bannerConfig])

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(false), 3000)
            return () => clearTimeout(t)
        }
    }, [success])

    const user = authData?.user
    const news = newsData || []

    async function handleSave() {
        setSaving(true)
        try {
            const payload: BannerConfig = { mode: config.mode }

            if (config.mode === "specific") {
                if (!selectedNewsId) {
                    toast.warning("Selecciona una noticia")
                    setSaving(false)
                    return
                }
                payload.newsId = selectedNewsId
            } else if (config.mode === "motd") {
                if (!motdText.trim()) {
                    toast.warning("Escribe un mensaje")
                    setSaving(false)
                    return
                }
                payload.motdText = motdText
            }

            const res = await fetch("/api/admin/banner-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["admin", "banner-config"] })
                setSuccess(true)
            } else {
                const errorData = await res.json()
                toast.error(`${errorData.error || "Error desconocido"}`)
            }
        } catch (error) {
            console.error("Error saving config:", error)
            toast.error("Error al guardar configuración")
        } finally {
            setSaving(false)
        }
    }

    if (!user) {
        return null
    }

    return (
        <AdminLayout title="Banner" subtitle="Gestiona el banner de la pagina principal">
            {success && (
                                <div className="mb-6 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-600">
                                    Configuración guardada exitosamente
                                </div>
                            )}

                            {/* Mode Selector */}
                            <div className="mb-6">
                                <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                    Modo de Banner
                                </h2>
                                <div className="space-y-2">
                                    {[
                                        { value: "latest", label: "Última Noticia", desc: "Muestra automáticamente la noticia más reciente" },
                                        { value: "specific", label: "Noticia Específica", desc: "Selecciona manualmente una noticia" },
                                        { value: "motd", label: "Mensaje Personalizado", desc: "Escribe un anuncio personalizado" },
                                    ].map((option) => (
                                        <label
                                            key={option.value}
                                            className={`flex cursor-pointer items-center gap-3 p-4 rounded-lg border transition-all ${config.mode === option.value
                                                ? "border-foreground/30 bg-foreground/5"
                                                : "border-foreground/[0.04] bg-foreground/[0.02] hover:bg-foreground/[0.03]"
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="mode"
                                                value={option.value}
                                                checked={config.mode === option.value}
                                                onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                                                className="h-4 w-4 accent-[#1a1a1e]"
                                            />
                                            <div>
                                                <div className={`text-sm font-medium ${config.mode === option.value ? "text-foreground" : "text-foreground"}`}>
                                                    {option.label}
                                                </div>
                                                <div className="text-[10px] text-foreground/30">{option.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Specific News Selector */}
                            {config.mode === "specific" && (
                                <div className="mb-6">
                                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                        Seleccionar Noticia
                                    </h2>
                                    <select
                                        value={selectedNewsId}
                                        onChange={(e) => setSelectedNewsId(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="">Selecciona una noticia...</option>
                                        {news.map((item: any) => (
                                            <option key={item.id} value={item.id}>
                                                {item.title} - {new Date(item.date).toLocaleDateString("es-CL")}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* MOTD Text Input */}
                            {config.mode === "motd" && (
                                <div className="mb-6">
                                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                        Mensaje Personalizado
                                    </h2>
                                    <textarea
                                        value={motdText}
                                        onChange={(e) => setMotdText(e.target.value)}
                                        className={`${inputCls} resize-none`}
                                        placeholder="Escribe tu mensaje o anuncio aquí..."
                                        rows={4}
                                        maxLength={200}
                                    />
                                    <div className="mt-1 text-right text-[10px] text-foreground/30">{motdText.length}/200</div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 bg-foreground text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all font-tiktok rounded-lg disabled:opacity-50"
                                >
                                    {saving ? "Guardando..." : "Guardar"}
                                </button>
                                <button
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "banner-config"] })}
                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-4 py-2.5 text-xs font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded-lg"
                                >
                                    Recargar
                                </button>
                            </div>
        </AdminLayout>
    )
}
