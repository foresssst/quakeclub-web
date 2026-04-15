"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

export function FooterV2() {
  const t = useTranslations("footer")

  const links: { label: string; href: string; external?: boolean }[] = [
    { label: t("about"), href: "/about" },
    { label: t("contact"), href: "/contacto" },
    { label: t("privacy"), href: "/privacidad" },
    { label: t("terms"), href: "/terminos" },
  ]

  return (
    <footer className="mt-6 sm:mt-12 relative safe-area-inset-bottom">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-4xl border-t border-foreground/[0.06] pt-4 sm:pt-5">
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
              {links.map((link, i) => (
                <span key={link.href} className="flex items-center">
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-1 text-[9px] text-[#888] hover:text-[#444] transition-colors uppercase tracking-[0.18em]"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="px-1.5 py-1 text-[9px] text-[#888] hover:text-[#444] transition-colors uppercase tracking-[0.18em]"
                    >
                      {link.label}
                    </Link>
                  )}
                  {i < links.length - 1 && <span className="text-black/10 hidden sm:inline">·</span>}
                </span>
              ))}
            </div>
            <p className="text-[9px] text-[#aaa] uppercase tracking-[0.22em]">
              QuakeClub 2024-2026
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
