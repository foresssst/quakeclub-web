"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import type { NewsItem } from "@/types/news"
import { NewsImage } from "@/components/news-image"
import { LoadingScreen } from "@/components/loading-screen"
import { NewsComments } from "@/components/news-comments"

export default function NoticiaContent() {
  const params = useParams()
  const router = useRouter()

  const { data: newsData, isFetched: newsFetched, error } = useQuery({
    queryKey: ['news-detail', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/news/${params.id}`)
      if (!res.ok) {
        router.push("/noticias")
        throw new Error('Failed to fetch news')
      }
      const data = await res.json()
      return data.news
    },
    enabled: !!params.id,
    staleTime: 5 * 60 * 1000, // 5 minutes (static content)
    placeholderData: (previousData) => previousData,
    retry: false
  })

  const news = newsData || null

  const processedContent = news?.content
    ? (() => {
      let content = news.content

      if (news.contentImages && typeof news.contentImages === "object") {
        Object.entries(news.contentImages).forEach(([imageId, dataUrl]) => {
          const urlStr = dataUrl as string
          const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${imageId}\\)`, "g")
          content = content.replace(regex, `![$1](${urlStr})`)
        })
      }

      return content
    })()
    : ""

  if (!newsFetched) {
    return <LoadingScreen />
  }

  if (error || !news) {
    return null
  }

  // Parsear la fecha como fecha local (no UTC) para evitar el desfase de timezone
  const [year, month, day] = news.date.split("-").map(Number)
  const newsDate = new Date(year, month - 1, day)
  const formattedDate = newsDate.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="relative min-h-screen">

      <div className="container mx-auto py-6 sm:py-8 px-3 sm:px-4 max-w-[1400px] pt-8 sm:pt-12">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-up">
          {/* Banner de la noticia */}
          <div className="relative h-[40vh] sm:h-[50vh] md:h-[60vh] w-full overflow-hidden bg-card shadow-sm border border-foreground/[0.06] rounded-xl">
            {news.imageUrl || news.image ? (
              <NewsImage
                src={news.imageUrl || news.image}
                alt={news.title}
                width={1920}
                height={1080}
                className="h-full w-full object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-[var(--qc-bg-medium)]">
                <div className="flex h-full items-center justify-center text-foreground/20">
                  <span className="text-9xl">📰</span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/35" />

            <div className="absolute bottom-4 left-4">
              <span className="bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider text-background">
                Noticias
              </span>
            </div>
          </div>

          {/* Contenido de la noticia */}
          <article className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl overflow-hidden animate-scale-fade [animation-delay:100ms]">
            <div className="px-6 sm:px-8 py-8 sm:py-12">
              {/* Header */}
              <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-6 mb-8 rounded-xl">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                  <div className="flex-shrink-0">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-foreground/40 tracking-wider">Escrito por</p>
                        <p className="font-medium text-foreground/82">{news.author}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-foreground/40 tracking-wider">Publicado</p>
                        <p className="text-sm font-medium text-foreground/82">{formattedDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <h1 className="font-tiktok text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-wider text-foreground leading-tight">
                      {news.title}
                    </h1>
                    <p className="text-lg sm:text-xl text-foreground/70 leading-relaxed normal-case">{news.excerpt}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-lg max-w-none px-6 normal-case">
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks, remarkGfm]}
                  disallowedElements={["script", "iframe", "object", "embed"]}
                  unwrapDisallowed={true}
                  skipHtml={false}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-6 mt-8 font-minecraft text-3xl font-bold uppercase tracking-wide text-foreground">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-4 mt-8 font-minecraft text-2xl font-bold uppercase tracking-wide text-foreground">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-3 mt-6 text-xl font-bold uppercase tracking-wide text-foreground">{children}</h3>
                    ),
                    p: ({ children, node }) => {
                      const childArray = Array.isArray(children) ? children : [children]
                      const hasLevelshots = node?.children?.some(
                        (child: any) => child.tagName === 'img' && child.properties?.src?.includes('/levelshots/')
                      )
                      if (hasLevelshots) {
                        return <span className="block my-6 flex flex-wrap mx-[-2px] sm:mx-[-3px]">{children}</span>
                      }
                      return <p className="mb-6 leading-relaxed text-foreground/70">{children}</p>
                    },
                    br: () => <br className="my-2" />,
                    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic text-foreground/60">{children}</em>,
                    ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground/70">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground/70">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-foreground underline transition-colors hover:text-foreground/70"
                      >
                        {children}
                      </a>
                    ),
                    img: ({ src, alt }) => {
                      const srcString = typeof src === 'string' ? src : undefined

                      // Levelshot: render as compact card
                      if (srcString && srcString.includes('/levelshots/')) {
                        const mapName = alt || srcString.split('/').pop()?.replace('.jpg', '') || 'Map'
                        return (
                          <span className="inline-block w-[calc(50%-4px)] sm:w-[calc(33.333%-6px)] align-top m-[2px] sm:m-[3px]">
                            <span className="block relative aspect-[16/10] rounded-lg overflow-hidden group">
                              <img
                                src={srcString}
                                alt={mapName}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.src = "/levelshots/default.jpg"
                                }}
                              />
                              <span className="absolute inset-0 bg-black/38" />
                              <span className="absolute bottom-0 left-0 right-0 px-2.5 py-2">
                                <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white drop-shadow-lg">
                                  {mapName}
                                </span>
                              </span>
                            </span>
                          </span>
                        )
                      }

                      return (
                        <span className="my-6 block">
                          <img
                            src={srcString || "/branding/logo.png"}
                            alt={alt || "Imagen de la noticia"}
                            className="mx-auto max-w-full rounded"
                            style={{ maxHeight: "800px", objectFit: "contain" }}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </span>
                      )
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="my-4 border-l-4 border-foreground bg-foreground/[0.04] py-2 pl-4 italic text-foreground/60">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-sm text-foreground">{children}</code>
                    ),
                    pre: ({ children }) => (
                      <pre className="my-4 overflow-x-auto rounded-lg bg-foreground/[0.04] p-4 font-mono text-sm text-foreground/70">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>              {/* Footer */}
              <div className="mt-12 pt-8 border-t border-foreground/[0.06] text-center px-6">
                <Link
                  href="/noticias"
                  className="inline-block rounded-lg bg-foreground px-8 py-3 font-bold uppercase tracking-wide text-background transition-all hover:opacity-90"
                >
                  ← Ver todas las noticias
                </Link>
              </div>
            </div>
          </article>

          {/* Comments */}
          {news.id && <NewsComments newsId={news.id} />}
        </div>
      </div>

    </div>
  )
}
