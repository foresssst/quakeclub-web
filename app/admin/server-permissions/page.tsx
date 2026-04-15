"use client"
import { systemConfirm } from "@/components/ui/system-modal"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import { PlayerAvatar } from "@/components/player-avatar"
import { parseQuakeColors } from "@/lib/quake-colors"
import { UserRoleBadges, type UserRole } from "@/components/user-role-badge"
import Link from "next/link"

interface Server {
  id: string
  port: number
  name: string
}

interface GlobalAdmin {
  steamId: string
  username: string
  avatar?: string
  roles: string[]
}

interface ServerPerm {
  id: string
  steamId: string
  serverId: string
  grantedBy?: string
  grantedAt: string
  notes?: string
  player: { username: string; avatar?: string }
}

interface SearchResult {
  steamId: string
  username: string
  avatar?: string
  roles: string[]
}

export default function ServerPermissionsPage() {
  const [selectedServer, setSelectedServer] = useState<string>("")
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-server-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/server-permissions")
      if (!res.ok) throw new Error("Failed")
      return res.json() as Promise<{
        servers: Server[]
        globalAdmins: GlobalAdmin[]
        serverPermissions: ServerPerm[]
      }>
    },
    staleTime: 30 * 1000,
  })

  const servers = data?.servers || []
  const globalAdmins = data?.globalAdmins || []
  const serverPermissions = data?.serverPermissions || []

  useEffect(() => {
    if (formSuccess) {
      const t = setTimeout(() => setFormSuccess(null), 3000)
      return () => clearTimeout(t)
    }
  }, [formSuccess])

  const permsForServer = selectedServer
    ? serverPermissions.filter((p) => p.serverId === selectedServer)
    : []

  async function searchPlayers(query: string) {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(query)}&limit=10`
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.players || [])
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false)
    }
  }

  async function addPermission(steamId: string) {
    if (!selectedServer) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/server-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId, serverId: selectedServer }),
      })
      if (res.ok) {
        setFormSuccess("Permiso agregado")
        setSearch("")
        setSearchResults([])
        refetch()
      } else {
        const err = await res.json()
        toast.error(err.error || "Error")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  async function removePermission(steamId: string, serverId: string) {
    if (!(await systemConfirm("¿Quitar permiso de admin a este jugador en este servidor?")))
      return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/server-permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId, serverId }),
      })
      if (res.ok) {
        setFormSuccess("Permiso removido")
        refetch()
      }
    } catch {
      toast.error("Error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout
      title="Servidores Quake Live"
      subtitle="Gestión de permisos de admin en los servidores de juego"
    >
      {formSuccess && (
        <div className="mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 text-xs text-green-600 rounded">
          {formSuccess}
        </div>
      )}

      {/* ── ADMINS GLOBALES ───────────────────────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Admins Globales
            </h2>
            <p className="text-[9px] text-foreground/30 mt-0.5">
              Tienen admin en todos los servidores. Se gestionan desde{" "}
              <Link
                href="/admin/users"
                className="underline hover:text-foreground"
              >
                Usuarios
              </Link>
              .
            </p>
          </div>
          <span className="text-[10px] text-foreground/30 font-medium">
            {globalAdmins.length} jugadores
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="border border-foreground/[0.06] rounded-lg overflow-hidden">
            {globalAdmins.map((admin, i) => (
              <div
                key={admin.steamId}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i < globalAdmins.length - 1
                    ? "border-b border-foreground/[0.06]"
                    : ""
                } hover:bg-foreground/[0.02] transition-colors`}
              >
                <PlayerAvatar
                  steamId={admin.steamId}
                  playerName={admin.username}
                  avatarUrl={admin.avatar}
                  size="xs"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground truncate block">
                    {parseQuakeColors(admin.username)}
                  </span>
                </div>
                <UserRoleBadges roles={admin.roles as UserRole[]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── PERMISOS POR SERVIDOR ─────────────────────── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-1">
          Permisos por Servidor
        </h2>
        <p className="text-[9px] text-foreground/30 mb-3">
          Dar admin a un jugador en un servidor específico, sin que sea admin
          global.
        </p>

        {/* Server selector */}
        <div className="mb-4">
          <select
            value={selectedServer}
            onChange={(e) => {
              setSelectedServer(e.target.value)
              setSearch("")
              setSearchResults([])
            }}
            className="w-full max-w-sm h-9 px-3 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg text-xs text-foreground focus:outline-none focus:border-foreground/30 appearance-none cursor-pointer"
          >
            <option value="">— Seleccionar servidor —</option>
            {servers.map((s) => {
              const count = serverPermissions.filter(
                (p) => p.serverId === s.id
              ).length
              return (
                <option key={s.id} value={s.id}>
                  {s.name} (:{s.port})
                  {count > 0 ? ` · ${count} extra` : ""}
                </option>
              )
            })}
          </select>
        </div>

        {/* Selected server content */}
        {selectedServer && (
          <div className="border border-foreground/[0.06] rounded-lg overflow-hidden">
            {/* Admins on this server */}
            <div className="px-4 py-3 bg-foreground/[0.02] border-b border-foreground/[0.06]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                Admins extra en{" "}
                {servers.find((s) => s.id === selectedServer)?.name ||
                  selectedServer}
              </h3>
            </div>

            {permsForServer.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-foreground/30">
                  No hay admins extra en este servidor.
                </p>
                <p className="text-[9px] text-foreground/20 mt-1">
                  Los admins globales de arriba ya tienen acceso.
                </p>
              </div>
            ) : (
              permsForServer.map((perm, i) => (
                <div
                  key={perm.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    i < permsForServer.length - 1
                      ? "border-b border-foreground/[0.06]"
                      : ""
                  } hover:bg-foreground/[0.02] transition-colors`}
                >
                  <PlayerAvatar
                    steamId={perm.steamId}
                    playerName={perm.player.username}
                    avatarUrl={perm.player.avatar}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground block truncate">
                      {parseQuakeColors(perm.player.username)}
                    </span>
                    {perm.notes && (
                      <span className="text-[9px] text-black/25 block truncate">
                        {perm.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-foreground/30">
                    {new Date(perm.grantedAt).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() =>
                      removePermission(perm.steamId, perm.serverId)
                    }
                    disabled={saving}
                    className="px-2 py-1 text-[9px] font-bold uppercase text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50 rounded"
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}

            {/* Add player */}
            <div className="px-4 py-3 border-t border-foreground/[0.06] bg-black/[0.01]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
                Agregar Jugador
              </h3>
              <input
                type="text"
                placeholder="Buscar por nombre o Steam ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  searchPlayers(e.target.value)
                }}
                className="w-full max-w-sm h-8 px-3 bg-foreground/[0.03] border border-foreground/[0.06] rounded text-xs text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-foreground/30"
              />

              {searching && (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-3 h-3 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
                  <span className="text-[10px] text-foreground/40">
                    Buscando...
                  </span>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 border border-foreground/[0.06] rounded-lg overflow-hidden max-w-sm">
                  {searchResults.map((p) => {
                    const isGlobal = p.roles?.some((r) =>
                      ["admin", "mod", "founder"].includes(r)
                    )
                    const hasServerPerm = serverPermissions.some(
                      (sp) =>
                        sp.steamId === p.steamId &&
                        sp.serverId === selectedServer
                    )
                    return (
                      <div
                        key={p.steamId}
                        className="flex items-center justify-between px-3 py-2 border-b border-foreground/[0.06] last:border-b-0 hover:bg-foreground/[0.02]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar
                            steamId={p.steamId}
                            playerName={p.username}
                            avatarUrl={p.avatar}
                            size="xs"
                          />
                          <span className="text-xs text-foreground truncate">
                            {parseQuakeColors(p.username)}
                          </span>
                        </div>
                        {isGlobal ? (
                          <span className="text-[9px] text-green-600 font-bold uppercase ml-2 shrink-0">
                            Ya es Global
                          </span>
                        ) : hasServerPerm ? (
                          <span className="text-[9px] text-blue-500 font-bold uppercase ml-2 shrink-0">
                            Ya tiene
                          </span>
                        ) : (
                          <button
                            onClick={() => addPermission(p.steamId)}
                            disabled={saving}
                            className="ml-2 shrink-0 px-3 py-1 text-[10px] font-bold uppercase bg-foreground text-white hover:brightness-110 transition-all disabled:opacity-50 rounded"
                          >
                            {saving ? "..." : "Agregar"}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary: all server permissions */}
        {serverPermissions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-2">
              Resumen — Todos los permisos extra ({serverPermissions.length})
            </h3>
            <div className="border border-foreground/[0.06] rounded-lg overflow-hidden">
              {serverPermissions.map((perm, i) => (
                <div
                  key={perm.id}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    i < serverPermissions.length - 1
                      ? "border-b border-foreground/[0.06]"
                      : ""
                  } hover:bg-foreground/[0.02] transition-colors`}
                >
                  <PlayerAvatar
                    steamId={perm.steamId}
                    playerName={perm.player.username}
                    avatarUrl={perm.player.avatar}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate block">
                      {parseQuakeColors(perm.player.username)}
                    </span>
                  </div>
                  <span className="text-[10px] text-foreground/40 font-medium">
                    {servers.find((s) => s.id === perm.serverId)?.name ||
                      perm.serverId}
                  </span>
                  <button
                    onClick={() =>
                      removePermission(perm.steamId, perm.serverId)
                    }
                    disabled={saving}
                    className="px-2 py-1 text-[9px] font-bold uppercase text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50 rounded"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  )
}
