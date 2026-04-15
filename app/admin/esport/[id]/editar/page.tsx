"use client"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { use } from "react"

export default function EditarTorneoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        gameType: "ca",
        maxParticipants: 16,
        registrationOpens: "",
        registrationCloses: "",
        startsAt: "",
        tournamentRules: "",
        rules: "",
        prizes: "",
        scheduleNotes: "",
        imageUrl: "",
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

    const { data: tournament, isLoading } = useQuery({
        queryKey: ['tournament', id],
        queryFn: async () => {
            const res = await fetch(`/api/admin/tournaments/${id}`)
            if (!res.ok) throw new Error('Error')
            const data = await res.json()
            return data.tournament
        },
        enabled: !!authData?.user?.isAdmin
    })

    // Populate form when tournament data is loaded
    useEffect(() => {
        if (tournament) {
            const formatDate = (date: string | null) => {
                if (!date) return ""
                return new Date(date).toISOString().slice(0, 16)
            }

            setFormData({
                name: tournament.name || "",
                description: tournament.description || "",
                gameType: tournament.gameType || "ca",
                maxParticipants: tournament.maxParticipants || 16,
                registrationOpens: formatDate(tournament.registrationOpens),
                registrationCloses: formatDate(tournament.registrationCloses),
                startsAt: formatDate(tournament.startsAt),
                tournamentRules: tournament.tournamentRules || "",
                rules: tournament.rules || "",
                prizes: tournament.prizes || "",
                scheduleNotes: tournament.scheduleNotes || "",
                imageUrl: tournament.imageUrl || "",
            })
        }
    }, [tournament])

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/admin/tournaments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al actualizar torneo')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            router.push(`/admin/esport/${id}`)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        updateMutation.mutate(formData)
    }

    const insertMarkdown = (textareaId: string, field: keyof typeof formData, before: string, after = "") => {
        const textarea = document.getElementById(textareaId) as HTMLTextAreaElement
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const currentValue = formData[field] as string
        const selectedText = currentValue.substring(start, end)
        const newText = currentValue.substring(0, start) + before + selectedText + after + currentValue.substring(end)

        setFormData({ ...formData, [field]: newText })

        setTimeout(() => {
            textarea.focus()
            const newPosition = start + before.length + selectedText.length
            textarea.setSelectionRange(newPosition, newPosition)
        }, 0)
    }

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

    return (
        <AdminLayout title="Editar Torneo" subtitle={tournament?.name}>
            <div className="mb-4">
                <Link
                    href={`/admin/esport/${id}`}
                    className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
                >
                    ← Volver al Torneo
                </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Informacion Basica */}
                <div
                    className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                    style={{ animationDelay: "0ms" }}
                >
                    <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                            Informacion Basica
                        </h2>
                        <span className="text-[10px] text-foreground/30">
                            {tournament?.tournamentType === 'CUSTOM_GROUP' ? 'Grupos + Playoffs' : tournament?.format || 'Eliminacion'}
                        </span>
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
                                placeholder="Nombre del torneo"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Descripcion</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none"
                                rows={2}
                                placeholder="Descripcion breve del torneo"
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
                                <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Max. Participantes</label>
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

                {/* Fechas */}
                <div
                    className="border border-foreground/20 bg-card backdrop-blur-sm shadow-sm animate-fade-up"
                    style={{ animationDelay: "50ms" }}
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
                    style={{ animationDelay: "100ms" }}
                >
                    <div className="flex items-center justify-between border-b border-foreground/20 bg-[var(--qc-bg-pure)] px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-tiktok">
                            Bases y Reglas
                        </h2>
                    </div>
                    <div className="p-4 space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Bases Completas del Torneo</label>
                            <p className="text-[10px] text-foreground/30 mb-2">Soporta Markdown: titulos, listas, negrita, enlaces, imagenes, etc.</p>
                            {/* Markdown Toolbar */}
                            <div className="flex flex-wrap items-center gap-1 p-2 bg-foreground/[0.02] border border-foreground/[0.06] border-b-0 rounded-t">
                                {[
                                    { label: "B", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "**", "**"), title: "Negrita" },
                                    { label: "I", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "*", "*"), title: "Cursiva", italic: true },
                                    { label: "H1", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "# "), title: "Titulo 1" },
                                    { label: "H2", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "## "), title: "Titulo 2" },
                                    { label: "H3", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "### "), title: "Titulo 3" },
                                    { label: "-", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "- "), title: "Lista" },
                                    { label: "1.", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "1. "), title: "Lista numerada" },
                                    { label: "[ ]", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "[texto](url)"), title: "Enlace" },
                                    { label: "img", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "![desc](url)"), title: "Imagen" },
                                    { label: '"', action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "> "), title: "Cita" },
                                    { label: "---", action: () => insertMarkdown("ta-tournamentRules", "tournamentRules", "\n---\n"), title: "Separador" },
                                ].map((btn, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={btn.action}
                                        title={btn.title}
                                        className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] rounded transition-all ${btn.italic ? "italic" : ""}`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                id="ta-tournamentRules"
                                value={formData.tournamentRules}
                                onChange={(e) => setFormData({ ...formData, tournamentRules: e.target.value })}
                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none font-mono rounded-t-none"
                                rows={14}
                                placeholder="# Bases del Torneo&#10;&#10;Escribe las bases completas usando Markdown..."
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Reglas Generales</label>
                            <div className="flex flex-wrap items-center gap-1 p-2 bg-foreground/[0.02] border border-foreground/[0.06] border-b-0 rounded-t">
                                {[
                                    { label: "B", action: () => insertMarkdown("ta-rules", "rules", "**", "**"), title: "Negrita" },
                                    { label: "I", action: () => insertMarkdown("ta-rules", "rules", "*", "*"), title: "Cursiva", italic: true },
                                    { label: "H2", action: () => insertMarkdown("ta-rules", "rules", "## "), title: "Titulo" },
                                    { label: "-", action: () => insertMarkdown("ta-rules", "rules", "- "), title: "Lista" },
                                    { label: "1.", action: () => insertMarkdown("ta-rules", "rules", "1. "), title: "Lista numerada" },
                                    { label: "[ ]", action: () => insertMarkdown("ta-rules", "rules", "[texto](url)"), title: "Enlace" },
                                ].map((btn, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={btn.action}
                                        title={btn.title}
                                        className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] rounded transition-all ${btn.italic ? "italic" : ""}`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                id="ta-rules"
                                value={formData.rules}
                                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none font-mono rounded-t-none"
                                rows={6}
                                placeholder="Reglas del torneo..."
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Premios</label>
                            <div className="flex flex-wrap items-center gap-1 p-2 bg-foreground/[0.02] border border-foreground/[0.06] border-b-0 rounded-t">
                                {[
                                    { label: "B", action: () => insertMarkdown("ta-prizes", "prizes", "**", "**"), title: "Negrita" },
                                    { label: "I", action: () => insertMarkdown("ta-prizes", "prizes", "*", "*"), title: "Cursiva", italic: true },
                                    { label: "H2", action: () => insertMarkdown("ta-prizes", "prizes", "## "), title: "Titulo" },
                                    { label: "-", action: () => insertMarkdown("ta-prizes", "prizes", "- "), title: "Lista" },
                                    { label: "img", action: () => insertMarkdown("ta-prizes", "prizes", "![desc](url)"), title: "Imagen" },
                                ].map((btn, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={btn.action}
                                        title={btn.title}
                                        className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] rounded transition-all ${btn.italic ? "italic" : ""}`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                id="ta-prizes"
                                value={formData.prizes}
                                onChange={(e) => setFormData({ ...formData, prizes: e.target.value })}
                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none font-mono rounded-t-none"
                                rows={5}
                                placeholder="Premios..."
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase tracking-wider">Notas de Calendario</label>
                            <textarea
                                id="ta-scheduleNotes"
                                value={formData.scheduleNotes}
                                onChange={(e) => setFormData({ ...formData, scheduleNotes: e.target.value })}
                                className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground placeholder-foreground/30 focus:border-foreground/50 focus:outline-none font-mono"
                                rows={4}
                                placeholder="Notas sobre programacion y calendario..."
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
                                                formDataUpload.append('tournamentId', id)

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
                        href={`/admin/esport/${id}`}
                        className="flex-1 text-center border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] uppercase tracking-wider"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="flex-1 border border-foreground/30 bg-foreground/10 px-4 py-3 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider disabled:opacity-50"
                    >
                        {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>
        </AdminLayout>
    )
}
