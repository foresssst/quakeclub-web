import { NextRequest } from "next/server"
import { getRedis, ACTIONS_CHANNEL } from "@/lib/redis"
import Redis from "ioredis"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("x-api-key")
    if (apiKey !== process.env.MINQLX_API_KEY) {
        return new Response("Unauthorized", { status: 401 })
    }

    const encoder = new TextEncoder()
    let subscriber: Redis | null = null

    const stream = new ReadableStream({
        start(controller) {
            const redis = getRedis()
            subscriber = redis.duplicate()

            subscriber.subscribe(ACTIONS_CHANNEL)

            subscriber.on("message", (_channel: string, message: string) => {
                try {
                    controller.enqueue(encoder.encode("data: " + message + "\n\n"))
                } catch (_e) {
                    // client disconnected
                }
            })

            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": keepalive\n\n"))
                } catch (_e) {
                    clearInterval(keepalive)
                }
            }, 20000)

            request.signal.addEventListener("abort", () => {
                clearInterval(keepalive)
                if (subscriber) {
                    subscriber.unsubscribe(ACTIONS_CHANNEL)
                    subscriber.disconnect()
                }
                try { controller.close() } catch (_e) { /* ignore */ }
            })
        },
        cancel() {
            if (subscriber) {
                subscriber.unsubscribe(ACTIONS_CHANNEL)
                subscriber.disconnect()
            }
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}
