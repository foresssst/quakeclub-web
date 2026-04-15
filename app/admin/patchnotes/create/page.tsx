"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

export default function CreatePatchNotePage() {
  const [version, setVersion] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) { router.push("/login?returnTo=/admin/patchnotes/create"); throw new Error("Not authenticated") }
      const data = await res.json()
      if (!data.user.isAdmin) { router.push("/"); throw new Error("Not admin") }
      return data
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  async function handleSave() {
    if (!version || !title || !content) {
      toast.warning("Completa todos los campos")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/patchnotes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          title,
          date: new Date().toLocaleDateString("en-CA"),
          content,
          author: authData?.user?.username || "QuakeClub",
        }),
      })

      if (res.ok) {
        router.push("/admin/patchnotes")
      } else {
        toast.error("Error al crear")
      }
    } catch {
      toast.error("Error al crear")
    } finally {
      setSaving(false)
    }
  }

  if (!authData?.user?.isAdmin) return null

  return (
    <AdminLayout title="Nuevo Patch Note" subtitle="Crea una nueva entrada en el changelog">
      <div className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-foreground/40 uppercase tracking-wider mb-1.5 font-medium">
              Version
            </label>
            <input
              type="text"
              placeholder="1.4.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-foreground/40 uppercase tracking-wider mb-1.5 font-medium">
              Titulo
            </label>
            <input
              type="text"
              placeholder="Mejoras al sistema de ELO"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-foreground/40 uppercase tracking-wider mb-1.5 font-medium">
            Contenido (Markdown)
          </label>
          <textarea
            placeholder={"### Cambios\n- Mejora 1\n- Mejora 2\n\n### Correcciones\n- Fix 1"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30 transition-all font-mono resize-y"
          />
        </div>

        <p className="text-[10px] text-foreground/30 normal-case">
          Usa @steamId en el contenido para mencionar jugadores (ej: @76561198012345678)
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-foreground text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded-lg disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Publicar"}
          </button>
          <button
            onClick={() => router.push("/admin/patchnotes")}
            className="bg-foreground/[0.04] border border-foreground/[0.06] px-6 py-2.5 text-xs font-medium text-foreground/60 transition-all hover:bg-foreground/[0.08] uppercase tracking-wider rounded-lg"
          >
            Cancelar
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
