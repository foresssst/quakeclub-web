"use client"

import Link from "next/link"

// Tipos de roles disponibles
export type UserRole = "founder" | "dev" | "admin" | "mod"

// Configuración de cada rol - Estilo osu-web user-group-badge
// Pill oscuro semi-transparente con texto en color del grupo
export const ROLE_CONFIG: Record<UserRole, {
    label: string
    color: string        // Color del texto (--group-colour en osu)
}> = {
    founder: {
        label: "FUNDADOR",
        color: "#ece6db",
    },
    dev: {
        label: "DEV",
        color: "#B8B8B8",        // Gris claro
    },
    admin: {
        label: "ADMIN",
        color: "#FF66AB",        // Rosa (como GMT en osu)
    },
    mod: {
        label: "MOD",
        color: "#99CCFF",        // Azul claro
    },
}

interface UserRoleBadgeProps {
    role: UserRole
    className?: string
    disableLink?: boolean
}

export function UserRoleBadge({ role, className = "", disableLink = false }: UserRoleBadgeProps) {
    const config = ROLE_CONFIG[role]

    if (!config) return null

    // Estilo osu-web: .user-group-badge
    // background-color: hsla(var(--hsl-b6), 0.75) → fondo oscuro ~10% lightness al 75%
    // color: var(--group-colour) → texto con color del grupo
    // border-radius: 20px, font-size: 10px, padding: 2px 10px, font-weight: 600
    const badgeStyle = {
        backgroundColor: "rgba(20, 20, 24, 0.75)",
        color: config.color,
    }

    const badgeClasses = `
        inline-flex items-center justify-center
        text-[10px] font-semibold
        rounded-full
        px-2.5 py-0.5
        transition-all duration-200
        ${className}
    `

    if (!disableLink) {
        return (
            <Link
                href={`/grupos/${role}`}
                className={`${badgeClasses} hover:brightness-110`}
                style={badgeStyle}
            >
                {config.label}
            </Link>
        )
    }

    return (
        <span className={badgeClasses} style={badgeStyle}>
            {config.label}
        </span>
    )
}

interface UserRoleBadgesProps {
    roles: UserRole[]
    className?: string
    disableLinks?: boolean
}

export function UserRoleBadges({ roles, className = "", disableLinks = false }: UserRoleBadgesProps) {
    if (!roles || roles.length === 0) return null

    // Ordenar roles por prioridad: founder > dev > admin > mod
    const sortedRoles = [...roles].sort((a, b) => {
        const priority: Record<UserRole, number> = { founder: 0, dev: 1, admin: 2, mod: 3 }
        return priority[a] - priority[b]
    })

    return (
        <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
            {sortedRoles.map((role) => (
                <UserRoleBadge key={role} role={role} disableLink={disableLinks} />
            ))}
        </div>
    )
}
