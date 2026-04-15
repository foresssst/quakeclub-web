"use client"
import { systemConfirm } from "@/components/ui/system-modal"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import { PlayerAvatar } from "@/components/player-avatar"
import Link from "next/link"

interface LinkedPlayer {
    id: string
    steamId: string
    username: string
    avatar: string | null
    lastSeen: string | null
}

interface LinkedAccount {
    id: string
    steamId: string
    sharedIps: string[]
    isPrimary: boolean
    player: LinkedPlayer | null
}

interface LinkedAccountGroup {
    id: string
    status: string
    note: string | null
    reviewedBy: string | null
    reviewedAt: string | null
    createdAt: string
    accounts: LinkedAccount[]
}

type FilterStatus = "all" | "pending" | "confirmed" | "dismissed"

const FILTERS: { id: FilterStatus; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "pending", label: "Por revisar" },
    { id: "confirmed", label: "Expuestos" },
    { id: "dismissed", label: "Descartados" },
]

function parseConfidence(note: string | null): "high" | "medium" | "low" | null {
    if (!note) return null
    if (note.includes("[high]")) return "high"
    if (note.includes("[medium]")) return "medium"
    if (note.includes("[low]")) return "low"
    return null
}

function parseReason(note: string | null): string {
    if (!note) return ""
    return note.replace(/\s*\[(high|medium|low)\]\s*$/, "")
}

function getConfidenceStyle(c: "high" | "medium" | "low" | null) {
    if (c === "high") return "bg-red-500/15 text-red-700"
    if (c === "medium") return "bg-amber-500/15 text-amber-700"
    return "bg-gray-500/15 text-gray-600"
}

function getStatusStyle(s: string) {
    if (s === "confirmed") return "bg-green-500/15 text-green-700"
    if (s === "dismissed") return "bg-foreground/[0.06] text-foreground/30"
    return "bg-amber-500/15 text-amber-700"
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

export default function LinkedAccountsPage() {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState<FilterStatus>("all")
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "linked-accounts"],
        queryFn: async () => {
            const res = await fetch("/api/admin/linked-accounts")
            if (!res.ok) throw new Error("Error cargando datos")
            return res.json() as Promise<{ groups: LinkedAccountGroup[] }>
        },
    })

    const scanMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/linked-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "scan" }),
            })
            if (!res.ok) throw new Error((await res.json()).error || "Error al escanear")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "linked-accounts"] }),
    })

    const updateMutation = useMutation({
        mutationFn: async (body: { groupId: string; status?: string; note?: string; primarySteamId?: string }) => {
            const res = await fetch("/api/admin/linked-accounts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error("Error al actualizar")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "linked-accounts"] }),
    })

    const deleteMutation = useMutation({
        mutationFn: async (groupId: string) => {
            const res = await fetch(`/api/admin/linked-accounts?groupId=${groupId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Error al eliminar")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "linked-accounts"] }),
    })

    const removeAccountMutation = useMutation({
        mutationFn: async ({ groupId, accountId }: { groupId: string; accountId: string }) => {
            const res = await fetch(`/api/admin/linked-accounts?groupId=${groupId}&accountId=${accountId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Error al remover")
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "linked-accounts"] }),
    })

    const groups = data?.groups ?? []
    const filtered = filter === "all" ? groups : groups.filter(g => g.status === filter)

    const counts = {
        all: groups.length,
        pending: groups.filter(g => g.status === "pending").length,
        confirmed: groups.filter(g => g.status === "confirmed").length,
        dismissed: groups.filter(g => g.status === "dismissed").length,
    }

    return (
        <AdminLayout title="Multi-Cuentas" subtitle={`${groups.length} pares detectados`}>
            {/* Filtros + escanear */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                filter === f.id
                                    ? "bg-foreground text-white"
                                    : "bg-foreground/[0.04] text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground/60"
                            }`}
                        >
                            {f.label}
                            <span className="ml-1 opacity-60">{counts[f.id]}</span>
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => scanMutation.mutate()}
                    disabled={scanMutation.isPending}
                    className="px-3 py-1.5 bg-foreground text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:brightness-110 disabled:opacity-40 transition-all"
                >
                    {scanMutation.isPending ? "Escaneando..." : "Escanear QLDS"}
                </button>
            </div>

            {scanMutation.isSuccess && scanMutation.data && (
                <div className="mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 text-[10px] font-bold uppercase tracking-wider">
                    {scanMutation.data.message}
                </div>
            )}

            {/* Tabla */}
            <div className="bg-foreground/[0.02] rounded-lg border border-foreground/[0.06] overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin mx-auto" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-foreground/30 text-xs">
                        {groups.length === 0 ? "Sin datos. Ejecuta un escaneo." : "Nada con este filtro."}
                    </div>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-foreground/[0.06] text-left">
                                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Cuenta A</th>
                                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40 text-center w-14">IPs</th>
                                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Cuenta B</th>
                                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40 text-center">Confianza</th>
                                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40 text-center">Estado</th>
                                <th className="px-3 py-2.5 w-6"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(group => {
                                const a = group.accounts[0]
                                const b = group.accounts[1]
                                const confidence = parseConfidence(group.note)
                                const reason = parseReason(group.note)
                                const isExpanded = expandedGroup === group.id
                                const maxIps = Math.max(...group.accounts.map(acc => acc.sharedIps.length))

                                return (
                                    <GroupRow
                                        key={group.id}
                                        group={group}
                                        a={a}
                                        b={b}
                                        confidence={confidence}
                                        reason={reason}
                                        maxIps={maxIps}
                                        isExpanded={isExpanded}
                                        onToggle={() => setExpandedGroup(isExpanded ? null : group.id)}
                                        onUpdate={(body) => updateMutation.mutate(body)}
                                        onDelete={async (id) => { if (await systemConfirm("¿Eliminar este par?")) deleteMutation.mutate(id) }}
                                        onRemoveAccount={async (groupId, accountId) => {
                                            if (await systemConfirm("¿Sacar esta cuenta del grupo?"))
                                                removeAccountMutation.mutate({ groupId, accountId })
                                        }}
                                    />
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </AdminLayout>
    )
}

function GroupRow({
    group, a, b, confidence, reason, maxIps, isExpanded,
    onToggle, onUpdate, onDelete, onRemoveAccount,
}: {
    group: LinkedAccountGroup
    a: LinkedAccount | undefined
    b: LinkedAccount | undefined
    confidence: "high" | "medium" | "low" | null
    reason: string
    maxIps: number
    isExpanded: boolean
    onToggle: () => void
    onUpdate: (body: { groupId: string; status?: string; note?: string; primarySteamId?: string }) => void
    onDelete: (groupId: string) => void
    onRemoveAccount: (groupId: string, accountId: string) => void
}) {
    return (
        <>
            <tr
                className={`border-b border-foreground/[0.04] hover:bg-foreground/[0.02] cursor-pointer transition-colors ${
                    group.status === "dismissed" ? "opacity-40" : ""
                }`}
                onClick={onToggle}
            >
                {/* Cuenta A */}
                <td className="px-4 py-2.5">
                    {a && (
                        <Link href={`/perfil/${a.steamId}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
                            <PlayerAvatar
                                steamId={a.steamId}
                                playerName={a.player?.username || a.steamId}
                                avatarUrl={a.player?.avatar || undefined}
                                size="sm"
                            />
                            <div className="min-w-0">
                                <span className="text-xs text-foreground font-bold block truncate">{a.player?.username || a.steamId}</span>
                                <span className="text-[9px] text-black/25 font-mono">{a.steamId}</span>
                            </div>
                        </Link>
                    )}
                </td>

                {/* IPs */}
                <td className="px-3 py-2.5 text-center">
                    <span className={`text-sm font-mono font-bold ${
                        maxIps >= 3 ? "text-red-600" : maxIps >= 2 ? "text-amber-600" : "text-foreground/30"
                    }`}>
                        {maxIps}
                    </span>
                </td>

                {/* Cuenta B */}
                <td className="px-4 py-2.5">
                    {b && (
                        <Link href={`/perfil/${b.steamId}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
                            <PlayerAvatar
                                steamId={b.steamId}
                                playerName={b.player?.username || b.steamId}
                                avatarUrl={b.player?.avatar || undefined}
                                size="sm"
                            />
                            <div className="min-w-0">
                                <span className="text-xs text-foreground font-bold block truncate">{b.player?.username || b.steamId}</span>
                                <span className="text-[9px] text-black/25 font-mono">{b.steamId}</span>
                            </div>
                        </Link>
                    )}
                </td>

                {/* Confianza */}
                <td className="px-3 py-2.5 text-center">
                    {confidence && (
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getConfidenceStyle(confidence)}`}>
                            {confidence === "high" ? "Alta" : confidence === "medium" ? "Media" : "Baja"}
                        </span>
                    )}
                </td>

                {/* Estado */}
                <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(group.status)}`}>
                        {group.status === "confirmed" ? "Expuesto" : group.status === "dismissed" ? "Falso +" : "Pendiente"}
                    </span>
                </td>

                {/* Expand arrow */}
                <td className="px-3 py-2.5 text-foreground/30">
                    <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </td>
            </tr>

            {/* Expanded detail */}
            {isExpanded && (
                <tr className="bg-foreground/[0.02]">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-4">
                            {/* Razon */}
                            {reason && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-foreground/30 uppercase tracking-wider font-bold">Razon:</span>
                                    <span className="text-xs text-foreground/60">{reason}</span>
                                </div>
                            )}

                            {/* Info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                <div>
                                    <span className="text-foreground/30 uppercase tracking-wider font-bold">Fecha deteccion</span>
                                    <div className="text-foreground/60 mt-0.5">{formatDate(group.createdAt)}</div>
                                </div>
                                <div>
                                    <span className="text-foreground/30 uppercase tracking-wider font-bold">Revisado por</span>
                                    <div className="text-foreground/60 mt-0.5">{group.reviewedBy || "—"}</div>
                                </div>
                                {group.reviewedAt && (
                                    <div>
                                        <span className="text-foreground/30 uppercase tracking-wider font-bold">Fecha revision</span>
                                        <div className="text-foreground/60 mt-0.5">{formatDate(group.reviewedAt)}</div>
                                    </div>
                                )}
                            </div>

                            {/* Cuentas */}
                            <div className="space-y-2">
                                <span className="text-[10px] text-foreground/30 uppercase tracking-wider font-bold">Cuentas del grupo</span>
                                {group.accounts.map(account => (
                                    <div key={account.id} className="flex items-center justify-between bg-foreground/[0.03] rounded-lg px-3 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <PlayerAvatar
                                                steamId={account.steamId}
                                                playerName={account.player?.username || account.steamId}
                                                avatarUrl={account.player?.avatar || undefined}
                                                size="sm"
                                            />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-foreground">{account.player?.username || account.steamId}</span>
                                                    {account.isPrimary && (
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-foreground text-white">Main</span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] text-black/25 font-mono">{account.steamId}</span>
                                                {account.sharedIps.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {account.sharedIps.map((ip, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 rounded bg-foreground/[0.05] text-[9px] font-mono text-foreground/40">{ip}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!account.isPrimary && (
                                                <button
                                                    onClick={() => onUpdate({ groupId: group.id, primarySteamId: account.steamId })}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-foreground/40 bg-foreground/[0.04] hover:bg-foreground/[0.08] hover:text-foreground/60 transition-all"
                                                >
                                                    Marcar Main
                                                </button>
                                            )}
                                            {group.accounts.length > 2 && (
                                                <button
                                                    onClick={() => onRemoveAccount(group.id, account.id)}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-500/60 bg-red-500/10 hover:bg-red-500/20 hover:text-red-600 transition-all"
                                                >
                                                    Sacar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Nota */}
                            <div>
                                <span className="text-[10px] text-foreground/30 uppercase tracking-wider font-bold block mb-1.5">Nota</span>
                                <input
                                    type="text"
                                    defaultValue={group.note?.replace(/\s*\[(high|medium|low)\]\s*$/, "") || ""}
                                    placeholder="Agregar nota..."
                                    onBlur={(e) => {
                                        const val = e.target.value.trim()
                                        const current = group.note?.replace(/\s*\[(high|medium|low)\]\s*$/, "") || ""
                                        if (val !== current) {
                                            onUpdate({ groupId: group.id, note: val })
                                        }
                                    }}
                                    className="w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:ring-1 focus:ring-black/10"
                                />
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center gap-2 pt-1 border-t border-foreground/[0.06]">
                                {group.status !== "confirmed" && (
                                    <button
                                        onClick={() => onUpdate({ groupId: group.id, status: "confirmed" })}
                                        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white bg-green-600 hover:bg-green-700 transition-all"
                                    >
                                        Exponer
                                    </button>
                                )}
                                {group.status === "confirmed" && (
                                    <button
                                        onClick={() => onUpdate({ groupId: group.id, status: "pending" })}
                                        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 transition-all"
                                    >
                                        Ocultar
                                    </button>
                                )}
                                {group.status !== "dismissed" && (
                                    <button
                                        onClick={() => onUpdate({ groupId: group.id, status: "dismissed" })}
                                        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-foreground/40 bg-foreground/[0.06] hover:bg-black/[0.10] hover:text-foreground/60 transition-all"
                                    >
                                        Falso positivo
                                    </button>
                                )}
                                <div className="flex-1" />
                                <button
                                    onClick={() => onDelete(group.id)}
                                    className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-red-500/60 hover:text-red-600 hover:bg-red-500/10 transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}
