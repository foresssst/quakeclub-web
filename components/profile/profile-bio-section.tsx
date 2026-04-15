"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface ProfileExtrasData {
  bio?: string
  links?: Record<string, string>
}

interface ProfileBioSectionProps {
  steamId?: string
  profileExtras?: ProfileExtrasData | null
  isOwnProfile: boolean
}

export function ProfileBioSection({
  steamId,
  profileExtras,
  isOwnProfile,
}: ProfileBioSectionProps) {
  const t = useTranslations("profile")
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentBio, setCurrentBio] = useState(profileExtras?.bio || "")
  const [draft, setDraft] = useState(profileExtras?.bio || "")

  useEffect(() => {
    if (!isEditing) {
      setCurrentBio(profileExtras?.bio || "")
      setDraft(profileExtras?.bio || "")
    }
  }, [profileExtras, isEditing])

  const hasBio = currentBio.trim().length > 0

  if (!isOwnProfile && !hasBio) {
    return null
  }

  const handleSave = async () => {
    if (!steamId) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/profile/extras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: draft, links: profileExtras?.links || {} }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t("bioSaveError"))

      setCurrentBio(data?.profileExtras?.bio || "")
      setDraft(data?.profileExtras?.bio || "")
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["player-data", steamId] })
      toast.success(t("bioSaved"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("bioSaveError"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-t border-foreground/[0.06]">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4">

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={280}
              placeholder={t("bioPlaceholder")}
              rows={3}
              className="w-full bg-transparent text-sm leading-relaxed text-foreground placeholder:text-foreground/25 resize-none outline-none border-none p-0"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-foreground/25 uppercase tracking-wider">
                {draft.trim().length}/280
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setDraft(currentBio); setIsEditing(false) }}
                  className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 hover:text-foreground transition-colors px-2 py-1"
                >
                  {t("cancelEdit")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="text-[10px] font-bold uppercase tracking-wider text-foreground bg-foreground/[0.06] hover:bg-foreground/[0.12] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  {isSaving ? "..." : t("saveBioLinks")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={isOwnProfile ? () => { setDraft(currentBio); setIsEditing(true) } : undefined}
            className={isOwnProfile ? "cursor-pointer group" : ""}
          >
            {hasBio ? (
              <p className="text-sm leading-relaxed text-foreground/60 whitespace-pre-line">
                {currentBio}
                {isOwnProfile && (
                  <span className="ml-2 text-[9px] text-foreground/20 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    editar
                  </span>
                )}
              </p>
            ) : (
              isOwnProfile && (
                <p className="text-sm text-foreground/25 italic">
                  {t("emptyBioOwner")}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
