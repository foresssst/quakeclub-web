"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { LoadingScreen } from "@/components/loading-screen"

interface EloHistoryEntry {
  timestamp: string
  date: string
  eloBefore: number
  eloAfter: number
  change: number
  gameType: string
  match: {
    map: string
    gameType: string
    kills: number
    deaths: number
    playedAt: Date
  } | null
}

interface EloChartProps {
  steamId: string
  selectedGameMode: string
  dominantHue?: number
  compact?: boolean
}

export function EloChart({ steamId, selectedGameMode, compact = false }: EloChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const lineColor = isDark ? "#d8d0c2" : "#1a1a1e"
  const axisColor = isDark ? "#8f877a" : "#6b6b76"
  const gridTop = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"
  const gridBottom = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"

  const { data: history = [], isLoading: loading } = useQuery({
    queryKey: ["elo-history", steamId, selectedGameMode],
    queryFn: async () => {
      const gameTypeParam = selectedGameMode === "overall" ? "all" : selectedGameMode
      const response = await fetch(`/api/players/${steamId}/elo-history?gameType=${gameTypeParam}`)

      if (!response.ok) {
        throw new Error("Failed to fetch ELO history")
      }

      const data = await response.json()
      return data.success && data.history ? data.history : []
    },
    enabled: !!steamId,
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  })

  const showLoading = useDebouncedLoading(loading, 600)

  const heightClass = compact ? "h-[70px] sm:h-[90px]" : "h-[180px] sm:h-[240px]"

  if (showLoading && !history.length) {
    return <LoadingScreen compact />
  }

  if (history.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center ${compact ? "py-4 sm:py-6" : "py-8 sm:py-12"} text-center border border-foreground/[0.06] bg-foreground/[0.02] rounded-lg px-4`}>
        <p className="font-tiktok text-xs sm:text-sm text-foreground/55">No hay suficiente historial de ELO para mostrar</p>
        {!compact && <p className="mt-2 text-[10px] sm:text-xs text-foreground/35">Juega más partidas para ver tu progresión</p>}
      </div>
    )
  }

  const chartData = history.map((entry: EloHistoryEntry, index: number) => ({
    index: index + 1,
    elo: entry.eloAfter,
    date: entry.date,
    change: entry.change,
    map: entry.match?.map || "Unknown",
    gameType: entry.gameType,
  }))

  const eloValues = chartData.map((d: { elo: number }) => d.elo)
  const minElo = Math.min(...eloValues)
  const maxElo = Math.max(...eloValues)
  const padding = (maxElo - minElo) * 0.1 || 50
  const yAxisMin = Math.floor(minElo - padding)
  const yAxisMax = Math.ceil(maxElo + padding)

  const CustomTooltip = ({
    active,
    payload,
  }: { active?: boolean; payload?: Array<{ payload: { elo: number; date: string } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card p-2.5 sm:p-3 rounded-lg shadow-lg border border-foreground/[0.06]">
          <div className="text-foreground text-sm sm:text-base font-bold">{Math.round(data.elo)}</div>
          <div className="text-[var(--qc-text-muted)] text-[10px] sm:text-xs">{data.date}</div>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`w-full ${heightClass} relative`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={compact ? { top: 5, right: 5, left: 5, bottom: 5 } : { top: 10, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={gridTop} stopOpacity={1} />
              <stop offset="100%" stopColor={gridBottom} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="0" stroke="url(#gridGradient)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey={compact ? "index" : "date"}
            hide={compact}
            tick={compact ? undefined : { fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yAxisMin, yAxisMax]}
            hide={compact}
            tick={compact ? undefined : { fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={compact ? 0 : 40}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Line
            type="linear"
            dataKey="elo"
            stroke={lineColor}
            strokeWidth={compact ? 2 : 2.5}
            dot={compact ? false : { r: 2, fill: lineColor, strokeWidth: 0 }}
            activeDot={{
              r: compact ? 5 : 6,
                fill: isDark ? "#171a20" : "#c8c8ce",
                stroke: lineColor,
                strokeWidth: 2,
              }}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-in-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
