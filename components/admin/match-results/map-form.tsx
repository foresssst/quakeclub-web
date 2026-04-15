"use client"

import { useState } from "react"

interface MapFormProps {
    matchId: string
    tournamentId: string
    team1: { id: string; name: string; tag: string }
    team2: { id: string; name: string; tag: string }
    mapNumber: number
    maxMaps: number
    onSuccess: () => void
}

export function MapForm({ matchId, tournamentId, team1, team2, mapNumber, maxMaps, onSuccess }: MapFormProps) {
    const [formData, setFormData] = useState({
        mapName: '',
        winnerId: '',
        score1: '',
        score2: '',
        screenshotUrl: '',
        notes: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const res = await fetch(`/api/admin/tournaments/${tournamentId}/matches/${matchId}/maps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mapNumber,
                    mapName: formData.mapName,
                    winnerId: formData.winnerId || null,
                    score1: formData.score1 ? parseInt(formData.score1) : null,
                    score2: formData.score2 ? parseInt(formData.score2) : null,
                    screenshotUrl: formData.screenshotUrl || null,
                    notes: formData.notes || null
                })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al registrar mapa')
            }

            alert('Resultado registrado exitosamente')
            setFormData({
                mapName: '',
                winnerId: '',
                score1: '',
                score2: '',
                screenshotUrl: '',
                notes: ''
            })
            onSuccess()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (mapNumber > maxMaps) {
        return (
            <div className="bg-card/40 border border-foreground/[0.06] p-4 rounded-lg text-center text-foreground/40 text-sm">
                Todos los mapas han sido registrados
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="bg-card/40 border border-foreground/[0.06] p-4 rounded-lg space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-foreground font-bold font-tiktok uppercase text-sm">
                    Registrar Mapa {mapNumber}
                </h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                        Nombre del Mapa *
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.mapName}
                        onChange={(e) => setFormData({ ...formData, mapName: e.target.value })}
                        className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground placeholder-black/40 text-sm"
                        placeholder="ej: t7, overkill, bloodrun"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                        Ganador *
                    </label>
                    <select
                        required
                        value={formData.winnerId}
                        onChange={(e) => setFormData({ ...formData, winnerId: e.target.value })}
                        className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground text-sm"
                    >
                        <option value="">Seleccionar ganador</option>
                        <option value={team1.id}>[{team1.tag}] {team1.name}</option>
                        <option value={team2.id}>[{team2.tag}] {team2.name}</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                        Score {team1.tag}
                    </label>
                    <input
                        type="number"
                        value={formData.score1}
                        onChange={(e) => setFormData({ ...formData, score1: e.target.value })}
                        className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground text-sm"
                        placeholder="0"
                        min="0"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                        Score {team2.tag}
                    </label>
                    <input
                        type="number"
                        value={formData.score2}
                        onChange={(e) => setFormData({ ...formData, score2: e.target.value })}
                        className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground text-sm"
                        placeholder="0"
                        min="0"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                    Screenshot URL
                </label>
                <input
                    type="url"
                    value={formData.screenshotUrl}
                    onChange={(e) => setFormData({ ...formData, screenshotUrl: e.target.value })}
                    className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground placeholder-black/40 text-sm"
                    placeholder="https://..."
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                    Notas
                </label>
                <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border border-black/20 bg-foreground/[0.04] py-2 px-3 text-foreground placeholder-black/40 text-sm"
                    placeholder="Notas adicionales..."
                    rows={2}
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-foreground text-white font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 font-tiktok text-sm rounded-lg"
            >
                {isSubmitting ? 'Registrando...' : 'Registrar Resultado'}
            </button>
        </form>
    )
}
