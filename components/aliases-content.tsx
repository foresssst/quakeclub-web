"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { parseQuakeColors } from "@/lib/quake-colors"
import { useQuery } from "@tanstack/react-query"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { useTranslations } from "next-intl"
import { LoadingScreen } from "@/components/loading-screen"

interface AliasesContentProps {
  steamId: string
}

interface AliasRecord {
  alias: string
  firstSeen: string
  lastSeen: string
  timesUsed: number
}

export function AliasesContent({ steamId }: AliasesContentProps) {
  const t = useTranslations("profile")
  const { data: aliases = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['aliases', steamId],
    queryFn: async () => {
      const response = await fetch(`/api/aliases/${steamId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch aliases")
      }
      const data = await response.json()
      return data.aliases || []
    },
    placeholderData: (previousData) => previousData,
    staleTime: 300000,
  })

  const showLoading = useDebouncedLoading(loading, 600)
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Unknown error") : null

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-4">
      {/* Volver al perfil */}
      <div className="flex items-center gap-4 animate-fade-in">
        <Link
          href={`/perfil/${steamId}`}
          className="flex items-center gap-2 text-foreground hover:text-[#d4b46f] transition-all hover:gap-3 bg-card border border-foreground/[0.06] rounded-xl px-4 py-2.5"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-sm font-tiktok">{t("backToProfile")}</span>
        </Link>
      </div>

      {/* Contenedor principal */}
      <div className="animate-scale-fade [animation-delay:100ms] bg-card border border-foreground/[0.06] rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06] px-4 sm:px-5 py-4 sm:py-5">
          <h1 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wider text-foreground">
            {t("aliasHistory")}
          </h1>
        </div>

        {/* Contenido */}
        <div className="px-4 sm:px-5" style={{ minHeight: loading ? '200px' : 'auto' }}>
          {showLoading && !aliases.length ? (
            <LoadingScreen compact />
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-500 font-medium">{error}</p>
            </div>
          ) : aliases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-tiktok text-sm text-gray-500 uppercase tracking-wider">
                {t("noAliases")}
              </p>
            </div>
          ) : (
            <>
              {/* Header de tabla - Desktop */}
              <div className="hidden sm:grid grid-cols-[36px_1fr_110px_110px] gap-4 py-2.5 border-b border-foreground/[0.06]">
                <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">#</span>
                <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider">{t("aliasName")}</span>
                <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{t("aliasFirstSeen")}</span>
                <span className="text-[10px] font-bold uppercase text-foreground/30 tracking-wider text-center">{t("aliasLastSeen")}</span>
              </div>

              {/* Filas */}
              {aliases.map((alias: AliasRecord, index: number) => (
                <div
                  key={index}
                  className="grid grid-cols-[36px_1fr_110px_110px] gap-4 items-center py-2.5 border-b border-black/[0.03] hover:bg-foreground/[0.03] transition-colors"
                >
                  {/* Número */}
                  <span className="text-xs font-bold text-foreground/20 text-center">{index + 1}</span>

                  {/* Nombre */}
                  <div className="min-w-0">
                    <span className="font-medium text-foreground/80 truncate text-sm block text-shadow-sm">
                      {parseQuakeColors(alias.alias)}
                    </span>
                    {/* Mobile: fechas debajo del nombre */}
                    <div className="flex items-center gap-3 sm:hidden mt-0.5">
                      <span className="text-[10px] text-foreground/30">
                        {new Date(alias.firstSeen).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-[10px] text-foreground/20">→</span>
                      <span className="text-[10px] text-foreground/40">
                        {new Date(alias.lastSeen).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Primera vez - Desktop */}
                  <div className="hidden sm:block text-center">
                    <span className="text-xs text-foreground/40">
                      {new Date(alias.firstSeen).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Última vez - Desktop */}
                  <div className="hidden sm:block text-center">
                    <span className="text-xs text-foreground/50">
                      {new Date(alias.lastSeen).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Spacer */}
              <div className="h-3" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
