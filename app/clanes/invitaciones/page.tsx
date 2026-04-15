"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { DEFAULT_CLAN_AVATAR } from "@/components/flag-clan"
import { LoadingScreen } from "@/components/loading-screen"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

interface ClanInvitation {
  id: string
  status: string
  message?: string
  createdAt: string
  Clan: {
    id: string
    name: string
    tag: string
    slug: string
    avatarUrl?: string
    memberCount: number
    averageElo: number
  }
  Inviter: {
    steamId: string
    username: string
    avatar?: string
  }
}

export default function InvitacionesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [responding, setResponding] = useState<string | null>(null)

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        router.push("/login?returnTo=/clanes/invitaciones")
        throw new Error("Not authenticated")
      }
      return res.json()
    },
  })

  const { data: invitationsData, isLoading } = useQuery({
    queryKey: ["clan", "invitations"],
    queryFn: async () => {
      const res = await fetch("/api/clans/invitations")
      if (!res.ok) throw new Error("Failed to fetch invitations")
      return res.json()
    },
    enabled: !!authData?.user,
  })

  async function handleRespond(invitationId: string, action: "accept" | "reject") {
    setResponding(invitationId)
    try {
      const res = await fetch(`/api/clans/invitations/${invitationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "Error al responder")
        return
      }

      alert(data.message)
      queryClient.invalidateQueries({ queryKey: ["clan", "invitations"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })

      if (action === "accept" && data.clan) {
        router.push(`/clanes/${data.clan.slug}`)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error al responder a la invitación")
    } finally {
      setResponding(null)
    }
  }

  const invitations: ClanInvitation[] = invitationsData?.invitations || []
  const pendingInvitations = invitations.filter((inv) => inv.status === "PENDING")

  if (!authData?.user) {
    return null
  }

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 max-w-[1100px] pb-16 pt-8 sm:pt-12 animate-fade-up">
        {/* Back Button */}
        <Link
          href="/clanes"
          className="inline-flex items-center gap-2 text-xs text-foreground/40 hover:text-foreground transition-colors mb-4 uppercase tracking-wider"
        >
          ← Volver a Clanes
        </Link>

        <ContentContainer className="animate-scale-fade [animation-delay:100ms]">
          <ContentHeader>
            <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
              Invitaciones de Clan
            </h1>
            <p className="text-xs text-foreground/40 mt-1">
              Invitaciones pendientes: <span className="text-foreground font-bold">{pendingInvitations.length}</span>
            </p>
          </ContentHeader>

          <div className="p-4 sm:p-6">
            {/* Loading */}
            {isLoading && (
              <LoadingScreen compact />
            )}

            {/* Empty State */}
            {!isLoading && pendingInvitations.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-foreground/40 mb-4 text-sm">No tienes invitaciones pendientes</p>
                <Link
                  href="/clanes/rankings"
                  className="inline-block bg-foreground hover:brightness-110 px-4 py-2 text-white font-bold uppercase tracking-wider text-xs rounded transition-all"
                >
                  Explorar Clanes
                </Link>
              </div>
            )}

            {/* Invitations List */}
            {!isLoading && pendingInvitations.length > 0 && (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="bg-foreground/[0.02] border border-foreground/[0.06] rounded-lg p-4 hover:border-foreground/20 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Clan Avatar */}
                      <div className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0 border border-foreground/[0.06]">
                        <Image
                          src={invitation.Clan.avatarUrl || DEFAULT_CLAN_AVATAR}
                          alt={invitation.Clan.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Invitation Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground">
                          [{invitation.Clan.tag}] {invitation.Clan.name}
                        </h3>
                        <p className="text-xs text-foreground/40 mt-0.5">
                          Invitado por <span className="text-foreground/60">{invitation.Inviter.username}</span>
                        </p>

                        {invitation.message && (
                          <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded p-2 mt-2 text-xs text-foreground/60">
                            {invitation.message}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-foreground/30 mt-2">
                          <span>{invitation.Clan.memberCount} miembros</span>
                          <span>•</span>
                          <span>ELO: {Math.round(invitation.Clan.averageElo)}</span>
                          <span>•</span>
                          <span>{new Date(invitation.createdAt).toLocaleDateString("es-ES")}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => handleRespond(invitation.id, "accept")}
                            disabled={responding === invitation.id}
                            className="bg-foreground hover:brightness-110 px-3 py-1.5 text-[10px] font-bold text-white uppercase tracking-wider rounded transition-all disabled:opacity-50"
                          >
                            {responding === invitation.id ? "..." : "Aceptar"}
                          </button>
                          <button
                            onClick={() => handleRespond(invitation.id, "reject")}
                            disabled={responding === invitation.id}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-[10px] font-bold text-red-500 uppercase tracking-wider rounded transition-all disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                          <Link
                            href={`/clanes/${invitation.Clan.slug}`}
                            className="bg-foreground/[0.05] hover:bg-black/10 border border-foreground/[0.06] px-3 py-1.5 text-[10px] font-bold text-foreground/60 uppercase tracking-wider rounded transition-all"
                          >
                            Ver Clan
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Invitations */}
          {!isLoading && invitations.some((inv) => inv.status !== "PENDING") && (
            <div className="px-4 sm:px-6 py-4 border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)]/50">
              <h2 className="text-[10px] font-bold text-foreground/30 uppercase tracking-wider mb-3">
                Historial
              </h2>
              <div className="space-y-2">
                {invitations
                  .filter((inv) => inv.status !== "PENDING")
                  .map((invitation) => (
                    <div
                      key={invitation.id}
                      className="bg-foreground/[0.02] border border-foreground/[0.06] rounded p-3 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs text-foreground/60">
                          [{invitation.Clan.tag}] {invitation.Clan.name}
                        </span>
                        <span className="text-[10px] text-foreground/30 ml-2">
                          de {invitation.Inviter.username}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          invitation.status === "ACCEPTED"
                            ? "bg-foreground/10 text-foreground border border-foreground/30"
                            : "bg-foreground/[0.06] text-foreground/40 border border-foreground/[0.08]"
                        }`}
                      >
                        {invitation.status === "ACCEPTED" ? "Aceptada" : "Rechazada"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </ContentContainer>
      </div>
    </div>
  )
}
