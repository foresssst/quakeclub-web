import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cache } from "@/lib/cache"

// API pública para obtener datos de actividad (gráfico)
export async function GET() {
    try {
        const cacheKey = "stats:activity"
        const cached = cache.get(cacheKey)
        if (cached) {
            return NextResponse.json(cached, {
                headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' }
            })
        }

        // Obtener partidas de los ÚLTIMOS 30 DÍAS para calcular el patrón de actividad mensual
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const matches = await prisma.match.findMany({
            where: {
                gameStatus: "SUCCESS",
                timestamp: {
                    gte: thirtyDaysAgo
                }
            },
            select: {
                timestamp: true,
                _count: {
                    select: {
                        PlayerMatchStats: true
                    }
                }
            }
        })

        // Agrupar por hora del día (0-23) EN HORA CHILE (UTC-3)
        // Contamos PARTIDAS por hora, no participaciones de jugadores
        const hourlyActivity: { [hour: number]: number } = {}
        for (let i = 0; i < 24; i++) {
            hourlyActivity[i] = 0
        }

        matches.forEach(match => {
            // Convert UTC to Chile time (UTC-3)
            const utcDate = new Date(match.timestamp)
            const chileOffset = -3 // Chile is UTC-3
            const chileHour = (utcDate.getUTCHours() + chileOffset + 24) % 24
            hourlyActivity[chileHour] += 1 // Contar partidas, no jugadores
        })

        // Encontrar el pico de actividad
        let peakHour = 0
        let peakValue = 0
        Object.entries(hourlyActivity).forEach(([hour, count]) => {
            if (count > peakValue) {
                peakValue = count
                peakHour = parseInt(hour)
            }
        })

        // Calcular rango de pico (hora pico +/- 2 horas)
        const peakStart = peakHour >= 2 ? peakHour - 2 : 22 + peakHour
        const peakEnd = (peakHour + 2) % 24

        // Generar puntos para el gráfico SVG (normalizar valores)
        const maxActivity = Math.max(...Object.values(hourlyActivity), 1)
        const points: { x: number; y: number; hour: number; value: number }[] = []

        // Tomar muestras cada 3 horas para el gráfico
        const sampledHours = [0, 3, 6, 9, 12, 15, 18, 21]
        sampledHours.forEach((hour, index) => {
            const value = hourlyActivity[hour]
            const x = (index / (sampledHours.length - 1)) * 200
            const y = 45 - ((value / maxActivity) * 40) // Invertir Y, dejar margen
            points.push({ x, y, hour, value })
        })

        // Formatear puntos para polyline SVG
        const svgPoints = points.map(p => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" ")

        // Encontrar el punto de pico para el círculo
        const peakPoint = points.reduce((max, p) => p.value > max.value ? p : max, points[0])

        const responseData = {
            svgPoints,
            peakPoint: {
                x: peakPoint.x,
                y: peakPoint.y
            },
            peakHours: `${String(peakStart).padStart(2, "0")}:00 - ${String(peakEnd).padStart(2, "0")}:00`,
            hourlyData: hourlyActivity,
            totalMatchesWeek: matches.length
        }
        cache.set(cacheKey, responseData, 10 * 60 * 1000)

        return NextResponse.json(responseData, {
            headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' }
        })
    } catch (error) {
        console.error("Error fetching activity stats:", error)
        // Retornar datos por defecto en caso de error
        return NextResponse.json({
            svgPoints: "0,40 28,38 57,35 85,30 114,20 142,15 171,18 200,25",
            peakPoint: { x: 142, y: 15 },
            peakHours: "20:00 - 00:00",
            hourlyData: {},
            totalMatchesWeek: 0
        }, { status: 500 })
    }
}
