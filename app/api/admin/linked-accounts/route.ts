import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// GET /api/admin/linked-accounts - List all linked account groups
export async function GET() {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const groups = await prisma.linkedAccountGroup.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            accounts: {
                include: {
                    player: {
                        select: {
                            id: true,
                            steamId: true,
                            username: true,
                            avatar: true,
                            lastSeen: true,
                        }
                    }
                },
                orderBy: { isPrimary: 'desc' }
            }
        }
    })

    return NextResponse.json({ groups })
}

// POST /api/admin/linked-accounts - Scan QLDS Redis for multi-account clusters
export async function POST(request: Request) {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'scan') {
        return runScan()
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
}

// PATCH /api/admin/linked-accounts - Update group status
export async function PATCH(request: Request) {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { groupId, status, note, primarySteamId } = body

    if (!groupId) {
        return NextResponse.json({ error: 'groupId requerido' }, { status: 400 })
    }

    // Update group status
    if (status && ['pending', 'confirmed', 'dismissed'].includes(status)) {
        await prisma.linkedAccountGroup.update({
            where: { id: groupId },
            data: {
                status,
                note: note ?? undefined,
                reviewedBy: session.user.steamId,
                reviewedAt: new Date(),
            }
        })
    }

    // Set primary account
    if (primarySteamId) {
        await prisma.$transaction([
            prisma.linkedAccount.updateMany({
                where: { groupId },
                data: { isPrimary: false }
            }),
            prisma.linkedAccount.updateMany({
                where: { groupId, steamId: primarySteamId },
                data: { isPrimary: true }
            })
        ])
    }

    const updated = await prisma.linkedAccountGroup.findUnique({
        where: { id: groupId },
        include: {
            accounts: {
                include: {
                    player: {
                        select: { id: true, steamId: true, username: true, avatar: true, lastSeen: true }
                    }
                },
                orderBy: { isPrimary: 'desc' }
            }
        }
    })

    return NextResponse.json({ group: updated })
}

// DELETE /api/admin/linked-accounts - Delete a group or remove an account from a group
export async function DELETE(request: Request) {
    const session = await getSession()
    if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const accountId = searchParams.get('accountId')

    if (!groupId) {
        return NextResponse.json({ error: 'groupId requerido' }, { status: 400 })
    }

    // Remove a single account from the group
    if (accountId) {
        await prisma.linkedAccount.delete({ where: { id: accountId } })

        // If the group has less than 2 accounts remaining, delete the whole group
        const remaining = await prisma.linkedAccount.count({ where: { groupId } })
        if (remaining < 2) {
            await prisma.linkedAccountGroup.delete({ where: { id: groupId } })
            return NextResponse.json({ success: true, deleted: 'group' })
        }

        return NextResponse.json({ success: true, deleted: 'account' })
    }

    // Delete entire group
    await prisma.linkedAccountGroup.delete({ where: { id: groupId } })
    return NextResponse.json({ success: true, deleted: 'group' })
}

// Run the Redis scan via SSH to QLDS server
async function runScan() {
    try {
        const keyPath = path.resolve(process.cwd(), process.env.QLDS_SSH_KEY_PATH ?? '.llaves/qlds-server.key')
        const sshHost = process.env.QLDS_SSH_HOST
        const scanScript = process.env.QLDS_SCAN_SCRIPT_PATH
        if (!sshHost || !scanScript) {
            throw new Error('QLDS_SSH_HOST o QLDS_SCAN_SCRIPT_PATH no configurados')
        }
        const sshCmd = `ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshHost} "python3 ${scanScript}"`

        const { stdout } = await execAsync(sshCmd, { timeout: 30000 })
        const clusters = JSON.parse(stdout.trim())

        let created = 0
        let skipped = 0

        for (const cluster of clusters) {
            const steamIds = cluster.accounts.map((a: { steamId: string }) => a.steamId).sort()
            const fingerprint = steamIds.join(',')

            // Check if a group with these exact steam IDs already exists
            const existingGroups = await prisma.linkedAccountGroup.findMany({
                include: { accounts: true }
            })

            const alreadyExists = existingGroups.some(g => {
                const existingSteamIds = g.accounts.map(a => a.steamId).sort().join(',')
                return existingSteamIds === fingerprint
            })

            if (alreadyExists) {
                skipped++
                continue
            }

            // Match steam IDs to existing players in the database
            const players = await prisma.player.findMany({
                where: { steamId: { in: steamIds } },
                select: { id: true, steamId: true, username: true }
            })
            const playerMap = new Map(players.map(p => [p.steamId, p]))

            await prisma.linkedAccountGroup.create({
                data: {
                    accounts: {
                        create: cluster.accounts.map((a: { steamId: string; sharedIps: string[]; primaryName: string }, idx: number) => {
                            const player = playerMap.get(a.steamId)
                            return {
                                id: undefined,
                                steamId: a.steamId,
                                playerId: player?.id ?? null,
                                sharedIps: a.sharedIps,
                                isPrimary: idx === 0,
                            }
                        })
                    }
                }
            })
            created++
        }

        return NextResponse.json({
            success: true,
            message: `Escaneo completado: ${created} grupos nuevos, ${skipped} ya existentes`,
            created,
            skipped,
            total: clusters.length,
        })
    } catch (error) {
        console.error('Scan error:', error)
        return NextResponse.json(
            { error: 'Error al escanear: ' + (error instanceof Error ? error.message : 'desconocido') },
            { status: 500 }
        )
    }
}
