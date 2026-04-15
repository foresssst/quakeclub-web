"use client"
import { toast } from "sonner"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"

interface User {
  id: string
  username: string
  isAdmin?: boolean
}

export default function EditNewsPage() {
  const params = useParams()
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState("")
  const [previewImage, setPreviewImage] = useState("")
  const [showGuide, setShowGuide] = useState(false)
  const router = useRouter()

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/admin")
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
    queryKey: ["news", "detail", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/news/${params.id}`)
      if (!res.ok) {
        toast.error("Noticia no encontrada")
        router.push("/admin")
        throw new Error("News not found")
      }
      const data = await res.json()
      return data.news
    },
    enabled: !!authData?.user?.isAdmin && !!params.id,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (newsData) {
      setTitle(newsData.title)
      setExcerpt(newsData.excerpt)
      setContent(newsData.content)
      setAuthor(newsData.author)
      setPreviewImage(newsData.image || "")
    }
  }, [newsData])

  const user = authData?.user
  const news = newsData

  // Mutation for uploading image
  const uploadImageMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/news/upload-image", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error al subir la imagen")
      }

      const data = await res.json()
      return data
    },
    onSuccess: (data) => {
      setPreviewImage(data.url)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Mutation for updating news
  const updateNewsMutation = useMutation({
    mutationFn: async (data: { title: string; excerpt: string; content: string; author: string; image?: string }) => {
      const res = await fetch(`/api/news/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Error al actualizar la noticia")
      }

      return res.json()
    },
    onSuccess: () => {
      toast.success("Noticia actualizada exitosamente")
      router.push("/admin")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handlePreviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    uploadImageMutation.mutate(formData)
    e.target.value = ""
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !excerpt || !content || !author) {
      toast.warning("Por favor completa todos los campos")
      return
    }

    updateNewsMutation.mutate({
      title,
      excerpt,
      content,
      author,
      image: previewImage || undefined,
    })
  }

  if (!user?.isAdmin) {
    return null
  }

  if (loading) {
    return (
      <AdminLayout title="Cargando..." subtitle="">
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Editar Noticia" subtitle="Modifica la noticia con soporte para Markdown">
      <div className="mb-4">
        <Link
          href="/admin"
          className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
        >
          ← Volver
        </Link>
      </div>

      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-foreground/10 bg-card p-6 backdrop-blur-sm">
            <label className="mb-2 block text-sm font-semibold text-foreground">Imagen Preview</label>
            <p className="mb-4 text-xs text-gray-400">
              Esta imagen se mostrara como portada de la noticia en la lista y en la parte superior del articulo
            </p>

            {previewImage ? (
              <div className="relative mb-4 aspect-video w-full overflow-hidden bg-card">
                <Image src={previewImage || "/branding/logo.png"} alt="Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setPreviewImage("")}
                  className="absolute right-2 top-2 bg-red-500/80 px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-red-600"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="mb-4 flex aspect-video w-full items-center justify-center border border-dashed border-foreground/20 bg-card">
                <span className="text-gray-500">Sin imagen preview</span>
              </div>
            )}

            <label
              className={`flex cursor-pointer items-center justify-center gap-2 border border-foreground bg-foreground/10 px-4 py-2 font-semibold text-foreground transition-colors hover:bg-foreground/20 ${uploadImageMutation.isPending ? "opacity-50" : ""}`}
            >
              {uploadImageMutation.isPending ? "Subiendo..." : "Subir Imagen Preview"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePreviewImageUpload}
                className="hidden"
                disabled={uploadImageMutation.isPending}
              />
            </label>
          </div>

          <div className="border border-foreground/10 bg-card p-6 backdrop-blur-sm">
            <label className="mb-2 block text-sm font-semibold text-foreground">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-foreground/20 bg-foreground/[0.04] px-4 py-2 text-foreground placeholder-gray-500 outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/[0.06]"
              placeholder="Titulo de la noticia"
              required
            />
          </div>

          <div className="border border-foreground/10 bg-card p-6 backdrop-blur-sm">
            <label className="mb-2 block text-sm font-semibold text-foreground">Extracto</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full border border-foreground/20 bg-foreground/[0.04] px-4 py-2 text-foreground placeholder-gray-500 outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/[0.06]"
              placeholder="Breve descripcion de la noticia"
              rows={3}
              required
            />
          </div>

          <div className="border border-foreground/10 bg-card p-6 backdrop-blur-sm">
            <label className="mb-2 block text-sm font-semibold text-foreground">Contenido</label>
            <p className="mb-4 text-xs text-gray-400">
              Usa Markdown para formatear. Para imagenes usa: ![descripcion](https://url-de-imagen.com/imagen.png)
            </p>

            <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-foreground/20 bg-card p-2 mb-0">
              <button
                type="button"
                onClick={() => insertMarkdown("**", "**")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs font-bold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("*", "*")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs italic"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("# ", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("## ", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("- ", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("1. ", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                1.
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("[texto](url)", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("![descripcion](https://url-imagen.com/imagen.png)", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                Img
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("> ", "")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                &quot;
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown("`", "`")}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                {'<>'}
              </button>

              <div className="mx-1 h-6 w-px bg-white/20" />

              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="rounded p-2 text-gray-400 transition-colors hover:bg-black/10 hover:text-foreground text-xs"
              >
                ?
              </button>
            </div>

            {showGuide && (
              <div className="rounded-b-lg border border-t-0 border-foreground/30 bg-foreground/5 p-4 text-sm mb-2">
                <h4 className="mb-2 font-bold text-foreground">Guia rapida de Markdown</h4>
                <div className="grid gap-2 text-foreground/60 md:grid-cols-2">
                  <div><code className="text-foreground">**negrita**</code> → <strong>negrita</strong></div>
                  <div><code className="text-foreground">*cursiva*</code> → <em>cursiva</em></div>
                  <div><code className="text-foreground"># Titulo 1</code> → Titulo grande</div>
                  <div><code className="text-foreground">## Titulo 2</code> → Titulo mediano</div>
                  <div><code className="text-foreground">- Item</code> → Lista con vinetas</div>
                  <div><code className="text-foreground">1. Item</code> → Lista numerada</div>
                  <div><code className="text-foreground">[texto](url)</code> → Enlace</div>
                  <div><code className="text-foreground">![alt](url)</code> → Imagen</div>
                  <div><code className="text-foreground">`codigo`</code> → Codigo inline</div>
                  <div><code className="text-foreground">&gt; cita</code> → Cita</div>
                </div>
              </div>
            )}

            <textarea
              id="content-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[400px] border border-foreground/20 bg-foreground/[0.04] px-4 py-2 text-foreground placeholder-gray-500 outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/[0.06] font-mono text-sm rounded-b-lg"
              placeholder="# Titulo&#10;&#10;Escribe tu contenido aqui...&#10;&#10;![Imagen](https://i.imgur.com/ejemplo.png)"
              required
            />
          </div>

          <div className="border border-foreground/10 bg-card p-6 backdrop-blur-sm">
            <label className="mb-2 block text-sm font-semibold text-foreground">Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full border border-foreground/20 bg-foreground/[0.04] px-4 py-2 text-foreground placeholder-gray-500 outline-none transition-colors focus:border-foreground/50 focus:bg-foreground/[0.06]"
              placeholder="Nombre del autor"
              required
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={updateNewsMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 border border-foreground bg-foreground/10 px-6 py-3 font-semibold text-foreground transition-colors hover:bg-foreground/20 disabled:opacity-50"
            >
              {updateNewsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </button>
            <Link
              href="/admin"
              className="flex items-center justify-center border border-foreground/20 bg-black/5 px-6 py-3 font-semibold text-foreground/80 transition-colors hover:border-white/40 hover:bg-black/10"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
