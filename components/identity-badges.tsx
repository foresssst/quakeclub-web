"use client"

import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { FlagClan } from "@/components/flag-clan"
import { FlagCountry } from "@/components/flag-country"

type BadgeSize = "xs" | "sm" | "md" | "lg"

interface IdentityBadgesProps {
  countryCode?: string | null
  countryName?: string | null
  countryHref?: string
  onCountryClick?: (event: MouseEvent<HTMLSpanElement>) => void
  clanTag?: string | null
  clanName?: string | null
  clanAvatar?: string | null
  clanHref?: string
  onClanClick?: (event: MouseEvent<HTMLSpanElement>) => void
  size?: BadgeSize
  className?: string
  countryClassName?: string
  clanClassName?: string
  showTooltips?: boolean
  clanShadow?: "default" | "none"
}

function BadgeWrapper({
  href,
  onClick,
  className,
  children,
}: {
  href?: string
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void
  className?: string
  children: ReactNode
}) {
  if (href) {
    return (
      <Link href={href} className={cn("qc-identity-badges__item", className)}>
        {children}
      </Link>
    )
  }

  if (onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onClick(event as unknown as MouseEvent<HTMLSpanElement>)
          }
        }}
        className={cn("qc-identity-badges__item cursor-pointer", className)}
      >
        {children}
      </span>
    )
  }

  return <span className={cn("qc-identity-badges__item", className)}>{children}</span>
}

export function IdentityBadges({
  countryCode,
  countryName,
  countryHref,
  onCountryClick,
  clanTag,
  clanName,
  clanAvatar,
  clanHref,
  onClanClick,
  size = "sm",
  className,
  countryClassName,
  clanClassName,
  showTooltips = false,
  clanShadow = "default",
}: IdentityBadgesProps) {
  const hasCountry = Boolean(countryCode)
  const hasClan = Boolean(clanTag || clanName || clanAvatar)

  if (!hasCountry && !hasClan) {
    return null
  }

  return (
    <div className={cn("qc-identity-badges", `qc-identity-badges--${size}`, className)}>
      {hasCountry && countryCode ? (
        <BadgeWrapper href={countryHref} onClick={onCountryClick} className={countryClassName}>
          <FlagCountry
            countryCode={countryCode}
            countryName={countryName || countryCode}
            size={size}
            showTooltip={showTooltips}
          />
        </BadgeWrapper>
      ) : null}

      {hasClan ? (
        <BadgeWrapper href={clanHref} onClick={onClanClick} className={clanClassName}>
          <FlagClan
            clanTag={clanTag || clanName || "Clan"}
            clanName={clanName || clanTag || "Clan"}
            clanAvatar={clanAvatar || undefined}
            size={size}
            showTooltip={showTooltips}
            shadow={clanShadow}
          />
        </BadgeWrapper>
      ) : null}
    </div>
  )
}
