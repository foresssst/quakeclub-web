"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

export default function MaintenancePage() {
    const [loading, setLoading] = useState<string | null>(null)
    const [results, setResults] = useState<any>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/maintenance")
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
    })

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["admin", "db-stats"],
        queryFn: async () => {
            const res = await fetch("/api/admin/maintenance/stats")
            if (!res.ok) throw new Error("Failed to fetch stats")
            return res.json()
        },
        enabled: !!authData?.user,
        staleTime: 60 * 1000,
    })

    const runMaintenance = async (action: string) => {
        setLoading(action)
        setResults(null)
        try {
            const res = await fetch("/api/admin/maintenance/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            })
            const data = await res.json()
            setResults(data)
            queryClient.invalidateQueries({ queryKey: ["admin", "db-stats"] })
        } catch (error) {
            setResults({ error: "Error al ejecutar mantenimiento" })
        } finally {
            setLoading(null)
        }
    }

    if (!authData?.user) return null

    const maintenanceTools = [
        {
            action: "fix-usernames",
            title: "Corregir Usernames Rotos",
            description: "Busca jugadores con usernames problemáticos y los corrige usando sus aliases o un fallback."
        },
        {
            action: "sync-stats",
            title: "Sincronizar Stats (EloHistory)",
            description: "Recalcula estadísticas de wins/losses/draws basándose en los registros de EloHistory."
        },
        {
            action: "sync-wins-losses",
            title: "Sincronizar Wins/Losses (Recomendado)",
            description: "Recalcula wins/losses basándose en los PARTIDOS REALES, no en cambios de ELO."
        },
        {
            action: "clean-sessions",
            title: "Limpiar Sesiones Expiradas",
            description: "Elimina sesiones de usuario que ya expiraron."
        },
        {
            action: "check-consistency",
            title: "Verificar Consistencia de Datos",
            description: "Analiza la base de datos buscando inconsistencias."
        },
        {
            action: "sync-steam-profiles",
            title: "Sincronizar Perfiles desde Steam",
            description: "Consulta la Steam API para obtener nombres y avatares reales de jugadores."
        },
        {
            action: "clear-rankings-cache",
            title: "Limpiar Caché de Rankings",
            description: "Invalida el caché de rankings para forzar recálculo."
        },
        {
            action: "recalculate-clan-elo",
            title: "Recalcular ELO de Clanes",
            description: "Recalcula el ELO promedio de todos los clanes."
        }
    ]

    return (
        <AdminLayout title="Mantenimiento" subtitle="Herramientas de mantenimiento y diagnostico">
            {/* Stats Grid */}
                            {statsLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                </div>
                            ) : stats && (
                                <>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                        <StatCard label="Jugadores Totales" value={stats.totalPlayers} />
                                        <StatCard label="Usernames Rotos" value={stats.brokenUsernames} color="red" />
                                        <StatCard label="Jugadores Activos (30d)" value={stats.activePlayers} color="green" />
                                        <StatCard label="Clanes" value={stats.totalClans} />
                                        <StatCard label="Partidas Totales" value={stats.totalMatches} />
                                        <StatCard label="Rating Records" value={stats.totalRatings} />
                                        <StatCard label="Solicitudes Pendientes" value={stats.pendingJoinRequests} color="yellow" />
                                        <StatCard label="Aliases Registrados" value={stats.totalAliases} />
                                    </div>

                                    {/* Legend */}
                                    <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 mb-6">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                            Leyenda de Estadísticas
                                        </h3>
                                        <div className="grid gap-2 sm:grid-cols-2 text-[10px] text-foreground/40">
                                            <div><span className="text-foreground/60">Jugadores Totales:</span> Todos los registros en la base de datos.</div>
                                            <div><span className="text-green-600/60">Jugadores Activos:</span> Con partidas en los últimos 30 días.</div>
                                            <div><span className="text-red-500/60">Usernames Rotos:</span> Nombres problemáticos (vacíos, códigos de color).</div>
                                            <div><span className="text-foreground/60">Rating Records:</span> Total de registros de ELO por modo de juego.</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Maintenance Tools */}
                            <div className="border-t border-foreground/[0.06] pt-6">
                                <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-4 font-tiktok">
                                    Herramientas de Mantenimiento
                                </h2>
                                <div className="space-y-2">
                                    {maintenanceTools.map((tool) => (
                                        <div
                                            key={tool.action}
                                            className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-foreground">{tool.title}</h3>
                                                <p className="text-[10px] text-foreground/40 mt-0.5">{tool.description}</p>
                                            </div>
                                            <button
                                                onClick={() => runMaintenance(tool.action)}
                                                disabled={loading !== null}
                                                className={`ml-4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded ${loading === tool.action
                                                    ? "bg-foreground/50 text-white cursor-wait"
                                                    : loading
                                                        ? "bg-black/5 text-foreground/30 cursor-not-allowed"
                                                        : "bg-foreground text-white hover:brightness-110"
                                                    }`}
                                            >
                                                {loading === tool.action ? "..." : "Ejecutar"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Results Panel */}
                            {results && (
                                <div className={`mt-6 p-4 rounded-lg border ${results.error
                                    ? "bg-red-500/10 border-red-500/20"
                                    : "bg-green-500/10 border-green-500/20"
                                    }`}>
                                    <h3 className={`text-sm font-bold mb-2 ${results.error ? "text-red-500" : "text-green-600"}`}>
                                        {results.error ? "Error" : "Resultado"}
                                    </h3>
                                    <div className="space-y-1 text-[11px] text-foreground/70">
                                        {results.message && <p className="font-bold">{results.message}</p>}
                                        {results.stats && (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                                {Object.entries(results.stats).map(([key, val]) => (
                                                    <div key={key} className="bg-foreground/[0.04] rounded px-3 py-2">
                                                        <span className="text-[9px] text-foreground/40 uppercase block">{key}</span>
                                                        <span className="text-sm font-bold text-foreground">{String(val)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {results.updates && Array.isArray(results.updates) && results.updates.length > 0 && (
                                            <div className="mt-2 max-h-48 overflow-y-auto">
                                                <p className="text-[9px] text-foreground/40 uppercase mb-1">Cambios ({results.updates.length})</p>
                                                {results.updates.map((u: string, i: number) => (
                                                    <p key={i} className="text-[10px] text-foreground/50 font-mono py-0.5 border-b border-foreground/[0.04] last:border-0">{u}</p>
                                                ))}
                                            </div>
                                        )}
                                        {!results.message && !results.stats && !results.updates && (
                                            <pre className="text-[10px] text-foreground/60 font-mono whitespace-pre-wrap overflow-x-auto">
                                                {JSON.stringify(results, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            )}
        </AdminLayout>
    )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: "red" | "green" | "yellow" }) {
    const colorClasses = {
        red: "text-red-500",
        green: "text-green-600",
        yellow: "text-yellow-600",
    }

    return (
        <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
            <div className={`text-2xl font-bold font-tiktok ${color ? colorClasses[color] : "text-foreground"}`}>
                {typeof value === "number" ? value.toLocaleString() : value}
            </div>
            <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">
                {label}
            </div>
        </div>
    )
}
