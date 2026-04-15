"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"
import { IdentityBadges } from "@/components/identity-badges"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"
import { UserRoleBadges, type UserRole } from "@/components/user-role-badge"

interface GroupUser {
  id: string
  steamId: string
  username: string
  avatar: string | null
  countryCode: string | null
  roles: string[]
  lastSeen: string | null
  rating: number | null
  gamesPlayed: number
}

interface GroupData {
  role: {
    id: string
    name: string
    description: string
    color: string
    shortName: string
  }
  users: GroupUser[]
  totalUsers: number
}

const GROUPS = [
  { id: "founder", name: "Fundadores", shortName: "FUNDADOR", description: "Los creadores y fundadores de QuakeClub. Responsables de la visión y dirección del proyecto." },
  { id: "dev", name: "Desarrolladores", shortName: "DEV", description: "Equipo de desarrollo encargado de crear y mantener la plataforma." },
  { id: "admin", name: "Administradores", shortName: "ADMIN", description: "Administradores de la comunidad. Gestionan usuarios y contenido." },
  { id: "mod", name: "Moderadores", shortName: "MOD", description: "Moderadores que mantienen el orden y ayudan a los usuarios." },
]

export default function GroupPage() {
  const params = useParams()
  const router = useRouter()
  const role = params.role as string

  const [data, setData] = useState<GroupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGroup() {
      try {
        const response = await fetch(`/api/groups/${role}`)
        if (!response.ok) {
          throw new Error("Grupo no encontrado")
        }
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    if (role) {
      fetchGroup()
    }
  }, [role])

  const currentGroup = GROUPS.find((g) => g.id === role) || GROUPS[0]

  if (error) {
    return (
      <div className="relative min-h-screen">
        <div className="pt-8 sm:pt-12 mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12">
          <div className="max-w-[1100px] mx-auto">
            <ContentContainer>
              <div className="p-8 text-center">
                <h1 className="text-xl font-bold text-foreground mb-2 font-tiktok">Grupo no encontrado</h1>
                <p className="text-foreground/40 mb-4">{error}</p>
                <Link href="/" className="text-foreground hover:underline text-sm">
                  Volver al inicio
                </Link>
              </div>
            </ContentContainer>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="pt-8 sm:pt-12 mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12">
        <div className="max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
          {/* Top Ad - In-Feed */}

          <ContentContainer className="animate-scale-fade [animation-delay:200ms]">
            {/* Header */}
            <ContentHeader className="flex items-center justify-between relative">
              <div>
                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                  Equipo QuakeClub
                </h1>
                <p className="text-xs text-foreground/40 mt-1">Conoce al equipo detrás de la comunidad</p>
              </div>
            </ContentHeader>

            <div className="flex flex-col lg:flex-row">
              {/* LEFT SIDEBAR - Group Navigation */}
              <div className="lg:w-48 border-b lg:border-b-0 lg:border-r border-foreground/[0.06] bg-foreground/[0.02]">
                <div className="p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                    Grupos
                  </h3>
                  <div className="space-y-1">
                    {GROUPS.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => router.push(`/grupos/${group.id}`)}
                        className={`w-full text-left p-3 transition-all rounded-lg ${role === group.id
                          ? "bg-foreground/10 border-l-2 border-foreground"
                          : "hover:bg-black/5 border-l-2 border-transparent"
                          }`}
                      >
                        <div
                          className={`text-sm font-bold ${role === group.id ? "text-foreground" : "text-foreground/80"}`}
                        >
                          {group.shortName}
                        </div>
                        <div className="text-[10px] text-foreground/40 mt-0.5">{group.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 border-t border-foreground/[0.06]">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-3 font-tiktok">
                    Información
                  </h3>
                  <div className="space-y-2 text-[11px] text-foreground/50">
                    <p>El equipo de QuakeClub trabaja voluntariamente para mantener la comunidad activa.</p>
                    <p className="text-foreground font-medium">¿Interesado en ayudar? Contáctanos en Discord.</p>
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT */}
              <div className="flex-1 min-w-0">
                {/* Group Header Tab */}
                <div className="flex bg-foreground/[0.02] border-b border-foreground/[0.06]">
                  <div className="px-5 py-3 text-xs font-bold uppercase tracking-wider font-tiktok border-b-2 -mb-px text-foreground border-foreground bg-card/50">
                    {loading ? "..." : data?.role.name || currentGroup.name}
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-foreground/20">
                      {loading ? "..." : data?.totalUsers || 0}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {(data?.role.description || currentGroup.description) && (
                  <div className="px-4 py-3 bg-black/[0.01] border-b border-foreground/[0.06]">
                    <p className="text-[11px] text-foreground/40 leading-relaxed">
                      {data?.role.description || currentGroup.description}
                    </p>
                  </div>
                )}

                {/* Content */}
                {loading ? (
                  <LoadingScreen compact />
                ) : data && data.users.length > 0 ? (
                  <div className="p-4">
                    <div className="space-y-0.5">
                      {data.users.map((user) => (
                        <Link
                          key={user.id}
                          href={`/perfil/${user.steamId}`}
                          className="flex items-center gap-4 px-3 py-2.5 hover:bg-foreground/[0.03] transition-all rounded-lg group"
                        >
                          <PlayerAvatar
                            steamId={user.steamId}
                            playerName={user.username}
                            avatarUrl={user.avatar}
                            size="sm"
                          />
                          <IdentityBadges
                            countryCode={user.countryCode}
                            countryName={user.countryCode}
                            size="sm"
                            showTooltips={false}
                          />
                          <span className="text-xs text-foreground/80 truncate group-hover:text-foreground transition-colors font-medium uppercase text-shadow-sm">
                            {parseQuakeColors(user.username)}
                          </span>
                          <div className="hidden sm:flex items-center gap-1 ml-auto">
                            <UserRoleBadges
                              roles={user.roles.filter(r => r !== role) as UserRole[]}
                              disableLinks
                            />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-sm text-foreground/30">No hay miembros en este grupo</p>
                  </div>
                )}
              </div>
            </div>
          </ContentContainer>

          {/* Bottom Ad - Display */}
        </div>
      </div>
    </div>
  )
}
