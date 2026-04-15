import Image from "next/image"

interface LoadingScreenProps {
  compact?: boolean
}

export function LoadingScreen({ compact = false }: LoadingScreenProps) {
  return (
    <div className={`flex items-center justify-center ${compact ? "py-6" : "min-h-[55vh]"}`}>
      <div className="flex flex-col items-center gap-1.5">
        <Image
          src="/tiers/carga.gif"
          alt="Cargando..."
          width={compact ? 40 : 64}
          height={compact ? 40 : 64}
          unoptimized
          priority
          className="animate-fade-up opacity-90"
        />
        {!compact && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#999] font-bold">
            Cargando
          </span>
        )}
      </div>
    </div>
  )
}
