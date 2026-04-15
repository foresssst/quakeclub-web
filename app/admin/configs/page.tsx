"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"

export default function AdminConfigsPage() {
    const router = useRouter()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/configs")
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

    const currentUser = authData?.user

    if (!currentUser?.isAdmin) {
        return null
    }

    return (
        <AdminLayout title="Configs" subtitle="Gestiona las configuraciones de los usuarios">
            {/* Cards */}
                            <div className="grid gap-4 sm:grid-cols-2 mb-6">
                                <Link
                                    href="/configs"
                                    className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-5 hover:border-foreground/30 transition-all group"
                                >
                                    <h2 className="text-sm font-bold text-foreground mb-1 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                        Configuraciones
                                    </h2>
                                    <p className="text-xs text-foreground/40 mb-3">Ver y gestionar las configuraciones subidas por usuarios</p>
                                    <span className="text-[10px] font-medium text-[#333] group-hover:text-foreground uppercase tracking-wider">
                                        Ver Configs →
                                    </span>
                                </Link>

                            </div>

                            {/* Info */}
                            <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-5">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                                    Nota
                                </h3>
                                <p className="text-sm text-foreground/50 leading-relaxed">
                                    La gestión de configuraciones se realiza desde la página pública. Los usuarios pueden subir, editar y eliminar sus propias configs.
                                    La moderación de contenido reportado se gestiona desde la sección de usuarios.
                                </p>
                            </div>
        </AdminLayout>
    )
}
