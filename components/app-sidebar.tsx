"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { locales, localeNames, localeFlagCodes, type Locale } from "@/i18n/config"
import { FlagCountry } from "./flag-country"
import { ThemeToggleButton } from "./theme-toggle-button"

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("nav")
  const [currentLocale, setCurrentLocale] = useState<Locale>("es")
  const [user, setUser] = useState<{ steamId: string; username: string; avatar?: string; isAdmin?: boolean } | null>(null)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [localeDropdownOpen, setLocaleDropdownOpen] = useState(false)

  const navItems = [
    { label: t("home"), href: "/" },
    { label: t("rankings"), href: "/rankings" },
    { label: t("ladder"), href: "/ladder" },
    { label: t("clans"), href: "/clanes/rankings" },
    { label: t("esports"), href: "/esport" },
    { label: t("configs"), href: "/configs" },
    { label: t("huds"), href: "/huds" },
    { label: t("news"), href: "/noticias" },
    { label: t("patchNotes"), href: "/patchnotes", key: "patchnotes" },
    { label: t("academy"), href: "/academia" },
    { label: t("servers"), href: "/browser" },
  ]

  // Detectar si hay patch notes nuevos que el usuario no ha visto
  const { data: latestPatchVersion } = useQuery<string | null>({
    queryKey: ["patchnotes-latest-version"],
    queryFn: async () => {
      const res = await fetch("/api/patchnotes/list")
      if (!res.ok) return null
      const data = await res.json()
      const notes = data.notes || []
      return notes.length > 0 ? notes[0].version : null
    },
    staleTime: 10 * 60 * 1000,
  })

  const [hasUnreadPatch, setHasUnreadPatch] = useState(false)

  useEffect(() => {
    if (!latestPatchVersion) return
    const seen = localStorage.getItem("patchnotes-seen-version")
    setHasUnreadPatch(seen !== latestPatchVersion)
  }, [latestPatchVersion])

  // Marcar como leído cuando visitan /patchnotes
  useEffect(() => {
    if (pathname === "/patchnotes" && latestPatchVersion) {
      localStorage.setItem("patchnotes-seen-version", latestPatchVersion)
      setHasUnreadPatch(false)
    }
  }, [pathname, latestPatchVersion])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("NEXT_LOCALE="))
    if (cookie) {
      const locale = cookie.split("=")[1] as Locale
      if (locales.includes(locale)) {
        setCurrentLocale(locale)
      }
    }
  }, [])

  const handleLocaleChange = async (locale: Locale) => {
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      setCurrentLocale(locale)
      setLocaleDropdownOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Failed to change locale:", error)
    }
  }

  const { data: socialStats } = useQuery<{
    discordMembers: number
    youtubeFollowers: number
    twitchFollowers: number
  }>({
    queryKey: ["social-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats/social")
      if (!res.ok) return { discordMembers: 0, youtubeFollowers: 0, twitchFollowers: 0 }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-50 hidden w-[280px] flex-col overflow-visible border-r border-white/[0.06] bg-[#181a1f] shadow-[4px_0_10px_-2px_rgba(0,0,0,0.32)] lg:flex"
    >
      <div className="relative flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center h-[72px] px-4 py-3 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center group">
          {/* Logo banner */}
          <div className="relative w-[240px] h-[48px] transition-all duration-300 group-hover:opacity-90">
            <Image
              src="/branding/banner_navbar.png"
              alt="QuakeClub"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-3 px-2.5 flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="rounded-[20px] border border-white/[0.05] bg-[#1d2026] p-2 shadow-[0_3px_10px_-2px_rgba(0,0,0,0.24)]">
          <div className="px-2.5 pb-1.5 pt-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/25">
              {t("explore")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const showNew = (item as any).key === "patchnotes" && hasUnreadPatch
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-[14px] transition-all duration-200 relative ${isActive(item.href)
                    ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)]"
                    : showNew
                      ? "text-[#c9a961] hover:text-[#d4b46a] hover:bg-white/[0.05]"
                      : "text-white/55 hover:text-white/88 hover:bg-white/[0.05]"
                    }`}
                >
                  <span className="text-[12px] font-semibold uppercase tracking-[0.12em]">
                    {item.label}
                  </span>
                  {showNew && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-[#1a1a1e] bg-[#c9a961] px-1.5 py-0.5 rounded-sm animate-pulse">
                      {t("new")}
                    </span>
                  )}
                  {isActive(item.href) && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-[#c9a961] rounded-full" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* HUD Lab (QuakeClub Style Highlight) */}
      <div className="border-t border-white/[0.06] py-2.5 px-2.5 relative">
        <a
          href="/hudlab/"
          className="flex items-center justify-between px-3 py-2.5 bg-white/[0.035] border border-white/[0.05] border-l-[2.5px] border-l-[#c9a961] hover:bg-white/[0.06] rounded-[14px] transition-all group shadow-[0_2px_6px_-1px_rgba(0,0,0,0.25)]"
        >
          <Image 
            src="/hudlab/logo.png" 
            alt="HUD Lab" 
            width={90} 
            height={24} 
            className="object-contain opacity-85 group-hover:opacity-100 transition-all" 
          />
          <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-[#1a1a1e] bg-[#c9a961] px-1.5 py-0.5 rounded-sm">
            NUEVO
          </span>
        </a>
      </div>

      {/* Social Stats */}
      <div className="border-t border-white/[0.06] py-2.5 px-2.5 flex flex-col gap-0.5">
        <a
          href="https://discord.gg/JKDWykm2Jy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-white/50 hover:text-[#7c85ff] hover:bg-white/[0.04] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-wider">Discord</span>
        </a>
        <a
          href="https://www.youtube.com/@QuakeClubCL"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-white/50 hover:text-[#ff5f5f] hover:bg-white/[0.04] transition-all"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-wider">YouTube</span>
        </a>
        <a
          href="https://www.twitch.tv/quakeclubcl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-white/50 hover:text-[#a77eff] hover:bg-white/[0.04] transition-all"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-wider">Twitch</span>
        </a>
      </div>

      {/* Bottom Section - User/Language */}
      <div className="border-t border-white/[0.06] py-2.5 px-2.5 flex flex-col gap-0.5">
        {/* Theme Toggle */}
        <ThemeToggleButton className="qc-theme-toggle--sidebar" showLabel />

        {/* Language */}
        <div className="relative">
          <button
            onClick={() => setLocaleDropdownOpen(!localeDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-white/92 hover:text-white hover:bg-white/[0.04] transition-all w-full"
          >
            <FlagCountry
              countryCode={localeFlagCodes[currentLocale]}
              countryName={localeNames[currentLocale]}
              className="w-5 h-4 flex-shrink-0"
              showTooltip={false}
            />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {localeNames[currentLocale]}
            </span>
          </button>
          {localeDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLocaleDropdownOpen(false)} />
              <div className="absolute left-full bottom-0 z-50 ml-2 min-w-[130px] rounded-lg border border-foreground/[0.08] bg-[var(--qc-bg-pure)]/95 py-1.5 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-scale-fade">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => handleLocaleChange(locale)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] transition-colors ${currentLocale === locale
                      ? "bg-foreground/[0.06] text-[var(--qc-text-primary)] dark:bg-white/[0.06]"
                      : "text-[var(--qc-text-secondary)] hover:bg-foreground/[0.04] hover:text-[var(--qc-text-primary)] dark:hover:bg-white/[0.04]"
                      }`}
                  >
                    <FlagCountry
                      countryCode={localeFlagCodes[locale]}
                      countryName={localeNames[locale]}
                      className="w-4 h-3"
                    />
                    {localeNames[locale]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* User */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/92 hover:text-white hover:bg-white/[0.06] transition-all w-full"
            >
              <div className="w-5 h-5 rounded-md overflow-hidden bg-white/20 ring-1 ring-white/[0.15] flex-shrink-0">
                {user.avatar ? (
                  <Image src={user.avatar || "/branding/logo.png"} alt={user.username} width={20} height={20} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-[8px] font-bold">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider truncate">
                {user.username}
              </span>
            </button>
            {userDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                <div className="absolute left-full bottom-0 z-50 ml-2 min-w-[140px] rounded-lg border border-foreground/[0.08] bg-[var(--qc-bg-pure)]/95 py-1 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-scale-fade">
                  <Link
                    href={`/perfil/${user.steamId}`}
                    className="flex items-center px-3 py-2.5 text-[11px] text-[var(--qc-text-secondary)] hover:text-[var(--qc-text-primary)] hover:bg-foreground/[0.04] transition-colors uppercase tracking-wider dark:hover:bg-white/[0.04]"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    {t("profile")}
                  </Link>
                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center px-3 py-2.5 text-[11px] font-medium text-[var(--qc-text-primary)] hover:bg-foreground/[0.04] transition-colors uppercase tracking-wider dark:hover:bg-white/[0.04]"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      Admin Panel
                    </Link>
                  )}
                  <div className="border-t border-foreground/[0.08]">
                    <a
                      href="/api/auth/logout"
                      className="flex items-center px-3 py-2.5 text-[11px] text-[var(--qc-text-secondary)] hover:text-[var(--qc-text-primary)] hover:bg-foreground/[0.04] transition-colors uppercase tracking-wider dark:hover:bg-white/[0.04]"
                    >
                      {t("logout")}
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center px-3 py-2 rounded-[12px] bg-white hover:bg-white/95 text-[#1a1a1e] transition-all shadow-[0_2px_6px_-1px_rgba(0,0,0,0.3)]"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {t("login")}
            </span>
          </Link>
        )}
      </div>
      </div>
    </aside>
  )
}
