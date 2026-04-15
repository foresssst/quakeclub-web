import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// API pública para obtener próximos torneos
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(parseInt(searchParams.get("limit") || "3"), 10)

        const tournaments = await prisma.tournament.findMany({
            where: {
                status: {
                    in: ["UPCOMING", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"]
                }
            },
            orderBy: [
                { status: "asc" }, // REGISTRATION_OPEN primero
                { startsAt: "asc" }
            ],
            take: limit,
            select: {
                id: true,
                name: true,
                slug: true,
                gameType: true,
                format: true,
                teamBased: true,
                maxParticipants: true,
                status: true,
                startsAt: true,
                registrationOpens: true,
                registrationCloses: true,
                imageUrl: true,
                _count: {
                    select: {
                        registrations: {
                            where: {
                                status: {
                                    in: ["PENDING", "APPROVED", "CHECKED_IN"]
                                }
                            }
                        }
                    }
                }
            }
        })

        // Formatear para el frontend
        const formattedTournaments = tournaments.map(t => {
            // Determinar el estado en español
            let statusText = "Próximamente"
            if (t.status === "REGISTRATION_OPEN") {
                statusText = "Inscripción abierta"
            } else if (t.status === "REGISTRATION_CLOSED") {
                statusText = "Inscripción cerrada"
            } else if (t.status === "IN_PROGRESS") {
                statusText = "En curso"
            }

            // Formatear el modo de juego
            const gameType = t.gameType.toUpperCase()
            const mode = t.teamBased ? `${gameType} ${t.format === "ROUND_ROBIN" ? "Liga" : "Equipo"}` : `${gameType} 1v1`

            // Formatear fecha
            const date = t.startsAt
                ? new Date(t.startsAt).toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "America/Santiago"
                  }).toUpperCase()
                : "TBD"

            return {
                id: t.id,
                name: t.name,
                slug: t.slug,
                date,
                mode,
                status: statusText,
                participants: t._count.registrations,
                maxParticipants: t.maxParticipants,
                imageUrl: t.imageUrl
            }
        })

        return NextResponse.json({
            tournaments: formattedTournaments
        })
    } catch (error) {
        console.error("Error fetching upcoming tournaments:", error)
        return NextResponse.json({ tournaments: [] }, { status: 500 })
    }
}
