"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

interface ServiceStatus {
    name: string
    key: string
    status: "operational" | "degraded" | "down"
    description: string
    responseTime?: number
}

interface HistoryEntry {
    date: string
    status: "operational" | "degraded" | "down"
}

interface StatusResponse {
    overall: "operational" | "degraded" | "down"
    services: ServiceStatus[]
    history: Record<string, HistoryEntry[]>
    timestamp: string
}

export default function StatusPage() {
    const t = useTranslations("status")
    const [data, setData] = useState<StatusResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStatus = async () => {
        try {
            const res = await fetch("/api/status")
            if (res.ok) {
                const json = await res.json()
                setData(json)
                setError(null)
            } else {
                setError(t("errorFetch"))
            }
        } catch {
            setError(t("errorConnect"))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [])

    const StatusBadge = ({ status }: { status: "operational" | "degraded" | "down" }) => {
        const colors = {
            operational: "bg-foreground",
            degraded: "bg-white/40",
            down: "bg-red-500",
        }
        return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
    }

    // Generate 90 bars from history data
    const generateBars = (serviceKey: string, currentStatus: "operational" | "degraded" | "down") => {
        const historyData = data?.history[serviceKey] || []
        const bars: ("operational" | "degraded" | "down")[] = []

        // Create a map of date -> status
        const statusMap = new Map<string, "operational" | "degraded" | "down">()
        for (const entry of historyData) {
            statusMap.set(entry.date, entry.status)
        }

        // Generate 90 days of bars
        const today = new Date()
        for (let i = 89; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split("T")[0]

            if (i === 0) {
                // Today - use current status
                bars.push(currentStatus)
            } else if (statusMap.has(dateStr)) {
                bars.push(statusMap.get(dateStr)!)
            } else {
                // No data for this day - assume operational (no recorded issues)
                bars.push("operational")
            }
        }

        return bars
    }

    const calculateUptime = (bars: ("operational" | "degraded" | "down")[]) => {
        const operational = bars.filter(b => b === "operational").length
        return ((operational / bars.length) * 100).toFixed(2)
    }

    return (
        <div className="relative min-h-screen flex flex-col">
            <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1100px] pt-8 sm:pt-12 flex-1">
                <div className="space-y-4 sm:space-y-6 animate-fade-up">
                    {/* Top Ad - In-Feed */}

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex items-center gap-3 text-foreground/40">
                                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span className="text-sm">{t("loading")}</span>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="p-4 border bg-red-500/10 border-red-500/30 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div>
                                    <p className="text-sm font-medium text-red-500">{error}</p>
                                    <p className="text-xs text-foreground/40 mt-0.5">{t("tryReload")}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    {data && !loading && (
                        <>
                            {/* Overall Status Banner */}
                            <div className={`p-4 border rounded-xl ${data.overall === "operational" ? "bg-foreground/10 border-foreground/30" :
                                data.overall === "degraded" ? "bg-foreground/[0.06] border-black/20" :
                                    "bg-red-500/10 border-red-500/30"
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${data.overall === "operational" ? "bg-foreground" :
                                        data.overall === "degraded" ? "bg-white/40" : "bg-red-500"
                                        }`} />
                                    <div>
                                        <p className={`text-sm font-medium ${data.overall === "operational" ? "text-foreground" :
                                            data.overall === "degraded" ? "text-foreground/60" : "text-red-500"
                                            }`}>
                                            {data.overall === "operational" ? t("allOperational") :
                                                data.overall === "degraded" ? t("someDegraded") :
                                                    t("criticalFailure")}
                                        </p>
                                        <p className="text-xs text-foreground/40 mt-0.5">
                                            {t("lastCheck")}: {new Date(data.timestamp).toLocaleTimeString("es-CL")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* System Services with Uptime Bars */}
                            <ContentContainer className="animate-scale-fade">
                                <ContentHeader>
                                    <div className="flex items-center justify-between w-full">
                                        <div>
                                            <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                                                {t("systemStatus")}
                                            </h2>
                                            <p className="text-[10px] text-foreground/40 mt-0.5">{t("last90Days")}</p>
                                        </div>
                                        <button
                                            onClick={() => { setLoading(true); fetchStatus(); }}
                                            className="text-[10px] text-[#333] hover:text-foreground transition-colors"
                                        >
                                            {t("refresh")}
                                        </button>
                                    </div>
                                </ContentHeader>

                                <div className="p-4 space-y-6">
                                    {data.services.map((service) => {
                                        const bars = generateBars(service.key, service.status)
                                        const uptime = calculateUptime(bars)

                                        return (
                                            <div key={service.key} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <StatusBadge status={service.status} />
                                                        <span className="text-xs font-medium text-foreground/80">{service.name}</span>
                                                        <span className="text-[10px] text-foreground/30 hidden sm:inline">
                                                            {service.description}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {service.responseTime !== undefined && service.responseTime > 0 && (
                                                            <span className="text-[10px] text-foreground/30">{service.responseTime}ms</span>
                                                        )}
                                                        <span className="text-[10px] text-foreground/40">{uptime}% uptime</span>
                                                    </div>
                                                </div>
                                                {/* Uptime bars */}
                                                <div className="flex gap-[2px] h-7">
                                                    {bars.map((status, i) => (
                                                        <div
                                                            key={i}
                                                            className={`flex-1 rounded-lg transition-all hover:opacity-80 cursor-default ${status === "operational" ? "bg-foreground/70 hover:bg-foreground" :
                                                                status === "degraded" ? "bg-white/30 hover:bg-black/15" :
                                                                    "bg-red-500/60 hover:bg-red-500/80"
                                                                }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ContentContainer>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 text-[10px] text-foreground/40">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-lg bg-foreground/70" />
                                    <span>{t("operational")}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-lg bg-white/30" />
                                    <span>{t("degraded")}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-lg bg-red-500/60" />
                                    <span>{t("down")}</span>
                                </div>
                            </div>

                            <p className="text-center text-[9px] text-foreground/20">
                                {t("autoRefresh")}
                            </p>
                        </>
                    )}

                    {/* Bottom Ad - Display */}

                </div>
            </div>
        </div>
    )
}
