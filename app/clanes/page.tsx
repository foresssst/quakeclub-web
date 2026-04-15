import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { TierBadgeInline } from "@/components/tier-badge"
import { FlagClan } from "@/components/flag-clan"
import { RankValue } from "@/components/rank-value"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { parseQuakeColors } from "@/lib/quake-colors"

export const dynamic = "force-dynamic"

export default async function ClanesPage() {
  const session = await getSession()
  const t = await getTranslations("clans")

  // Si el usuario tiene sesion y clan, redirigir a su clan
  if (session?.user?.steamId) {
    const player = await prisma.player.findUnique({
      where: { steamId: session.user.steamId },
    })

    if (player) {
      const membership = await prisma.clanMember.findFirst({
        where: { playerId: player.id },
        include: { Clan: true },
      })

      if (membership) {
        redirect(`/clanes/${membership.Clan.slug}`)
      }
    }
  }

  // Obtener estadisticas globales
  const [totalClanes, totalMiembros, topClanes] = await Promise.all([
    prisma.clan.count(),
    prisma.clanMember.count(),
    prisma.clan.findMany({
      include: {
        ClanMember: {
          include: {
            Player: {
              include: {
                PlayerRating: { where: { gameType: "ca" } }
              }
            }
          }
        }
      }
    }),
  ])

  // Calcular ELO promedio de cada clan y ordenar
  const clanesConElo = topClanes
    .filter(clan => clan.ClanMember.length >= 4)
    .map(clan => {
      const totalElo = clan.ClanMember.reduce((sum, m) => {
        const rating = m.Player.PlayerRating[0]?.rating || 900
        return sum + rating
      }, 0)
      const avgElo = clan.ClanMember.length > 0 ? Math.round(totalElo / clan.ClanMember.length) : 900
      return { ...clan, avgElo }
    })
    .sort((a, b) => b.avgElo - a.avgElo)

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1100px] pt-8 sm:pt-12">
        <div className="space-y-4 sm:space-y-5 animate-fade-up">

          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex items-center justify-between">
              <div>
                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                  {t("title")}
                </h1>
                <p className="text-xs text-foreground/40 mt-1">{t("systemSubtitle")}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={session ? "/clanes/create" : "/login?returnTo=/clanes/create"}
                  className="rounded-lg bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-background transition-colors hover:opacity-90 sm:px-4 sm:text-xs"
                >
                  {t("create")}
                </Link>
                <Link
                  href="/clanes/rankings"
                  className="px-3 py-2 sm:px-4 bg-foreground/[0.05] text-foreground/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg border border-foreground/[0.08] hover:bg-foreground/[0.08] transition-colors hidden sm:block"
                >
                  {t("viewRankings")}
                </Link>
              </div>
            </ContentHeader>

            {/* Stats inline */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 p-3 sm:p-4 border-b border-foreground/[0.06]">
              <div className="text-center p-2.5 sm:p-3 bg-foreground/[0.02] rounded-lg">
                <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{totalClanes}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-foreground/32 sm:text-[10px]">{t("activeClans")}</p>
              </div>
              <div className="text-center p-2.5 sm:p-3 bg-foreground/[0.02] rounded-lg">
                <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{totalMiembros}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-foreground/32 sm:text-[10px]">{t("totalMembers")}</p>
              </div>
              <div className="text-center p-2.5 sm:p-3 bg-foreground/[0.02] rounded-lg">
                <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{clanesConElo.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-foreground/32 sm:text-[10px]">{t("ranked")}</p>
              </div>
              <div className="text-center p-2.5 sm:p-3 bg-foreground/[0.02] rounded-lg">
                <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">
                  {Math.round(totalMiembros / Math.max(totalClanes, 1) * 10) / 10}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-foreground/32 sm:text-[10px]">{t("avgMembers")}</p>
              </div>
            </div>

            {/* Header de tabla */}
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between mb-3 px-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/30">
                  {t("allClans")}
                </h2>
                <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-foreground/25">
                  <span className="w-10 text-center hidden sm:block">TIER</span>
                  <span className="w-12 text-center">{t("elo")}</span>
                  <span className="w-10 text-right">{t("mbr")}</span>
                </div>
              </div>

              {/* Lista de clanes */}
              {clanesConElo.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-foreground/30">{t("noClans")}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {clanesConElo.map((clan, index) => (
                    <Link
                      key={clan.id}
                      href={`/clanes/${clan.slug}`}
                      className={`flex items-center gap-3 py-2.5 px-3 transition-all hover:bg-foreground/[0.03] group rounded-lg ${
                        index < clanesConElo.length - 1 ? "border-b border-black/[0.03]" : ""
                      }`}
                    >
                      <RankValue rank={index + 1} totalPlayers={clanesConElo.length} className="w-7 text-center text-sm" showHash={true} />
                      <FlagClan
                        clanTag={clan.tag}
                        clanName={clan.name}
                        clanAvatar={clan.avatarUrl || undefined}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground/60 truncate group-hover:text-foreground/80 transition-colors block">
                          {clan.name}
                        </span>
                        <span className="text-[9px] font-mono leading-none text-foreground/24">
                          {parseQuakeColors(clan.inGameTag || `[${clan.tag}]`)}
                        </span>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <div className="w-10 flex justify-center">
                          <TierBadgeInline elo={clan.avgElo} gameType="ca" size="sm" />
                        </div>
                        <span className="w-12 text-center text-sm font-medium text-foreground/68">
                          {Math.round(clan.avgElo)}
                        </span>
                        <span className="w-10 text-right text-[11px] text-foreground/30">
                          {clan.ClanMember.length}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {clanesConElo.length > 0 && (
                <div className="mt-5 mb-4 text-center">
                  <Link
                    href="/clanes/rankings"
                    className="text-sm font-medium uppercase tracking-wider text-foreground/60 transition-colors hover:text-foreground"
                  >
                    {t("viewClanRankings")} →
                  </Link>
                </div>
              )}
            </div>
          </ContentContainer>

          {/* Info section */}
          <ContentContainer className="animate-scale-fade">
            <ContentHeader>
              <h2 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
                {t("clanInfo")}
              </h2>
            </ContentHeader>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="border-l-2 border-foreground/30 pl-4">
                <p className="text-[11px] text-foreground/50 leading-relaxed">{t("oneClanOnly")}</p>
              </div>
              <div className="border-l-2 border-foreground/30 pl-4">
                <p className="text-[11px] text-foreground/50 leading-relaxed">{t("autoElo")}</p>
              </div>
              <div className="border-l-2 border-foreground/30 pl-4">
                <p className="text-[11px] text-foreground/50 leading-relaxed">{t("minMembers")}</p>
              </div>
              <div className="border-l-2 border-foreground/30 pl-4">
                <p className="text-[11px] text-foreground/50 leading-relaxed">{t("foundersControl")}</p>
              </div>
            </div>
          </ContentContainer>

        </div>
      </div>
    </div>
  )
}
