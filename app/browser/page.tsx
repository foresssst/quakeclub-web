"use client"

import React from "react"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { FlagCountry } from "@/components/flag-country"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"
import Image from "next/image"

interface Server {
  ip: string
  port: number
  name: string
  map: string
  gameType: string
  players: number
  maxplayers: number
  status: string
  region: string
  country?: string
  countryCode?: string
  isOurs?: boolean
}

interface ServersResponse {
  our: Server[]
  world: Server[]
}

// Map levelshot with fallback
function MapLevelshot({ mapName, className }: { mapName: string; className?: string }) {
  const [src, setSrc] = useState(`/levelshots/${mapName?.toLowerCase()}.jpg`)

  return (
    <Image
      src={src || "/branding/logo.png"}
      alt={mapName || "map"}
      fill
      className={`object-cover ${className || ""}`}
      onError={() => setSrc("/levelshots/default.jpg")}
      unoptimized
    />
  )
}

// Continent-based region flag mapping
function getRegionFlag(region: string): { code: string; name: string } {
  switch (region) {
    case "Africa": return { code: "ZA", name: "Africa" }
    case "Asia": return { code: "JP", name: "Asia" }
    case "Europe": return { code: "EU", name: "Europe" }
    case "North America": return { code: "US", name: "North America" }
    case "Oceania": return { code: "AU", name: "Oceania" }
    case "South America": return { code: "BR", name: "South America" }
    default: return { code: "EU", name: "Europe" }
  }
}

// Custom dropdown component
interface DropdownOption {
  value: string
  label: string
}

function CustomDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current
      const atTop = scrollTop === 0 && e.deltaY < 0
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0
      if (atTop || atBottom) {
        e.preventDefault()
      }
    }
  }

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={dropdownRef} className={`relative ${isOpen ? "z-[80]" : "z-0"}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 w-full bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg text-[var(--qc-text-secondary)] text-[11px] hover:bg-foreground/[0.05] transition-colors"
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <svg
          className={`w-2.5 h-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={listRef}
          onWheel={handleWheel}
          className="absolute z-[90] mt-1 w-full min-w-[110px] bg-card border border-foreground/[0.08] rounded-lg max-h-44 overflow-y-auto overscroll-contain"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.16)" }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full px-2.5 py-1.5 text-left text-[11px] transition-colors ${value === option.value
                ? "bg-foreground/12 text-foreground"
                : "text-[var(--qc-text-secondary)] hover:bg-foreground/[0.04] hover:text-foreground"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Server row component used in both panels
function ServerRow({ server, onClick }: { server: Server; onClick: () => void }) {
  const flagCode = server.countryCode || getRegionFlag(server.region).code
  const flagName = server.country || server.region
  return (
    <div className="w-full flex items-center gap-2.5 p-2.5 transition-colors text-left bg-transparent hover:bg-foreground/[0.02]">
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2.5 min-w-0 text-left"
      >
        <div className="relative w-11 h-7 flex-shrink-0 overflow-hidden rounded bg-[var(--qc-bg-pure)]">
          <MapLevelshot mapName={server.map} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <FlagCountry countryCode={flagCode} countryName={flagName} />
            <span className="text-[11px] text-[var(--qc-text-secondary)] truncate">
              {parseQuakeColors(server.name)}
            </span>
            {server.isOurs && (
              <span className="text-[7px] px-1 py-0.5 bg-foreground/15 text-foreground uppercase font-bold rounded">
                QC
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] text-foreground uppercase font-semibold">{server.map}</span>
            <span className="text-[9px] text-[var(--qc-text-muted)] uppercase">{server.gameType}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`text-[11px] font-bold ${server.players > 0 ? "text-foreground" : "text-[var(--qc-text-muted)]"}`}>
            {server.players}
          </span>
          <span className="text-[11px] text-[var(--qc-text-muted)]">/{server.maxplayers}</span>
        </div>
      </button>
      {server.players > 0 && (
        <a
          href={`steam://connect/${server.ip}:${server.port}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 px-2 py-1 rounded bg-foreground/[0.06] hover:bg-foreground/[0.12] text-[9px] font-bold uppercase tracking-wider text-[var(--qc-text-secondary)] hover:text-foreground transition-colors"
          title="Conectar vía Steam"
        >
          Jugar
        </a>
      )}
    </div>
  )
}

export default function BrowserPage() {
  const t = useTranslations("browser")
  const router = useRouter()
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "")
  const [gameTypeFilter, setGameTypeFilter] = useState<string>(searchParams.get("mode") || "all")
  const [playerFilter, setPlayerFilter] = useState<string>(searchParams.get("players") || "all")
  const [regionFilter, setRegionFilter] = useState<string>(searchParams.get("region") || "all")
  const [mapFilter, setMapFilter] = useState<string>(searchParams.get("map") || "all")

  const updateUrlParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    const newUrl = params.toString() ? `?${params.toString()}` : "/browser"
    router.replace(newUrl, { scroll: false })
  }, [router, searchParams])

  const handleGameTypeChange = (value: string) => {
    setGameTypeFilter(value)
    updateUrlParams({ mode: value })
  }

  const handleRegionChange = (value: string) => {
    setRegionFilter(value)
    updateUrlParams({ region: value })
  }

  const handleMapChange = (value: string) => {
    setMapFilter(value)
    updateUrlParams({ map: value })
  }

  const handlePlayerChange = (value: string) => {
    setPlayerFilter(value)
    updateUrlParams({ players: value })
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    const timeoutId = setTimeout(() => {
      updateUrlParams({ q: value })
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setGameTypeFilter("all")
    setPlayerFilter("all")
    setRegionFilter("all")
    setMapFilter("all")
    router.replace("/browser", { scroll: false })
  }

  const { data, isLoading } = useQuery<ServersResponse>({
    queryKey: ["servers-global"],
    queryFn: async () => {
      const res = await fetch("/api/servers-global")
      if (!res.ok) throw new Error("Failed to fetch servers")
      return res.json()
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const ourServers = data?.our || []
  const worldServers = data?.world || []
  const allServers = [...ourServers, ...worldServers]

  const gameTypes = useMemo(() => {
    const types = new Set<string>()
    allServers.forEach((s) => types.add(s.gameType))
    return Array.from(types).sort()
  }, [data])

  const regions = useMemo(() => {
    const regionSet = new Set<string>()
    allServers.forEach((s) => regionSet.add(s.region))
    return Array.from(regionSet).sort()
  }, [data])

  const maps = useMemo(() => {
    const mapSet = new Set<string>()
    allServers.forEach((s) => mapSet.add(s.map))
    return Array.from(mapSet).sort()
  }, [data])

  // Filter function shared by both panels
  const applyFilters = useCallback((servers: Server[]) => {
    return servers.filter((server) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (!server.name.toLowerCase().includes(search) &&
          !server.map.toLowerCase().includes(search) &&
          !server.gameType.toLowerCase().includes(search)) {
          return false
        }
      }
      if (gameTypeFilter !== "all" && server.gameType !== gameTypeFilter) return false
      if (regionFilter !== "all" && server.region !== regionFilter) return false
      if (mapFilter !== "all" && server.map !== mapFilter) return false
      if (playerFilter === "withPlayers" && server.players === 0) return false
      if (playerFilter === "empty" && server.players > 0) return false
      return true
    }).sort((a, b) => b.players - a.players)
  }, [searchTerm, gameTypeFilter, regionFilter, mapFilter, playerFilter])

  const filteredOur = useMemo(() => applyFilters(ourServers), [applyFilters, ourServers])
  const filteredAll = useMemo(() => applyFilters(allServers), [applyFilters, allServers])

  const handleSelectServer = (server: Server) => {
    const serverId = `${server.ip.replace(/\./g, '-')}-${server.port}`
    router.push(`/browser/${serverId}`)
  }

  const hasActiveFilters = regionFilter !== "all" || mapFilter !== "all" || gameTypeFilter !== "all" || playerFilter !== "all" || searchTerm

  return (
    <div className="relative min-h-screen">
      <div className="pt-4 sm:pt-10 mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12">
        <div className="max-w-[1100px] mx-auto space-y-3">

          {/* Header + Filters */}
          <ContentContainer className="animate-scale-fade !overflow-visible relative z-30">
            <ContentHeader>
              <h1 className="font-tiktok text-base sm:text-lg font-bold uppercase tracking-wide text-foreground">
                Server Browser
              </h1>
              <p className="text-[9px] text-[var(--qc-text-muted)] mt-0.5">{t("subtitle")}</p>
            </ContentHeader>

            <div className="px-3 sm:px-4 py-2.5 bg-[var(--qc-bg-page)] relative border-t border-foreground/[0.04]">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder={t("search")}
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full px-3 py-1.5 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg text-foreground placeholder:text-[var(--qc-text-subtle)] text-[11px] focus:outline-none focus:border-foreground/25"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <CustomDropdown
                    options={[
                      { value: "all", label: t("allRegions") },
                      ...regions.map((r) => ({ value: r, label: getRegionFlag(r).name })),
                    ]}
                    value={regionFilter}
                    onChange={handleRegionChange}
                    placeholder={t("allRegions")}
                  />
                  <CustomDropdown
                    options={[
                      { value: "all", label: t("allMaps") },
                      ...maps.map((m) => ({ value: m, label: m.toUpperCase() })),
                    ]}
                    value={mapFilter}
                    onChange={handleMapChange}
                    placeholder={t("allMaps")}
                  />
                  <CustomDropdown
                    options={[
                      { value: "all", label: t("allModes") },
                      ...gameTypes.map((type) => ({ value: type, label: type })),
                    ]}
                    value={gameTypeFilter}
                    onChange={handleGameTypeChange}
                    placeholder={t("allModes")}
                  />
                  <CustomDropdown
                    options={[
                      { value: "all", label: t("allPlayers") },
                      { value: "withPlayers", label: t("withPlayers") },
                      { value: "empty", label: t("empty") },
                    ]}
                    value={playerFilter}
                    onChange={handlePlayerChange}
                    placeholder={t("allPlayers")}
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-[10px] text-foreground/40 hover:text-foreground transition-colors text-left"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            </div>
          </ContentContainer>

          {isLoading ? (
            <LoadingScreen compact />
          ) : (
            <>
              {/* Side-by-side on desktop, stacked on mobile */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* QuakeClub Servers - Left */}
                <ContentContainer className="animate-scale-fade relative z-0">
                  <div className="px-3 sm:px-4 py-2 border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                        QuakeClub
                      </h2>
                      <span className="text-[9px] text-[var(--qc-text-muted)]">
                        {filteredOur.length} servidores | {filteredOur.reduce((sum, s) => sum + s.players, 0)} jugadores
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-foreground/[0.05]">
                    {filteredOur.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[11px] text-[var(--qc-text-muted)]">{t("noResults")}</p>
                      </div>
                    ) : (
                      filteredOur.map((server) => (
                        <ServerRow
                          key={`${server.ip}:${server.port}`}
                          server={server}
                          onClick={() => handleSelectServer(server)}
                        />
                      ))
                    )}
                  </div>
                </ContentContainer>

                {/* All Servers - Right */}
                <ContentContainer className="animate-scale-fade relative z-0">
                  <div className="px-3 sm:px-4 py-2 border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                        {t("allServers")}
                      </h2>
                      <span className="text-[9px] text-[var(--qc-text-muted)]">
                        {filteredAll.length} servidores | {filteredAll.reduce((sum, s) => sum + s.players, 0)} jugadores
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-foreground/[0.05] max-h-[560px] overflow-y-auto">
                    {filteredAll.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[11px] text-[var(--qc-text-muted)]">{t("noResults")}</p>
                      </div>
                    ) : (
                      filteredAll.map((server) => (
                        <ServerRow
                          key={`${server.ip}:${server.port}`}
                          server={server}
                          onClick={() => handleSelectServer(server)}
                        />
                      ))
                    )}
                  </div>
                </ContentContainer>

              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
