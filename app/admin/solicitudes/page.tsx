"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"

interface JoinRequest {
    id: string
    status: string
    createdAt: string
    Clan: {
        id: string
        name: string
        tag: string
        slug: string
        avatarUrl?: string
        memberCount: number
    }
    Player: {
        id: string
        steamId: string
        username: string
        avatar?: string
        countryCode?: string
    }
}

export default function SolicitudesPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [responding, setResponding] = useState<string | null>(null)

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/solicitudes")
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

    const { data: requestsData, isLoading } = useQuery({
        queryKey: ["admin", "join-requests"],
        queryFn: async () => {
            const res = await fetch("/api/admin/join-requests")
            if (!res.ok) throw new Error("Failed to fetch join requests")
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin,
        refetchInterval: 10000,
    })

    async function handleRespond(requestId: string, action: "accept" | "reject") {
        setResponding(requestId)
        try {
            const res = await fetch(`/api/admin/join-requests/${requestId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.error || "Error al responder")
                return
            }

            queryClient.invalidateQueries({ queryKey: ["admin", "join-requests"] })
            queryClient.invalidateQueries({ queryKey: ["admin", "activity"] })
        } catch (error) {
            console.error("Error:", error)
            toast.error("Error al procesar la solicitud")
        } finally {
            setResponding(null)
        }
    }

    const requests: JoinRequest[] = requestsData?.requests || []

    if (!authData?.user?.isAdmin) {
        return null
    }

    return (
        <AdminLayout title="Solicitudes" subtitle={`${requests.length} solicitudes pendientes`}>
            {/* Auto-refresh indicator */}
            <div className="flex justify-end mb-4">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-foreground/30 uppercase tracking-wider">Auto-refresh</span>
                </div>
            </div>

            {isLoading && (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                </div>
                            )}

                            {!isLoading && requests.length === 0 && (
                                <div className="text-center py-16">
                                    <p className="text-sm text-foreground/30 mb-2">No hay solicitudes pendientes</p>
                                    <p className="text-xs text-foreground/20">Las nuevas solicitudes aparecerán aquí automáticamente</p>
                                </div>
                            )}

                            {!isLoading && requests.length > 0 && (
                                <div className="space-y-3">
                                    {requests.map((request) => (
                                        <div
                                            key={request.id}
                                            className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 hover:border-foreground/20 transition-all"
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Player Avatar */}
                                                <div className="flex-shrink-0">
                                                    {request.Player.avatar ? (
                                                        <Image
                                                            src={request.Player.avatar}
                                                            alt={request.Player.username}
                                                            width={48}
                                                            height={48}
                                                            className="rounded-lg"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-black/5 rounded-lg flex items-center justify-center">
                                                            <span className="text-foreground/20 text-lg">?</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Request Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-sm font-bold text-foreground">
                                                            {request.Player.username}
                                                        </h3>
                                                        {request.Player.countryCode && (
                                                            <span className="text-[10px] text-foreground/40">{request.Player.countryCode}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-foreground/50 mb-2">
                                                        Solicita unirse a{" "}
                                                        <Link
                                                            href={`/clanes/${request.Clan.slug}`}
                                                            className="text-foreground hover:underline font-medium"
                                                        >
                                                            [{request.Clan.tag}] {request.Clan.name}
                                                        </Link>
                                                    </p>
                                                    <div className="flex items-center gap-3 text-[10px] text-foreground/30">
                                                        <span>{request.Player.steamId}</span>
                                                        <span className="text-foreground/10">·</span>
                                                        <span>{request.Clan.memberCount} miembros</span>
                                                        <span className="text-foreground/10">·</span>
                                                        <span>
                                                            {new Date(request.createdAt).toLocaleDateString("es-CL", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Clan Avatar */}
                                                <div className="flex-shrink-0">
                                                    {request.Clan.avatarUrl ? (
                                                        <Image
                                                            src={request.Clan.avatarUrl}
                                                            alt={request.Clan.name}
                                                            width={48}
                                                            height={48}
                                                            className="rounded-lg"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-foreground/10 rounded-lg flex items-center justify-center">
                                                            <span className="text-foreground font-bold text-xs">{request.Clan.tag}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 mt-4 pt-3 border-t border-foreground/[0.04]">
                                                <button
                                                    onClick={() => handleRespond(request.id, "accept")}
                                                    disabled={responding === request.id}
                                                    className="bg-foreground/10 border border-foreground/20 px-3 py-1.5 text-[10px] font-medium text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded disabled:opacity-50"
                                                >
                                                    {responding === request.id ? "..." : "Aceptar"}
                                                </button>
                                                <button
                                                    onClick={() => handleRespond(request.id, "reject")}
                                                    disabled={responding === request.id}
                                                    className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-500 transition-all hover:bg-red-500/20 uppercase tracking-wider rounded disabled:opacity-50"
                                                >
                                                    Rechazar
                                                </button>
                                                <Link
                                                    href={`/clanes/${request.Clan.slug}`}
                                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-3 py-1.5 text-[10px] font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                                >
                                                    Ver Clan
                                                </Link>
                                                <Link
                                                    href={`/perfil/${request.Player.steamId}`}
                                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-3 py-1.5 text-[10px] font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                                >
                                                    Ver Jugador
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
        </AdminLayout>
    )
}
