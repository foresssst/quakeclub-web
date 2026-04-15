import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// Función para limpiar códigos de color de Quake
function stripQuakeColors(text: string): string {
  return text.replace(/\^[0-9]/g, '');
}

/**
 * POST /api/players/resolve-steamids
 * 
 * Busca Steam IDs para una lista de nombres de jugadores
 * Usa la tabla PlayerAlias y Player.username
 * Limpia códigos de color de Quake para matching
 * 
 * Body: { names: string[] }
 * Response: { name: string, steamId: string | null }[]
 */
export async function POST(request: Request) {
  try {
    const { names } = await request.json();

    // Validación de entrada más estricta
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de nombres" },
        { status: 400 }
      );
    }
    
    // Límite de cantidad de nombres para prevenir ataques DoS
    if (names.length > 100) {
      return NextResponse.json(
        { error: "Máximo 100 nombres por solicitud" },
        { status: 400 }
      );
    }
    
    // Validar y sanitizar cada nombre
    const sanitizedNames = names
      .filter(name => typeof name === 'string' && name.length > 0 && name.length <= 50)
      .map(name => {
        // Permitir caracteres alfanuméricos, espacios y caracteres Quake (^ para colores)
        // Remover cualquier carácter potencialmente peligroso
        return name.replace(/[^\w\s^]/g, '').trim();
      })
      .filter(name => name.length > 0);
    
    if (sanitizedNames.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron nombres válidos" },
        { status: 400 }
      );
    }

    // Buscar primero en PlayerAlias con nombres sanitizados
    const aliases = await prisma.$queryRaw<Array<{ alias: string; steamId: string }>>`
      SELECT DISTINCT ON (alias) alias, "steamId"
      FROM "PlayerAlias"
      WHERE alias = ANY(${sanitizedNames})
      ORDER BY alias, "lastSeen" DESC
    `;

    const aliasMap = new Map(aliases.map((a: { alias: string; steamId: string }) => [a.alias, a.steamId]));

    // Para los nombres que no se encontraron, buscar en Player.username
    // Buscar todos los players y hacer matching limpiando códigos de color
    const missingNames = names.filter(name => !aliasMap.has(name));
    
    if (missingNames.length > 0) {
      const allPlayers = await prisma.player.findMany({
        select: {
          username: true,
          steamId: true
        }
      });
      
      // Crear un mapa de nombre limpio -> steamId
      const cleanPlayerMap = new Map<string, string>();
      allPlayers.forEach(p => {
        const cleanName = stripQuakeColors(p.username);
        cleanPlayerMap.set(cleanName, p.steamId);
      });
      
      // Buscar matches para los nombres que faltan
      missingNames.forEach(name => {
        const cleanName = stripQuakeColors(name);
        const steamId = cleanPlayerMap.get(cleanName);
        if (steamId) {
          aliasMap.set(name, steamId);
        }
      });
    }

    // Devolver resultado en el mismo orden que los nombres de entrada
    const result = names.map(name => ({
      name,
      steamId: aliasMap.get(name) || null
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error resolviendo Steam IDs:", error);
    return NextResponse.json(
      { error: "Error al buscar Steam IDs" },
      { status: 500 }
    );
  }
}
