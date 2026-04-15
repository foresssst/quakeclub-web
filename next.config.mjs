import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite solicitudes cross-origin desde estos dominios en desarrollo
  // Esto silencia la advertencia: "Cross-origin request detected"
  allowedDevOrigins: [
    'www.quakeclub.com',
    'quakeclub.com',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Habilitar optimizacion de imagenes con dominios permitidos
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.steamstatic.com' },
      { protocol: 'https', hostname: 'steamcdn-a.akamaihd.net' },
      { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // Cache por 1 hora
  },
  experimental: {
    // Aumentar límite del body para permitir uploads de imágenes grandes (avatares en base64)
    // Un GIF de 10MB en base64 es aprox ~13-14MB
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  // Límite de body para API routes
  serverExternalPackages: [],
  async rewrites() {
    return []
  },
  // No exponer source maps en produccion
  productionBrowserSourceMaps: false,
  // Desactivar header X-Powered-By
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quakeclub.com'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
      {
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quakeclub.com'
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
