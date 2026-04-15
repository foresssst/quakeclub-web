"use client"

import { useState, useEffect, use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"

// Standard Quake Live map pools by game mode (from official/competitive pools)
const MAP_POOLS: Record<string, string[]> = {
  duel: [
    "aerowalk", "bloodrun", "campgrounds", "coldcathode", "cure",
    "furiousheights", "hearth", "hektik", "ironworks", "lostworld",
    "silence", "sinister", "toxicity", "verticalvengeance",
  ],
  ca: [
    "almostlost", "asylum", "battleforged", "beyondreality", "blackcathedral",
    "bloodrun", "brimstoneabbey", "campgrounds", "cannedheat", "castledeathstalker",
    "cliffside", "coldwar", "concretepalace", "corrosion", "courtyard",
    "cursed", "devilish", "dismemberment", "eviscerated", "evolution",
    "eyetoeye", "fatalinstinct", "finnegans", "furiousheights", "gothicrage",
    "grimdungeons", "hearth", "hektik", "henhouse", "hiddenfortress",
    "infinity", "innersanctums", "intervention", "ironworks", "leviathan",
    "longestyard", "namelessplace", "overkill", "overlord", "phrantic",
    "pillbox", "provinggrounds", "quarantine", "railyard", "rebound",
    "repent", "retribution", "scornforge", "seamsandbolts", "siberia",
    "silence", "sinister", "skyward", "spillway", "stonekeep",
    "stronghold", "terminus", "theatreofpain", "thunderstruck", "tornado",
    "toxicity", "trinity", "verticalvengeance", "warehouse",
  ],
  tdm: [
    "aerowalk", "battleforged", "beyondreality", "bloodrun", "campgrounds",
    "coldwar", "corrosion", "demonkeep", "dismemberment", "furiousheights",
    "hearth", "hektik", "ironworks", "overkill", "phrantic",
    "quarantine", "railyard", "repent", "retribution", "sinister",
    "spillway", "toxicity", "verticalvengeance",
  ],
  ctf: [
    "basesiege", "campercrossings", "citycrossings", "courtyard",
    "dividedcrossings", "futurecrossings", "gospelcrossings",
    "ironworks", "japanesecastles", "longestyard", "spacectf",
    "spidercrossings", "stronghold", "thunderstruck",
  ],
  ffa: [
    "aerowalk", "asylum", "beyondreality", "blackcathedral", "bloodrun",
    "campgrounds", "coldwar", "corrosion", "demonkeep", "eviscerated",
    "evolution", "furiousheights", "gothicrage", "hearth", "hektik",
    "ironworks", "longestyard", "overkill", "phrantic", "quarantine",
    "repent", "sinister", "spillway", "terminus", "toxicity",
    "verticalvengeance",
  ],
  ft: [
    "almostlost", "asylum", "battleforged", "beyondreality", "blackcathedral",
    "bloodrun", "campgrounds", "castledeathstalker", "coldwar", "corrosion",
    "courtyard", "devilish", "eviscerated", "evolution", "eyetoeye",
    "furiousheights", "gothicrage", "hearth", "hektik", "henhouse",
    "innersanctums", "ironworks", "overkill", "pillbox", "quarantine",
    "rebound", "repent", "sinister", "spillway", "stonekeep",
    "terminus", "theatreofpain", "thunderstruck", "toxicity", "trinity",
    "verticalvengeance",
  ],
}

const MODE_LABELS: Record<string, string> = {
  duel: "Duel",
  ca: "Clan Arena",
  tdm: "Team Deathmatch",
  ctf: "Capture the Flag",
  ffa: "Free for All",
  ft: "Freeze Tag",
}

interface PoolMap {
  id: string
  mapName: string
  order: number
}

interface FormatInfo {
  id: string
  name: string
  description: string
  poolSize: number
  totalMaps: number
}

export default function MapPoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const [selectedMaps, setSelectedMaps] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string>("")
  const [searchFilter, setSearchFilter] = useState("")
  const [modeFilter, setModeFilter] = useState<string>("all")
  const [initialized, setInitialized] = useState(false)
  const [allMaps, setAllMaps] = useState<string[]>([])

  // Fetch all available levelshots
  useEffect(() => {
    fetch("/api/maps/list").then(r => r.json()).then(data => {
      if (data.maps) setAllMaps(data.maps)
    }).catch(() => {
      // Fallback: use the union of all pools
      const all = new Set<string>()
      Object.values(MAP_POOLS).forEach(maps => maps.forEach(m => all.add(m)))
      setAllMaps([...all].sort())
    })
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ["map-pool", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tournaments/${id}/map-pool`)
      if (!res.ok) throw new Error("Error")
      return res.json() as Promise<{
        maps: PoolMap[]
        pickBanFormat: string | null
        formats: FormatInfo[]
      }>
    },
  })

  // Initialize state from server data
  if (data && !initialized) {
    setSelectedMaps(data.maps.map(m => m.mapName))
    setSelectedFormat(data.pickBanFormat || "")
    setInitialized(true)
  }

  const { data: tournamentData } = useQuery({
    queryKey: ["tournament-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/esport/tournaments/${id}`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/tournaments/${id}/map-pool`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maps: selectedMaps,
          pickBanFormat: selectedFormat || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al guardar")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map-pool", id] })
    },
  })

  const toggleMap = (mapName: string) => {
    setSelectedMaps(prev =>
      prev.includes(mapName)
        ? prev.filter(m => m !== mapName)
        : [...prev, mapName]
    )
  }

  const removeMap = (mapName: string) => {
    setSelectedMaps(prev => prev.filter(m => m !== mapName))
  }

  const setPreset = (maps: string[]) => {
    setSelectedMaps(maps)
  }

  const addPreset = (maps: string[]) => {
    setSelectedMaps(prev => {
      const set = new Set(prev)
      maps.forEach(m => set.add(m))
      return [...set]
    })
  }

  const gameType = tournamentData?.tournament?.gameType?.toLowerCase() || "ca"
  const currentFormat = data?.formats?.find(f => f.id === selectedFormat)

  // Determine which maps to show based on filter
  const getFilteredMaps = () => {
    let maps: string[]
    if (modeFilter === "all") {
      maps = allMaps.length > 0 ? allMaps : []
    } else {
      maps = MAP_POOLS[modeFilter] || []
    }
    if (searchFilter) {
      maps = maps.filter(m => m.includes(searchFilter.toLowerCase()))
    }
    return maps.sort()
  }

  const filteredMaps = getFilteredMaps()

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/admin/esport/${id}`} className="text-xs text-blue-600 hover:text-blue-500">
              ← Volver al torneo
            </Link>
            <h1 className="text-xl font-bold text-foreground mt-1">
              Map Pool & Pick/Ban
            </h1>
            {tournamentData?.tournament && (
              <p className="text-sm text-foreground/40 mt-0.5">{tournamentData.tournament.name}</p>
            )}
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || selectedMaps.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-lg disabled:opacity-50 transition-all"
          >
            {saveMutation.isPending ? "Guardando..." : "Guardar Map Pool"}
          </button>
        </div>

        {saveMutation.isSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
            Map pool guardado correctamente
          </div>
        )}
        {saveMutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-lg">
            {(saveMutation.error as Error).message}
          </div>
        )}

        {isLoading ? (
          <div className="text-foreground/40 text-center py-12">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Format + Selected Maps */}
            <div className="space-y-4">
              {/* Pick/Ban Format */}
              <div className="bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl p-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Formato Pick/Ban</h2>
                <div className="space-y-2">
                  {data?.formats?.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${
                        selectedFormat === fmt.id
                          ? "bg-blue-50 border-blue-300 text-foreground"
                          : "bg-white border-foreground/[0.08] text-foreground/60 hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      <span className="font-bold">{fmt.name}</span>
                      <span className="block text-[10px] text-foreground/40 mt-0.5">{fmt.description}</span>
                      <span className="block text-[10px] text-foreground/30">Pool mínimo: {fmt.poolSize} mapas · {fmt.totalMaps} mapa{fmt.totalMaps > 1 ? "s" : ""} jugado{fmt.totalMaps > 1 ? "s" : ""}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedFormat("")}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${
                      !selectedFormat
                        ? "bg-foreground/[0.06] border-foreground/20 text-foreground"
                        : "bg-white border-foreground/[0.08] text-foreground/40 hover:text-foreground/60"
                    }`}
                  >
                    Sin pick/ban
                  </button>
                </div>
              </div>

              {/* Selected Maps (ordered) */}
              <div className="bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl p-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">
                  Map Pool ({selectedMaps.length} mapas)
                  {currentFormat && (
                    <span className={`ml-2 text-[10px] font-normal ${
                      selectedMaps.length >= currentFormat.poolSize ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {selectedMaps.length >= currentFormat.poolSize ? "✓" : `mín. ${currentFormat.poolSize}`}
                    </span>
                  )}
                </h2>
                {selectedMaps.length === 0 ? (
                  <p className="text-foreground/30 text-xs py-4 text-center">Selecciona mapas del panel derecho</p>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                    {selectedMaps.map((mapName, idx) => (
                      <div
                        key={mapName}
                        className="flex items-center gap-2 bg-foreground/[0.04] rounded-lg px-2 py-1.5 group"
                      >
                        <span className="text-[10px] text-foreground/30 w-4 text-center">{idx + 1}</span>
                        <img
                          src={`/levelshots/${mapName}.jpg`}
                          alt={mapName}
                          className="w-10 h-6 object-cover rounded"
                        />
                        <span className="text-xs text-foreground flex-1 uppercase font-medium">{mapName}</span>
                        <button
                          onClick={() => removeMap(mapName)}
                          className="text-foreground/20 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedMaps.length > 0 && (
                  <button
                    onClick={() => setSelectedMaps([])}
                    className="mt-2 text-[10px] text-red-400 hover:text-red-500 transition-colors"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </div>

            {/* Right: Map Selector */}
            <div className="lg:col-span-2 bg-foreground/[0.03] border border-foreground/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Mapas</h2>
                <input
                  type="text"
                  placeholder="Buscar mapa..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="flex-1 bg-white border border-foreground/10 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-foreground/30"
                />
              </div>

              {/* Mode filter tabs */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                <button
                  onClick={() => setModeFilter("all")}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    modeFilter === "all"
                      ? "bg-foreground text-white"
                      : "bg-foreground/[0.05] text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.08]"
                  }`}
                >
                  Todos ({allMaps.length})
                </button>
                {Object.entries(MODE_LABELS).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setModeFilter(mode)}
                    className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                      modeFilter === mode
                        ? "bg-foreground text-white"
                        : "bg-foreground/[0.05] text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.08]"
                    }`}
                  >
                    {label} ({MAP_POOLS[mode]?.length || 0})
                  </button>
                ))}
              </div>

              {/* Quick presets */}
              {modeFilter !== "all" && MAP_POOLS[modeFilter] && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={() => setPreset(MAP_POOLS[modeFilter].slice(0, 7))}
                    className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition-all font-medium"
                  >
                    Usar Top 7 {MODE_LABELS[modeFilter]}
                  </button>
                  {MAP_POOLS[modeFilter].length >= 9 && (
                    <button
                      onClick={() => setPreset(MAP_POOLS[modeFilter].slice(0, 9))}
                      className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 transition-all font-medium"
                    >
                      Usar Top 9 {MODE_LABELS[modeFilter]}
                    </button>
                  )}
                  <button
                    onClick={() => addPreset(MAP_POOLS[modeFilter])}
                    className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-all font-medium"
                  >
                    Agregar todos ({MAP_POOLS[modeFilter].length})
                  </button>
                </div>
              )}

              {/* Map grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredMaps.map(mapName => {
                  const isSelected = selectedMaps.includes(mapName)
                  return (
                    <button
                      key={mapName}
                      onClick={() => toggleMap(mapName)}
                      className={`relative aspect-[16/10] rounded-lg overflow-hidden border-2 transition-all group ${
                        isSelected
                          ? "border-blue-500 ring-1 ring-blue-500/30"
                          : "border-transparent hover:border-foreground/20"
                      }`}
                    >
                      <img
                        src={`/levelshots/${mapName}.jpg`}
                        alt={mapName}
                        className={`w-full h-full object-cover transition-all ${
                          isSelected ? "" : "group-hover:brightness-110"
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white uppercase drop-shadow-lg">
                        {mapName}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
                {filteredMaps.length === 0 && (
                  <div className="col-span-full text-center py-8 text-foreground/30 text-sm">
                    No se encontraron mapas
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
