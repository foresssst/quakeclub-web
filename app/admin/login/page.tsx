"use client"

import type React from "react"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { FooterV2 } from "@/components/footer-v2"

function AdminLoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo") || "/admin"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (res.ok) {
        const authRes = await fetch("/api/auth/me")
        if (authRes.ok) {
          const authData = await authRes.json()
          if (authData.user?.isAdmin) {
            router.push(returnTo)
          } else {
            setError(authData.user ? "No tienes permisos de administrador" : "Error de sesión. Reintenta.")
            if (authData.user) await fetch("/api/auth/logout", { method: "POST" })
          }
        } else {
          setError("Error al verificar permisos")
        }
      } else {
        setError(data.error || "Credenciales inválidas")
      }
    } catch (err) {
      setError("Error al iniciar sesión: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background gradient - red tint for admin */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Back button */}
      <div className="relative z-10 p-6">
        <Link
          href="/login"
          className="group inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60 bg-black/5 border border-foreground/10 rounded-lg hover:bg-foreground/10 hover:border-foreground/50 hover:text-foreground transition-all duration-200"
        >
          ← Volver al login
        </Link>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <Image src="/branding/logo.png" alt="Quake Club" width={140} height={50} className="h-12 w-auto" />
          </div>

          {/* Card */}
          <div className="bg-card border border-foreground/[0.06] rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <h1 className="font-tiktok text-lg font-bold uppercase tracking-wider text-center text-foreground">
                  Panel Admin
                </h1>
              </div>
              <p className="text-center text-xs text-foreground/40">Acceso restringido</p>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Error message */}
              {error && (
                <div className="mb-5 bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <p className="text-xs text-red-500 text-center">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username field */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-11 px-4 bg-black/5 border border-foreground/10 text-foreground text-sm placeholder:text-foreground/20 focus:border-foreground/50 focus:outline-none transition-colors rounded-lg"
                      placeholder="Ingresa tu usuario"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 px-4 bg-black/5 border border-foreground/10 text-foreground text-sm placeholder:text-foreground/20 focus:border-foreground/50 focus:outline-none transition-colors rounded-lg"
                      placeholder="Ingresa tu contraseña"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-black/5 hover:bg-black/10 border border-foreground/10 hover:border-foreground/20 text-foreground/80 hover:text-foreground text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 rounded-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Verificando...
                    </span>
                  ) : (
                    "Acceder al Panel"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Bottom text */}
          <p className="text-center text-[10px] text-foreground/20 mt-6">Solo personal autorizado</p>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <FooterV2 />
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center justify-center gap-2 text-foreground">
            <svg className="h-5 w-5 animate-spin text-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Cargando...</span>
          </div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  )
}
