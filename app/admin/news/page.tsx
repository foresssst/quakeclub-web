"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ConfirmDialog } from "@/components/confirm-dialog-new"
import { AdminLayout } from "@/components/admin-layout"

export default function NewsAdminPage() {
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; newsId: string; title: string }>({
        open: false,
        newsId: "",
        title: "",
    })
    const [search, setSearch] = useState("")
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/news")
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

    const { data: newsData, isLoading: loading } = useQuery({
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

    const currentUser = authData?.user
    const allNews = newsData || []
    const news = search
        ? allNews.filter((n: any) =>
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.author.toLowerCase().includes(search.toLowerCase())
        )
        : allNews

    const thisWeekCount = allNews.filter((n: any) => {
        const date = new Date(n.date)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays <= 7
    }).length

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
            } else {
                toast.error("Error al eliminar la noticia")
            }
        } catch (error) {
            console.error("Error deleting news:", error)
            toast.error("Error al eliminar la noticia")
        }
    }

    if (!currentUser?.isAdmin) {
        return null
    }

    return (
        <AdminLayout title="Noticias" subtitle="Gestiona las noticias del sitio">
            {/* Header Action */}
            <div className="flex justify-end mb-6">
                <Link
                    href="/admin/news/create"
                    className="bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg"
                >
                    Nueva Noticia
                </Link>
            </div>
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{allNews.length}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Total Noticias</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{thisWeekCount}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Esta Semana</div>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Buscar por título o autor..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"
                                />
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                </div>
                            ) : news.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-sm text-foreground/30 mb-4">
                                        {search ? "No se encontraron noticias" : "No hay noticias publicadas"}
                                    </p>
                                    {!search && (
                                        <Link
                                            href="/admin/news/create"
                                            className="inline-block bg-foreground/10 border border-foreground/20 px-4 py-2 text-xs font-medium text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded-lg"
                                        >
                                            Crear Primera Noticia
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {news.map((item: any) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                                                <div className="flex items-center gap-2 text-[10px] text-foreground/30 mt-0.5">
                                                    <span>{new Date(item.date).toLocaleDateString("es-CL")}</span>
                                                    <span className="text-foreground/10">·</span>
                                                    <span>por {item.author}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                                <Link
                                                    href={`/admin/news/edit/${item.id}`}
                                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                                >
                                                    Editar
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
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
                title="Eliminar Noticia"
                description={`¿Estás seguro de que quieres eliminar "${deleteDialog.title}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </AdminLayout>
    )
}
