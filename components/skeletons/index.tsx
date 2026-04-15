import { Skeleton } from "@/components/ui/skeleton"

// Skeleton para una fila de ranking (top 10, rankings)
export function RankingRowSkeleton() {
    return (
        <div className="flex items-center gap-3 p-2">
            <Skeleton className="w-6 h-4" /> {/* Rank */}
            <Skeleton className="w-6 h-6" /> {/* Avatar */}
            <Skeleton className="w-5 h-5" /> {/* Clan/Flag */}
            <Skeleton className="h-3 flex-1 max-w-[120px]" /> {/* Name */}
            <Skeleton className="w-10 h-4 ml-auto" /> {/* ELO */}
        </div>
    )
}

// Skeleton para tarjeta de servidor
export function ServerCardSkeleton() {
    return (
        <div className="flex items-center gap-3 p-3 bg-foreground/[0.02] border border-foreground/[0.06]">
            <Skeleton className="w-16 h-10" /> {/* Map image */}
            <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" /> {/* Server name */}
                <Skeleton className="h-2 w-20" /> {/* Map name */}
            </div>
            <Skeleton className="w-8 h-4" /> {/* Player count */}
        </div>
    )
}

// Skeleton para tarjeta de match
export function MatchCardSkeleton() {
    return (
        <div className="p-4 bg-foreground/[0.02] border border-foreground/[0.06] space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" /> {/* Game type */}
                <Skeleton className="h-2 w-24" /> {/* Date */}
            </div>
            <div className="flex items-center gap-4">
                <Skeleton className="w-8 h-8" /> {/* Team 1 */}
                <Skeleton className="w-10 h-6" /> {/* Score */}
                <Skeleton className="w-8 h-8" /> {/* Team 2 */}
            </div>
            <Skeleton className="h-2 w-full" /> {/* Map */}
        </div>
    )
}

// Skeleton para Weapon God card
export function WeaponGodSkeleton() {
    return (
        <div className="flex items-center gap-3 p-3 bg-foreground/[0.02]">
            <Skeleton className="w-8 h-8" /> {/* Weapon icon */}
            <Skeleton className="w-7 h-7 rounded-full" /> {/* Avatar */}
            <Skeleton className="w-5 h-5" /> {/* Clan avatar */}
            <div className="flex-1 space-y-1">
                <Skeleton className="h-2 w-12" /> {/* Title */}
                <Skeleton className="h-3 w-20" /> {/* Name */}
            </div>
            <Skeleton className="w-12 h-4" /> {/* Stat */}
        </div>
    )
}

// Skeleton para tarjeta de clan
export function ClanCardSkeleton() {
    return (
        <div className="p-4 bg-foreground/[0.02] border border-foreground/[0.06]">
            <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12" /> {/* Clan avatar */}
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" /> {/* Clan name */}
                    <Skeleton className="h-2 w-16" /> {/* Member count */}
                </div>
                <Skeleton className="w-16 h-5" /> {/* ELO */}
            </div>
        </div>
    )
}

// Skeleton para tarjeta de noticia
export function NewsCardSkeleton() {
    return (
        <div className="bg-foreground/[0.02] border border-foreground/[0.06] overflow-hidden">
            <Skeleton className="h-32 w-full" /> {/* Image */}
            <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" /> {/* Title */}
                <Skeleton className="h-3 w-full" /> {/* Description */}
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-2 w-20" /> {/* Author */}
                    <Skeleton className="h-2 w-16" /> {/* Date */}
                </div>
            </div>
        </div>
    )
}

// Skeleton para perfil de jugador
export function ProfileHeaderSkeleton() {
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20 rounded-md" /> {/* Avatar */}
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-40" /> {/* Username */}
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-5" /> {/* Flag */}
                        <Skeleton className="h-5 w-20" /> {/* Clan */}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="text-center space-y-1">
                        <Skeleton className="h-6 w-12 mx-auto" />
                        <Skeleton className="h-2 w-16 mx-auto" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// Skeleton para tabla de rankings completa
export function RankingsTableSkeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div className="space-y-1">
            {Array.from({ length: rows }).map((_, i) => (
                <RankingRowSkeleton key={i} />
            ))}
        </div>
    )
}
