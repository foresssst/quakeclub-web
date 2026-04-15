"use client"
import { systemConfirm } from "@/components/ui/system-modal"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import { PICKBAN_FORMATS } from "@/lib/pickban"

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
}

const MODE_LABELS: Record<string, string> = {
  ca: "CA", tdm: "TDM", ctf: "CTF", duel: "Duel",
}

const TEAM_MODES = ["ca", "tdm", "ctf", "ft"]

interface ClanOption {
  id: string
  name: string
  tag: string
  avatarUrl: string | null
  slug: string | null
}

interface PlayerOption {
  id: string
  username: string
  steamId: string
  avatar: string | null
}

// Searchable selector for clans
function ClanSelector({ label, selected, onSelect, exclude }: {
  label: string
  selected: ClanOption | null
  onSelect: (clan: ClanOption | null) => void
  exclude?: string | null
}) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ["clans-list"],
    queryFn: async () => {
      const res = await fetch("/api/clans?limit=100")
      if (!res.ok) throw new Error("Error")
      return res.json() as Promise<{ clans: ClanOption[] }>
    },
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const clans = (data?.clans || [])
    .filter(c => c.id !== exclude)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase()))

  if (selected) {
    return (
      <div className="flex items-center gap-2 bg-foreground/[0.02] border border-foreground/[0.08] rounded p-2">
        {selected.avatarUrl ? (
          <img src={selected.avatarUrl} alt="" className="w-8 h-8 rounded object-cover" />
        ) : (
          <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40">{selected.tag.substring(0, 2)}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{selected.name}</div>
          <div className="text-[9px] text-foreground/30">[{selected.tag}]</div>
        </div>
        <button onClick={() => onSelect(null)} className="text-foreground/20 hover:text-foreground/50 text-lg">×</button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 mb-1.5">{label}</div>
      <input
        type="text"
        placeholder="Buscar clan..."
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full border border-foreground/[0.08] bg-foreground/[0.02] py-2 px-3 text-sm text-foreground rounded placeholder-foreground/30"
      />
      {open && clans.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-foreground/[0.08] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {clans.map(clan => (
            <button
              key={clan.id}
              onClick={() => { onSelect(clan); setOpen(false); setSearch("") }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/[0.04] transition-all text-left"
            >
              {clan.avatarUrl ? (
                <img src={clan.avatarUrl} alt="" className="w-6 h-6 rounded object-cover" />
              ) : (
                <div className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground/40">{clan.tag.substring(0, 2)}</div>
              )}
              <span className="text-sm font-medium text-foreground">{clan.name}</span>
              <span className="text-[9px] text-foreground/30">[{clan.tag}]</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Searchable selector for players
function PlayerSelector({ label, selected, onSelect, exclude }: {
  label: string
  selected: PlayerOption | null
  onSelect: (player: PlayerOption | null) => void
  exclude?: string | null
}) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ["player-search", search],
    queryFn: async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(search)}`)
      if (!res.ok) throw new Error("Error")
      return res.json() as Promise<{ players: PlayerOption[] }>
    },
    enabled: search.length >= 2,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const players = (data?.players || []).filter(p => p.id !== exclude)

  if (selected) {
    return (
      <div className="flex items-center gap-2 bg-foreground/[0.02] border border-foreground/[0.08] rounded p-2">
        {selected.avatar ? (
          <img src={selected.avatar} alt="" className="w-8 h-8 rounded object-cover" />
        ) : (
          <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40">?</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{selected.username}</div>
          <div className="text-[9px] text-foreground/30 font-mono">{selected.steamId}</div>
        </div>
        <button onClick={() => onSelect(null)} className="text-foreground/20 hover:text-foreground/50 text-lg">×</button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 mb-1.5">{label}</div>
      <input
        type="text"
        placeholder="Buscar jugador..."
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full border border-foreground/[0.08] bg-foreground/[0.02] py-2 px-3 text-sm text-foreground rounded placeholder-foreground/30"
      />
      {open && players.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-foreground/[0.08] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => { onSelect(player); setOpen(false); setSearch("") }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/[0.04] transition-all text-left"
            >
              {player.avatar ? (
                <img src={player.avatar} alt="" className="w-6 h-6 rounded object-cover" />
              ) : (
                <div className="w-6 h-6 rounded bg-foreground/10" />
              )}
              <span className="text-sm font-medium text-foreground">{player.username}</span>
            </button>
          ))}
        </div>
      )}
      {open && search.length >= 2 && players.length === 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-foreground/[0.08] rounded-lg shadow-lg p-3 text-center text-[10px] text-foreground/30">
          Sin resultados
        </div>
      )}
    </div>
  )
}

export default function AdminPickBanPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [gameMode, setGameMode] = useState("ca")
  const [clan1, setClan1] = useState<ClanOption | null>(null)
  const [clan2, setClan2] = useState<ClanOption | null>(null)
  const [player1, setPlayer1] = useState<PlayerOption | null>(null)
  const [player2, setPlayer2] = useState<PlayerOption | null>(null)
  const [format, setFormat] = useState("bo1")
  const [selectedMaps, setSelectedMaps] = useState<string[]>([])
  const [modeFilter, setModeFilter] = useState("ca")
  const [searchFilter, setSearchFilter] = useState("")
  const [allMaps, setAllMaps] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isTeamMode = TEAM_MODES.includes(gameMode)

  useEffect(() => {
    fetch("/api/maps/list").then(r => r.json()).then(data => {
      if (data.maps) setAllMaps(data.maps)
    }).catch(() => {
      const all = new Set<string>()
      Object.values(MAP_POOLS).forEach(maps => maps.forEach(m => all.add(m)))
      setAllMaps([...all].sort())
    })
  }, [])

  // Sync map mode filter with game mode
  useEffect(() => {
    if (MAP_POOLS[gameMode]) setModeFilter(gameMode)
  }, [gameMode])

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) { router.push("/login"); throw new Error("Not authenticated") }
      const data = await res.json()
      if (!data.user.isAdmin) { router.push("/"); throw new Error("Not admin") }
      return data
    }
  })

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pickban-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pickban")
      if (!res.ok) throw new Error("Error")
      return res.json() as Promise<{ sessions: any[] }>
    },
    enabled: !!authData?.user?.isAdmin,
  })

  // Resolve team info from selection
  const getTeamData = () => {
    if (isTeamMode) {
      if (!clan1 || !clan2) return null
      return {
        team1Name: clan1.name, team1Tag: clan1.tag, team1Avatar: clan1.avatarUrl || undefined,
        team2Name: clan2.name, team2Tag: clan2.tag, team2Avatar: clan2.avatarUrl || undefined,
      }
    } else {
      if (!player1 || !player2) return null
      return {
        team1Name: player1.username, team1Tag: player1.username, team1Avatar: player1.avatar || undefined,
        team2Name: player2.username, team2Tag: player2.username, team2Avatar: player2.avatar || undefined,
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const teams = getTeamData()
      if (!teams) throw new Error("Faltan participantes")
      const res = await fetch("/api/admin/pickban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, ...teams, mapPool: selectedMaps }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pickban-sessions"] })
      setShowCreate(false)
      setClan1(null); setClan2(null)
      setPlayer1(null); setPlayer2(null)
      setSelectedMaps([])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/pickban?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pickban-sessions"] }),
  })

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/pickban?id=${id}`, { method: "PATCH" })
      if (!res.ok) throw new Error("Error")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-pickban-sessions"] }),
  })

  const copyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const fmt = PICKBAN_FORMATS[format]
  const teamData = getTeamData()
  const canCreate = teamData && selectedMaps.length >= (fmt?.poolSize || 7)

  const getFilteredMaps = () => {
    let maps = modeFilter === "all" ? allMaps : (MAP_POOLS[modeFilter] || [])
    if (searchFilter) maps = maps.filter(m => m.includes(searchFilter.toLowerCase()))
    return maps.sort()
  }

  if (!authData?.user?.isAdmin) return null

  return (
    <AdminLayout title="Pick/Ban" subtitle="Sesiones de veto de mapas">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Sesiones</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-foreground/10 border border-foreground/20 px-3 py-1.5 text-[9px] font-bold text-foreground transition-all hover:bg-foreground/20 uppercase tracking-wider rounded"
        >
          {showCreate ? "Cancelar" : "Nueva Sesion"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg p-5 mb-6 space-y-5">
          {/* Game Mode */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 mb-2">Modo de juego</div>
            <div className="flex gap-1.5">
              {[
                { id: "duel", label: "Duel" },
                { id: "ca", label: "Clan Arena" },
                { id: "tdm", label: "TDM" },
                { id: "ctf", label: "CTF" },
                { id: "ffa", label: "FFA" },
                { id: "ft", label: "Freeze Tag" },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => { setGameMode(m.id); setClan1(null); setClan2(null); setPlayer1(null); setPlayer2(null) }}
                  className={`px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${
                    gameMode === m.id
                      ? "bg-foreground text-white border-foreground"
                      : "bg-foreground/[0.02] text-foreground/30 border-foreground/[0.06] hover:border-foreground/30 hover:text-foreground/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div className="grid grid-cols-2 gap-5">
            {isTeamMode ? (
              <>
                <ClanSelector label="Equipo A" selected={clan1} onSelect={setClan1} exclude={clan2?.id} />
                <ClanSelector label="Equipo B" selected={clan2} onSelect={setClan2} exclude={clan1?.id} />
              </>
            ) : (
              <>
                <PlayerSelector label="Jugador A" selected={player1} onSelect={setPlayer1} exclude={player2?.id} />
                <PlayerSelector label="Jugador B" selected={player2} onSelect={setPlayer2} exclude={player1?.id} />
              </>
            )}
          </div>

          {/* Format */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 mb-2">Formato</div>
            <div className="flex gap-2">
              {Object.values(PICKBAN_FORMATS).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    format === f.id
                      ? "bg-foreground text-white border-foreground"
                      : "bg-foreground/[0.02] text-foreground/40 border-foreground/[0.06] hover:border-foreground/30"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Map Pool */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30">
                Map Pool ({selectedMaps.length}/{fmt?.poolSize || 7})
              </span>
              {selectedMaps.length >= (fmt?.poolSize || 7) && (
                <span className="text-[9px] text-foreground font-bold">OK</span>
              )}
            </div>

            {/* Mode tabs + search */}
            <div className="flex items-center gap-2 mb-2">
              {Object.entries(MODE_LABELS).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setModeFilter(mode)}
                  className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-all ${
                    modeFilter === mode
                      ? "bg-foreground text-white"
                      : "bg-foreground/[0.04] text-foreground/30 hover:text-foreground/50"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setModeFilter("all")}
                className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-all ${
                  modeFilter === "all"
                    ? "bg-foreground text-white"
                    : "bg-foreground/[0.04] text-foreground/30 hover:text-foreground/50"
                }`}
              >
                Todos
              </button>
              <input
                type="text" placeholder="Buscar..."
                value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                className="ml-auto bg-foreground/[0.02] border border-foreground/[0.06] rounded px-2 py-1 text-[10px] text-foreground placeholder-foreground/30 w-32"
              />
            </div>

            {/* Quick presets */}
            {modeFilter !== "all" && MAP_POOLS[modeFilter] && (
              <div className="flex gap-1.5 mb-2">
                <button
                  onClick={() => setSelectedMaps(MAP_POOLS[modeFilter].slice(0, 7))}
                  className="text-[9px] bg-foreground/5 text-foreground/60 border border-foreground/10 px-2 py-0.5 rounded hover:bg-foreground/10 font-medium uppercase tracking-wider"
                >
                  Top 7
                </button>
                {MAP_POOLS[modeFilter].length >= 9 && (
                  <button
                    onClick={() => setSelectedMaps(MAP_POOLS[modeFilter].slice(0, 9))}
                    className="text-[9px] bg-foreground/5 text-foreground/60 border border-foreground/10 px-2 py-0.5 rounded hover:bg-foreground/10 font-medium uppercase tracking-wider"
                  >
                    Top 9
                  </button>
                )}
                {selectedMaps.length > 0 && (
                  <button
                    onClick={() => setSelectedMaps([])}
                    className="text-[9px] text-foreground/30 hover:text-foreground/50 px-2 py-0.5 uppercase tracking-wider"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Selected pills */}
            {selectedMaps.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedMaps.map(m => (
                  <span key={m} className="inline-flex items-center gap-1 bg-foreground/10 text-foreground text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {m}
                    <button onClick={() => setSelectedMaps(prev => prev.filter(x => x !== m))} className="text-foreground/30 hover:text-foreground/60 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Map grid */}
            <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-1.5 max-h-[250px] overflow-y-auto">
              {getFilteredMaps().map(mapName => {
                const isSelected = selectedMaps.includes(mapName)
                return (
                  <button
                    key={mapName}
                    onClick={() => setSelectedMaps(prev =>
                      prev.includes(mapName) ? prev.filter(m => m !== mapName) : [...prev, mapName]
                    )}
                    className={`relative aspect-[16/10] rounded overflow-hidden border-2 transition-all ${
                      isSelected ? "border-foreground opacity-100" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={`/levelshots/${mapName}.jpg`} alt={mapName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute bottom-0.5 left-1 text-[6px] font-bold text-white uppercase drop-shadow-lg">{mapName}</span>
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-foreground flex items-center justify-center rounded-bl">
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Create */}
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canCreate || createMutation.isPending}
            className="w-full py-2.5 bg-foreground text-white font-bold uppercase text-[10px] tracking-wider rounded hover:brightness-110 transition-all disabled:opacity-30"
          >
            {createMutation.isPending ? "Creando..." : "Crear Sesion"}
          </button>
          {createMutation.isError && (
            <p className="text-red-500 text-[10px]">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-foreground/30 border-t-[#1a1a1e] rounded-full animate-spin" />
        </div>
      ) : data?.sessions?.length === 0 ? (
        <div className="text-center py-12 text-foreground/20 text-xs">
          No hay sesiones de pick/ban
        </div>
      ) : (
        <div className="space-y-1.5">
          {data?.sessions?.map((s: any) => {
            const f = PICKBAN_FORMATS[s.format]
            const isActive = s.status !== "COMPLETED"
            const baseUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pickban/${s.id}`

            return (
              <div
                key={s.id}
                className="p-3 bg-foreground/[0.02] border border-foreground/[0.04] rounded-lg hover:bg-foreground/[0.03] transition-all"
              >
                <div className="flex items-center gap-3">
                  {/* Status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.status === "COMPLETED" ? "bg-foreground/30" :
                    s.status === "IN_PROGRESS" ? "bg-foreground animate-pulse" :
                    "bg-foreground/15"
                  }`} />

                  {/* Team avatars + names */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {s.team1Avatar ? (
                      <img src={s.team1Avatar} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground/30">{s.team1Tag?.substring(0, 2)}</div>
                    )}
                    <span className="text-sm font-bold text-foreground truncate">{s.team1Name}</span>
                    <span className="text-[9px] text-foreground/20 uppercase">vs</span>
                    <span className="text-sm font-bold text-foreground truncate">{s.team2Name}</span>
                    {s.team2Avatar ? (
                      <img src={s.team2Avatar} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-[8px] font-bold text-foreground/30">{s.team2Tag?.substring(0, 2)}</div>
                    )}
                    <span className="text-[9px] text-foreground/20 ml-1">{f?.name || s.format}</span>
                  </div>

                  {/* Links */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyLink(`${baseUrl}?team=a`, `${s.id}-a`)}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                        copiedId === `${s.id}-a`
                          ? "bg-foreground text-white"
                          : "bg-foreground/[0.04] text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06]"
                      }`}
                    >
                      {copiedId === `${s.id}-a` ? "Copiado" : s.team1Tag}
                    </button>
                    <button
                      onClick={() => copyLink(`${baseUrl}?team=b`, `${s.id}-b`)}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                        copiedId === `${s.id}-b`
                          ? "bg-foreground text-white"
                          : "bg-foreground/[0.04] text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06]"
                      }`}
                    >
                      {copiedId === `${s.id}-b` ? "Copiado" : s.team2Tag}
                    </button>
                    <button
                      onClick={() => copyLink(`${baseUrl}?stream=1`, `${s.id}-stream`)}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                        copiedId === `${s.id}-stream`
                          ? "bg-foreground text-white"
                          : "bg-foreground/[0.04] text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06]"
                      }`}
                    >
                      {copiedId === `${s.id}-stream` ? "Copiado" : "OBS"}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-foreground/[0.06] pl-2 ml-1">
                    {isActive && (
                      <button
                        onClick={async () => { if (await systemConfirm("¿Reiniciar esta sesión? Se borran todos los bans/picks.")) resetMutation.mutate(s.id) }}
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded text-foreground/20 hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={async () => { if (await systemConfirm("¿Eliminar esta sesión?")) deleteMutation.mutate(s.id) }}
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded text-red-400/50 hover:text-red-500 hover:bg-red-500/5 transition-all"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div className="text-[9px] text-foreground/20 mt-1.5 ml-[18px]">
                  {new Date(s.createdAt).toLocaleDateString("es-CL")} · {s.actions?.length || 0}/{f?.steps?.length || 0} pasos
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
