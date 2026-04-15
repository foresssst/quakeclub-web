"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ConfirmDialog } from "@/components/confirm-dialog-new"
import { AdminLayout } from "@/components/admin-layout"

interface Stats {
    totalUsers: number
    totalClans: number
    totalNews: number
    totalMatches: number
}

export default function AdminPage() {
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; newsId: string; title: string }>({
        open: false,
        newsId: "",
        title: "",
    })
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

    const { data: statsData } = useQuery({
        queryKey: ["admin", "stats"],
        queryFn: async () => {
            const res = await fetch("/api/admin/stats")
            if (!res.ok) throw new Error("Failed to fetch stats")
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin,
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: newsData, isLoading: newsLoading } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => {
            const res = await fetch("/api/news/list")
            if (!res.ok) throw new Error("Failed to fetch news")
            const data = await res.json()
            return data.news || []
        },
        enabled: !!authData?.user?.isAdmin,
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: requestsData } = useQuery({
        queryKey: ["admin", "join-requests"],
        queryFn: async () => {
            const res = await fetch("/api/admin/join-requests")
            if (!res.ok) throw new Error("Failed to fetch join requests")
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin,
        refetchInterval: 10000,
        staleTime: 5 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const user = authData?.user
    const stats = statsData || { totalUsers: 0, totalClans: 0, totalNews: 0, totalMatches: 0 }
    const news = newsData || []
    const pendingRequests = requestsData?.total || 0

    async function handleDelete(id: string) {
        const newsItem = news.find((item: any) => item.id === id)
        setDeleteDialog({ open: true, newsId: id, title: newsItem?.title || "esta noticia" })
    }

    async function confirmDelete() {
        const { newsId } = deleteDialog
        setDeleteDialog({ open: false, newsId: "", title: "" })

        try {
            const res = await fetch(`/api/news/${newsId}`, { method: "DELETE" })
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["news", "list"] })
                queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
            } else {
                toast.error("Error al eliminar la noticia")
            }
        } catch (error) {
            console.error("Error deleting news:", error)
            toast.error("Error al eliminar la noticia")
        }
    }

    if (!user?.isAdmin) return null

    return (
        <AdminLayout title="Dashboard" subtitle="Resumen general del sistema">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-wider mt-1">Usuarios</div>
                </div>
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{stats.totalClans}</div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-wider mt-1">Clanes</div>
                </div>
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{stats.totalNews}</div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-wider mt-1">Noticias</div>
                </div>
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{stats.totalMatches.toLocaleString()}</div>
                    <div className="text-[9px] text-foreground/30 uppercase tracking-wider mt-1">Partidas</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mb-6">
                <Link
                    href="/admin/news/create"
                    className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 hover:border-foreground/30 hover:bg-foreground/[0.03] transition-all group"
                >
                    <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-foreground transition-colors uppercase tracking-wider">
                        Crear Noticia
                    </h3>
                    <p className="text-[10px] text-foreground/30">Publica una nueva noticia en el sitio</p>
                </Link>

                <Link
                    href="/admin/solicitudes"
                    className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 hover:border-foreground/30 hover:bg-foreground/[0.03] transition-all group"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-foreground transition-colors uppercase tracking-wider">
                                Solicitudes Pendientes
                            </h3>
                            <p className="text-[10px] text-foreground/30">Gestiona las solicitudes de clanes</p>
                        </div>
                        {pendingRequests > 0 && (
                            <span className="flex-shrink-0 ml-3 inline-flex items-center justify-center w-6 h-6 bg-foreground text-background text-[10px] font-bold rounded-full">
                                {pendingRequests}
                            </span>
                        )}
                    </div>
                </Link>

                <Link
                    href="/admin/zmq"
                    className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4 hover:border-foreground/30 hover:bg-foreground/[0.03] transition-all group"
                >
                    <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-foreground transition-colors uppercase tracking-wider">
                        ZMQ Receiver
                    </h3>
                    <p className="text-[10px] text-foreground/30">Administra la lista de servidores que alimentan el web receiver</p>
                </Link>
            </div>

            {/* News Section */}
            <div className="border-t border-foreground/[0.06] pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                        Noticias Recientes
                    </h2>
                    <Link
                        href="/admin/news/create"
                        className="bg-foreground/10 border border-foreground/20 px-3 py-1.5 text-[9px] font-bold text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded"
                    >
                        Nueva
                    </Link>
                </div>

                {newsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-12 text-foreground/20 text-xs">
                        No hay noticias publicadas
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {news.slice(0, 5).map((item: any) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all"
                            >
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                                    <div className="flex items-center gap-2 text-[9px] text-foreground/30 mt-0.5">
                                        <span>{new Date(item.date).toLocaleDateString("es-CL")}</span>
                                        <span className="text-foreground/10">·</span>
                                        <span>{item.author}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-4 shrink-0">
                                    <Link
                                        href={`/admin/news/edit/${item.id}`}
                                        className="bg-foreground/[0.04] border border-foreground/[0.06] px-2 py-1 text-[9px] font-bold text-foreground/50 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                    >
                                        Editar
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="bg-red-500/10 border border-red-500/20 px-2 py-1 text-[9px] font-bold text-red-500 transition-all hover:bg-red-500/20 uppercase tracking-wider rounded"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {news.length > 5 && (
                    <div className="mt-4 text-center">
                        <Link
                            href="/admin/news"
                            className="text-[10px] font-medium text-foreground/50 transition-colors hover:text-foreground uppercase tracking-wider"
                        >
                            Ver todas las noticias
                        </Link>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
                title="Eliminar Noticia"
                description={`Estas seguro de que quieres eliminar "${deleteDialog.title}"? Esta accion no se puede deshacer.`}
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </AdminLayout>
    )
}
