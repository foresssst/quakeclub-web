"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"

interface AuditLog {
  id: string
  category: string
  action: string
  actorType: string
  actorId: string | null
  actorName: string | null
  actorIp: string | null
  targetType: string | null
  targetId: string | null
  targetName: string | null
  details: Record<string, unknown> | null
  status: string
  method: string | null
  path: string | null
  userAgent: string | null
  duration: number | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const CATEGORIES = [
  { id: "", label: "Todas" },
  { id: "AUTH", label: "Auth", color: "bg-blue-500/15 text-blue-700" },
  { id: "ADMIN", label: "Admin", color: "bg-red-500/15 text-red-700" },
  { id: "PLAYER", label: "Jugador", color: "bg-green-500/15 text-green-700" },
  { id: "CLAN", label: "Clan", color: "bg-purple-500/15 text-purple-700" },
  { id: "TOURNAMENT", label: "Torneo", color: "bg-amber-500/15 text-amber-700" },
  { id: "MATCH", label: "Match", color: "bg-cyan-500/15 text-cyan-700" },
  { id: "RATING", label: "Rating", color: "bg-orange-500/15 text-orange-700" },
  { id: "SERVER", label: "Server", color: "bg-slate-500/15 text-slate-700" },
  { id: "CONTENT", label: "Contenido", color: "bg-pink-500/15 text-pink-700" },
  { id: "SYSTEM", label: "Sistema", color: "bg-gray-500/15 text-gray-700" },
]

const STATUSES = [
  { id: "", label: "Todos" },
  { id: "SUCCESS", label: "OK", color: "text-green-600" },
  { id: "FAILURE", label: "Fallo", color: "text-yellow-600" },
  { id: "ERROR", label: "Error", color: "text-red-600" },
]

function getCategoryStyle(category: string): string {
  const cat = CATEGORIES.find(c => c.id === category)
  return cat?.color || "bg-gray-500/15 text-gray-700"
}

function getStatusStyle(status: string): string {
  const s = STATUSES.find(st => st.id === status)
  return s?.color || "text-foreground/40"
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function AuditLogPage() {
  const router = useRouter()

  const [page, setPage] = useState(1)
  const [category, setCategory] = useState("")
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const { data: authData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) { router.push("/login?returnTo=/admin/audit-log"); throw new Error("x") }
      const data = await res.json()
      if (!data.user.isAdmin) { router.push("/"); throw new Error("x") }
      return data
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, category, status, search, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "50")
      if (category) params.set("category", category)
      if (status) params.set("status", status)
      if (search) params.set("search", search)
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      const res = await fetch(`/api/admin/audit-log?${params}`)
      if (!res.ok) throw new Error("Failed")
      return res.json() as Promise<{ logs: AuditLog[]; pagination: Pagination }>
    },
    enabled: !!authData?.user?.isAdmin,
    staleTime: 15 * 1000,
  })

  const logs = data?.logs || []
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    setPage(1)
  }

  function handleStatusChange(st: string) {
    setStatus(st)
    setPage(1)
  }

  function clearFilters() {
    setCategory("")
    setStatus("")
    setSearch("")
    setSearchInput("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  if (!authData?.user?.isAdmin) return null

  return (
    <AdminLayout title="Auditoría" subtitle={`${pagination.total.toLocaleString()} registros totales`}>
      {/* Filtros */}
      <div className="space-y-3 mb-6">
        {/* Categorías como chips */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                category === cat.id
                  ? "bg-foreground text-white"
                  : "bg-foreground/[0.04] text-foreground/40 hover:bg-foreground/[0.08] hover:text-foreground/60"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Segunda fila: búsqueda, status, fechas */}
        <div className="flex flex-wrap gap-2 items-end">
          <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por acción, actor, objetivo, path..."
              className="flex-1 bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:ring-1 focus:ring-black/10"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-foreground text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:brightness-110 transition-all"
            >
              Buscar
            </button>
          </form>

          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-black/10"
          >
            {STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-black/10"
          />
          <span className="text-foreground/30 text-xs">a</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-black/10"
          />

          {(category || status || search || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="px-2 py-1.5 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors uppercase tracking-wider"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-foreground/[0.02] rounded-lg border border-foreground/[0.06] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-foreground/30 text-xs">Cargando registros...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-foreground/30 text-xs">No se encontraron registros</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-foreground/[0.06] text-left">
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Fecha</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Categoría</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Acción</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Actor</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Objetivo</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Estado</th>
                  <th className="px-3 py-2.5 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <LogRow
                    key={log.id}
                    log={log}
                    isExpanded={expandedRow === log.id}
                    onToggle={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[10px] text-foreground/30 uppercase tracking-wider">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 text-[10px] bg-foreground/[0.04] border border-foreground/[0.06] rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-wider font-bold"
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number
              if (pagination.totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-2.5 py-1 text-[10px] rounded-lg transition-all font-bold ${
                    pageNum === page
                      ? "bg-foreground text-white"
                      : "bg-foreground/[0.04] text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.08]"
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-2.5 py-1 text-[10px] bg-foreground/[0.04] border border-foreground/[0.06] rounded-lg text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-wider font-bold"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function LogRow({ log, isExpanded, onToggle }: { log: AuditLog; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-foreground/40 whitespace-nowrap font-mono text-[10px]">
          {formatDate(log.createdAt)}
        </td>
        <td className="px-3 py-2">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryStyle(log.category)}`}>
            {log.category}
          </span>
        </td>
        <td className="px-3 py-2 text-foreground font-bold text-[10px] uppercase tracking-wider">
          {log.action}
        </td>
        <td className="px-3 py-2">
          <span className="text-foreground/50 text-[10px]">
            {log.actorName || log.actorId || (
              <span className="text-foreground/20">{log.actorType}</span>
            )}
          </span>
        </td>
        <td className="px-3 py-2">
          {log.targetType ? (
            <span className="text-foreground/50 text-[10px]">
              <span className="text-foreground/30">{log.targetType}:</span>{" "}
              {log.targetName || log.targetId}
            </span>
          ) : (
            <span className="text-foreground/20">—</span>
          )}
        </td>
        <td className="px-3 py-2">
          <span className={`text-[10px] font-bold ${getStatusStyle(log.status)}`}>
            {log.status}
          </span>
        </td>
        <td className="px-3 py-2 text-foreground/30">
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-foreground/[0.02]">
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div>
                <span className="text-foreground/30 uppercase tracking-wider font-bold">Actor ID</span>
                <div className="text-foreground/60 font-mono mt-0.5">{log.actorId || "—"}</div>
              </div>
              <div>
                <span className="text-foreground/30 uppercase tracking-wider font-bold">IP</span>
                <div className="text-foreground/60 font-mono mt-0.5">{log.actorIp || "—"}</div>
              </div>
              <div>
                <span className="text-foreground/30 uppercase tracking-wider font-bold">Método</span>
                <div className="text-foreground/60 mt-0.5">{log.method || "—"}</div>
              </div>
              <div>
                <span className="text-foreground/30 uppercase tracking-wider font-bold">Path</span>
                <div className="text-foreground/60 font-mono mt-0.5">{log.path || "—"}</div>
              </div>
              {log.targetId && (
                <div>
                  <span className="text-foreground/30 uppercase tracking-wider font-bold">Target ID</span>
                  <div className="text-foreground/60 font-mono mt-0.5">{log.targetId}</div>
                </div>
              )}
              {log.duration !== null && (
                <div>
                  <span className="text-foreground/30 uppercase tracking-wider font-bold">Duración</span>
                  <div className="text-foreground/60 mt-0.5">{log.duration}ms</div>
                </div>
              )}
              {log.userAgent && (
                <div className="col-span-2">
                  <span className="text-foreground/30 uppercase tracking-wider font-bold">User Agent</span>
                  <div className="text-foreground/60 mt-0.5 break-all">{log.userAgent}</div>
                </div>
              )}
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="col-span-full">
                  <span className="text-foreground/30 uppercase tracking-wider font-bold">Detalles</span>
                  <pre className="mt-1 bg-foreground/[0.04] rounded-lg p-2 text-foreground/60 overflow-x-auto text-[10px]">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
