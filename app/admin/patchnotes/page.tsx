"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ConfirmDialog } from "@/components/confirm-dialog-new"
import { AdminLayout } from "@/components/admin-layout"

export default function PatchNotesAdminPage() {
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; title: string }>({
        open: false, id: "", title: "",
    })
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) { router.push("/login?returnTo=/admin/patchnotes"); throw new Error("Not authenticated") }
            const data = await res.json()
            if (!data.user.isAdmin) { router.push("/"); throw new Error("Not admin") }
            return data
        },
        staleTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const { data: notesData, isLoading } = useQuery({
        queryKey: ["patchnotes", "admin"],
        queryFn: async () => {
            const res = await fetch("/api/patchnotes/list")
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            return data.notes || []
        },
        enabled: !!authData?.user?.isAdmin,
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })

    const notes = notesData || []

    async function confirmDelete() {
        const { id } = deleteDialog
        setDeleteDialog({ open: false, id: "", title: "" })
        try {
            const res = await fetch(`/api/patchnotes/${id}`, { method: "DELETE" })
            if (res.ok) queryClient.invalidateQueries({ queryKey: ["patchnotes"] })
            else toast.error("Error al eliminar")
        } catch { toast.error("Error al eliminar") }
    }

    if (!authData?.user?.isAdmin) return null

    return (
        <AdminLayout title="Patch Notes" subtitle="Gestiona el changelog del sitio">
            <div className="flex justify-end mb-6">
                <Link
                    href="/admin/patchnotes/create"
                    className="bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg"
                >
                    Nuevo Patch Note
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground font-tiktok">{notes.length}</div>
                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Total Patch Notes</div>
                </div>
                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                    <div className="text-2xl font-bold text-foreground font-tiktok">
                        {notes.length > 0 ? `v${notes[0]?.version}` : "-"}
                    </div>
                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Ultima Version</div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                </div>
            ) : notes.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-sm text-foreground/30 mb-4">No hay patch notes</p>
                    <Link
                        href="/admin/patchnotes/create"
                        className="inline-block bg-foreground/10 border border-foreground/20 px-4 py-2 text-xs font-medium text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded-lg"
                    >
                        Crear Primer Patch Note
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {notes.map((item: any) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-foreground/50 bg-foreground/[0.04] px-1.5 py-0.5 rounded">
                                        v{item.version}
                                    </span>
                                    <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                                </div>
                                <div className="text-[10px] text-foreground/30 mt-0.5">
                                    {new Date(item.date).toLocaleDateString("es-CL")}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                <Link
                                    href={`/admin/patchnotes/edit/${item.id}`}
                                    className="bg-foreground/[0.04] border border-foreground/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] hover:text-foreground uppercase tracking-wider rounded"
                                >
                                    Editar
                                </Link>
                                <button
                                    onClick={() => setDeleteDialog({ open: true, id: item.id, title: item.title })}
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
                title="Eliminar Patch Note"
                description={`Eliminar "${deleteDialog.title}"? Esta accion no se puede deshacer.`}
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </AdminLayout>
    )
}
