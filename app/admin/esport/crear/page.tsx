"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"

export default function CrearTorneoPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        gameType: "ca",
        format: "SINGLE_ELIMINATION", // Tournament format
        maxParticipants: 16,
        registrationOpens: "",
        registrationCloses: "",
        startsAt: "",
        rules: "",
        prizes: "",
        imageUrl: "",
        // Custom tournament fields
        tournamentType: "STANDARD",
        groupsCount: 2,
        teamsPerGroup: 5,
        mapsPerMatch: 3,
        playoffFormat: "BO7",
        minRosterSize: 4,
        maxRosterSize: 6,
        tournamentRules: "",
        scheduleNotes: ""
    })

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

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/admin/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al crear torneo')
            }
            return res.json()
        },
        onSuccess: (data) => {
            router.push(`/admin/esport/${data.tournament.id}`)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate(formData)
    }

    if (!authData?.user?.isAdmin) return null

    const isCustom = formData.tournamentType === "CUSTOM_GROUP"

    return (
        <AdminLayout title="Crear Torneo" subtitle="Nuevo torneo E-Sports">
            <div className="mb-4">
                <Link
                    href="/admin/esport"
                    className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
                >
                    ← Volver a Torneos
                </Link>
            </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Tipo de Torneo */}
                        <div
                            className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                            style={{ animationDelay: "0ms" }}
                        >
                            <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                    Tipo de Torneo
                                </h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Sistema</label>
                                    <select
                                        value={formData.tournamentType}
                                        onChange={(e) => setFormData({ ...formData, tournamentType: e.target.value as any })}
                                        className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                    >
                                        <option value="STANDARD">Eliminación Directa (Brackets)</option>
                                        <option value="CUSTOM_GROUP">Fase de Grupos + Playoffs</option>
                                    </select>
                                </div>

                                {/* Format selector for Standard tournaments */}
                                {!isCustom && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Formato de Bracket</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, format: "SINGLE_ELIMINATION" })}
                                                className={`p-4 border text-left transition-all ${
                                                    formData.format === "SINGLE_ELIMINATION"
                                                        ? "border-foreground bg-foreground/10"
                                                        : "border-foreground/10 bg-card hover:border-foreground/20"
                                                }`}
                                            >
                                                <div className={`text-sm font-bold mb-1 ${formData.format === "SINGLE_ELIMINATION" ? "text-foreground" : "text-foreground"}`}>
                                                    Single Elimination
                                                </div>
                                                <div className="text-[10px] text-foreground/40">
                                                    Pierdes = Eliminado. Formato más rápido.
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, format: "DOUBLE_ELIMINATION" })}
                                                className={`p-4 border text-left transition-all ${
                                                    formData.format === "DOUBLE_ELIMINATION"
                                                        ? "border-foreground bg-foreground/10"
                                                        : "border-foreground/10 bg-card hover:border-foreground/20"
                                                }`}
                                            >
                                                <div className={`text-sm font-bold mb-1 ${formData.format === "DOUBLE_ELIMINATION" ? "text-foreground" : "text-foreground"}`}>
                                                    Double Elimination
                                                </div>
                                                <div className="text-[10px] text-foreground/40">
                                                    Segunda oportunidad en Lower Bracket.
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <p className="text-[10px] text-foreground/40 pt-2 border-t border-white/5">
                                    {isCustom
                                        ? "Fase de grupos con round-robin donde todos juegan contra todos, seguido de playoffs con los clasificados"
                                        : formData.format === "SINGLE_ELIMINATION"
                                            ? "Bracket clásico estilo Challonge. Una derrota = eliminación"
                                            : "Bracket con Upper y Lower. Necesitas perder 2 veces para ser eliminado"}
                                </p>
                            </div>
                        </div>

                        {/* Información Básica */}
                        <div
                            className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                            style={{ animationDelay: "50ms" }}
                        >
                            <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                    Información Básica
                                </h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Nombre *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                        placeholder="Ej: Torneo QuakeClub 4v4 CA 2025"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Descripción</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                        rows={2}
                                        placeholder="Descripción breve del torneo"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Tipo de Juego</label>
                                        <select
                                            value={formData.gameType}
                                            onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                        >
                                            <option value="ca">Clan Arena</option>
                                            <option value="ctf">Capture the Flag</option>
                                            <option value="tdm">Team Deathmatch</option>
                                            <option value="duel">Duel</option>
                                            <option value="ffa">Free for All</option>
                                            <option value="ft">Freeze Tag</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Máx. Participantes</label>
                                        <input
                                            type="number"
                                            value={formData.maxParticipants}
                                            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                            min={2}
                                            max={32}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Configuración Customizada */}
                        {isCustom && (
                            <div
                                className="border border-foreground/40 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                                style={{ animationDelay: "100ms" }}
                            >
                                <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                    <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                        Configuración Customizada
                                    </h2>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Grupos</label>
                                            <input
                                                type="number"
                                                value={formData.groupsCount}
                                                onChange={(e) => setFormData({ ...formData, groupsCount: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                                min={1}
                                                max={8}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Equipos/Grupo</label>
                                            <input
                                                type="number"
                                                value={formData.teamsPerGroup}
                                                onChange={(e) => setFormData({ ...formData, teamsPerGroup: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                                min={2}
                                                max={10}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Mapas/Partido</label>
                                            <input
                                                type="number"
                                                value={formData.mapsPerMatch}
                                                onChange={(e) => setFormData({ ...formData, mapsPerMatch: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                                min={1}
                                                max={7}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Formato Playoffs</label>
                                            <select
                                                value={formData.playoffFormat}
                                                onChange={(e) => setFormData({ ...formData, playoffFormat: e.target.value })}
                                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                            >
                                                <option value="BO3">Best of 3</option>
                                                <option value="BO5">Best of 5</option>
                                                <option value="BO7">Best of 7</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Clasifican/Grupo</label>
                                            <input
                                                type="number"
                                                value={2}
                                                disabled
                                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground/40 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fechas */}
                        <div
                            className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                            style={{ animationDelay: "150ms" }}
                        >
                            <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                    Fechas
                                </h2>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Inicio Inscripciones</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.registrationOpens}
                                            onChange={(e) => setFormData({ ...formData, registrationOpens: e.target.value })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Cierre Inscripciones</label>
                                        <input
                                            type="datetime-local"
                                            value={formData.registrationCloses}
                                            onChange={(e) => setFormData({ ...formData, registrationCloses: e.target.value })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Inicio Torneo *</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.startsAt}
                                            onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bases y Reglas */}
                        <div
                            className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                            style={{ animationDelay: "200ms" }}
                        >
                            <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                                    Bases y Reglas
                                </h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {isCustom && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">
                                            Bases Completas del Torneo
                                        </label>
                                        <textarea
                                            value={formData.tournamentRules}
                                            onChange={(e) => setFormData({ ...formData, tournamentRules: e.target.value })}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none font-mono"
                                            rows={10}
                                            placeholder="Ingresa las bases completas del torneo..."
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Reglas Generales</label>
                                    <textarea
                                        value={formData.rules}
                                        onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                        className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                        rows={4}
                                        placeholder="Reglas generales..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Premios</label>
                                    <textarea
                                        value={formData.prizes}
                                        onChange={(e) => setFormData({ ...formData, prizes: e.target.value })}
                                        className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                        rows={3}
                                        placeholder="Premios para los ganadores..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Imagen del Torneo</label>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.imageUrl}
                                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                                placeholder="URL o sube una imagen"
                                            />
                                            <label className="cursor-pointer border border-foreground/30 bg-foreground/10 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Subir
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (!file) return
                                                        
                                                        const formDataUpload = new FormData()
                                                        formDataUpload.append('file', file)
                                                        formDataUpload.append('tournamentId', 'new')
                                                        
                                                        try {
                                                            const res = await fetch('/api/tournaments-images', {
                                                                method: 'POST',
                                                                body: formDataUpload
                                                            })
                                                            const data = await res.json()
                                                            if (data.imageUrl) {
                                                                setFormData({ ...formData, imageUrl: data.imageUrl })
                                                            } else {
                                                                toast.error(data.error || 'Error al subir imagen')
                                                            }
                                                        } catch (err) {
                                                            toast.error('Error al subir imagen')
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        {formData.imageUrl && (
                                            <div className="relative w-32 h-20 bg-card border border-foreground/10 overflow-hidden">
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3 pt-2">
                            <Link
                                href="/admin/esport"
                                className="flex-1 text-center border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] uppercase tracking-wider"
                            >
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="flex-1 border border-foreground/30 bg-foreground/10 px-4 py-3 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creando...' : 'Crear Torneo'}
                            </button>
                        </div>
                    </form>
        </AdminLayout>
    )
}
