"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Check, X, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useQuery } from "@tanstack/react-query"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"

interface JoinRequest {
  id: string
  message: string
  createdAt: string
  steamId: string
  player: {
    username: string
    steamId: string
    avatar?: string
    PlayerRating?: Array<{
      rating: number
    }>
  }
}

export default function ClanRequestsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const clanSlug = params.slug as string

  const [processingId, setProcessingId] = useState<string | null>(null)

  const { data: requests = [], isLoading: loading, error: requestsError, refetch: refetchRequests } = useQuery({
    queryKey: ['clan-join-requests', clanSlug],
    queryFn: async () => {
      const response = await fetch(`/api/clans/slug/${clanSlug}/join-request`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al cargar solicitudes")
      }
      return data.requests || []
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const error = requestsError ? (requestsError as Error).message : ""

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    setProcessingId(requestId)

    try {
      const response = await fetch(`/api/clans/join-requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Error al procesar solicitud",
          variant: "destructive",
        })
        setProcessingId(null)
        return
      }

      toast({
        title: action === "accept" ? "Solicitud aceptada" : "Solicitud rechazada",
        description: data.message,
      })

      setProcessingId(null)
      refetchRequests()
    } catch (err) {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      })
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <div className="container mx-auto px-3 sm:px-4 max-w-[1100px] pb-16 pt-8 sm:pt-12">
          <ContentContainer>
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/30 border-t-[#1a1a1e]" />
            </div>
          </ContentContainer>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 max-w-[1100px] pb-16 pt-8 sm:pt-12 animate-fade-up">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/clanes/${clanSlug}`)}
          className="inline-flex items-center gap-2 text-xs text-foreground/40 hover:text-foreground transition-colors mb-4 uppercase tracking-wider"
        >
          ← Volver al Clan
        </button>

        <ContentContainer className="animate-scale-fade [animation-delay:100ms]">
          <ContentHeader>
            <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
              Solicitudes de Unión
            </h1>
            <p className="text-xs text-foreground/40 mt-1">
              <span className="text-foreground font-bold">{requests.length}</span> solicitud{requests.length !== 1 ? "es" : ""} pendiente{requests.length !== 1 ? "s" : ""}
            </p>
          </ContentHeader>

          <div className="p-4 sm:p-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4 text-sm text-red-500">
                {error}
              </div>
            )}

            {requests.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-foreground/40 text-sm">No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((request: JoinRequest) => (
                  <div
                    key={request.id}
                    className="bg-foreground/[0.02] border border-foreground/[0.06] rounded-lg p-4 hover:border-foreground/20 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">{request.player.username}</span>
                          <span className="inline-block bg-foreground/10 border border-foreground/30 px-2 py-0.5 text-[10px] font-bold text-foreground rounded">
                            {request.player.PlayerRating?.[0]?.rating?.toFixed(0) || "900"} ELO
                          </span>
                        </div>
                        <p className="text-[10px] text-foreground/30 mt-1">Solicitó unirse el {formatDate(request.createdAt)}</p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRespond(request.id, "accept")}
                          disabled={processingId === request.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-foreground/10 hover:bg-foreground/20 border border-foreground/30 text-foreground font-bold uppercase text-[10px] rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              Aceptar
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRespond(request.id, "reject")}
                          disabled={processingId === request.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 font-bold uppercase text-[10px] rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="h-3 w-3" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ContentContainer>
      </div>
    </div>
  )
}
