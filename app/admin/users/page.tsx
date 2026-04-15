"use client"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { PlayerAvatar } from "@/components/player-avatar"
import { parseQuakeColors } from "@/lib/quake-colors"
import { UserRoleBadges, ROLE_CONFIG, type UserRole } from "@/components/user-role-badge"
import { AdminLayout } from "@/components/admin-layout"

interface Player {
    id: string
    steamId: string
    username: string
    avatar?: string
    roles: string[]
    isBanned: boolean
    isSuspended: boolean
    banReason?: string
    suspendReason?: string
    bannedAt?: string
    banExpiresAt?: string
    lastSeen?: string
    createdAt: string
    clan?: { tag: string; name: string; slug: string }
}

interface PlayerDetail {
    player: Player & {
        bannedBy?: string
        ratings: { gameType: string; rating: number; games: number }[]
        matchCount: number
        warnStrikes: number
        banvoted: boolean
    }
    history: {
        id: string
        type: string
        reason?: string
        details?: string
        duration?: number
        actorId?: string
        actorName?: string
        createdAt: string
    }[]
}

const AVAILABLE_ROLES: UserRole[] = ["founder", "dev", "admin", "mod"]

const FILTERS = [
    { id: "all", label: "Todos", short: "TODOS" },
    { id: "admin", label: "Administradores", short: "ADMINS" },
    { id: "banned", label: "Baneados", short: "BANEADOS" },
    { id: "suspended", label: "Suspendidos", short: "SUSPENDIDOS" },
]

export default function UsersAdminPage() {
    const router = useRouter()

    const [search, setSearch] = useState("")
    const [filter, setFilter] = useState("all")
    const [page, setPage] = useState(1)
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
    const [actionModal, setActionModal] = useState<{ type: "ban" | "warn" | "silence" | "banvote" | null; reason: string; duration: string }>({ type: null, reason: "", duration: "permanent" })
    const [rolesModal, setRolesModal] = useState<{ open: boolean; selectedRoles: string[] }>({ open: false, selectedRoles: [] })
    const [noteText, setNoteText] = useState("")
    const [saving, setSaving] = useState(false)
    const [formSuccess, setFormSuccess] = useState<string | null>(null)

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) { router.push("/login?returnTo=/admin/users"); throw new Error("x") }
            const data = await res.json()
            if (!data.user.isAdmin) { router.push("/"); throw new Error("x") }
            return data
        },
        staleTime: 10 * 60 * 1000,
    })

    const { data: usersData, isLoading, refetch: refetchList } = useQuery({
        queryKey: ["admin-users", search, filter, page],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set("search", search)
            if (filter !== "all") params.set("filter", filter)
            params.set("limit", "50")
            params.set("page", String(page))
            const res = await fetch(`/api/admin/users?${params}`)
            if (!res.ok) throw new Error("Failed")
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin,
        staleTime: 30 * 1000,
    })

    const { data: playerDetail, refetch: refetchDetail } = useQuery({
        queryKey: ["admin-user-detail", selectedPlayer],
        queryFn: async () => {
            if (!selectedPlayer) return null
            const res = await fetch(`/api/admin/users/${selectedPlayer}`)
            if (!res.ok) throw new Error("Failed")
            return res.json() as Promise<PlayerDetail>
        },
        enabled: !!selectedPlayer,
        staleTime: 10 * 1000,
    })

    const players: Player[] = usersData?.players || []
    const pagination = usersData?.pagination || { total: 0, pages: 1 }
    const stats = usersData?.stats || { total: 0, banned: 0, suspended: 0, admins: 0 }
    const detail = playerDetail?.player

    useEffect(() => {
        if (playerDetail?.player && rolesModal.open) {
            setRolesModal(prev => ({ ...prev, selectedRoles: playerDetail.player.roles || [] }))
        }
    }, [playerDetail?.player, rolesModal.open])

    useEffect(() => {
        if (formSuccess) {
            const t = setTimeout(() => setFormSuccess(null), 3000)
            return () => clearTimeout(t)
        }
    }, [formSuccess])

    async function performAction(action: string, payload: any = {}) {
        if (!selectedPlayer) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/users/${selectedPlayer}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...payload }),
            })
            if (res.ok) {
                refetchList()
                refetchDetail()
                setActionModal({ type: null, reason: "", duration: "permanent" })
                setRolesModal({ open: false, selectedRoles: [] })
                setNoteText("")
                setFormSuccess(
                    action === "ban" ? "Usuario baneado" :
                    action === "unban" ? "Ban removido" :
                    action === "warn" ? "Advertencia aplicada" :
                    action === "unwarn" ? "Advertencias removidas" :
                    action === "silence" ? "Usuario silenciado" :
                    action === "unsilence" ? "Silencio removido" :
                    action === "banvote" ? "Voto prohibido" :
                    action === "unbanvote" ? "Puede votar" :
                    action === "add_note" ? "Nota agregada" :
                    "Roles actualizados"
                )
            } else {
                toast.error((await res.json()).error || "Error")
            }
        } catch { toast.error("Error") }
        finally { setSaving(false) }
    }

    function getDurationSeconds(d: string): number | null {
        const map: Record<string, number> = { "1h": 3600, "6h": 21600, "1d": 86400, "7d": 604800, "30d": 2592000 }
        return map[d] || null
    }

    function formatDate(d?: string): string {
        if (!d) return "-"
        return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    }

    const currentFilter = FILTERS.find(f => f.id === filter)

    if (!authData?.user?.isAdmin) return null

    return (
        <AdminLayout title="Usuarios">
            <div className="bg-card border border-foreground/[0.06] rounded-xl overflow-hidden shadow-lg animate-scale-fade">

                    <div className="flex flex-col lg:flex-row">
                        {/* LEFT SIDEBAR - Filters */}
                        <div className="lg:w-48 border-b lg:border-b-0 lg:border-r border-foreground/[0.06] bg-[var(--qc-bg-pure)]/50">
                                <div className="p-4">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                        Filtrar
                                    </h3>
                                    <div className="space-y-1">
                                        {FILTERS.map((f) => (
                                            <button
                                                key={f.id}
                                                onClick={() => { setFilter(f.id); setPage(1) }}
                                                className={`w-full text-left p-3 transition-all rounded-lg ${filter === f.id
                                                    ? "bg-foreground/10 border-l-2 border-foreground"
                                                    : "hover:bg-black/5 border-l-2 border-transparent"
                                                }`}
                                            >
                                                <div className={`text-sm font-bold ${filter === f.id ? "text-foreground" : "text-foreground/80"}`}>
                                                    {f.short}
                                                </div>
                                                <div className="text-[10px] text-foreground/40 mt-0.5">{f.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="p-4 border-t border-foreground/[0.06]">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                        Estadísticas
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-foreground/40 uppercase">Total</span>
                                            <span className="text-sm font-bold text-foreground">{stats.total.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-foreground/40 uppercase">Admins</span>
                                            <span className="text-sm font-bold text-foreground">{stats.admins}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-foreground/40 uppercase">Baneados</span>
                                            <span className="text-sm font-bold text-red-500">{stats.banned}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-foreground/40 uppercase">Suspendidos</span>
                                            <span className="text-sm font-bold text-yellow-600">{stats.suspended}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="p-4 border-t border-foreground/[0.06]">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                        Buscar
                                    </h3>
                                    <input
                                        type="text"
                                        placeholder="Usuario o Steam ID..."
                                        value={search}
                                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                                        className="w-full h-9 px-3 bg-foreground/[0.03] border border-foreground/[0.06] text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
                                    />
                                </div>
                            </div>

                            {/* MAIN CONTENT - Users Table */}
                            <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="grid grid-cols-[1fr_80px_80px] lg:grid-cols-[1fr_100px_80px_100px] gap-2 px-4 py-3 text-[10px] font-bold uppercase text-foreground/30 border-b border-foreground/[0.06] bg-foreground/[0.02]">
                                    <div>Usuario</div>
                                    <div className="text-center">Estado</div>
                                    <div className="hidden lg:block text-center">Roles</div>
                                    <div className="text-center">Registro</div>
                                </div>

                                {/* List */}
                                <div className="p-4">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                        </div>
                                    ) : players.length === 0 ? (
                                        <div className="py-16 text-center">
                                            <p className="text-foreground/30 text-xs">No se encontraron usuarios</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            {players.map((player) => (
                                                <button
                                                    key={player.id}
                                                    onClick={() => setSelectedPlayer(player.steamId)}
                                                    className={`w-full text-left grid grid-cols-[1fr_80px_80px] lg:grid-cols-[1fr_100px_80px_100px] gap-2 items-center px-3 py-2.5 transition-all border-b border-foreground/[0.06] rounded-lg group ${
                                                        selectedPlayer === player.steamId
                                                            ? "bg-foreground/10"
                                                            : "hover:bg-foreground/[0.03]"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <PlayerAvatar
                                                            steamId={player.steamId}
                                                            playerName={player.username}
                                                            avatarUrl={player.avatar}
                                                            size="sm"
                                                        />
                                                        <div className="min-w-0">
                                                            <span className={`text-xs truncate block ${
                                                                selectedPlayer === player.steamId ? "text-foreground font-bold" : "text-foreground/80 group-hover:text-foreground"
                                                            }`}>
                                                                {parseQuakeColors(player.username)}
                                                            </span>
                                                            <span className="text-[9px] text-foreground/30 block">{player.steamId}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        {player.isBanned ? (
                                                            <span className="px-2 py-0.5 text-[8px] font-bold uppercase bg-red-500/20 text-red-500 rounded">BAN</span>
                                                        ) : player.isSuspended ? (
                                                            <span className="px-2 py-0.5 text-[8px] font-bold uppercase bg-yellow-500/20 text-yellow-600 rounded">SUSP</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 text-[8px] font-bold uppercase bg-green-500/20 text-green-600 rounded">OK</span>
                                                        )}
                                                    </div>
                                                    <div className="hidden lg:block text-center">
                                                        {player.roles?.length > 0 ? (
                                                            <span className="text-[9px] text-foreground/50">{player.roles.length}</span>
                                                        ) : (
                                                            <span className="text-[9px] text-foreground/20">-</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-foreground/40 text-center">
                                                        {formatDate(player.createdAt).split(",")[0]}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {pagination.pages > 1 && (
                                        <div className="px-4 py-3 border-t border-foreground/[0.06] flex items-center justify-between">
                                            <span className="text-[10px] text-foreground/30">
                                                {pagination.total} usuarios · Pág {page}/{pagination.pages}
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page <= 1}
                                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-foreground/[0.04] hover:bg-foreground/[0.08] disabled:opacity-30 transition-all"
                                                >
                                                    Ant
                                                </button>
                                                <button
                                                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                                    disabled={page >= pagination.pages}
                                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-foreground/[0.04] hover:bg-foreground/[0.08] disabled:opacity-30 transition-all"
                                                >
                                                    Sig
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT SIDEBAR - User Detail */}
                            <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-foreground/[0.06] bg-foreground/[0.02]">
                                {!selectedPlayer ? (
                                    <div className="p-4 text-center py-16">
                                        <p className="text-xs text-foreground/30">Selecciona un usuario</p>
                                    </div>
                                ) : !detail ? (
                                    <div className="p-4 flex items-center justify-center py-16">
                                        <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        {/* User Info */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            {formSuccess && (
                                                <div className="mb-3 px-3 py-2 bg-green-500/10 border border-green-500/20 text-xs text-green-600 rounded">
                                                    {formSuccess}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mb-3">
                                                <PlayerAvatar
                                                    steamId={detail.steamId}
                                                    playerName={detail.username}
                                                    avatarUrl={detail.avatar}
                                                    size="lg"
                                                />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-foreground truncate">
                                                        {parseQuakeColors(detail.username)}
                                                    </div>
                                                    <div className="text-[9px] text-foreground/30">{detail.steamId}</div>
                                                    {detail.clan && (
                                                        <div className="text-[10px] text-foreground/50 mt-0.5">[{detail.clan.tag}] {detail.clan.name}</div>
                                                    )}
                                                </div>
                                            </div>
                                            {detail.roles?.length > 0 && (
                                                <UserRoleBadges roles={detail.roles as UserRole[]} />
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                                Stats
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="text-center p-2 bg-foreground/[0.02]">
                                                    <div className="text-sm font-bold text-foreground">{detail.matchCount}</div>
                                                    <div className="text-[8px] text-foreground/30 uppercase">Partidas</div>
                                                </div>
                                                {detail.ratings.slice(0, 3).map(r => (
                                                    <div key={r.gameType} className="text-center p-2 bg-foreground/[0.02]">
                                                        <div className="text-sm font-bold text-foreground">{r.rating}</div>
                                                        <div className="text-[8px] text-foreground/30 uppercase">{r.gameType}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Account Status */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                                Estado
                                            </h3>
                                            {detail.isBanned ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                                        <span className="text-xs font-bold text-red-500 uppercase">Baneado</span>
                                                    </div>
                                                    {detail.banReason && <p className="text-[10px] text-foreground/50">{detail.banReason}</p>}
                                                    <p className="text-[9px] text-foreground/30">Desde: {formatDate(detail.bannedAt)}</p>
                                                    {detail.banExpiresAt && <p className="text-[9px] text-foreground/30">Expira: {formatDate(detail.banExpiresAt)}</p>}
                                                    <button
                                                        onClick={() => performAction("unban")}
                                                        disabled={saving}
                                                        className="w-full p-2 text-[10px] font-bold uppercase bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-all disabled:opacity-50"
                                                    >
                                                        {saving ? "..." : "Desbanear"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                                        <span className="text-xs text-green-600">Puede conectarse</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Server Moderation */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                                Moderación
                                            </h3>

                                            {/* Current Status Indicators */}
                                            <div className="space-y-1 mb-3">
                                                {detail.warnStrikes > 0 && (
                                                    <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
                                                        <span className="text-[10px] text-yellow-600">Warns: {detail.warnStrikes}/3</span>
                                                        <button
                                                            onClick={() => performAction("unwarn")}
                                                            disabled={saving}
                                                            className="text-[9px] text-yellow-600/60 hover:text-yellow-600"
                                                        >
                                                            Limpiar
                                                        </button>
                                                    </div>
                                                )}
                                                {detail.isSuspended && (
                                                    <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded">
                                                        <span className="text-[10px] text-orange-400">Silenciado</span>
                                                        <button
                                                            onClick={() => performAction("unsilence")}
                                                            disabled={saving}
                                                            className="text-[9px] text-orange-400/60 hover:text-orange-400"
                                                        >
                                                            Levantar
                                                        </button>
                                                    </div>
                                                )}
                                                {detail.banvoted && (
                                                    <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded">
                                                        <span className="text-[10px] text-purple-400">No puede votar</span>
                                                        <button
                                                            onClick={() => performAction("unbanvote")}
                                                            disabled={saving}
                                                            className="text-[9px] text-purple-400/60 hover:text-purple-400"
                                                        >
                                                            Permitir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-2 gap-1">
                                                {!detail.isBanned && (
                                                    <button
                                                        onClick={() => setActionModal({ type: "ban", reason: "", duration: "permanent" })}
                                                        className="p-2 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                                                    >
                                                        Ban
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setActionModal({ type: "warn", reason: "", duration: "1d" })}
                                                    className="p-2 text-[10px] font-bold uppercase bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-all"
                                                >
                                                    Warn
                                                </button>
                                                <button
                                                    onClick={() => setActionModal({ type: "silence", reason: "", duration: "1h" })}
                                                    className="p-2 text-[10px] font-bold uppercase bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
                                                >
                                                    Silence
                                                </button>
                                                {!detail.banvoted && (
                                                    <button
                                                        onClick={() => setActionModal({ type: "banvote", reason: "", duration: "permanent" })}
                                                        className="p-2 text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                                                    >
                                                        Banvote
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Roles */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 font-tiktok">
                                                    Roles
                                                </h3>
                                                <button
                                                    onClick={() => setRolesModal({ open: true, selectedRoles: detail.roles || [] })}
                                                    className="text-[9px] text-[#333] hover:text-foreground transition-colors"
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                            {detail.roles?.length > 0 ? (
                                                <UserRoleBadges roles={detail.roles as UserRole[]} />
                                            ) : (
                                                <p className="text-[10px] text-foreground/30">Sin roles</p>
                                            )}
                                        </div>

                                        {/* Add Note */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                                Nota
                                            </h3>
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={noteText}
                                                    onChange={(e) => setNoteText(e.target.value)}
                                                    placeholder="Agregar nota..."
                                                    className="flex-1 h-8 px-2 bg-foreground/[0.03] border border-foreground/[0.06] text-[11px] text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
                                                />
                                                <button
                                                    onClick={() => { if (noteText.trim()) performAction("add_note", { reason: noteText }) }}
                                                    disabled={!noteText.trim() || saving}
                                                    className="px-3 h-8 text-[10px] font-bold bg-foreground text-white hover:brightness-110 transition-all disabled:opacity-50"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        {/* History */}
                                        <div className="p-4 border-b border-foreground/[0.06]">
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                                Historial
                                            </h3>
                                            {playerDetail?.history?.length > 0 ? (
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                    {playerDetail.history.slice(0, 10).map((action) => (
                                                        <div key={action.id} className="flex items-start gap-2 p-1.5 hover:bg-foreground/[0.02] rounded transition-colors">
                                                            <span className={`px-1 py-0.5 text-[7px] font-bold uppercase rounded shrink-0 ${
                                                                action.type === "ban" || action.type === "permaban" ? "bg-red-500/20 text-red-500" :
                                                                action.type === "unban" ? "bg-green-500/20 text-green-600" :
                                                                action.type === "warn" ? "bg-yellow-500/20 text-yellow-600" :
                                                                action.type === "unwarn" ? "bg-yellow-500/10 text-yellow-300" :
                                                                action.type === "silence" ? "bg-orange-500/20 text-orange-400" :
                                                                action.type === "unsilence" ? "bg-orange-500/10 text-orange-300" :
                                                                action.type === "banvote" ? "bg-purple-500/20 text-purple-400" :
                                                                action.type === "unbanvote" ? "bg-purple-500/10 text-purple-300" :
                                                                action.type === "note" ? "bg-blue-500/20 text-blue-600" :
                                                                action.type === "role_change" ? "bg-cyan-500/20 text-cyan-400" :
                                                                "bg-black/10 text-foreground/50"
                                                            }`}>
                                                                {action.type}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                {action.reason && <p className="text-[9px] text-foreground/50 truncate">{action.reason}</p>}
                                                                <p className="text-[8px] text-black/25">{action.actorName && `${action.actorName} · `}{formatDate(action.createdAt)}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-foreground/30 text-center py-2">Sin historial</p>
                                            )}
                                        </div>

                                        {/* Links */}
                                        <div className="p-4">
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/perfil/${detail.steamId}`}
                                                    target="_blank"
                                                    className="flex-1 p-2 text-[9px] font-bold uppercase text-center bg-foreground/[0.02] text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-all"
                                                >
                                                    Ver Perfil
                                                </Link>
                                                {detail.clan && (
                                                    <Link
                                                        href={`/clanes/${detail.clan.slug}`}
                                                        target="_blank"
                                                        className="flex-1 p-2 text-[9px] font-bold uppercase text-center bg-foreground/[0.02] text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-all"
                                                    >
                                                        Ver Clan
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                    </div>
                </div>

            {/* Modal Actions */}
            {actionModal.type && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setActionModal({ type: null, reason: "", duration: "permanent" })} />
                    <div className="relative bg-card border border-foreground/[0.06] w-full max-w-md mx-4 shadow-2xl animate-scale-fade">
                        <div className="px-5 py-4 border-b border-foreground/[0.06]">
                            <h2 className={`text-sm font-bold font-tiktok uppercase tracking-wider ${
                                actionModal.type === "ban" ? "text-red-500" :
                                actionModal.type === "warn" ? "text-yellow-600" :
                                actionModal.type === "silence" ? "text-orange-400" :
                                "text-purple-400"
                            }`}>
                                {actionModal.type === "ban" ? "Banear Usuario" :
                                 actionModal.type === "warn" ? "Advertir Usuario" :
                                 actionModal.type === "silence" ? "Silenciar Usuario" :
                                 "Prohibir Votos"}
                            </h2>
                            <p className="text-[10px] text-foreground/30 mt-1">
                                {actionModal.type === "ban" ? "No puede conectarse a los servidores" :
                                 actionModal.type === "warn" ? "3 strikes = ban automático" :
                                 actionModal.type === "silence" ? "No puede usar el chat" :
                                 "No puede llamar votaciones"}
                            </p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-2">Razón</label>
                                <textarea
                                    value={actionModal.reason}
                                    onChange={(e) => setActionModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Describe la razón..."
                                    className="w-full h-20 px-3 py-2 bg-foreground/[0.03] border border-foreground/[0.06] text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30 resize-none"
                                />
                            </div>
                            {actionModal.type !== "banvote" && (
                                <div>
                                    <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-2">Duración</label>
                                    <div className="flex gap-1">
                                        {(actionModal.type === "ban" ? ["permanent", "1h", "6h", "1d", "7d", "30d"] :
                                          actionModal.type === "warn" ? ["1d", "7d", "30d"] :
                                          ["1h", "6h", "1d", "7d"]).map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setActionModal(prev => ({ ...prev, duration: d }))}
                                                className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all ${
                                                    actionModal.duration === d
                                                        ? "bg-foreground text-white"
                                                        : "text-foreground/30 hover:text-foreground/50 bg-foreground/[0.02] border border-foreground/[0.04]"
                                                }`}
                                            >
                                                {d === "permanent" ? "PERM" : d.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-foreground/[0.06] flex justify-end gap-2">
                            <button
                                onClick={() => setActionModal({ type: null, reason: "", duration: "permanent" })}
                                className="px-4 py-2 text-[10px] font-bold text-foreground/50 hover:text-foreground uppercase tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => performAction(actionModal.type!, { reason: actionModal.reason, duration: getDurationSeconds(actionModal.duration) })}
                                disabled={!actionModal.reason.trim() || saving}
                                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 ${
                                    actionModal.type === "ban" ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" :
                                    actionModal.type === "warn" ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30" :
                                    actionModal.type === "silence" ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30" :
                                    "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                }`}
                            >
                                {saving ? "..." : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Roles */}
            {rolesModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setRolesModal({ open: false, selectedRoles: [] })} />
                    <div className="relative bg-card border border-foreground/[0.06] w-full max-w-sm mx-4 shadow-2xl animate-scale-fade">
                        <div className="px-5 py-4 border-b border-foreground/[0.06]">
                            <h2 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">Editar Roles</h2>
                        </div>
                        <div className="p-4 space-y-1">
                            {AVAILABLE_ROLES.map((role) => {
                                const cfg = ROLE_CONFIG[role]
                                const isSelected = rolesModal.selectedRoles.includes(role)
                                return (
                                    <button
                                        key={role}
                                        onClick={() => setRolesModal(prev => ({
                                            ...prev,
                                            selectedRoles: isSelected ? prev.selectedRoles.filter(r => r !== role) : [...prev.selectedRoles, role]
                                        }))}
                                        className={`w-full text-left p-3 transition-all ${
                                            isSelected
                                                ? "bg-foreground/10 border-l-2 border-foreground"
                                                : "hover:bg-black/5 border-l-2 border-transparent"
                                        }`}
                                    >
                                        <span className="text-sm font-bold" style={{ color: isSelected ? cfg.color : 'rgba(255,255,255,0.5)' }}>
                                            {cfg.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="px-5 py-4 border-t border-foreground/[0.06] flex justify-end gap-2">
                            <button
                                onClick={() => setRolesModal({ open: false, selectedRoles: [] })}
                                className="px-4 py-2 text-[10px] font-bold text-foreground/50 hover:text-foreground uppercase tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => performAction("update_roles", { roles: rolesModal.selectedRoles })}
                                disabled={saving}
                                className="px-4 py-2 text-[10px] font-bold bg-foreground text-white uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
                            >
                                {saving ? "..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
