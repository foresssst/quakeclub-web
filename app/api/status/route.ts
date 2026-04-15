import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface ServiceStatus {
    name: string
    key: string
    status: "operational" | "degraded" | "down"
    description: string
    responseTime?: number
}

interface ServerInfo {
    name: string
    address: string
    online: boolean
    players: number
    maxPlayers: number
    map?: string
}

interface HistoryEntry {
    date: string
    status: "operational" | "degraded" | "down"
}

// Get start of today (Chile timezone, UTC-3)
function getToday(): Date {
    const now = new Date()
    // Adjust to Chile timezone
    const chileOffset = -3 * 60 // UTC-3 in minutes
    const localOffset = now.getTimezoneOffset()
    const diff = chileOffset + localOffset
    now.setMinutes(now.getMinutes() + diff)
    now.setHours(0, 0, 0, 0)
    return now
}

export async function GET() {
    const services: ServiceStatus[] = []
    const servers: ServerInfo[] = []
    const history: Record<string, HistoryEntry[]> = {}

    // 1. Check QuakeClub API
    let apiStatus: "operational" | "degraded" | "down" = "operational"
    let apiTime = 0

    try {
        const startApi = Date.now()
        const testRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "https://quakeclub.com"}/api/stats/social`, {
            signal: AbortSignal.timeout(5000),
        })
        apiTime = Date.now() - startApi
        apiStatus = testRes.ok ? (apiTime < 2000 ? "operational" : "degraded") : "down"
    } catch {
        apiStatus = "down"
    }

    services.push({
        name: "API QuakeClub",
        key: "api",
        status: apiStatus,
        description: "Backend y servicios web",
        responseTime: apiTime,
    })

    // 2. Check Game Servers - Use existing /api/servers-status endpoint
    let serverStatus: "operational" | "degraded" | "down" = "operational"
    let serverTime = 0
    let serverDescription = "Verificando..."

    try {
        const startServers = Date.now()
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quakeclub.com"
        const serversRes = await fetch(`${baseUrl}/api/servers-status`, {
            signal: AbortSignal.timeout(10000),
            cache: "no-store",
        })

        serverTime = Date.now() - startServers

        if (serversRes.ok) {
            const serversData = await serversRes.json()
            const onlineCount = serversData.length

            // Transform to our format
            for (const srv of serversData) {
                servers.push({
                    name: srv.name || "Servidor QuakeClub",
                    address: `${srv.ip}:${srv.port}`,
                    online: srv.status === "online",
                    players: srv.players || 0,
                    maxPlayers: srv.maxplayers || 16,
                    map: srv.map,
                })
            }

            // Get expected count from DB
            const expectedCount = await prisma.zmqServerConfig.count({ where: { enabled: true } })

            serverStatus = onlineCount >= expectedCount ? "operational" : onlineCount > 0 ? "degraded" : "down"
            serverDescription = `${onlineCount}/${expectedCount} servidores online`
        } else {
            serverStatus = "down"
            serverDescription = "Error al verificar servidores"
        }
    } catch {
        serverStatus = "down"
        serverDescription = "No se pudo verificar"
    }

    services.push({
        name: "Servidores de Juego",
        key: "servers",
        status: serverStatus,
        description: serverDescription,
        responseTime: serverTime,
    })

    // 3. Save today's status (upsert - update if exists, create if not)
    const today = getToday()

    try {
        // Save API status
        await prisma.statusHistory.upsert({
            where: {
                service_date: { service: "api", date: today }
            },
            update: {
                status: apiStatus,
                responseTime: apiTime,
            },
            create: {
                service: "api",
                status: apiStatus,
                responseTime: apiTime,
                date: today,
            }
        })

        // Save server status
        await prisma.statusHistory.upsert({
            where: {
                service_date: { service: "servers", date: today }
            },
            update: {
                status: serverStatus,
                responseTime: serverTime,
                details: serverDescription,
            },
            create: {
                service: "servers",
                status: serverStatus,
                responseTime: serverTime,
                details: serverDescription,
                date: today,
            }
        })
    } catch (e) {
        console.error("Failed to save status history:", e)
    }

    // 4. Get last 90 days of history
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    try {
        const historyRecords = await prisma.statusHistory.findMany({
            where: {
                date: { gte: ninetyDaysAgo }
            },
            orderBy: { date: "asc" }
        })

        // Organize by service
        for (const record of historyRecords) {
            if (!history[record.service]) {
                history[record.service] = []
            }
            history[record.service].push({
                date: record.date.toISOString().split("T")[0],
                status: record.status as "operational" | "degraded" | "down",
            })
        }
    } catch (e) {
        console.error("Failed to fetch status history:", e)
    }

    // Calculate overall status
    const allOperational = services.every(s => s.status === "operational")
    const anyDown = services.some(s => s.status === "down")

    return NextResponse.json({
        overall: anyDown ? "down" : allOperational ? "operational" : "degraded",
        services,
        servers,
        history,
        timestamp: new Date().toISOString(),
    })
}
