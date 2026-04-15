"use client"

import Image from "next/image"
import { getTierInfo, getTierProgress, getEloToNextTier, getNextTierName } from "@/lib/tiers"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

interface TierBadgeProps {
    elo: number
    gameType?: string
    size?: "xs" | "sm" | "md" | "lg" | "xl"
    showLabel?: boolean
    showProgress?: boolean
    showTooltip?: boolean
    className?: string
}

const SIZE_CONFIG = {
    xs: { image: 20, text: "text-[8px]" },
    sm: { image: 28, text: "text-[10px]" },
    md: { image: 40, text: "text-xs" },
    lg: { image: 56, text: "text-sm" },
    xl: { image: 72, text: "text-base" },
}

/**
 * Componente que muestra el icono del tier basado en el ELO
 * Reemplaza visualmente el número de ELO en rankings, ladder, etc.
 */
export function TierBadge({
    elo,
    gameType,
    size = "md",
    showLabel = false,
    showProgress = false,
    showTooltip = true,
    className = "",
}: TierBadgeProps) {
    const tierInfo = getTierInfo(elo, gameType)
    const config = SIZE_CONFIG[size]
    const progress = showProgress ? getTierProgress(elo, gameType) : 0
    const toNextTier = showProgress ? getEloToNextTier(elo, gameType) : null
    const nextTierName = showProgress ? getNextTierName(elo, gameType) : null
    const isGranMaestro = tierInfo.level === "gran_maestro"
    const isElite = tierInfo.level === "elite"
    const isTopTier = isGranMaestro || isElite || tierInfo.level === 1

    const badgeContent = (
        <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
            {/* Tier Icon */}
            <div className="relative flex-shrink-0 drop-shadow-md">
                <Image
                    src={tierInfo.image}
                    alt={tierInfo.name}
                    width={config.image}
                    height={config.image}
                    className="object-contain"
                    unoptimized
                />
            </div>

            {/* Label (optional) */}
            {showLabel && (
                <span className={`font-bold uppercase tracking-wider ${isGranMaestro ? "text-[#d4b76f]" : isElite ? "text-[#c0c0c0]" : "text-foreground/60"} ${config.text}`}>
                    {tierInfo.name}
                </span>
            )}

            {/* Progress bar to next tier (optional) */}
            {showProgress && !isGranMaestro && (
                <div className="w-full space-y-0.5">
                    <div className="h-[3px] bg-foreground/[0.08] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-foreground rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {toNextTier !== null && nextTierName && (
                        <p className="text-[8px] text-[#888] text-center">
                            {toNextTier} pts para {nextTierName}
                        </p>
                    )}
                </div>
            )}
        </div>
    )

    if (!showTooltip) {
        return badgeContent
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                <TooltipContent>
                    <p className={`font-bold ${isGranMaestro ? 'text-[#d4b76f]' : 'text-foreground'}`}>{tierInfo.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

/**
 * Versión inline del badge para usar en tablas y listas
 */
export function TierBadgeInline({
    elo,
    gameType,
    size = "sm",
    showTooltip = true,
    className = "",
}: Omit<TierBadgeProps, "showLabel" | "showProgress">) {
    const tierInfo = getTierInfo(elo, gameType)
    const config = SIZE_CONFIG[size]
    const isGranMaestro = tierInfo.level === "gran_maestro"

    const badgeContent = (
        <div className={`inline-flex items-center justify-center ${className}`}>
            <Image
                src={tierInfo.image}
                alt={tierInfo.name}
                width={config.image}
                height={config.image}
                className="object-contain drop-shadow-sm"
                unoptimized
            />
        </div>
    )

    if (!showTooltip) {
        return badgeContent
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
                <TooltipContent>
                    <p className={`font-bold ${isGranMaestro ? 'text-[#d4b76f]' : 'text-foreground'}`}>{tierInfo.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
