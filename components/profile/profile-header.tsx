"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { FlagCountry } from "@/components/flag-country"
import { FlagClan } from "@/components/flag-clan"
import { ProfileBadges } from "@/components/profile-badges"
import { CoverSelector } from "@/components/cover-selector"
import { systemConfirm } from "@/lib/system-modal"
import { UserRoleBadges, type UserRole } from "@/components/user-role-badge"

interface ProfileHeaderProps {
  user: {
    steamId?: string
    username: string
    avatar?: string
    isRegistered?: boolean
    roles?: UserRole[]
  }
  playerData: {
    avatar?: string
    banner?: string
    bannerOffsetX?: number
    bannerOffsetY?: number
    title?: {
      title: string
      titleColor?: string
      titleUrl?: string
    }
    clan?: {
      tag: string
      name: string
      slug: string
      avatarUrl?: string
    }
    badges?: Array<{
      id: string
      name: string
      icon: string
    }>
  } | null
  isOwnProfile: boolean
  joinDate: string
}

export function ProfileHeader({ user, playerData, isOwnProfile, joinDate }: ProfileHeaderProps) {
  const t = useTranslations("profile")
  const queryClient = useQueryClient()

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(playerData?.avatar || user.avatar || "")
  const [showBannerMenu, setShowBannerMenu] = useState(false)
  const [showCoverSelector, setShowCoverSelector] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState(playerData?.banner || "")
  const [bannerOffsetX, setBannerOffsetX] = useState(playerData?.bannerOffsetX || 0)
  const [bannerOffsetY, setBannerOffsetY] = useState(playerData?.bannerOffsetY || 0)

  // Update previews when playerData changes
  useEffect(() => {
    if (playerData?.avatar) {
      setPreviewUrl(playerData.avatar)
    }
    if (playerData?.banner) {
      setBannerPreviewUrl(playerData.banner)
    }
    if (playerData?.bannerOffsetX !== undefined) {
      setBannerOffsetX(playerData.bannerOffsetX)
    }
    if (playerData?.bannerOffsetY !== undefined) {
      setBannerOffsetY(playerData.bannerOffsetY)
    }
  }, [playerData?.avatar, playerData?.banner, playerData?.bannerOffsetX, playerData?.bannerOffsetY])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showBannerMenu && !target.closest('[data-banner-menu]')) {
        setShowBannerMenu(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showBannerMenu])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpdate = async () => {
    if (!avatarFile) return

    setIsUploading(true)

    try {
      const reader = new FileReader()

      reader.onerror = () => {
        alert("Error al leer el archivo")
        setIsUploading(false)
      }

      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string

          const response = await fetch("/api/profile/avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarData: base64 }),
          })

          if (!response.ok) {
            const error = await response.json()
            alert(error.error || "Error al subir avatar")
            setIsUploading(false)
            return
          }

          const data = await response.json()
          setPreviewUrl(data.avatarUrl)
          setAvatarFile(null)
          setIsUploading(false)
          setShowConfirmation(true)
        } catch {
          alert("Error al comunicarse con el servidor")
          setIsUploading(false)
        }
      }

      reader.readAsDataURL(avatarFile)
    } catch {
      alert("Error al procesar el avatar")
      setIsUploading(false)
    }
  }

  const handleCoverSelect = async (file: File, position?: { x: number; y: number }) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()

      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string

          const response = await fetch('/api/profile/cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coverData: base64Data,
              offsetX: position?.x || 0,
              offsetY: position?.y || 0,
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            alert(error.error || 'Error al actualizar banner')
            reject(new Error(error.error || 'Error al actualizar banner'))
            return
          }

          const data = await response.json()

          if (data.coverUrl) {
            setBannerPreviewUrl(data.coverUrl)
          }

          queryClient.invalidateQueries({ queryKey: ['player-data', user.steamId] })
          setShowCoverSelector(false)
          resolve()
        } catch (error) {
          alert('Error al actualizar banner')
          reject(error)
        }
      }

      reader.onerror = () => {
        const error = new Error('Error al leer el archivo')
        alert('Error al leer el archivo')
        reject(error)
      }

      reader.readAsDataURL(file)
    })
  }

  const handleCoverDelete = async () => {
    if (!await systemConfirm('¿Estás seguro de que quieres eliminar tu banner?', 'Eliminar Banner')) {
      return
    }

    try {
      const response = await fetch('/api/profile/cover', { method: 'DELETE' })

      if (!response.ok) {
        alert('Error al eliminar banner')
        return
      }

      setBannerPreviewUrl('')
      queryClient.invalidateQueries({ queryKey: ['player-data', user.steamId] })
      alert('Banner eliminado exitosamente')
    } catch {
      alert('Error al eliminar banner')
    }
  }

  const handleCancelAvatar = () => {
    setAvatarFile(null)
    setPreviewUrl(playerData?.avatar || "")
  }

  const handleResetAvatar = async () => {
    if (!await systemConfirm("¿Estás seguro de que quieres eliminar tu avatar personalizado?", "Eliminar Avatar")) {
      return
    }

    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" })

      if (!response.ok) {
        alert("Error al eliminar avatar")
        return
      }

      setPreviewUrl("")
      setAvatarFile(null)
      queryClient.invalidateQueries({ queryKey: ['player-data', user.steamId] })
      alert("Avatar eliminado exitosamente")
    } catch {
      alert("Error al eliminar avatar")
    }
  }

  return (
    <>
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="animate-scale-fade border border-primary/30 bg-card p-8 shadow-2xl backdrop-blur-xl max-w-md w-full mx-4 rounded-xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 border-2 border-primary/50">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-tiktok text-2xl font-bold text-foreground">{t("avatarUpdated")}</h3>
              <p className="text-muted-foreground">{t("avatarSaved")}</p>
              <button
                onClick={() => {
                  setShowConfirmation(false)
                  window.location.reload()
                }}
                className="w-full border-2 border-primary bg-primary/20 px-6 py-3 font-tiktok font-semibold text-primary transition-all hover:bg-primary/30 rounded-lg"
              >
                {t("accept")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="relative h-24 sm:h-32 md:h-44 bg-[var(--qc-bg-medium)] group" data-banner-menu>
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`absolute inset-0 transition-transform duration-300 ${bannerPreviewUrl ? 'group-hover:scale-105' : ''}`}
          >
            {bannerPreviewUrl ? (
              <img
                src={bannerPreviewUrl || "/branding/logo.png"}
                alt="Banner"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `calc(50% + ${bannerOffsetX}px) calc(50% + ${bannerOffsetY}px)`,
                }}
              />
            ) : null}
          </div>
        </div>

        {isOwnProfile && (
          <>
            <button
              onClick={() => setShowBannerMenu(!showBannerMenu)}
              className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-xs font-bold text-white uppercase tracking-wider hidden sm:inline">{t("editProfile")}</span>
            </button>

            <button
              onClick={() => setShowBannerMenu(!showBannerMenu)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10"
              aria-label="Opciones de banner"
            />

            {showBannerMenu && (
                <div
                  className="absolute top-4 right-4 z-50 bg-card/98 backdrop-blur-xl border border-foreground/[0.08] rounded-lg min-w-[180px] py-1"
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}
                  data-banner-menu
                >
                {avatarFile ? (
                  <>
                    <button
                      onClick={() => { handleAvatarUpdate(); setShowBannerMenu(false); }}
                      disabled={isUploading}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--qc-text-secondary)] hover:bg-foreground/[0.04] transition-colors disabled:opacity-50"
                    >
                      {isUploading ? t("savingAvatar") : t("saveAvatar")}
                    </button>
                    <button
                      onClick={() => { handleCancelAvatar(); setShowBannerMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-foreground/50 hover:bg-foreground/[0.04] transition-colors"
                    >
                      {t("cancelAvatar")}
                    </button>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="avatar-upload"
                      className="block w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground transition-colors cursor-pointer"
                    >
                      {t("changeAvatar")}
                    </label>
                    {previewUrl && (
                      <button
                        onClick={() => { handleResetAvatar(); setShowBannerMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-500/80 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                      >
                        {t("deleteAvatar")}
                      </button>
                    )}
                    <div className="my-1 border-t border-foreground/[0.06]" />
                    <button
                      onClick={() => { setShowCoverSelector(true); setShowBannerMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
                    >
                      {bannerPreviewUrl ? t("changeBanner") : t("addBanner")}
                    </button>
                    {bannerPreviewUrl && (
                      <button
                        onClick={() => { handleCoverDelete(); setShowBannerMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-500/80 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                      >
                        {t("deleteBanner")}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <input id="avatar-upload" type="file" accept="image/*" onChange={(e) => { handleFileChange(e); setShowBannerMenu(true); }} className="hidden" />
          </>
        )}
      </div>

      {/* Player Details Section */}
      <div className="bg-[var(--qc-bg-medium)] px-4 sm:px-5 lg:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4">
          {/* Avatar - overlaps banner */}
          <div className="relative flex-shrink-0 group/avatar -mt-12 sm:-mt-14">
            {previewUrl ? (
              <div className="relative h-18 w-18 sm:h-22 sm:w-22 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.15)] border-2 border-white rounded-xl sm:rounded-2xl">
                <Image
                  src={previewUrl || "/branding/logo.png"}
                  alt="Avatar"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="relative h-20 w-20 sm:h-24 sm:w-24">
                <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-white bg-[var(--qc-bg-pure)] text-3xl font-bold text-foreground shadow-[0_2px_12px_rgba(0,0,0,0.2)] sm:rounded-[20px] sm:text-4xl">
                  {user.username[0].toUpperCase()}
                </div>
              </div>
            )}
            {isOwnProfile && (
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer rounded-2xl sm:rounded-[20px]"
              >
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">{t("changeAvatar")}</span>
                </div>
              </label>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0 w-full sm:w-auto text-center sm:text-left">
            {/* Username and Role Badges */}
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-0.5 flex-wrap">
              {user.steamId ? (
                <Link
                  href={`/aliases/${user.steamId}`}
                  className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground hover:opacity-80 transition-opacity"
                >
                  <h1>{parseQuakeColors(user.username)}</h1>
                </Link>
              ) : (
                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wider text-foreground">
                  {parseQuakeColors(user.username)}
                </h1>
              )}

              {user.roles && user.roles.length > 0 && (
                <UserRoleBadges roles={user.roles} />
              )}

              {user.isRegistered === false && (
                <span className="inline-flex items-center border border-black/10 bg-foreground/[0.04] px-2 py-0.5 text-[10px] text-foreground/50 font-bold uppercase tracking-wider rounded">
                  {t("notRegistered")}
                </span>
              )}
            </div>

            {/* Player Title */}
            {playerData?.title && (
              <div className="mb-1">
                {playerData.title.titleUrl ? (
                  <Link
                    href={playerData.title.titleUrl}
                    className="inline-block text-sm font-semibold transition-opacity hover:opacity-80 font-tiktok text-foreground"
                  >
                    {playerData.title.title}
                  </Link>
                ) : (
                  <span className="inline-block text-sm font-semibold font-tiktok text-foreground">
                    {playerData.title.title}
                  </span>
                )}
              </div>
            )}

            {/* Country, Clan, Member Since */}
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 flex-wrap mt-1">
              <a
                href={`/rankings?country=${playerData?.countryCode || 'CL'}`}
                className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
              >
                <FlagCountry countryCode={playerData?.countryCode || 'CL'} />
              </a>
              {playerData?.clan && (
                <Link
                  href={`/clanes/${playerData.clan.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
                >
                  <FlagClan
                    clanTag={playerData.clan.tag}
                    clanName={playerData.clan.name}
                    clanAvatar={playerData.clan.avatarUrl}
                  />
                  <span>{playerData.clan.name}</span>
                </Link>
              )}
              <span className="text-xs text-foreground/40">{t("memberSince")} {joinDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Player Badges */}
      {playerData?.badges && playerData.badges.length > 0 && (
        <div className="bg-background px-5 lg:px-7 py-3 border-t border-foreground/[0.06]">
          <ProfileBadges badges={playerData.badges} />
        </div>
      )}

      {/* Cover Selector Modal */}
      {showCoverSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--qc-bg-pure)]/80 backdrop-blur-sm">
          <div className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto bg-card border border-foreground/[0.06] shadow-2xl rounded-xl">
            <div className="sticky top-0 bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-foreground">{t("changeBanner")}</h2>
              <button
                onClick={() => setShowCoverSelector(false)}
                className="text-foreground/60 hover:text-foreground text-2xl font-bold transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <CoverSelector
                currentCover={bannerPreviewUrl}
                onSelect={handleCoverSelect}
                onClose={() => setShowCoverSelector(false)}
                isRegistered={isOwnProfile}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
