import { NextRequest, NextResponse } from "next/server"
import * as dgram from "dgram"

export const dynamic = "force-dynamic"

// A2S_PLAYER query protocol constants
const A2S_PLAYER = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55, 0xFF, 0xFF, 0xFF, 0xFF])

interface Player {
  index: number
  name: string
  score: number
  duration: number
}

// Parse A2S_PLAYER response
function parsePlayerResponse(buffer: Buffer): Player[] {
  const players: Player[] = []

  // Check header (0xFF 0xFF 0xFF 0xFF 0x44)
  if (buffer.length < 6 || buffer[4] !== 0x44) {
    return players
  }

  let offset = 5
  const numPlayers = buffer.readUInt8(offset)
  offset++

  for (let i = 0; i < numPlayers && offset < buffer.length; i++) {
    try {
      const index = buffer.readUInt8(offset)
      offset++

      // Read null-terminated string for name
      let nameEnd = offset
      while (nameEnd < buffer.length && buffer[nameEnd] !== 0) {
        nameEnd++
      }
      const name = buffer.slice(offset, nameEnd).toString("utf8")
      offset = nameEnd + 1

      // Score (4 bytes, little endian signed int32)
      const score = buffer.readInt32LE(offset)
      offset += 4

      // Duration (4 bytes, float)
      const duration = buffer.readFloatLE(offset)
      offset += 4

      players.push({ index, name, score, duration })
    } catch {
      break
    }
  }

  return players
}

// Query server for player list
async function queryPlayers(ip: string, port: number): Promise<Player[]> {
  return new Promise((resolve) => {
    const client = dgram.createSocket("udp4")
    let challengeReceived = false

    const timeout = setTimeout(() => {
      client.close()
      resolve([])
    }, 3000) // 3 second timeout

    client.on("message", (msg) => {
      // Check for challenge response (0xFF 0xFF 0xFF 0xFF 0x41)
      if (!challengeReceived && msg.length >= 9 && msg[4] === 0x41) {
        challengeReceived = true
        // Extract challenge number and send new request
        const challenge = msg.slice(5, 9)
        const request = Buffer.concat([
          Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55]),
          challenge
        ])
        client.send(request, port, ip)
        return
      }

      // Parse player response
      if (msg[4] === 0x44) {
        clearTimeout(timeout)
        const players = parsePlayerResponse(msg)
        client.close()
        resolve(players)
      }
    })

    client.on("error", () => {
      clearTimeout(timeout)
      client.close()
      resolve([])
    })

    // Send initial A2S_PLAYER request
    client.send(A2S_PLAYER, port, ip)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ip = searchParams.get("ip")
  const portStr = searchParams.get("port")

  if (!ip || !portStr) {
    return NextResponse.json({ error: "Missing ip or port" }, { status: 400 })
  }

  const port = parseInt(portStr, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "Invalid port" }, { status: 400 })
  }

  // Validate IP format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(ip)) {
    return NextResponse.json({ error: "Invalid IP" }, { status: 400 })
  }

  try {
    const players = await queryPlayers(ip, port)

    return NextResponse.json({
      ip,
      port,
      players,
      count: players.length,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    })
  } catch (error) {
    console.error("[A2S_PLAYER] Error:", error)
    return NextResponse.json({
      ip,
      port,
      players: [],
      count: 0,
      error: "Failed to query server"
    }, { status: 200 })
  }
}
