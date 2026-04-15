import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { PICKBAN_FORMATS } from '@/lib/pickban'

// GET /api/admin/pickban - List all pick/ban sessions
export async function GET(request: Request) {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const sessions = await prisma.pickBanSession.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            actions: { orderBy: { step: 'asc' } }
        }
    })

    return NextResponse.json({ sessions })
}

// POST /api/admin/pickban - Create a new pick/ban session
export async function POST(request: Request) {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { format, team1Name, team1Tag, team1Avatar, team2Name, team2Tag, team2Avatar, mapPool } = body

    if (!format || !PICKBAN_FORMATS[format]) {
        return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    if (!team1Name || !team1Tag || !team2Name || !team2Tag) {
        return NextResponse.json({ error: 'Faltan datos de equipos' }, { status: 400 })
    }

    const fmt = PICKBAN_FORMATS[format]
    if (!mapPool || !Array.isArray(mapPool) || mapPool.length < fmt.poolSize) {
        return NextResponse.json({ error: `Se necesitan al menos ${fmt.poolSize} mapas` }, { status: 400 })
    }

    const pbSession = await prisma.pickBanSession.create({
        data: {
            format,
            team1Name,
            team1Tag,
            team1Avatar: team1Avatar || null,
            team2Name,
            team2Tag,
            team2Avatar: team2Avatar || null,
            mapPool,
            createdById: session.user.id,
        }
    })

    return NextResponse.json({ session: pbSession })
}

// DELETE /api/admin/pickban - Delete a session
export async function DELETE(request: Request) {
    const authSession = await getSession()
    if (!authSession?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'Falta ID' }, { status: 400 })
    }

    await prisma.pickBanSession.delete({ where: { id } })
    return NextResponse.json({ ok: true })
}

// PATCH /api/admin/pickban - Reset a session (delete all actions, reset to WAITING)
export async function PATCH(request: Request) {
    const authSession = await getSession()
    if (!authSession?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'Falta ID' }, { status: 400 })
    }

    await prisma.pickBanSessionAction.deleteMany({ where: { sessionId: id } })
    await prisma.pickBanSession.update({
        where: { id },
        data: { status: 'WAITING', currentStep: 0 }
    })

    return NextResponse.json({ ok: true })
}
