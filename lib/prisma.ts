/**
 * Cliente de Prisma para conexión a PostgreSQL
 * Usa patrón singleton para evitar múltiples conexiones en hot-reload
 */
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // Solo logear queries en desarrollo si se necesita debug
  // Los errores los manejamos manualmente en el código
  log: [],
})

// Cache en ambos entornos para evitar múltiples conexiones
globalForPrisma.prisma = prisma
