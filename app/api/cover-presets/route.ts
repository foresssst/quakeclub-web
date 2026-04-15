import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
    try {
        const presets = await prisma.coverPreset.findMany({
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                name: true,
                imageUrl: true,
            },
        })

        return NextResponse.json({ success: true, presets })
    } catch (error) {
        console.error("Error fetching cover presets:", error)
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
}
