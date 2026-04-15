"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function AdminEsportPage() {
    const router = useRouter()

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login?returnTo=/admin/esport")
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
    })

    const { data: tournaments, isLoading } = useQuery({
        queryKey: ['admin-tournaments'],
        queryFn: async () => {
            const res = await fetch('/api/esport/tournaments')
            if (!res.ok) throw new Error('Error')
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin
    })

    const user = authData?.user

    if (!user?.isAdmin) return null

    const all = [...(tournaments?.upcoming || []), ...(tournaments?.active || []), ...(tournaments?.completed || [])]

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'IN_PROGRESS': 'En Curso',
            'REGISTRATION_OPEN': 'Inscripciones',
            'REGISTRATION_CLOSED': 'Cerrado',
            'UPCOMING': 'Próximo',
            'COMPLETED': 'Finalizado',
            'CANCELLED': 'Cancelado'
        }
        return labels[status] || status
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return 'bg-foreground/10 text-foreground'
            case 'REGISTRATION_OPEN': return 'bg-black/10 text-foreground/60'
            case 'UPCOMING': return 'bg-foreground/[0.06] text-foreground/40'
            case 'COMPLETED': return 'bg-black/5 text-foreground/40'
            default: return 'bg-black/5 text-foreground/50'
        }
    }

    const getFormatLabel = (tournament: any) => {
        if (tournament.tournamentType === 'CUSTOM_GROUP') return 'Grupos'
        if (tournament.format === 'DOUBLE_ELIMINATION') return 'Double'
        if (tournament.format === 'SINGLE_ELIMINATION') return 'Single'
        return 'Estándar'
    }

    const activeCount = (tournaments?.active || []).length
    const upcomingCount = (tournaments?.upcoming || []).length
    const completedCount = (tournaments?.completed || []).length

    return (
        <AdminLayout title="Torneos E-Sports" subtitle="Gestionar torneos y competencias">
            {/* Header Action */}
            <div className="flex justify-end mb-6">
                <Link
                    href="/admin/esport/crear"
                    className="bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg"
                >
                    Crear Torneo
                </Link>
            </div>

            {/* Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{all.length}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Total Torneos</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground font-tiktok">{activeCount}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">En Curso</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-blue-600 font-tiktok">{upcomingCount}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Próximos</div>
                                </div>
                                <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
                                    <div className="text-2xl font-bold text-foreground/40 font-tiktok">{completedCount}</div>
                                    <div className="text-[10px] text-foreground/30 uppercase tracking-wider mt-1">Finalizados</div>
                                </div>
                            </div>

                            {/* Tournament List */}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                                </div>
                            ) : all.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-sm text-foreground/30 mb-2">No hay torneos creados</p>
                                    <Link
                                        href="/admin/esport/crear"
                                        className="text-xs text-foreground hover:underline"
                                    >
                                        Crear primer torneo
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {all.map((tournament: any) => (
                                        <Link
                                            key={tournament.id}
                                            href={`/admin/esport/${tournament.id}`}
                                            className="flex items-center justify-between p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {tournament.imageUrl ? (
                                                    <Image
                                                        src={tournament.imageUrl}
                                                        alt={tournament.name}
                                                        width={36}
                                                        height={36}
                                                        className="rounded-lg border border-foreground/10"
                                                    />
                                                ) : (
                                                    <div className="w-9 h-9 bg-foreground/10 border border-foreground/20 flex items-center justify-center rounded-lg flex-shrink-0">
                                                        <span className="text-foreground font-bold text-xs font-tiktok">
                                                            {tournament.name.substring(0, 2).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-medium text-foreground truncate group-hover:text-foreground transition-colors">
                                                        {tournament.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-[10px] text-foreground/30 mt-0.5">
                                                        <span>{tournament.gameType?.toUpperCase() || 'N/A'}</span>
                                                        {tournament.startsAt && (
                                                            <>
                                                                <span className="text-foreground/10">·</span>
                                                                <span>{format(new Date(tournament.startsAt), 'dd MMM yyyy', { locale: es })}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] text-foreground/40 hidden sm:block">{getFormatLabel(tournament)}</span>
                                                <span className="text-xs text-foreground/50">{tournament._count?.registrations || 0} equipos</span>
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${getStatusStyle(tournament.status)}`}>
                                                    {getStatusLabel(tournament.status)}
                                                </span>
                                                <span className="text-foreground text-sm group-hover:translate-x-1 transition-transform">
                                                    →
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
        </AdminLayout>
    )
}
