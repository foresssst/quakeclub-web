import { AliasesContent } from "@/components/aliases-content"

interface PageProps {
  params: Promise<{ steamId: string }>
}

export default async function AliasesPage({ params }: PageProps) {
  const { steamId } = await params

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-12 pb-12 max-w-[1100px] space-y-4">
        {/* Top Ad - In-Feed */}

        <AliasesContent steamId={steamId} />

        {/* Bottom Ad - Display */}
      </div>
    </div>
  )
}
