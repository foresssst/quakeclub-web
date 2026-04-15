import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PICKBAN_FORMATS, computePickBanState } from '@/lib/pickban'

// GET /api/pickban/[id] - Get pick/ban session state (public)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const session = await prisma.pickBanSession.findUnique({
        where: { id },
        include: {
            actions: { orderBy: { step: 'asc' } }
        }
    })

    if (!session) {
        return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    const format = PICKBAN_FORMATS[session.format]
    if (!format) {
        return NextResponse.json({ error: 'Formato inválido' }, { status: 500 })
    }

    const state = computePickBanState(
        session.mapPool,
        session.actions.map(a => ({
            step: a.step,
            action: a.action,
            mapName: a.mapName,
            teamId: a.team === 'a' ? 'team_a' : 'team_b'
        })),
        format,
        'team_a',
        'team_b'
    )

    return NextResponse.json({
        id: session.id,
        format: session.format,
        formatInfo: format,
        status: session.status,
        team1: { name: session.team1Name, tag: session.team1Tag, avatar: session.team1Avatar },
        team2: { name: session.team2Name, tag: session.team2Tag, avatar: session.team2Avatar },
        mapPool: session.mapPool,
        ...state,
        currentTeam: state.currentTeamId === 'team_a' ? 'a' : state.currentTeamId === 'team_b' ? 'b' : null,
        actions: session.actions.map(a => ({
            step: a.step,
            action: a.action,
            mapName: a.mapName,
            team: a.team,
        })),
    })
}

// POST /api/pickban/[id] - Execute a pick/ban action (public)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await request.json()
    const { team, mapName } = body as { team: 'a' | 'b'; mapName: string }

    if (!team || !mapName || !['a', 'b'].includes(team)) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const session = await prisma.pickBanSession.findUnique({
        where: { id },
        include: { actions: { orderBy: { step: 'asc' } } }
    })

    if (!session) {
        return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    if (session.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Sesión ya completada' }, { status: 400 })
    }

    const format = PICKBAN_FORMATS[session.format]
    if (!format) {
        return NextResponse.json({ error: 'Formato inválido' }, { status: 500 })
    }

    const state = computePickBanState(
        session.mapPool,
        session.actions.map(a => ({
            step: a.step,
            action: a.action,
            mapName: a.mapName,
            teamId: a.team === 'a' ? 'team_a' : 'team_b'
        })),
        format,
        'team_a',
        'team_b'
    )

    if (state.isCompleted) {
        return NextResponse.json({ error: 'Ya se completaron todos los pasos' }, { status: 400 })
    }

    // Validate it's the right team's turn
    const expectedTeam = state.currentTeamId === 'team_a' ? 'a' : 'b'
    if (team !== expectedTeam) {
        return NextResponse.json({ error: 'No es tu turno' }, { status: 400 })
    }

    // Validate map is available
    if (!state.availableMaps.includes(mapName)) {
        return NextResponse.json({ error: 'Mapa no disponible' }, { status: 400 })
    }

    const currentAction = state.currentAction!

    // Create the action
    await prisma.pickBanSessionAction.create({
        data: {
            sessionId: id,
            step: state.currentStep,
            action: currentAction,
            mapName,
            team,
        }
    })

    // Check if this was the last step
    const newStep = state.currentStep + 1
    const isNowCompleted = newStep >= format.steps.length

    await prisma.pickBanSession.update({
        where: { id },
        data: {
            currentStep: newStep,
            status: isNowCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        }
    })

    return NextResponse.json({ ok: true, step: state.currentStep, action: currentAction, mapName })
}
