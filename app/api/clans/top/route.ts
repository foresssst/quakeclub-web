import { NextResponse } from "next/server"
import { getTopClans } from "@/lib/clan-elo"

// GET /api/clans/top - Top 10 clanes por ELO promedio (CA)
export async function GET() {
    try {
        const clans = await getTopClans(10)
        return NextResponse.json({ clans })
    } catch (error) {
        console.error("Error fetching top clans:", error)
        return NextResponse.json({ error: "Error" }, { status: 500 })
    }
}
