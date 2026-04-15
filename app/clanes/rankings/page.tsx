import Link from "next/link"
import { getTopClans } from "@/lib/rankings-service"
import { getTranslations } from "next-intl/server"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { FlagClan } from "@/components/flag-clan"
import { RankValue } from "@/components/rank-value"
import { TierBadgeInline } from "@/components/tier-badge"
import { parseQuakeColors } from "@/lib/quake-colors"

export const revalidate = 60

export default async function ClanRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gameType?: string }>
}) {
  const { gameType: rawGameType } = await searchParams
  const gameType = rawGameType || "ca"
  const t = await getTranslations("clans")

  const clans = await getTopClans(50, gameType)

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 max-w-[1400px] pt-4 sm:pt-10">
        <div className="max-w-[1080px] mx-auto space-y-4 sm:space-y-5 animate-fade-up">
          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex-col items-stretch gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                    {t("clanRankings")}
                  </h1>
                  <span className="mt-0.5 block text-[10px] tracking-wide text-[var(--qc-text-muted)]">
                    {clans.length} {t("clansRegistered")}
                  </span>
                </div>
                <div className="flex gap-0.5 flex-wrap rounded-lg bg-secondary p-0.5 overflow-x-auto mobile-hide-scrollbar">
                  {["ca", "duel", "tdm", "ctf", "ffa"].map((mode) => (
                    <Link
                      key={mode}
                      href={`/clanes/rankings?gameType=${mode}`}
                      className={`px-3 py-1.5 sm:px-2.5 sm:py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md flex-shrink-0 ${
                        gameType === mode ? "bg-foreground text-background shadow-sm" : "text-[var(--qc-text-muted)] hover:text-foreground"
                      }`}
                    >
                      {mode.toUpperCase()}
                    </Link>
                  ))}
                </div>
              </div>
            </ContentHeader>

            <div className="p-2 sm:p-4">
              {clans.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-[var(--qc-text-secondary)]">{t("noClans")}</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 border-b border-foreground/[0.06]">
                    <div className="w-8 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">#</div>
                    <div className="flex-1 text-[9px] font-bold uppercase text-[var(--qc-text-muted)]">{t("clan")}</div>
                    <div className="w-9 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">TIER</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)]">ELO</div>
                    <div className="w-10 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("kd")}</div>
                    <div className="w-12 text-[9px] font-bold uppercase text-center text-[var(--qc-text-muted)] hidden sm:block">{t("mbr")}</div>
                  </div>

                  <div className="space-y-0">
                    {clans.map((clan, index) => (
                      <Link
                        key={clan.slug}
                        href={`/clanes/${clan.slug}`}
                        className="flex items-center gap-2 w-full border-b border-foreground/[0.05] py-2 sm:py-1.5 px-2 transition-all hover:bg-foreground/[0.02] rounded-lg group"
                      >
                        <RankValue
                          rank={index + 1}
                          totalPlayers={clans.length}
                          className="w-8 text-center text-xs flex-shrink-0"
                          showHash={true}
                          variant="flat"
                        />

                        <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
                          <span className="flex-shrink-0 icon-shadow">
                            <FlagClan
                              clanTag={clan.tag}
                              clanName={clan.name}
                              clanAvatar={clan.avatarUrl || undefined}
                              size="lg"
                              showTooltip={false}
                            />
                          </span>

                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] text-[var(--qc-text-secondary)] truncate group-hover:text-foreground transition-colors">
                              {clan.name}
                            </span>
                            <span className="text-[10px] text-[var(--qc-text-muted)] font-mono leading-none">
                              {parseQuakeColors(clan.inGameTag || `[${clan.tag}]`)}
                            </span>
                          </div>
                        </div>

                        <div className="w-9 hidden sm:flex justify-center flex-shrink-0 icon-shadow">
                          <TierBadgeInline elo={Math.round(clan.avgElo)} gameType={gameType} size="sm" />
                        </div>

                        <div className="flex items-center gap-1.5 sm:w-12 flex-shrink-0">
                          <span className="sm:hidden icon-shadow">
                            <TierBadgeInline elo={Math.round(clan.avgElo)} gameType={gameType} size="sm" />
                          </span>
                          <span className="text-[13px] text-center text-foreground font-medium tabular-nums">
                            {Math.round(clan.avgElo)}
                          </span>
                        </div>

                        <span className="w-10 text-[11px] text-center text-[var(--qc-text-secondary)] hidden sm:block flex-shrink-0 tabular-nums">
                          {clan.avgKd ? clan.avgKd.toFixed(2) : "-"}
                        </span>

                        <span className="w-12 text-[11px] text-center text-[var(--qc-text-secondary)] hidden sm:block flex-shrink-0 tabular-nums">
                          {clan.members}
                        </span>
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 section-divider">
                    <p className="text-[9px] text-[var(--qc-text-muted)] uppercase tracking-wider">
                      {t("minMembersNote") || "Los clanes necesitan mínimo 4 miembros para aparecer en el ranking"}
                    </p>
                    <Link
                      href="/clanes/create"
                      className="rounded-lg bg-foreground px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-background transition-all hover:opacity-90"
                      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
                    >
                      Crear mi Clan
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
