import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"

interface ConfigMetadata {
    name: string
    size: string
    uploadDate: string
    downloads: number
    userId: string
    username: string
    author: string
    description: string
    previewImage?: string
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(parseInt(searchParams.get("limit") || "4"), 10)

        const metadataPath = path.join(process.cwd(), "public", "configs", "metadata.json")

        if (!fs.existsSync(metadataPath)) {
            return NextResponse.json({ configs: [] })
        }

        const data = fs.readFileSync(metadataPath, "utf-8")
        const configs: ConfigMetadata[] = JSON.parse(data)

        // Ordenar por descargas descendente y limitar
        const popularConfigs = configs
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, limit)
            .map(config => ({
                name: config.name,
                author: config.author || config.username,
                downloads: config.downloads,
                uploadDate: config.uploadDate,
                previewImage: config.previewImage,
                downloadUrl: `/configs/${config.name}`
            }))

        return NextResponse.json({ configs: popularConfigs })
    } catch (error) {
        console.error("Error fetching popular configs:", error)
        return NextResponse.json({ configs: [] }, { status: 500 })
    }
}
