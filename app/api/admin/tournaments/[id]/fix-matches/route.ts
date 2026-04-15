import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// POST /api/admin/tournaments/[id]/fix-matches - Fix match groupIds based on participant groups
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { id: tournamentId } = await params

        // Get all matches with their participants
        const matches = await prisma.tournamentMatch.findMany({
            where: {
                tournamentId,
                isPlayoff: false
            },
            include: {
                participant1Reg: {
                    select: { id: true, groupId: true }
                },
                participant2Reg: {
                    select: { id: true, groupId: true }
                }
            }
        })

        const fixed: string[] = []
        const invalid: string[] = []
        const unchanged: string[] = []

        for (const match of matches) {
            const p1GroupId = match.participant1Reg?.groupId
            const p2GroupId = match.participant2Reg?.groupId

            // Check if both participants are in the same group
            if (p1GroupId && p2GroupId && p1GroupId === p2GroupId) {
                // Both are in the same group
                if (match.groupId !== p1GroupId) {
                    // Fix the match groupId
                    await prisma.tournamentMatch.update({
                        where: { id: match.id },
                        data: { groupId: p1GroupId }
                    })
                    fixed.push(match.id)
                } else {
                    unchanged.push(match.id)
                }
            } else {
                // Participants are in different groups - this match is invalid
                invalid.push(match.id)
            }
        }

        return NextResponse.json({
            success: true,
            total: matches.length,
            fixed: fixed.length,
            unchanged: unchanged.length,
            invalid: invalid.length,
            invalidMatchIds: invalid,
            message: invalid.length > 0 
                ? `Se corrigieron ${fixed.length} partidos. ${invalid.length} partidos tienen equipos de diferentes grupos y deben ser eliminados o corregidos manualmente.`
                : `Se corrigieron ${fixed.length} partidos. ${unchanged.length} ya estaban correctos.`
        })

    } catch (error) {
        console.error("Error fixing matches:", error)
        return NextResponse.json(
            { error: "Error al corregir partidos: " + (error as Error).message },
            { status: 500 }
        )
    }
}

// DELETE /api/admin/tournaments/[id]/fix-matches - Delete invalid cross-group matches
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user?.isAdmin) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }

        const { id: tournamentId } = await params

        // Get all group stage matches
        const matches = await prisma.tournamentMatch.findMany({
            where: {
                tournamentId,
                isPlayoff: false
            },
            include: {
                participant1Reg: {
                    select: { id: true, groupId: true }
                },
                participant2Reg: {
                    select: { id: true, groupId: true }
                }
            }
        })

        const toDelete: string[] = []

        for (const match of matches) {
            const p1GroupId = match.participant1Reg?.groupId
            const p2GroupId = match.participant2Reg?.groupId

            // If participants are in different groups, mark for deletion
            if (p1GroupId && p2GroupId && p1GroupId !== p2GroupId) {
                toDelete.push(match.id)
            }
        }

        if (toDelete.length > 0) {
            // Delete maps first (cascade)
            await prisma.tournamentMap.deleteMany({
                where: {
                    matchId: { in: toDelete }
                }
            })

            // Delete invalid matches
            await prisma.tournamentMatch.deleteMany({
                where: {
                    id: { in: toDelete }
                }
            })
        }

        return NextResponse.json({
            success: true,
            deleted: toDelete.length,
            message: `Se eliminaron ${toDelete.length} partidos inválidos (equipos de diferentes grupos).`
        })

    } catch (error) {
        console.error("Error deleting invalid matches:", error)
        return NextResponse.json(
            { error: "Error al eliminar partidos inválidos: " + (error as Error).message },
            { status: 500 }
        )
    }
}
