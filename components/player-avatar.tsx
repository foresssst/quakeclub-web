"use client"

import Image from "next/image"
import { usePlayerAvatar } from "@/hooks/use-player-avatars"
import { useState, memo } from "react"

interface PlayerAvatarProps {
  steamId: string
  playerName?: string
  avatarUrl?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  showInitial?: boolean
}

const sizeClasses = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 sm:h-7 sm:w-7 text-[10px]",
  md: "h-10 w-10 sm:h-12 sm:w-12 text-sm",
  lg: "h-16 w-16 sm:h-20 sm:w-20 text-lg",
  xl: "h-24 w-24 sm:h-32 sm:w-32 text-2xl",
}

export const PlayerAvatar = memo(function PlayerAvatar({
  steamId,
  playerName,
  avatarUrl: propAvatarUrl,
  size = "sm",
  className = "",
  showInitial = true,
}: PlayerAvatarProps) {
  const { player } = usePlayerAvatar(steamId, { enabled: !propAvatarUrl })
  const [imageError, setImageError] = useState(false)

  const name = playerName || player?.username || `Player_${steamId.slice(-6)}`
  const avatarUrl = propAvatarUrl !== undefined ? propAvatarUrl : player?.avatar
  const initial = name[0]?.toUpperCase() || "?"

  const sizeClass = sizeClasses[size]
  const textSizeClass =
    size === "xs"
      ? "text-[8px]"
      : size === "sm"
        ? "text-[10px]"
        : size === "md"
          ? "text-sm"
          : size === "lg"
            ? "text-lg"
            : "text-2xl"

  if (!avatarUrl || imageError) {
    return (
      <div
        className={`js-usercard relative ${sizeClass} flex-shrink-0 overflow-hidden !rounded-md avatar-shadow ${className}`}
        data-user-id={steamId}
      >
        <div className="flex h-full w-full items-center justify-center bg-foreground">
          <span className={`font-bold text-foreground ${textSizeClass}`}>{initial}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`js-usercard relative ${sizeClass} flex-shrink-0 overflow-hidden !rounded-md avatar-shadow ${className} bg-foreground`}
      data-user-id={steamId}
    >
      <Image
        src={avatarUrl || "/branding/logo.png"}
        alt={name}
        fill
        className="object-cover"
        sizes={
          size === "xs" ? "20px" : size === "sm" ? "32px" : size === "md" ? "48px" : size === "lg" ? "80px" : "128px"
        }
        unoptimized
        onError={() => setImageError(true)}
      />
    </div>
  )
})
