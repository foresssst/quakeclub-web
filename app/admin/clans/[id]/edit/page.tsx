"use client"
import { systemConfirm } from "@/components/ui/system-modal"
import { toast } from "sonner"

import { useState, use, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"
import { ConfirmDialog } from "@/components/confirm-dialog-new"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Member {
  id: string
  playerId: string
  steamId: string
  username: string
  avatar?: string
  role: string
  joinedAt: string
  rating: number
}

interface Clan {
  id: string
  name: string
  tag: string
  inGameTag?: string
  description?: string
  avatarUrl?: string
  averageElo: number
  founderId?: string
  members: Member[]
  pendingInvitations: any[]
  pendingRequests: any[]
}

interface Player {
  id: string
  steamId: string
  username: string
  avatar?: string
}

export default function EditClanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const clanId = resolvedParams.id
  const router = useRouter()
  const queryClient = useQueryClient()

  // Form states
  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  const [inGameTag, setInGameTag] = useState("")
  const [description, setDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Member management states
  const [newMemberSteamId, setNewMemberSteamId] = useState("")
  const [newMemberRole, setNewMemberRole] = useState("MEMBER")
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false)
  const playerDropdownRef = useRef<HTMLDivElement>(null)
  const [playerSearch, setPlayerSearch] = useState("")

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(event.target as Node)) {
        setShowPlayerDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  const [changeRoleDialog, setChangeRoleDialog] = useState<{
    open: boolean
    member: Member | null
    newRole: string
  }>({ open: false, member: null, newRole: "" })
  const [removeMemberDialog, setRemoveMemberDialog] = useState<{
    open: boolean
    member: Member | null
  }>({ open: false, member: null })

  // Auth check
  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/admin/clans")
        throw new Error("Not authenticated")
      }
      const data = await res.json()
      if (!data.user.isAdmin) {
        router.push("/")
        throw new Error("Not admin")
      }
      return data
    },
  })

  // Fetch clan data
  const { data: clanData, isLoading } = useQuery({
    queryKey: ["admin", "clan", clanId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/clans/${clanId}`)
      if (!res.ok) throw new Error("Failed to fetch clan")
      const data = await res.json()
      // Initialize form with clan data
      setName(data.clan.name)
      setTag(data.clan.tag)
      setInGameTag(data.clan.inGameTag || "")
      setDescription(data.clan.description || "")
      return data.clan as Clan
    },
    enabled: !!authData?.user?.isAdmin,
  })

  const clan = clanData

  // Fetch available players (not in any clan)
  const { data: playersData } = useQuery({
    queryKey: ["admin", "players", "available"],
    queryFn: async () => {
      const res = await fetch("/api/admin/players/available")
      if (!res.ok) throw new Error("Failed to fetch available players")
      const data = await res.json()
      return data.players || []
    },
    enabled: !!authData?.user?.isAdmin,
    staleTime: 1 * 60 * 1000,
  })

  const availablePlayers: Player[] = playersData || []

  // Filter players based on search
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return availablePlayers

    const searchLower = playerSearch.toLowerCase()
    return availablePlayers.filter(
      (player) =>
        player.username.toLowerCase().includes(searchLower) ||
        player.steamId.includes(searchLower)
    )
  }, [availablePlayers, playerSearch])

  // Update clan info
  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/clans/${clanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag, inGameTag, description }),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        queryClient.invalidateQueries({ queryKey: ["admin", "clans"] })
        toast.success("Clan actualizado correctamente")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al actualizar clan")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al actualizar clan")
    } finally {
      setIsSaving(false)
    }
  }

  // Upload avatar
  async function handleAvatarUpload() {
    if (!avatarFile) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("avatar", avatarFile)

      const res = await fetch(`/api/admin/clans/${clanId}/avatar`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        setAvatarFile(null)
        setAvatarPreview(null)
        toast.success("Avatar actualizado correctamente")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al subir avatar")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al subir avatar")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // Delete avatar
  async function handleDeleteAvatar() {
    if (!(await systemConfirm("¿Eliminar avatar del clan?"))) return

    try {
      const res = await fetch(`/api/admin/clans/${clanId}/avatar`, {
        method: "DELETE",
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        toast.success("Avatar eliminado")
      } else {
        toast.error("Error al eliminar avatar")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al eliminar avatar")
    }
  }

  // Add member
  async function handleAddMember() {
    if (!newMemberSteamId.trim()) {
      toast.warning("Ingresa el Steam ID del jugador")
      return
    }

    setIsAddingMember(true)
    try {
      const res = await fetch(`/api/admin/clans/${clanId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId: newMemberSteamId.trim(),
          role: newMemberRole,
        }),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        queryClient.invalidateQueries({ queryKey: ["admin", "players", "available"] })
        setNewMemberSteamId("")
        setNewMemberRole("MEMBER")
        setPlayerSearch("")
        toast.success("Miembro agregado correctamente")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al agregar miembro")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al agregar miembro")
    } finally {
      setIsAddingMember(false)
    }
  }

  // Change member role
  async function handleChangeRole() {
    const { member, newRole } = changeRoleDialog
    if (!member) return

    try {
      const res = await fetch(`/api/admin/clans/${clanId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          newRole,
        }),
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        setChangeRoleDialog({ open: false, member: null, newRole: "" })
        toast.success("Rol cambiado correctamente")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al cambiar rol")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al cambiar rol")
    }
  }

  // Remove member
  async function handleRemoveMember() {
    const { member } = removeMemberDialog
    if (!member) return

    try {
      const res = await fetch(`/api/admin/clans/${clanId}/members?memberId=${member.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "clan", clanId] })
        setRemoveMemberDialog({ open: false, member: null })
        toast.success("Miembro eliminado")
      } else {
        const data = await res.json()
        toast.error(data.error || "Error al eliminar miembro")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al eliminar miembro")
    }
  }

  // Handle avatar file selection
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!authData?.user?.isAdmin) {
    return null
  }

  if (isLoading || !clan) {
    return (
      <AdminLayout title="Cargando..." subtitle="">
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Editar Clan" subtitle={`[${clan.tag}] ${clan.name}`}>
      <div className="mb-4">
        <Link
          href="/admin/clans"
          className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
        >
          ← Volver
        </Link>
      </div>

      <div className="space-y-6">
        {/* Clan Info Section */}
        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Informacion del Clan
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-foreground/60 mb-2">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-foreground/[0.04] border border-foreground/10 px-4 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                placeholder="Nombre del clan"
              />
            </div>

            <div>
              <label className="block text-xs text-foreground/60 mb-2">Tag</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={6}
                className="w-full bg-foreground/[0.04] border border-foreground/10 px-4 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
                placeholder="TAG"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-foreground/60 mb-2">In-Game Tag (para servidores)</label>
              <input
                type="text"
                value={inGameTag}
                onChange={(e) => setInGameTag(e.target.value)}
                className="w-full bg-foreground/[0.04] border border-foreground/10 px-4 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none font-mono"
                placeholder="ej: ^1QM, ^4CLAN"
              />
              <p className="mt-1 text-[10px] text-foreground/40">
                Tag con colores de Quake para mostrar en servidores (soporta ^1 ^2 etc.)
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-foreground/60 mb-2">Descripcion</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-foreground/[0.04] border border-foreground/10 px-4 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none resize-none"
                placeholder="Descripcion del clan (opcional)"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-4 bg-foreground px-6 py-2 text-xs font-bold text-white uppercase tracking-wider transition-colors hover:bg-[#d4b76e] disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>

        {/* Avatar Section */}
        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Avatar</h2>

          <div className="flex items-start gap-6">
            <div className="w-32 h-32 bg-card border border-foreground/10 flex items-center justify-center">
              {avatarPreview ? (
                <Image src={avatarPreview} alt="Preview" width={128} height={128} className="w-full h-full object-cover" />
              ) : clan.avatarUrl ? (
                <Image src={clan.avatarUrl} alt={clan.name} width={128} height={128} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-foreground/20 font-bold">{clan.tag.substring(0, 2)}</span>
              )}
            </div>

            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="mb-3 text-xs text-foreground/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAvatarUpload}
                  disabled={!avatarFile || isUploadingAvatar}
                  className="bg-foreground px-4 py-2 text-xs font-bold text-white uppercase tracking-wider transition-colors hover:bg-[#d4b76e] disabled:opacity-50"
                >
                  {isUploadingAvatar ? "Subiendo..." : "Subir Avatar"}
                </button>
                {clan.avatarUrl && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-500 uppercase tracking-wider transition-colors hover:bg-red-500/20"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Miembros ({clan.members.length})
          </h2>

          {/* Add Member Form */}
          <div className="mb-6 p-4 bg-black/5 border border-foreground/10">
            <h3 className="text-xs font-bold text-foreground/80 uppercase mb-3">Agregar Miembro</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative" ref={playerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowPlayerDropdown(!showPlayerDropdown)}
                  className="flex items-center justify-between w-full h-10 px-3 bg-foreground/[0.04] border border-foreground/10 text-sm"
                >
                  <span className={newMemberSteamId ? "text-foreground" : "text-foreground/40"}>
                    {newMemberSteamId
                      ? availablePlayers.find(p => p.steamId === newMemberSteamId)?.username || newMemberSteamId
                      : "Selecciona un jugador"}
                  </span>
                  <svg className={`w-3 h-3 transition-transform ${showPlayerDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPlayerDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-[var(--qc-bg-pure)] border border-foreground/10 shadow-xl max-h-[300px] overflow-hidden">
                    <div className="px-2 py-1.5 border-b border-foreground/10">
                      <input
                        type="text"
                        placeholder="Buscar jugador..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="w-full h-8 bg-foreground/[0.04] border border-foreground/10 px-2 text-foreground text-xs focus:border-foreground/50 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-[240px]">
                      {filteredPlayers.length === 0 ? (
                        <div className="py-6 text-center text-sm text-foreground/40">
                          {availablePlayers.length === 0
                            ? "No hay jugadores disponibles"
                            : "No se encontraron jugadores"}
                        </div>
                      ) : (
                        filteredPlayers.map((player) => (
                          <button
                            key={player.steamId}
                            type="button"
                            onClick={() => {
                              setNewMemberSteamId(player.steamId)
                              setShowPlayerDropdown(false)
                              setPlayerSearch("")
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-foreground/[0.05] transition-colors ${newMemberSteamId === player.steamId ? "bg-foreground/[0.08]" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              {player.avatar && (
                                <Image
                                  src={player.avatar}
                                  alt={player.username}
                                  width={20}
                                  height={20}
                                  className="rounded-lg"
                                />
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm text-foreground">{player.username}</span>
                                <span className="text-[10px] text-foreground/40">{player.steamId}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="bg-foreground/[0.04] border border-foreground/10 px-3 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
              >
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="FOUNDER">FOUNDER</option>
              </select>
              <button
                onClick={handleAddMember}
                disabled={isAddingMember}
                className="bg-foreground px-6 py-2 text-xs font-bold text-white uppercase tracking-wider transition-colors hover:bg-[#d4b76e] disabled:opacity-50"
              >
                {isAddingMember ? "..." : "Agregar"}
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {clan.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4 bg-black/5 border border-foreground/10 transition-colors hover:bg-black/[0.07]"
              >
                {member.avatar ? (
                  <Image
                    src={member.avatar}
                    alt={member.username}
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="w-10 h-10 bg-black/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-foreground/40">?</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{member.username}</div>
                  <div className="text-xs text-foreground/40">{member.steamId}</div>
                </div>
                <div className="text-xs font-bold text-foreground">{member.rating}</div>
                <div className={`px-3 py-1 text-xs font-bold uppercase ${
                  member.role === "FOUNDER"
                    ? "bg-foreground/20 text-foreground"
                    : member.role === "ADMIN"
                    ? "bg-blue-500/20 text-blue-600"
                    : "bg-black/10 text-foreground/60"
                }`}>
                  {member.role}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setChangeRoleDialog({
                        open: true,
                        member,
                        newRole: member.role === "MEMBER" ? "ADMIN" : "MEMBER",
                      })
                    }
                    className="bg-black/5 border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-black/10 uppercase"
                  >
                    Cambiar Rol
                  </button>
                  <button
                    onClick={() => setRemoveMemberDialog({ open: true, member })}
                    className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 uppercase"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change Role Dialog */}
      <ConfirmDialog
        open={changeRoleDialog.open}
        onOpenChange={(open) =>
          setChangeRoleDialog({ ...changeRoleDialog, open })
        }
        title="Cambiar Rol"
        description={
          <div>
            <p className="mb-4">
              ¿Cambiar rol de <strong>{changeRoleDialog.member?.username}</strong>?
            </p>
            <select
              value={changeRoleDialog.newRole}
              onChange={(e) =>
                setChangeRoleDialog({ ...changeRoleDialog, newRole: e.target.value })
              }
              className="w-full bg-foreground/[0.04] border border-foreground/10 px-3 py-2 text-sm text-foreground focus:border-foreground/50 focus:outline-none"
            >
              <option value="FOUNDER">FOUNDER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
            </select>
          </div>
        }
        onConfirm={handleChangeRole}
        confirmText="Cambiar"
        cancelText="Cancelar"
      />

      {/* Remove Member Dialog */}
      <ConfirmDialog
        open={removeMemberDialog.open}
        onOpenChange={(open) =>
          setRemoveMemberDialog({ ...removeMemberDialog, open })
        }
        title="Quitar Miembro"
        description={`¿Estas seguro de que quieres quitar a ${removeMemberDialog.member?.username} del clan?`}
        onConfirm={handleRemoveMember}
        confirmText="Quitar"
        cancelText="Cancelar"
        variant="danger"
      />
    </AdminLayout>
  )
}
