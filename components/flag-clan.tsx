// Component for displaying clan badges (osu-web team style)
import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const DEFAULT_CLAN_AVATAR = "/clans-avatars/clan-default.png"

interface Props {
  clanTag: string
  clanName: string
  clanAvatar?: string
  className?: string
  size?: "xs" | "sm" | "md" | "lg"
  showTooltip?: boolean
  shadow?: "default" | "none"
}

const sizeStyles = {
  xs: "14px",
  sm: "16px",
  md: "18px",
  lg: "22px",
}

export function FlagClan({
  clanTag,
  clanName,
  clanAvatar,
  className = '',
  size = "sm",
  showTooltip = true,
  shadow = "default",
}: Props) {
  const backgroundImage = `url('${clanAvatar || DEFAULT_CLAN_AVATAR}')`

  const flagElement = (
    <span
      className={`flag-clan ${shadow === "default" ? "flag-clan--shadow" : ""} ${className}`}
      style={{
        backgroundImage,
        ["--height" as string]: sizeStyles[size],
      }}
      aria-label={clanName || clanTag}
    />
  )

  if (!showTooltip) {
    return flagElement
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {flagElement}
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-semibold text-foreground">{clanName}</span>
      </TooltipContent>
    </Tooltip>
  )
}
