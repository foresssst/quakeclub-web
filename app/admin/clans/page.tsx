"use client"
import { toast } from "sonner"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import Image from "next/image"
import { ConfirmDialog } from "@/components/confirm-dialog-new"
import { AdminLayout } from "@/components/admin-layout"

interface Clan {
    id: string
    name: string
    tag: string
    slug: string
    inGameTag?: string
    avatarUrl?: string
    memberCount: number
    elo: number
    createdAt: string
}

interface Player {
    id: string
    steamId: string
    username: string
    avatar?: string
}

const inputCls = "w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"

export default function ClansAdminPage() {
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; clanId: string; clanTag: string; clanName: string }>({
        open: false,
        clanId: "",
        clanTag: "",
        clanName: "",
    })
    const [createDialog, setCreateDialog] = useState(false)
    const [createData, setCreateData] = useState({
        name: "",
        tag: "",
        description: "",
        founderSteamId: "",
    })
    const [createLoading, setCreateLoading] = useState(false)
    const [createError, setCreateError] = useState("")
    const [playerSearch, setPlayerSearch] = useState("")
    const [search, setSearch] = useState("")

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
                router.push("/")
                throw new Error("Not admin")
            }
            return data
        },
        staleTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: clansData, isLoading: loading } = useQuery({
        queryKey: ["admin", "clans"],
        queryFn: async () => {
            const res = await fetch("/api/admin/clans")
            if (!res.ok) throw new Error("Failed to fetch clans")
            const data = await res.json()
            return data.clans || []
        },
        enabled: !!authData?.user?.isAdmin,
        staleTime: 3 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: playersData } = useQuery({
        queryKey: ["admin", "players", "available"],
        queryFn: async () => {
            const res = await fetch("/api/admin/players/available")
            if (!res.ok) throw new Error("Failed to fetch available players")
            const data = await res.json()
            return data.players || []
        },
        enabled: !!authData?.user?.isAdmin && createDialog,
        staleTime: 1 * 60 * 1000,
    })

    const user = authData?.user
    const allClans: Clan[] = clansData || []
    const availablePlayers: Player[] = playersData || []

    const clans = search
        ? allClans.filter((c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.tag.toLowerCase().includes(search.toLowerCase())
        )
        : allClans

    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return availablePlayers
        const searchLower = playerSearch.toLowerCase()
        return availablePlayers.filter(
            (player) =>
                player.username.toLowerCase().includes(searchLower) ||
                player.steamId.includes(searchLower)
        )
    }, [availablePlayers, playerSearch])

    async function handleDelete(id: string, tag: string, name: string) {
        setDeleteDialog({ open: true, clanId: id, clanTag: tag, clanName: name })
    }

    async function confirmDelete() {
        const { clanId, clanTag, clanName } = deleteDialog
        setDeleteDialog({ open: false, clanId: "", clanTag: "", clanName: "" })

        try {
            const res = await fetch(`/api/admin/clans/${clanId}/delete`, { method: "DELETE" })
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["admin", "clans"] })
                queryClient.invalidateQueries({ queryKey: ["admin", "players", "available"] })
            } else {
                const data = await res.json()
                toast.error(data.error || "Error al eliminar el clan")
            }
        } catch (error) {
            console.error("Error deleting clan:", error)
            toast.error("Error al eliminar el clan")
        }
    }

    async function handleCreateClan() {
        setCreateError("")
        setCreateLoading(true)

        try {
            const res = await fetch("/api/admin/clans/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createData),
            })

            const data = await res.json()

            if (!res.ok) {
                setCreateError(data.error || "Error al crear el clan")
                setCreateLoading(false)
                return
            }

            setCreateDialog(false)
            setCreateData({ name: "", tag: "", description: "", founderSteamId: "" })
            setPlayerSearch("")
            queryClient.invalidateQueries({ queryKey: ["admin", "clans"] })
            queryClient.invalidateQueries({ queryKey: ["admin", "players", "available"] })
        } catch (error) {
            console.error("Error:", error)
            setCreateError("Error al crear el clan")
        } finally {
            setCreateLoading(false)
        }
    }

    if (!user?.isAdmin) {
        return null
    }

    const totalMembers = allClans.reduce((acc, clan) => acc + clan.memberCount, 0)
    const avgElo = allClans.length > 0 ? Math.round(allClans.reduce((acc, clan) => acc + clan.elo, 0) / allClans.length) : 0

    return (
        <AdminLayout title="Clanes" subtitle="Gestiona los clanes registrados">
            {/* Header Action */}
            <div className="flex justify-end mb-6">
                <button
                    onClick={() => setCreateDialog(true)}
                    className="bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg"
                >
                    Crear Clan
                </button>
            </div>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{allClans.length}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Total Clanes</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{totalMembers}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Total Miembros</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground/50 font-tiktok">{avgElo}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">ELO Promedio</div>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o tag..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                </div>
                            ) : clans.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-sm text-foreground/30">
                                        {search ? "No se encontraron clanes" : "No hay clanes registrados"}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {clans.map((clan) => (
                                        <div
                                            key={clan.id}
                                            className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {clan.avatarUrl ? (
                                                    <Image
                                                        src={clan.avatarUrl}
                                                        alt={clan.name}
                                                        width={36}
                                                        height={36}
                                                        className="rounded-lg border border-foreground/10"
                                                    />
                                                ) : (
                                                    <div className="w-9 h-9 bg-foreground/10 border border-foreground/20 flex items-center justify-center rounded-lg flex-shrink-0">
                                                        <span className="text-foreground font-bold text-xs font-tiktok">
                                                            {clan.tag.substring(0, 2).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-medium text-foreground truncate">{clan.name}</h3>
                                                        <span className="text-[10px] text-foreground font-bold">[{clan.tag}]</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-foreground/30 mt-0.5">
                                                        <span>{clan.memberCount} miembros</span>
                                                        <span className="text-foreground/10">·</span>
                                                        <span className="text-foreground">{clan.elo} ELO</span>
                                                        {clan.inGameTag && (
                                                            <>
                                                                <span className="text-foreground/10">·</span>
                                                                <span className="font-mono">{clan.inGameTag}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                                <Link
                                                    href={`/admin/clans/${clan.id}/edit`}
                                                    className="bg-foreground/10 border border-foreground/20 px-2.5 py-1.5 text-[10px] font-medium text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded"
                                                >
                                                    Editar
                                                </Link>
                                                <Link
                                                    href={`/clanes/${clan.slug}`}
                                                    target="_blank"
                                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                                >
                                                    Ver
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(clan.id, clan.tag, clan.name)}
                                                    className="bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 text-[10px] font-medium text-red-500 transition-all hover:bg-red-500/20 uppercase tracking-wider rounded"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
                title="Eliminar Clan"
                description={`¿Estás seguro de que quieres eliminar el clan "${deleteDialog.clanName}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />

            {/* Create Clan Modal */}
            {createDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCreateDialog(false); setCreateError(""); setCreateData({ name: "", tag: "", description: "", founderSteamId: "" }); setPlayerSearch(""); }} />
                    <div className="relative bg-card border border-foreground/[0.08] rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fade-up">
                        <div className="px-6 py-4 border-b border-foreground/[0.06]">
                            <h2 className="text-lg font-bold text-foreground font-tiktok uppercase tracking-wider">Crear Nuevo Clan</h2>
                            <p className="text-xs text-foreground/40 mt-1">Completa la información del clan</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-1.5">Nombre del Clan</label>
                                <input
                                    type="text"
                                    value={createData.name}
                                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                                    placeholder="Nombre del clan"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-1.5">Tag (2-6 caracteres)</label>
                                <input
                                    type="text"
                                    value={createData.tag}
                                    onChange={(e) => setCreateData({ ...createData, tag: e.target.value.toUpperCase() })}
                                    placeholder="TAG"
                                    maxLength={6}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-1.5">Descripción (Opcional)</label>
                                <textarea
                                    value={createData.description}
                                    onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                                    placeholder="Descripción del clan"
                                    rows={3}
                                    className={`${inputCls} resize-none`}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-foreground/30 uppercase tracking-wider block mb-1.5">Fundador del Clan</label>
                                <input
                                    type="text"
                                    placeholder="Buscar jugador..."
                                    value={playerSearch}
                                    onChange={(e) => setPlayerSearch(e.target.value)}
                                    className={inputCls}
                                />
                                {playerSearch && filteredPlayers.length > 0 && (
                                    <div className="mt-2 max-h-40 overflow-y-auto bg-[var(--qc-bg-pure)] border border-foreground/[0.06] rounded-lg">
                                        {filteredPlayers.slice(0, 10).map((player) => (
                                            <button
                                                key={player.steamId}
                                                type="button"
                                                onClick={() => { setCreateData({ ...createData, founderSteamId: player.steamId }); setPlayerSearch(player.username); }}
                                                className={`w-full text-left px-3 py-2 text-sm transition-all hover:bg-foreground/[0.04] ${createData.founderSteamId === player.steamId ? "bg-foreground/10 text-foreground" : "text-foreground/60"}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {player.avatar && (
                                                        <Image src={player.avatar} alt={player.username} width={20} height={20} className="rounded object-cover" />
                                                    )}
                                                    <span>{player.username}</span>
                                                    <span className="text-[10px] text-foreground/30">{player.steamId}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <p className="mt-1 text-[10px] text-foreground/30">Solo jugadores sin clan</p>
                            </div>

                            {createError && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500">
                                    {createError}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-foreground/[0.06] flex justify-end gap-3">
                            <button
                                onClick={() => { setCreateDialog(false); setCreateError(""); setCreateData({ name: "", tag: "", description: "", founderSteamId: "" }); setPlayerSearch(""); }}
                                className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateClan}
                                disabled={createLoading || !createData.name || !createData.tag || !createData.founderSteamId}
                                className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                            >
                                {createLoading ? "Creando..." : "Crear Clan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
