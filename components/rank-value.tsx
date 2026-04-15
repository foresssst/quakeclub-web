"use client"

import React from "react"

export type RankTier =
    | "champion"   // #1 - Único
    | "legend"     // Top 3 (2-3)
    | "elite"      // Top 10
    | "master"     // Top 25
    | "diamond"    // Top 50
    | "gold"       // Top 100
    | "silver"     // Top 150
    | "bronze"     // Top 200
    | "iron"       // Resto
    | "base"       // Sin clasificar

export const RANK_TIER_GRADIENTS: Record<RankTier, string> = {
    champion: "linear-gradient(135deg, #FF00FF 0%, #00FFFF 50%, #FF00FF 100%)",  // Magenta ↔ Cyan (único, arcoíris)
    legend: "linear-gradient(135deg, #FFD700 0%, #FF6B00 50%, #FF0000 100%)",    // Oro → Naranja → Rojo
    elite: "linear-gradient(135deg, #FF4500 0%, #FF0000 50%, #CC0000 100%)",     // Naranja → Rojo oscuro
    master: "linear-gradient(135deg, #FF6600 0%, #FF9900 100%)",                  // Naranja intenso
    diamond: "linear-gradient(135deg, #00FF88 0%, #00CC66 50%, #009944 100%)",   // Verde Quake (ácido)
    gold: "linear-gradient(135deg, #1a1a1e 0%, #a08040 100%)",                    // Dorado QuakeClub
    silver: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",                  // Plateado
    bronze: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",                  // Bronce
    iron: "linear-gradient(135deg, #6B6B6B 0%, #4A4A4A 100%)",                    // Hierro
    base: "linear-gradient(135deg, #444444 0%, #333333 100%)",                    // Base
}

export const RANK_TIER_COLORS: Record<RankTier, string> = {
    champion: "#FF00FF",
    legend: "#FFD700",
    elite: "#FF4500",
    master: "#FF9900",
    diamond: "#00FF88",
    gold: "#1a1a1e",
    silver: "#C0C0C0",
    bronze: "#CD7F32",
    iron: "#6B6B6B",
    base: "#444444",
}

export const RANK_TIER_NAMES: Record<RankTier, string> = {
    champion: "CHAMPION",
    legend: "LEGEND",
    elite: "ELITE",
    master: "MASTER",
    diamond: "DIAMOND",
    gold: "GOLD",
    silver: "SILVER",
    bronze: "BRONZE",
    iron: "IRON",
    base: "",
}

interface RankValueProps {
    rank: number | null
    totalPlayers?: number
    className?: string
    showHash?: boolean
    variant?: "gradient" | "flat"
}

/**
 * Calcula el tier basado en la posición absoluta
 * Optimizado para ~300 jugadores
 */
export function getRankTier(rank: number | null, totalPlayers?: number): RankTier {
    if (rank == null || rank <= 0) return "base"

    // Posiciones absolutas (optimizado para ~300 jugadores)
    if (rank === 1) return "champion"    // #1 = Champion (único)
    if (rank <= 3) return "legend"       // Top 3 (2-3) = Leyenda
    if (rank <= 10) return "elite"       // Top 10 = Elite
    if (rank <= 25) return "master"      // Top 25 = Master
    if (rank <= 50) return "diamond"     // Top 50 = Diamond
    if (rank <= 100) return "gold"       // Top 100 = Gold
    if (rank <= 150) return "silver"     // Top 150 = Silver
    if (rank <= 200) return "bronze"     // Top 200 = Bronze

    return "iron"                        // Resto = Iron
}

const RANK_TEXT_COLOR = "var(--foreground)"

export function RankValue({ rank, totalPlayers, className = "", showHash = true, variant = "gradient" }: RankValueProps) {
    if (rank == null || rank <= 0) {
        return (
            <span className={`font-bold text-foreground/40 ${className}`}>
                -
            </span>
        )
    }

    return (
        <span
            className={`font-bold ${className}`}
            style={{
                color: RANK_TEXT_COLOR,
            }}
        >
            {showHash ? "#" : ""}{rank.toLocaleString()}
        </span>
    )
}

/**
 * Versión más simple que solo devuelve el estilo para aplicar a cualquier elemento
 */
export function useRankGradientStyle(rank: number | null, totalPlayers?: number) {
    const tier = getRankTier(rank, totalPlayers)
    const name = RANK_TIER_NAMES[tier]

    return {
        style: {
            color: RANK_TEXT_COLOR,
        } as React.CSSProperties,
        tier,
        tierName: name,
        gradient: "none",
        primaryColor: RANK_TEXT_COLOR,
    }
}
