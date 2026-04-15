"use client"
import { toast } from "sonner"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"

export default function CreateNewsPage() {
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState("")
  const [previewImage, setPreviewImage] = useState("")
  const [uploadingPreview, setUploadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const router = useRouter()

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/admin/news/create")
        throw new Error("Not authenticated")
      }
      const data = await res.json()
      if (!data.user.isAdmin) {
        router.push("/")
        throw new Error("Not admin")
      }
      if (!author) {
        setAuthor(data.user.username)
      }
      return data
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const user = authData?.user

  const handlePreviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPreview(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/news/upload-image", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setPreviewImage(data.url)
      } else {
        const error = await res.json()
        toast.error(error.error || "Error al subir la imagen")
      }
    } catch (error) {
      console.error("Error uploading preview image:", error)
      toast.error("Error al subir la imagen")
    } finally {
      setUploadingPreview(false)
      e.target.value = ""
    }
  }

  const insertMarkdown = (before: string, after = "") => {
    const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end)

    setContent(newText)

    setTimeout(() => {
      textarea.focus()
      const newPosition = start + before.length + selectedText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !excerpt || !content || !author) {
      toast.warning("Por favor completa todos los campos")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/news/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          author,
          image: previewImage || undefined,
          date: new Date().toISOString().split("T")[0],
        }),
      })

      if (res.ok) {
        router.push("/admin")
      } else {
        toast.error("Error al crear la noticia")
      }
    } catch (error) {
      console.error("Error creating news:", error)
      toast.error("Error al crear la noticia")
    } finally {
      setSaving(false)
    }
  }

  if (!user?.isAdmin) {
    return null
  }

  const inputCls = "w-full h-10 px-3 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 focus:bg-foreground/[0.05] transition-all"
  const textareaCls = "w-full px-3 py-2.5 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 focus:bg-foreground/[0.05] transition-all resize-none"
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2"

  return (
    <AdminLayout title="Nueva Noticia" subtitle="Crea contenido con soporte Markdown">
      <div className="mb-4">
        <Link
          href="/admin/news"
          className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
        >
          ← Volver
        </Link>
      </div>

      <div className="max-w-[1100px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preview Image */}
          <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-4">
            <label className={labelCls}>Imagen de Portada</label>
            <p className="text-[10px] text-foreground/30 mb-4">
              Se mostrara como preview en la lista de noticias
            </p>

            {previewImage ? (
              <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-black/20">
                <Image src={previewImage} alt="Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setPreviewImage("")}
                  className="absolute top-2 right-2 px-2 py-1 text-[10px] font-bold uppercase bg-red-500/80 hover:bg-red-500 text-white rounded transition-colors"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="mb-4 aspect-video w-full flex items-center justify-center border border-dashed border-foreground/10 rounded-lg bg-foreground/[0.02]">
                <span className="text-[10px] text-foreground/20 uppercase tracking-wider">Sin imagen</span>
              </div>
            )}

            <label className={`flex cursor-pointer items-center justify-center gap-2 h-10 border border-foreground/30 bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${uploadingPreview ? "opacity-50 cursor-wait" : ""}`}>
              {uploadingPreview ? "Subiendo..." : "Subir Imagen"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePreviewImageUpload}
                className="hidden"
                disabled={uploadingPreview}
              />
            </label>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Titulo de la noticia"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className={labelCls}>Extracto</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className={textareaCls}
              placeholder="Breve descripcion que aparecera en la lista"
              rows={3}
              required
            />
          </div>

          {/* Content with Markdown toolbar */}
          <div>
            <label className={labelCls}>Contenido</label>

            {/* Markdown Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-foreground/[0.02] border border-foreground/[0.06] border-b-0 rounded-t-lg">
              {[
                { label: "B", action: () => insertMarkdown("**", "**"), title: "Negrita" },
                { label: "I", action: () => insertMarkdown("*", "*"), title: "Cursiva", italic: true },
                { label: "H1", action: () => insertMarkdown("# ", ""), title: "Titulo 1" },
                { label: "H2", action: () => insertMarkdown("## ", ""), title: "Titulo 2" },
                { label: "-", action: () => insertMarkdown("- ", ""), title: "Lista" },
                { label: "1.", action: () => insertMarkdown("1. ", ""), title: "Lista numerada" },
                { label: "[ ]", action: () => insertMarkdown("[texto](url)", ""), title: "Enlace" },
                { label: "img", action: () => insertMarkdown("![desc](url)", ""), title: "Imagen" },
                { label: '"', action: () => insertMarkdown("> ", ""), title: "Cita" },
                { label: "<>", action: () => insertMarkdown("`", "`"), title: "Codigo" },
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

              <div className="w-px h-5 bg-black/10 mx-1" />

              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className={`px-2 h-8 flex items-center text-[10px] font-bold uppercase tracking-wider rounded transition-all ${showGuide ? "text-foreground bg-foreground/10" : "text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06]"}`}
              >
                Ayuda
              </button>
            </div>

            {showGuide && (
              <div className="p-4 bg-foreground/5 border-x border-foreground/[0.06]">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground mb-3">Guia Markdown</h4>
                <div className="grid gap-2 sm:grid-cols-2 text-[10px]">
                  {[
                    ["**negrita**", "negrita"],
                    ["*cursiva*", "cursiva"],
                    ["# Titulo", "Titulo grande"],
                    ["- Item", "Lista"],
                    ["[texto](url)", "Enlace"],
                    ["![alt](url)", "Imagen"],
                  ].map(([code, result]) => (
                    <div key={code} className="flex items-center gap-2 text-foreground/50">
                      <code className="text-[#333] font-mono">{code}</code>
                      <span className="text-foreground/30">→</span>
                      <span>{result}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              id="content-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`${textareaCls} min-h-[350px] font-mono text-xs ${showGuide ? "rounded-t-none border-t-0" : "rounded-t-none"}`}
              placeholder="# Titulo&#10;&#10;Escribe tu contenido aqui usando Markdown..."
              required
            />
          </div>

          {/* Author */}
          <div>
            <label className={labelCls}>Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputCls}
              placeholder="Nombre del autor"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-foreground/[0.06]">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 bg-foreground hover:brightness-110 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Publicando..." : "Publicar Noticia"}
            </button>
            <Link
              href="/admin/news"
              className="h-11 px-6 flex items-center justify-center bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-foreground/[0.06] text-foreground/60 hover:text-foreground text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
