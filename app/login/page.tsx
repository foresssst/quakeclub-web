"use client"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { FooterV2 } from "@/components/footer-v2"

export default function LoginPage() {
  const t = useTranslations("login")
  const [error, setError] = useState("")
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")
  const returnTo = searchParams.get("returnTo") || "/"

  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: t("errAuthFailed"),
        invalid_steam_id: t("errInvalidSteamId"),
        steam_api_failed: t("errSteamApiFailed"),
        callback_failed: t("errCallbackFailed"),
      }
      setError(errorMessages[errorParam] || t("errUnknown"))
    }
  }, [errorParam, t])

  const handleSteamLogin = () => {
    window.location.href = `/api/auth/steam?returnTo=${encodeURIComponent(returnTo)}&rememberMe=${rememberMe}`
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1e]/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-foreground/5 blur-[120px] rounded-full" />
      </div>

      {/* Back button */}
      <div className="relative z-10 p-4 sm:p-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#333] bg-black/5 border border-foreground/[0.06] rounded-lg hover:bg-foreground/10 hover:border-foreground/50 hover:text-foreground transition-all duration-200"
        >
          ← {t("backToHome")}
        </Link>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-10 sm:pb-20">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <Image src="/branding/logo.png" alt="Quake Club" width={140} height={50} className="h-12 w-auto" />
          </div>

          {/* Card */}
          <div className="bg-card border border-black/[0.07] rounded-[18px] overflow-hidden animate-scale-fade [animation-delay:100ms]" style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.05), 0 12px 28px rgba(0,0,0,0.14)" }}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.05]">
              <h1 className="font-tiktok text-base font-bold uppercase tracking-wide text-center text-foreground">
                {t("title")}
              </h1>
              <p className="text-center text-[11px] text-[#555] mt-1">{t("subtitle")}</p>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Error message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-red-500 text-center">{error}</p>
                </div>
              )}

              {/* Steam login button */}
              <button
                onClick={handleSteamLogin}
                className="w-full flex items-center justify-center gap-2.5 h-11 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-black/[0.05] hover:border-black/[0.1] transition-all group rounded-xl"
              >
                <Image
                  src="/branding/steam-icon.png"
                  alt="Steam"
                  width={22}
                  height={22}
                  className="h-5 w-5 opacity-75 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-[13px] font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                  {t("steamLogin")}
                </span>
              </button>

              {/* Remember me toggle */}
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-black/[0.03] transition-all cursor-pointer group"
              >
                <span
                  className={`relative inline-flex h-[16px] w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                    rememberMe ? "bg-foreground" : "bg-black/12"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      rememberMe ? "translate-x-[13px]" : "translate-x-[2px]"
                    }`}
                  />
                </span>
                <span className="text-[10px] text-[#666] group-hover:text-[#444] transition-colors">
                  {t("rememberMe")}
                </span>
              </button>

              {/* Security note */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-black/25 uppercase tracking-wider">
                <span>{t("secureConnection")}</span>
              </div>
            </div>

            {/* Footer - Operator Access */}
            <div className="px-6 py-4 bg-foreground/[0.02] border-t border-foreground/[0.06]">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1 h-px bg-black/10" />
                <span className="text-[9px] text-foreground/30 uppercase tracking-wider">{t("orAlso")}</span>
                <div className="flex-1 h-px bg-black/10" />
              </div>
              <Link
                href="/admin/login"
                className="w-full flex items-center justify-center gap-2 h-10 bg-black/5 hover:bg-black/10 border border-foreground/[0.06] hover:border-black/20 transition-all rounded-lg"
              >
                <span className="text-xs font-medium text-[#333] hover:text-foreground/80">{t("operatorAccess")}</span>
              </Link>
            </div>
          </div>

          {/* Bottom text */}
          <p className="text-center text-[10px] text-foreground/20 mt-6">
            {t("acceptTerms")}
            <button
              onClick={() => setShowInfoModal(true)}
              className="ml-1 text-[#333] hover:text-foreground underline transition-colors"
            >
              {t("whatData")}
            </button>
          </p>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowInfoModal(false)}
          />
          <div className="relative bg-card border border-black/[0.07] rounded-xl max-w-md w-full p-6 animate-scale-fade" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}>
            <h3 className="font-tiktok text-sm font-bold uppercase tracking-wider text-foreground mb-4">
              {t("dataTitle")}
            </h3>
            <div className="space-y-3 text-xs text-[#333]">
              <p>
                {t.rich("dataIntro", { public: (chunks) => <strong className="text-foreground/80">{chunks}</strong> })}
              </p>
              <ul className="space-y-2 pl-4">
                <li className="flex gap-2">
                  <span className="text-foreground">•</span>
                  <span><strong className="text-foreground/80">{t("dataSteamId")}</strong> — {t("dataSteamIdDesc")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground">•</span>
                  <span><strong className="text-foreground/80">{t("dataProfileName")}</strong> — {t("dataProfileNameDesc")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground">•</span>
                  <span><strong className="text-foreground/80">{t("dataAvatar")}</strong> — {t("dataAvatarDesc")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground">•</span>
                  <span><strong className="text-foreground/80">{t("dataCountry")}</strong> — {t("dataCountryDesc")}</span>
                </li>
              </ul>
              <p className="text-[#333] pt-2 border-t border-foreground/[0.06]">
                {t("dataDisclaimer")}
              </p>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-5 w-full h-9 bg-black/5 hover:bg-black/10 border border-foreground/[0.06] text-[#333] hover:text-foreground text-xs font-medium transition-all rounded-lg"
            >
              {t("understood")}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10">
        <FooterV2 />
      </div>
    </div>
  )
}
