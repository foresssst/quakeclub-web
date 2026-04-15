"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"
import { IdentityBadges } from "@/components/identity-badges"
import { DEFAULT_CLAN_AVATAR } from "@/components/flag-clan"
import { LoadingScreen } from "@/components/loading-screen"
import { RankValue } from "@/components/rank-value"
import { TierBadge, TierBadgeInline } from "@/components/tier-badge"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

interface ClanMember {
  id: string
  playerId: string
  role: string
  joinedAt: string
  player: {
    id: string
    username: string
    steamId: string
    avatar?: string | null
    countryCode?: string
    PlayerRating?: Array<{
      rating: number
    }>
    ranking?: {
      rank: number | null
      totalPlayers: number
    } | null
  }
}

interface ClanDetail {
  id: string
  name: string
  tag: string
  inGameTag?: string
  description: string | null
  avatarUrl: string | null
  averageElo: number
  totalGames: number
  totalWins: number
  createdAt: string
  founder: {
    username: string
    steamId: string
  }
  memberCount: number
  members: ClanMember[]
}

interface ClanRanking {
  rank: number
  totalClans: number
}

const CLAN_GAME_MODES = [
  { id: "ca", label: "CA", name: "Clan Arena" },
  { id: "duel", label: "Duel", name: "Duel" },
  { id: "tdm", label: "TDM", name: "Team Deathmatch" },
  { id: "ctf", label: "CTF", name: "Capture The Flag" },
  { id: "ffa", label: "FFA", name: "Free For All" },
]

const CLAN_VALID_MODES = CLAN_GAME_MODES.map((mode) => mode.id)

function getMemberElo(member: ClanMember) {
  return Math.round(member.player.PlayerRating?.[0]?.rating || 900)
}

export default function ClanPageContent() {
  const params = useParams()
  const router = useRouter()
  const clanSlug = params.slug as string
  const { toast } = useToast()
  const success = (msg: string) => toast({ description: msg })
  const showError = (msg: string) => toast({ description: msg, variant: "destructive" })

  const [selectedMode, setSelectedMode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.slice(1).toLowerCase()
      if (CLAN_VALID_MODES.includes(hash)) {
        return hash
      }
    }
    return "ca"
  })

  useEffect(() => {
    const newHash = `#${selectedMode}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash)
    }
  }, [selectedMode])

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1).toLowerCase()
      if (CLAN_VALID_MODES.includes(hash) && hash !== selectedMode) {
        setSelectedMode(hash)
      }
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [selectedMode])

  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<ClanMember | null>(null)
  const [selectedNewFounder, setSelectedNewFounder] = useState<string>("")

  const [addMemberData, setAddMemberData] = useState({ playerSteamId: "" })
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [editData, setEditData] = useState({
    name: "",
    inGameTag: "",
    newTag: "",
    description: "",
  })
  const [editDataHydratedForClanId, setEditDataHydratedForClanId] = useState<string | null>(null)

  const [inviteMode, setInviteMode] = useState<"steamid" | "userlist">("userlist")

  const [addMemberLoading, setAddMemberLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [requestingToJoin, setRequestingToJoin] = useState(false)
  const [hasRequestedToJoin, setHasRequestedToJoin] = useState(false)

  const [addMemberError, setAddMemberError] = useState("")
  const [editError, setEditError] = useState("")

  const {
    data: clan,
    isFetched: clanFetched,
    error: clanError,
    refetch: refetchClanDetails,
  } = useQuery({
    queryKey: ["clan-detail", clanSlug, selectedMode],
    queryFn: async () => {
      const response = await fetch(`/api/clans/slug/${clanSlug}?gameType=${selectedMode}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el clan")
      }
      return data.clan as ClanDetail
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  // Fetch clan ranking
  const { data: clanRanking } = useQuery<ClanRanking | null>({
    queryKey: ["clan-ranking", clanSlug, selectedMode],
    queryFn: async () => {
      const response = await fetch(`/api/rankings/clans?gameType=${selectedMode}&limit=1000`)
      if (!response.ok) return null
      const data = await response.json()
      const clans = data.clans || []
      const idx = clans.findIndex((c: any) => c.slug === clanSlug)
      if (idx === -1) return null
      return { rank: idx + 1, totalClans: clans.length }
    },
    staleTime: 60 * 1000,
    enabled: !!clanSlug,
  })

  const { data: userRole = null, refetch: refetchUserRole } = useQuery({
    queryKey: ["user-clan-role", clanSlug],
    queryFn: async () => {
      const userResponse = await fetch("/api/auth/me")
      if (!userResponse.ok) return null

      const userData = await userResponse.json()
      const currentUserSteamId = userData.user?.steamId

      if (!currentUserSteamId) return null

      const response = await fetch(`/api/clans/slug/${clanSlug}`)
      const data = await response.json()

      if (response.ok && data.clan) {
        const member = data.clan.members.find((m: any) => m.player.steamId === currentUserSteamId)
        return member ? member.role : null
      }
      return null
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data: userClanMembership = null } = useQuery({
    queryKey: ["user-clan-membership"],
    queryFn: async () => {
      const userResponse = await fetch("/api/auth/me")
      if (!userResponse.ok) return null

      const userData = await userResponse.json()
      const steamId = userData.user?.steamId

      if (!steamId) return null

      const response = await fetch(`/api/clans/my-membership?steamId=${steamId}`)
      if (!response.ok) return null

      const data = await response.json()
      return data.clan || null
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data: registeredUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["registered-users", clanSlug],
    queryFn: async () => {
      const userResponse = await fetch("/api/auth/me")
      const userData = await userResponse.json()
      const currentUserSteamId = userData.user?.steamId

      const response = await fetch("/api/users/list")
      const data = await response.json()

      if (response.ok) {
        const currentMemberSteamIds = clan?.members.map((m) => m.player.steamId) || []
        return data.users.filter(
          (u: any) => u.steamId && !currentMemberSteamIds.includes(u.steamId) && u.steamId !== currentUserSteamId,
        )
      }
      return []
    },
    enabled: showAddMemberDialog && inviteMode === "userlist",
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (!clan || editDataHydratedForClanId === clan.id) return

    setEditData({
      name: clan.name,
      newTag: clan.tag,
      description: clan.description || "",
      inGameTag: clan.inGameTag || "",
    })
    setEditDataHydratedForClanId(clan.id)
  }, [clan, editDataHydratedForClanId])

  const handleAddMember = async () => {
    setAddMemberError("")
    setAddMemberLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberData),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddMemberError(data.error || "Error al agregar miembro")
        setAddMemberLoading(false)
        return
      }

      setShowAddMemberDialog(false)
      setAddMemberData({ playerSteamId: "" })
      setAddMemberLoading(false)
      refetchClanDetails()
      success(data.message || "Invitación enviada correctamente")
    } catch (err) {
      setAddMemberError("Error de conexión")
      setAddMemberLoading(false)
    }
  }

  const handleRemoveMember = async (member: ClanMember) => {
    setRemoveMemberLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/members/${member.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al eliminar miembro")
        setRemoveMemberLoading(false)
        return
      }

      setMemberToRemove(null)
      setRemoveMemberLoading(false)
      refetchClanDetails()
      success("Miembro eliminado correctamente")
    } catch (err) {
      showError("Error de conexión")
      setRemoveMemberLoading(false)
    }
  }

  const handleEditClan = async () => {
    setEditError("")
    setEditLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      })

      const data = await response.json()

      if (!response.ok) {
        setEditError(data.error || "Error al actualizar el clan")
        setEditLoading(false)
        return
      }

      setShowEditDialog(false)
      setEditLoading(false)

      if (data.clan?.slug && data.clan.slug !== clanSlug) {
        router.push(`/clanes/${data.clan.slug}`)
      } else {
        refetchClanDetails()
      }

      success("Clan actualizado correctamente")
    } catch (err) {
      setEditError("Error de conexión")
      setEditLoading(false)
    }
  }

  const handleDeleteClan = async () => {
    setDeleteLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/delete`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al eliminar el clan")
        setDeleteLoading(false)
        return
      }

      setDeleteLoading(false)
      success("Clan eliminado correctamente")
      router.push("/clanes/rankings")
    } catch (err) {
      showError("Error de conexión")
      setDeleteLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      showError("La imagen no puede superar los 10MB")
      return
    }

    if (!file.type.startsWith("image/")) {
      showError("Solo se permiten imágenes")
      return
    }

    setUploadingAvatar(true)

    try {
      const formData = new FormData()
      formData.append("avatar", file)

      const response = await fetch(`/api/clans/slug/${clanSlug}/avatar`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al subir el avatar")
        setUploadingAvatar(false)
        return
      }

      refetchClanDetails()
      setUploadingAvatar(false)
      success("Avatar actualizado correctamente")
    } catch (err) {
      showError("Error al subir el avatar")
      setUploadingAvatar(false)
    }
  }

  const handleRequestToJoin = async () => {
    setRequestingToJoin(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/join-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al enviar solicitud")
        setRequestingToJoin(false)
        return
      }

      setHasRequestedToJoin(true)
      setRequestingToJoin(false)
      success("Solicitud enviada correctamente. El clan recibirá tu solicitud.")
    } catch (err) {
      showError("Error de conexión")
      setRequestingToJoin(false)
    }
  }

  const handleLeaveClan = async () => {
    setLeaveLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/leave`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al abandonar el clan")
        setLeaveLoading(false)
        return
      }

      setShowLeaveDialog(false)
      setLeaveLoading(false)
      success(data.message || "Has abandonado el clan correctamente")
      refetchClanDetails()
      refetchUserRole()
    } catch (err) {
      showError("Error de conexión")
      setLeaveLoading(false)
    }
  }

  const handleTransferFounder = async () => {
    if (!selectedNewFounder) {
      showError("Debes seleccionar un nuevo fundador")
      return
    }

    setTransferLoading(true)

    try {
      const response = await fetch(`/api/clans/slug/${clanSlug}/transfer-founder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newFounderId: selectedNewFounder }),
      })

      const data = await response.json()

      if (!response.ok) {
        showError(data.error || "Error al transferir el rol de fundador")
        setTransferLoading(false)
        return
      }

      setShowTransferDialog(false)
      setSelectedNewFounder("")
      setTransferLoading(false)
      success(data.message || "Rol de fundador transferido correctamente")
      refetchClanDetails()
      refetchUserRole()
    } catch (err) {
      showError("Error de conexión")
      setTransferLoading(false)
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return "Fundador"
      case "ADMIN":
        return "Admin"
      case "MODERATOR":
        return "Moderador"
      default:
        return "Miembro"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getWinRate = (wins: number, total: number) => {
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  const error = clanError ? (clanError as Error).message : ""
  const isAdmin = userRole === "FOUNDER" || userRole === "ADMIN"
  const isFounder = userRole === "FOUNDER"
  const isMember = userRole !== null
  const winRate = clan ? getWinRate(clan.totalWins, clan.totalGames) : 0
  const losses = clan ? Math.max(0, clan.totalGames - clan.totalWins) : 0
  const topPlayer = clan
    ? [...clan.members].sort((a, b) => getMemberElo(b) - getMemberElo(a))[0] || null
    : null
  const selectedModeLabel = CLAN_GAME_MODES.find((mode) => mode.id === selectedMode)?.label || "CA"

  if (!clanFetched) {
    return <LoadingScreen />
  }

  if (error || !clan) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-fade-up">
        <ContentContainer>
          <div className="p-6">
            <Alert variant="destructive">
              <AlertDescription>{error || "Clan no encontrado"}</AlertDescription>
            </Alert>
            <button
              onClick={() => router.push("/clanes/rankings")}
              className="mt-4 rounded bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-all hover:opacity-90"
            >
              Volver a Rankings
            </button>
          </div>
        </ContentContainer>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-up">
      <ContentContainer className="animate-scale-fade [animation-delay:100ms]">
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <ContentHeader className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:gap-5">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <div className="relative flex-shrink-0 group/avatar">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] sm:h-20 sm:w-20">
                      <img
                        src={clan.avatarUrl || DEFAULT_CLAN_AVATAR}
                        alt={`${clan.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {isAdmin && (
                      <>
                        <label
                          htmlFor="avatar-upload"
                          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/55 opacity-0 transition-opacity group-hover/avatar:opacity-100"
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider text-white">
                            {uploadingAvatar ? "..." : "Cambiar"}
                          </span>
                        </label>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="font-tiktok text-xl font-bold uppercase tracking-wide text-foreground sm:text-2xl">
                      {clan.name}
                    </h1>
                    {clan.description ? (
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/46">
                        {clan.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-foreground/36">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/24">
                        Fundado por
                      </span>
                      <button
                        onClick={() => router.push(`/perfil/${clan.founder.steamId}`)}
                        className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                      >
                        <PlayerAvatar
                          steamId={clan.founder.steamId}
                          playerName={clan.founder.username}
                          size="xs"
                        />
                        <span className="text-[13px] font-medium text-foreground/64">
                          {parseQuakeColors(clan.founder.username)}
                        </span>
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/24">
                        Creado {formatDate(clan.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
                  {!userRole && !hasRequestedToJoin && !userClanMembership && (
                    <button
                      onClick={handleRequestToJoin}
                      disabled={requestingToJoin}
                      className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/70 transition-colors hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-50 sm:px-4 sm:text-xs"
                    >
                      {requestingToJoin ? "Enviando..." : "Solicitar unirse"}
                    </button>
                  )}
                  {hasRequestedToJoin && !userRole && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/38 sm:text-xs">
                      Solicitud enviada
                    </span>
                  )}
                  {!userRole && userClanMembership && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/38 sm:text-xs">
                      Ya perteneces a un clan
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => router.push(`/clanes/${clanSlug}/requests`)}
                      className="text-[10px] font-bold uppercase tracking-wider text-foreground/42 transition-colors hover:text-foreground sm:text-xs"
                    >
                      Solicitudes
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddMemberDialog(true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-foreground/42 transition-colors hover:text-foreground sm:text-xs"
                    >
                      Invitar
                    </button>
                  )}
                  {isFounder && (
                    <button
                      onClick={() => setShowEditDialog(true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-foreground/42 transition-colors hover:text-foreground sm:text-xs"
                    >
                      Editar
                    </button>
                  )}
                  {isFounder && (
                    <button
                      onClick={() => setShowTransferDialog(true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-foreground/42 transition-colors hover:text-foreground sm:text-xs"
                    >
                      Transferir
                    </button>
                  )}
                  {isFounder && (
                    <button
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-red-500/70 transition-colors hover:text-red-500 sm:text-xs"
                    >
                      Eliminar
                    </button>
                  )}
                  {isMember && !isFounder && (
                    <button
                      onClick={() => setShowLeaveDialog(true)}
                      className="text-[10px] font-bold uppercase tracking-wider text-red-500/70 transition-colors hover:text-red-500 sm:text-xs"
                    >
                      Abandonar
                    </button>
                  )}
                </div>
              </div>
            </ContentHeader>

            <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-4 py-2.5 sm:px-5 lg:px-6">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <span className="font-tiktok text-base font-bold tracking-wide text-foreground">
                    {clan.memberCount}
                  </span>
                  <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-muted)]">
                    miembros
                  </span>
                </div>
                <div>
                  <span className="font-tiktok text-base font-bold tracking-wide text-foreground">
                    {clan.totalWins}-{losses}
                  </span>
                  <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-muted)]">
                    record
                  </span>
                </div>
                <div>
                  <span className="font-tiktok text-base font-bold tracking-wide text-foreground">
                    {winRate}%
                  </span>
                  <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[var(--qc-text-muted)]">
                    win rate
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--qc-bg-page)] p-3 sm:p-4 lg:p-5">
              <div className="mb-4 flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-secondary p-0.5 mobile-hide-scrollbar">
                {CLAN_GAME_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`flex-shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                      selectedMode === mode.id
                        ? "bg-foreground text-background shadow-sm"
                        : "text-[var(--qc-text-muted)] hover:text-foreground"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="px-1 sm:px-2">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground/72">
                    Plantilla
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider text-foreground/25">
                    {selectedModeLabel}
                  </span>
                </div>

                <div className="overflow-hidden border-y border-foreground/[0.06]">
                  <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-3 py-2">
                    <div className="w-8 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">#</div>
                    <div className="flex-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">Jugador</div>
                    <div className="hidden w-9 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)] sm:block">Tier</div>
                    <div className="w-12 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">ELO</div>
                    <div className="w-12 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">Rank</div>
                    {isAdmin && <div className="w-14" />}
                  </div>

                  <div className="space-y-0">
                    {clan.members.map((member, idx) => {
                      const rating = getMemberElo(member)

                      return (
                        <div
                          key={member.id}
                          onClick={() => router.push(`/perfil/${member.player.steamId}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              router.push(`/perfil/${member.player.steamId}`)
                            }
                          }}
                          role="link"
                          tabIndex={0}
                          className="group flex cursor-pointer items-center gap-2 border-b border-foreground/[0.05] px-3 py-2.5 transition-all hover:bg-foreground/[0.018] focus-visible:bg-foreground/[0.04] focus-visible:outline-none last:border-b-0"
                        >
                          <div className="w-8 flex-shrink-0 text-center text-xs text-[var(--qc-text-muted)]">
                            {idx + 1}
                          </div>

                          <div className="qc-identity-inline min-w-0 flex-1 gap-2 sm:gap-3">
                            <span className="qc-identity-inline__avatar">
                              <PlayerAvatar
                                steamId={member.player.steamId}
                                playerName={member.player.username}
                                size="sm"
                              />
                            </span>
                            <IdentityBadges
                              className="qc-identity-inline__badges"
                              countryCode={member.player.countryCode}
                              countryName={member.player.countryCode}
                              size="sm"
                              showTooltips={false}
                            />
                            <span className="qc-identity-inline__name truncate text-[13px] font-medium text-[var(--qc-text-secondary)] transition-colors group-hover:text-foreground">
                              {parseQuakeColors(member.player.username)}
                            </span>
                          </div>

                          <div className="hidden w-9 flex-shrink-0 justify-center sm:flex icon-shadow">
                            <TierBadgeInline elo={rating} gameType={selectedMode} size="sm" />
                          </div>
                          <span className="w-12 flex-shrink-0 text-center text-[13px] font-medium tabular-nums text-foreground">
                            {rating}
                          </span>
                          <span className="w-12 flex-shrink-0 text-center text-[11px] text-[var(--qc-text-secondary)]">
                            {member.player.ranking?.rank ? `#${member.player.ranking.rank}` : "—"}
                          </span>
                          {isAdmin && (
                            <div className="w-14 text-right">
                              {member.role !== "FOUNDER" ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setMemberToRemove(member)
                                  }}
                                  className="text-[9px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:text-red-600"
                                >
                                  Quitar
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
            <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                  Tier
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <span className="icon-shadow">
                    <TierBadge elo={clan.averageElo} gameType={selectedMode} size="xl" showTooltip={true} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground">{Math.round(clan.averageElo)}</p>
                    <p className="text-[10px] uppercase text-foreground/40">{selectedModeLabel} ELO</p>
                  </div>
                </div>
              </div>

              {clanRanking ? (
                <button
                  onClick={() => router.push(`/clanes/rankings?gameType=${selectedMode.toLowerCase()}`)}
                  className="block w-full space-y-2 border-t border-foreground/[0.06] pt-4 text-left transition-colors hover:text-foreground"
                >
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                    Ranking global
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <RankValue
                      rank={clanRanking.rank}
                      totalPlayers={clanRanking.totalClans}
                      className="text-3xl"
                      showHash={true}
                      variant="flat"
                    />
                    <span className="text-xs uppercase text-foreground/40">{selectedModeLabel}</span>
                  </div>
                  <p className="text-[10px] text-foreground/30">
                    de {clanRanking.totalClans} clanes
                  </p>
                </button>
              ) : null}

              <div className="space-y-3 border-t border-foreground/[0.06] pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                  Record
                </h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/50">Win rate</span>
                    <span className="font-bold text-foreground">{winRate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-500"
                      style={{ width: `${winRate}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{clan.totalWins}</p>
                    <p className="text-[9px] uppercase text-foreground/30">Victorias</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{losses}</p>
                    <p className="text-[9px] uppercase text-foreground/30">Derrotas</p>
                  </div>
                </div>
                <p className="text-center text-[10px] text-[var(--qc-text-muted)]">
                  {clan.totalGames} partidas totales
                </p>
              </div>

              <div className="space-y-3 border-t border-foreground/[0.06] pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                  Identidad
                </h3>
                {topPlayer ? (
                  <div
                    onClick={() => router.push(`/perfil/${topPlayer.player.steamId}`)}
                    className="flex cursor-pointer items-center gap-3 transition-colors hover:text-foreground"
                  >
                    <PlayerAvatar
                      steamId={topPlayer.player.steamId}
                      playerName={topPlayer.player.username}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)]">
                        Franquicia
                      </p>
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {parseQuakeColors(topPlayer.player.username)}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2.5 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--qc-text-secondary)]">Tag</span>
                    <span className="font-bold text-foreground">{parseQuakeColors(clan.inGameTag || `[${clan.tag}]`)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--qc-text-secondary)]">Fundador</span>
                    <button
                      onClick={() => router.push(`/perfil/${clan.founder.steamId}`)}
                      className="font-medium text-foreground transition-opacity hover:opacity-75"
                    >
                      {parseQuakeColors(clan.founder.username)}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--qc-text-secondary)]">Creacion</span>
                    <span className="text-foreground">{formatDate(clan.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </ContentContainer>

      {/* Dialogs */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-foreground">Invitar Jugador al Clan</DialogTitle>
            <DialogDescription className="text-foreground/50">Envía una invitación a un jugador.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {addMemberError && (
              <Alert variant="destructive">
                <AlertDescription>{addMemberError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 p-1 bg-black/5 rounded">
              <button
                onClick={() => setInviteMode("userlist")}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${inviteMode === "userlist" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"
                  }`}
              >
                Usuario Registrado
              </button>
              <button
                onClick={() => setInviteMode("steamid")}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${inviteMode === "steamid" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"
                  }`}
              >
                Steam ID
              </button>
            </div>

            {inviteMode === "userlist" ? (
              <div className="space-y-2">
                <Label htmlFor="searchUser" className="text-foreground/70 text-xs">
                  Buscar jugador
                </Label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-6">
                    <span className="text-xs text-foreground animate-pulse">Cargando usuarios...</span>
                  </div>
                ) : registeredUsers.length > 0 ? (
                  <div className="relative">
                    <Input
                      id="searchUser"
                      placeholder="Buscar por nombre..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value)
                        setShowUserDropdown(true)
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      className="bg-black/5 border-foreground/[0.06] text-foreground"
                      autoComplete="off"
                    />
                    {addMemberData.playerSteamId && (
                      <div className="mt-2 flex items-center justify-between p-2 bg-foreground/10 border border-foreground/30 rounded text-sm">
                        <div>
                          <span className="text-foreground text-xs">Seleccionado: </span>
                          <span className="text-foreground font-medium">
                            {registeredUsers.find((u: any) => u.steamId === addMemberData.playerSteamId)?.username}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setAddMemberData({ playerSteamId: "" })
                            setUserSearchQuery("")
                          }}
                          className="text-xs font-bold uppercase text-foreground/40 hover:text-foreground"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                    {showUserDropdown && userSearchQuery && (
                      <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-foreground/[0.06] bg-card shadow-xl">
                        {registeredUsers
                          .filter((user: any) =>
                            user.username.toLowerCase().includes(userSearchQuery.toLowerCase())
                          )
                          .slice(0, 20)
                          .map((user: any) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setAddMemberData({ playerSteamId: user.steamId })
                                setUserSearchQuery("")
                                setShowUserDropdown(false)
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                            >
                              {user.avatar && (
                                <img src={user.avatar || "/branding/logo.png"} alt="" className="w-6 h-6 rounded object-cover" />
                              )}
                              <span>{user.username}</span>
                            </button>
                          ))}
                        {registeredUsers.filter((user: any) =>
                          user.username.toLowerCase().includes(userSearchQuery.toLowerCase())
                        ).length === 0 && (
                            <p className="px-3 py-4 text-sm text-foreground/40 text-center">
                              No se encontraron jugadores
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-foreground/40 py-4 text-center">No hay usuarios disponibles</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="addSteamId" className="text-foreground/70 text-xs">
                  Steam ID64
                </Label>
                <Input
                  id="addSteamId"
                  placeholder="76561198..."
                  value={addMemberData.playerSteamId}
                  onChange={(e) => setAddMemberData({ playerSteamId: e.target.value })}
                  className="bg-black/5 border-foreground/[0.06] text-foreground"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddMemberDialog(false)
                setAddMemberData({ playerSteamId: "" })
                setUserSearchQuery("")
                setShowUserDropdown(false)
                setAddMemberError("")
              }}
              disabled={addMemberLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addMemberLoading || !addMemberData.playerSteamId}
              className="bg-foreground text-background hover:opacity-90"
            >
              {addMemberLoading ? "Enviando..." : "Enviar Invitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-foreground">Editar Clan</DialogTitle>
            <DialogDescription className="text-foreground/50">Modifica la información del clan.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="editName" className="text-foreground/70 text-xs">
                Nombre del Clan
              </Label>
              <Input
                id="editName"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="bg-black/5 border-foreground/[0.06] text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editTag" className="text-foreground/70 text-xs">
                Tag (URL)
              </Label>
              <Input
                id="editTag"
                value={editData.newTag}
                onChange={(e) => setEditData({ ...editData, newTag: e.target.value.toLowerCase() })}
                className="bg-black/5 border-foreground/[0.06] text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editInGameTag" className="text-foreground/70 text-xs">
                Tag In-Game (interno, con colores Quake)
              </Label>
              <Input
                id="editInGameTag"
                value={editData.inGameTag}
                onChange={(e) => setEditData({ ...editData, inGameTag: e.target.value })}
                className="bg-black/5 border-foreground/[0.06] text-foreground font-mono"
                placeholder="^1R^7S"
              />
              <p className="text-[11px] text-muted-foreground">Solo visible en el juego</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription" className="text-foreground/70 text-xs">
                Descripción
              </Label>
              <Textarea
                id="editDescription"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="bg-black/5 border-foreground/[0.06] text-foreground min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={editLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditClan}
              disabled={editLoading}
              className="bg-foreground text-background hover:opacity-90"
            >
              {editLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Clan Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-red-500">Eliminar Clan</DialogTitle>
            <DialogDescription className="text-foreground/50">
              Esta acción no se puede deshacer. El clan y todos sus datos serán eliminados permanentemente.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteClan}
              disabled={deleteLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteLoading ? "Eliminando..." : "Eliminar Clan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-red-500">Eliminar Miembro</DialogTitle>
            <DialogDescription className="text-foreground/50">
              ¿Estás seguro de que deseas eliminar a{" "}
              <span className="text-foreground font-medium">{memberToRemove?.player.username}</span> del clan?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeMemberLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              disabled={removeMemberLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {removeMemberLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Clan Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-red-500">Abandonar Clan</DialogTitle>
            <DialogDescription className="text-foreground/50">
              ¿Estás seguro de que deseas abandonar <span className="text-foreground font-medium">{clan?.name}</span>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
              disabled={leaveLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLeaveClan}
              disabled={leaveLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {leaveLoading ? "Abandonando..." : "Abandonar Clan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Founder Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="bg-card border-foreground/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-tiktok text-blue-600">Transferir Rol de Fundador</DialogTitle>
            <DialogDescription className="text-foreground/50">
              Selecciona al nuevo fundador del clan. Tú pasarás a ser Administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newFounder" className="text-foreground/70 text-xs">
                Nuevo Fundador
              </Label>
              <select
                id="newFounder"
                value={selectedNewFounder}
                onChange={(e) => setSelectedNewFounder(e.target.value)}
                className="w-full bg-black/5 border border-foreground/[0.06] text-foreground rounded px-3 py-2 text-sm focus:border-foreground focus:outline-none"
              >
                <option value="">-- Selecciona un miembro --</option>
                {clan?.members
                  .filter((m) => m.role !== "FOUNDER")
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.player.username} ({getRoleName(member.role)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferDialog(false)
                setSelectedNewFounder("")
              }}
              disabled={transferLoading}
              className="border-foreground/[0.06] text-foreground/70 hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTransferFounder}
              disabled={transferLoading || !selectedNewFounder}
              className="bg-foreground text-background hover:opacity-90"
            >
              {transferLoading ? "Transfiriendo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Ad - Display */}
    </div>
  )
}
