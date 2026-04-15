"use client"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { use } from "react"
import Image from "next/image"
import { systemConfirm } from "@/lib/system-modal"

interface Registration {
    id: string
    status: string
    clan?: {
        id: string
        tag: string
        name: string
        avatarUrl?: string
    }
    groupId?: string | null
}

interface Group {
    id: string
    name: string
    registrations: Registration[]
}

export default function GestionGruposPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()
    const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({})
    const [newGroupName, setNewGroupName] = useState("")

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login")
                throw new Error("Not authenticated")
            }
            const data = await res.json()
            if (!data.user.isAdmin) {
                router.push("/")
                throw new Error("Not admin")
            }
            return data
        }
    })

    const { data: tournament, isLoading } = useQuery({
        queryKey: ['tournament', id],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${id}`)
            if (!res.ok) throw new Error('Error')
            const data = await res.json()
            return data.tournament || data
        },
        enabled: !!authData?.user?.isAdmin
    })

    useEffect(() => {
        if (tournament?.registrations) {
            const initial: Record<string, string | null> = {}
            tournament.registrations.forEach((reg: Registration) => {
                if (reg.status === 'APPROVED') {
                    initial[reg.id] = reg.groupId || null
                }
            })
            setLocalAssignments(initial)
        }
    }, [tournament])

    const createGroupMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await fetch(`/api/admin/tournaments/${id}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al crear grupo')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            setNewGroupName("")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const deleteGroupMutation = useMutation({
        mutationFn: async (groupId: string) => {
            const res = await fetch(`/api/admin/tournaments/${id}/groups/${groupId}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Error al eliminar grupo')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
        }
    })

    const saveAssignmentsMutation = useMutation({
        mutationFn: async (assignments: Record<string, string | null>) => {
            const res = await fetch(`/api/admin/tournaments/${id}/groups`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al guardar asignaciones')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            toast.success('Asignaciones guardadas')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const generateFixtureMutation = useMutation({
        mutationFn: async (includeReturn: boolean = false) => {
            const res = await fetch(`/api/admin/tournaments/${id}/groups/generate-fixtures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mapsPerMatch: tournament?.mapsPerMatch || 3,
                    includeReturn // Solo ida por defecto, ida y vuelta si se solicita
                })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al generar fixture')
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            toast.success(`Fixture generado: ${data.matchesCreated || data.matches?.length || 0} partidos creados`)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    if (!authData?.user?.isAdmin) return null
    if (isLoading) {
        return (
            <AdminLayout title="Cargando..." subtitle="">
                <div className="flex items-center justify-center py-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
                </div>
            </AdminLayout>
        )
    }

    const groups: Group[] = tournament?.groups || []
    const approvedRegs: Registration[] = tournament?.registrations?.filter((r: Registration) => r.status === 'APPROVED') || []
    const unassignedRegs = approvedRegs.filter(r => !localAssignments[r.id])
    const hasMatches = (tournament?.matches?.length || 0) > 0

    const assignToGroup = (regId: string, groupId: string | null) => {
        setLocalAssignments(prev => ({ ...prev, [regId]: groupId }))
    }

    const autoAssign = () => {
        if (groups.length === 0) {
            toast.warning('Primero crea los grupos')
            return
        }
        const shuffled = [...approvedRegs].sort(() => Math.random() - 0.5)
        const newAssignments: Record<string, string | null> = {}
        shuffled.forEach((reg, index) => {
            const groupIndex = index % groups.length
            newAssignments[reg.id] = groups[groupIndex].id
        })
        setLocalAssignments(newAssignments)
    }

    const getTeamsInGroup = (groupId: string) => {
        return approvedRegs.filter(r => localAssignments[r.id] === groupId)
    }

    const hasChanges = () => {
        return approvedRegs.some(reg => {
            const serverGroupId = reg.groupId || null
            const localGroupId = localAssignments[reg.id] || null
            return serverGroupId !== localGroupId
        })
    }

    return (
        <AdminLayout title="Gestion de Grupos" subtitle={tournament?.name}>
            <div className="mb-4">
                <Link
                    href={`/admin/esport/${id}`}
                    className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
                >
                    ← Volver al Torneo
                </Link>
            </div>

            <div className="space-y-4">
                {/* Create Group */}
                <div
                    className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                    style={{ animationDelay: "0ms" }}
                >
                    <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                            Crear Grupo
                        </h2>
                    </div>
                    <div className="p-4 flex gap-3">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Nombre del grupo (ej: Grupo A)"
                            className="flex-1 px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                        />
                        <button
                            onClick={() => newGroupName && createGroupMutation.mutate(newGroupName)}
                            disabled={!newGroupName || createGroupMutation.isPending}
                            className="border border-foreground/30 bg-foreground/10 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider disabled:opacity-50"
                        >
                            Crear
                        </button>
                    </div>
                </div>

                {/* Action Bar */}
                <div
                    className="flex flex-wrap gap-2 animate-fade-up"
                    style={{ animationDelay: "50ms" }}
                >
                    <button
                        onClick={autoAssign}
                        disabled={groups.length === 0 || approvedRegs.length === 0}
                        className="border border-foreground/10 bg-foreground/[0.03] px-3 py-1.5 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] uppercase tracking-wider disabled:opacity-50"
                    >
                        Asignar Aleatoriamente
                    </button>
                    <button
                        onClick={() => saveAssignmentsMutation.mutate(localAssignments)}
                        disabled={!hasChanges() || saveAssignmentsMutation.isPending}
                        className="border border-foreground/30 bg-foreground/10 px-3 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider disabled:opacity-50"
                    >
                        {saveAssignmentsMutation.isPending ? 'Guardando...' : 'Guardar Asignaciones'}
                    </button>
                    <button
                        onClick={async () => {
                            if (hasMatches) {
                                toast.warning('Ya existen partidos generados')
                                return
                            }
                            if (unassignedRegs.length > 0) {
                                toast.warning('Todos los equipos deben estar asignados a un grupo')
                                return
                            }
                            const includeReturn = await systemConfirm('¿Generar partidos de ida y vuelta?\n\n• Aceptar = Ida y Vuelta (cada equipo juega 2 veces contra cada rival)\n• Cancelar = Solo Ida (cada equipo juega 1 vez contra cada rival)', 'Generar Fixture')
                            generateFixtureMutation.mutate(includeReturn)
                        }}
                        disabled={generateFixtureMutation.isPending || hasMatches || unassignedRegs.length > 0}
                        className="border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[10px] font-medium text-green-600 transition-colors hover:bg-green-500/20 uppercase tracking-wider disabled:opacity-50"
                    >
                        {hasMatches ? 'Fixture Generado' : 'Generar Fixture'}
                    </button>
                </div>

                {/* Unassigned Teams */}
                {unassignedRegs.length > 0 && (
                    <div
                        className="border border-foreground/40 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                        style={{ animationDelay: "100ms" }}
                    >
                        <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                Equipos Sin Asignar ({unassignedRegs.length})
                            </h2>
                        </div>
                        <div className="p-3">
                            <div className="flex flex-wrap gap-2">
                                {unassignedRegs.map((reg) => (
                                    <div
                                        key={reg.id}
                                        className="flex items-center gap-2 px-2 py-1.5 bg-foreground/[0.02] border border-white/5"
                                    >
                                        {reg.clan?.avatarUrl ? (
                                            <Image
                                                src={reg.clan.avatarUrl}
                                                alt={reg.clan.name || ''}
                                                width={20}
                                                height={20}
                                                className="rounded-lg"
                                            />
                                        ) : (
                                            <div className="w-5 h-5 bg-black/10 rounded-lg" />
                                        )}
                                        <span className="text-[10px] font-bold text-foreground">[{reg.clan?.tag}]</span>
                                        <select
                                            value=""
                                            onChange={(e) => assignToGroup(reg.id, e.target.value || null)}
                                            className="px-1.5 py-0.5 bg-foreground/[0.04] border border-foreground/10 text-foreground text-[10px] focus:outline-none focus:border-foreground/50"
                                        >
                                            <option value="">→</option>
                                            {groups.map((g) => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Groups Grid */}
                {groups.length === 0 ? (
                    <div
                        className="border border-foreground/20 bg-card p-12 text-center backdrop-blur-sm shadow-sm animate-fade-up"
                        style={{ animationDelay: "150ms" }}
                    >
                        <p className="text-xs text-foreground/40">No hay grupos creados</p>
                        <p className="text-[10px] text-foreground/30 mt-1">Crea grupos para organizar los equipos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.map((group, idx) => {
                            const teamsInGroup = getTeamsInGroup(group.id)
                            return (
                                <div
                                    key={group.id}
                                    className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                                    style={{ animationDelay: `${150 + idx * 50}ms` }}
                                >
                                    <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                            {group.name}
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-foreground/40">
                                                {teamsInGroup.length} equipos
                                            </span>
                                            {!hasMatches && (
                                                <button
                                                    onClick={async () => {
                                                        if (await systemConfirm(`¿Eliminar ${group.name}?`, 'Eliminar Grupo')) {
                                                            deleteGroupMutation.mutate(group.id)
                                                        }
                                                    }}
                                                    className="text-[10px] text-red-500/60 hover:text-red-500 transition-colors"
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-h-[100px]">
                                        {teamsInGroup.length === 0 ? (
                                            <div className="h-[100px] flex items-center justify-center text-foreground/30 text-[10px]">
                                                Sin equipos asignados
                                            </div>
                                        ) : (
                                            <div>
                                                {teamsInGroup.map((reg) => (
                                                    <div
                                                        key={reg.id}
                                                        className="flex items-center justify-between px-4 py-2 border-b border-black/5 transition-colors hover:bg-foreground/[0.02] last:border-0"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {reg.clan?.avatarUrl ? (
                                                                <Image
                                                                    src={reg.clan.avatarUrl}
                                                                    alt={reg.clan.name || ''}
                                                                    width={20}
                                                                    height={20}
                                                                    className="rounded-lg"
                                                                />
                                                            ) : (
                                                                <div className="w-5 h-5 bg-black/10 rounded-lg" />
                                                            )}
                                                            <span className="text-xs font-semibold text-foreground">[{reg.clan?.tag}]</span>
                                                            <span className="text-[10px] text-foreground/40">{reg.clan?.name}</span>
                                                        </div>
                                                        {!hasMatches && (
                                                            <button
                                                                onClick={() => assignToGroup(reg.id, null)}
                                                                className="text-[10px] text-foreground/30 hover:text-red-500 transition-colors"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Instructions */}
                <div
                    className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                    style={{ animationDelay: "300ms" }}
                >
                    <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                            Instrucciones
                        </h2>
                    </div>
                    <div className="p-4">
                        <ul className="text-[10px] text-foreground/50 space-y-1">
                            <li>1. Crea los grupos necesarios (ej: Grupo A, Grupo B)</li>
                            <li>2. Asigna los equipos a cada grupo</li>
                            <li>3. Guarda las asignaciones</li>
                            <li>4. Genera el fixture cuando todos los equipos estén asignados</li>
                        </ul>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
