import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join } from 'path'

// GET /api/maps/list - Returns all available map names from levelshots
export async function GET() {
    try {
        const dir = join(process.cwd(), 'public', 'levelshots')
        const files = await readdir(dir)
        const maps = files
            .filter(f => f.endsWith('.jpg'))
            .map(f => f.replace('.jpg', ''))
            .filter(m => m !== 'default' && m !== 'loadingback' && m !== 'preview')
            .sort()

        return NextResponse.json({ maps })
    } catch {
        return NextResponse.json({ maps: [] })
    }
}
