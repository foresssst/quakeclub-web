"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { locales, localeNames, localeFlagCodes, type Locale } from "@/i18n/config"
import { FlagCountry } from "./flag-country"
import { ThemeToggleButton } from "./theme-toggle-button"

export function MobileHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("nav")
  const footerT = useTranslations("footer")
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<Locale>("es")
  const [user, setUser] = useState<{ steamId: string; username: string; avatar?: string; isAdmin?: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const secondaryItems = [
    { label: t("servers"), href: "/browser" },
    { label: t("ladder"), href: "/ladder" },
    { label: t("clans"), href: "/clanes/rankings" },
    { label: t("esports"), href: "/esport" },
    { label: t("configs"), href: "/configs" },
    { label: t("huds"), href: "/huds" },
    { label: t("academy"), href: "/academia" },
  ]

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.user) setUser(data.user) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const cookie = document.cookie.split("; ").find((row) => row.startsWith("NEXT_LOCALE="))
    if (cookie) {
      const locale = cookie.split("=")[1] as Locale
      if (locales.includes(locale)) setCurrentLocale(locale)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  const handleLocaleChange = async (locale: Locale) => {
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      setCurrentLocale(locale)
      router.refresh()
    } catch (error) {
      console.error("Failed to change locale:", error)
    }
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 safe-area-inset-top">
      {/* Header bar -- matches desktop sidebar aesthetic: dark, text-only */}
      <div className="border-b border-white/[0.08] bg-[#181a1f] backdrop-blur-xl shadow-[0_3px_10px_-2px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between h-14 px-3.5">
          <Link href="/" className="flex items-center">
            <div className="relative w-[112px] h-[22px]">
              <Image
                src="/branding/banner_navbar.png"
                alt="QuakeClub"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>

          <div className="flex items-center gap-1">
            {/* Language toggle -- same style as desktop sidebar */}
            <button
              onClick={() => {
                const next = locales[(locales.indexOf(currentLocale) + 1) % locales.length]
                handleLocaleChange(next)
              }}
              className="flex items-center justify-center w-10 h-10 rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-white/50 active:text-white active:bg-white/[0.08] transition-colors"
            >
              <FlagCountry
                countryCode={localeFlagCodes[currentLocale]}
                countryName={localeNames[currentLocale]}
                className="w-4 h-3"
                showTooltip={false}
              />
            </button>

            <ThemeToggleButton className="qc-theme-toggle--mobile" />

            {/* Hamburger -- two horizontal lines, not three */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex flex-col items-center justify-center w-10 h-10 rounded-[14px] border border-white/[0.08] bg-white/[0.04] active:bg-white/[0.08] transition-colors gap-[5px]"
              aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
            >
              <span className={`block w-4 h-[1.5px] bg-white/60 transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-[3.25px]" : ""}`} />
              <span className={`block w-4 h-[1.5px] bg-white/60 transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-[3.25px]" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen drawer -- mirrors desktop sidebar style exactly */}
      {menuOpen && (
        <div className="fixed inset-0 top-14 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/54 backdrop-blur-[2px]" />

          <div
            ref={menuRef}
            className="absolute right-0 top-0 bottom-0 w-[292px] overflow-y-auto overscroll-contain animate-slide-in-drawer border-l border-white/[0.08] bg-[#181a1f] shadow-[-4px_0_12px_-2px_rgba(0,0,0,0.36)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full">
            {/* User -- same layout as desktop sidebar bottom */}
            {user && (
              <div className="px-4 pt-5 pb-4 border-b border-white/[0.08]">
                <Link
                  href={`/perfil/${user.steamId}`}
                  className="flex items-center gap-3 active:opacity-70 transition-opacity"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="w-8 h-8 rounded-md overflow-hidden bg-white/20 ring-1 ring-white/[0.15]">
                    {user.avatar ? (
                      <Image src={user.avatar} alt={user.username} width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                        {user.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white truncate">
                    {user.username}
                  </span>
                </Link>
              </div>
            )}

            {/* Nav items -- identical style to desktop sidebar nav */}
            <div className="py-4 px-3">
              <div className="rounded-[24px] border border-white/[0.06] bg-[#1d2026] p-2.5 shadow-[0_3px_10px_-2px_rgba(0,0,0,0.24)]">
                <div className="px-2.5 pb-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/28">
                    {t("explore")}
                  </span>
                </div>
                {secondaryItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 py-2.5 rounded-[16px] transition-all duration-200 relative ${
                      isActive(item.href)
                        ? "text-white bg-white/[0.10]"
                        : "text-white/60 active:text-white/90 active:bg-white/[0.06]"
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="text-[13px] font-semibold uppercase tracking-[0.16em]">
                      {item.label}
                    </span>
                    {isActive(item.href) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#d4af37] rounded-full" />
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* Social + footer links -- same as desktop sidebar bottom */}
            <div className="border-t border-white/[0.08] py-3 px-2">
              <a
                href="https://discord.gg/JKDWykm2Jy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-white/60 active:text-[#8d96ff] active:bg-white/[0.05] transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider">Discord</span>
              </a>
              <a
                href="https://www.youtube.com/@QuakeClubCL"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-white/60 active:text-[#ff6b6b] active:bg-white/[0.05] transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider">YouTube</span>
              </a>
            </div>

            {/* Footer pages */}
            <div className="border-t border-white/[0.08] py-3 px-2">
              {[
                { label: footerT("about"), href: "/about" },
                { label: footerT("rules"), href: "/reglas" },
                { label: footerT("contact"), href: "/contacto" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center px-3 py-2.5 rounded-[16px] text-white/40 active:text-white/70 active:bg-white/[0.04] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{link.label}</span>
                </Link>
              ))}
              {user && (
                <a
                  href="/api/auth/logout"
                  className="flex items-center px-3 py-2 rounded-lg text-red-400/50 active:text-red-400 active:bg-white/[0.04] transition-colors mt-1"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{t("logout")}</span>
                </a>
              )}
            </div>
            <div className="safe-area-inset-bottom" />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
