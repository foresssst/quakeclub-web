import type React from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { Open_Sans, Outfit } from "next/font/google"
import { QueryProvider } from "@/components/providers/query-provider"
import { SystemModalProvider } from "@/components/ui/system-modal"
import { LenisProvider } from "@/components/lenis-provider"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import Script from "next/script"
import { StructuredData } from "@/components/structured-data"
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_TITLE,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
} from "@/lib/seo"

if (typeof window === "undefined") {
  import("@/lib/zmq-init").then(({ initializeZmqListener }) => {
    initializeZmqListener().catch((error) => {
      console.error("[LAYOUT] Error iniciando ZMQ:", error)
    })
  })
}

const tiktokSans = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-tiktok",
})

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-opensans",
})

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | QuakeClub",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "QuakeClub Team" }],
  creator: "QuakeClub",
  publisher: "QuakeClub",
  metadataBase: new URL("https://quakeclub.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://quakeclub.com",
    siteName: "QuakeClub",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        ...DEFAULT_OG_IMAGE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QuakeClub",
  },
}

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()
  const rootStructuredData = [buildOrganizationJsonLd(), buildWebsiteJsonLd()]

  return (
    <html lang={locale} className={`${tiktokSans.variable} ${openSans.variable}`} suppressHydrationWarning>
      <head />
        <body className="min-h-screen font-tiktok antialiased text-foreground uppercase">
        <StructuredData id="quakeclub-root-jsonld" data={rootStructuredData} />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(function(reg){if(reg&&reg.update){reg.update()}}).catch(function(){})})}`
          }}
        />
        <Script
          id="devtools-protection"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){document.addEventListener('contextmenu',function(e){e.preventDefault()});document.addEventListener('keydown',function(e){if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C'))||(e.ctrlKey&&e.key==='u')){e.preventDefault()}});document.addEventListener('copy',function(e){var s=window.getSelection();if(s&&s.toString().length>500){e.preventDefault()}})})();`
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <LenisProvider>
                <SystemModalProvider>
                  <LayoutWrapper>{children}</LayoutWrapper>
                  <Toaster position="bottom-right" richColors closeButton />
                </SystemModalProvider>
              </LenisProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
