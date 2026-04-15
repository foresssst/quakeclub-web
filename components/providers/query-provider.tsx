"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache por 5 minutos
            staleTime: 5 * 60 * 1000,
            // Mantener en cache por 30 minutos (aumentado para mejor persistencia)
            gcTime: 30 * 60 * 1000,
            // NO refetch en background cuando se enfoca la ventana
            refetchOnWindowFocus: false,
            // NO refetch cuando se monta el componente si hay datos en cache
            refetchOnMount: false,
            // Reintentar 1 vez en caso de error
            retry: 1,
            // NO refetch al reconectar (evita refetches al volver de suspensión)
            refetchOnReconnect: false,
            // CRÍTICO: networkMode offline permite usar cache incluso sin red
            networkMode: 'online',
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
