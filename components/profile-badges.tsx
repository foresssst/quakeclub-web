"use client"

import Link from "next/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface Badge {
  id: string
  name: string
  description?: string | null
  imageUrl: string
  badgeUrl?: string | null
  category?: string | null
  awardedAt: Date
}

interface ProfileBadgesProps {
  badges: Badge[]
  modifiers?: string[]
}

export function ProfileBadges({ badges, modifiers = [] }: ProfileBadgesProps) {
  if (badges.length === 0) return null

  const modifierClasses = modifiers.map(m => `profile-badges--${m}`).join(' ')

  return (
    <div className={`profile-badges ${modifierClasses}`}>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {badges.map((badge) => {
          const BadgeImage = (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div className="cursor-pointer w-[86px] h-10 transition-transform hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badge.imageUrl}
                    alt={badge.name}
                    width={86}
                    height={40}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {badge.description && (
                  <div className="text-foreground">{badge.description}</div>
                )}
                <div className="text-foreground/50 mt-1.5" style={{ fontSize: '10px' }}>
                  {new Date(badge.awardedAt).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </TooltipContent>
            </Tooltip>
          )

          return badge.badgeUrl ? (
            <Link key={badge.id} href={badge.badgeUrl} className="inline-block">
              {BadgeImage}
            </Link>
          ) : (
            BadgeImage
          )
        })}
      </div>
    </div>
  )
}
