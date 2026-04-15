import { cn } from '@/lib/utils'

interface SkeletonProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'text' | 'avatar' | 'card' | 'circle'
  shimmer?: boolean
}

function Skeleton({ className, variant = 'default', shimmer = true, ...props }: SkeletonProps) {
  const variantClasses = {
    default: '',
    text: 'h-4 rounded-md',
    avatar: 'w-8 h-8 rounded-lg',
    card: 'h-24 rounded-xl',
    circle: 'rounded-full',
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md',
        shimmer ? 'skeleton-shimmer' : 'bg-foreground/[0.04]',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

// Componentes de skeleton reutilizables
function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  )
}

function SkeletonAvatar({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }
  return <Skeleton className={cn(sizeClasses[size], 'rounded-lg', className)} />
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

// ============================================
// SKELETON TEMPLATES - ESTILO MINIMALISTA
// ============================================

// Stat Box (usado en homepage, perfil) - minimalista
function SkeletonStatBox({ className }: { className?: string }) {
  return (
    <div className={cn('p-3', className)}>
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-5 w-12" />
    </div>
  )
}

// Ranking Row - minimalista (como en la screenshot del ranking)
function SkeletonRankingRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 py-2 px-2', className)}>
      {/* Rank number */}
      <Skeleton className="w-5 h-4 rounded-lg" />
      {/* Avatar */}
      <Skeleton className="w-6 h-6 rounded-lg flex-shrink-0" />
      {/* Flag */}
      <Skeleton className="w-4 h-3 rounded-lg flex-shrink-0" />
      {/* Name - long bar that takes remaining space */}
      <Skeleton className="h-3 flex-1 max-w-[200px] rounded-lg" />
      {/* Stats on right */}
      <div className="flex items-center gap-4 ml-auto">
        <Skeleton className="h-3 w-8 rounded-lg" />
        <Skeleton className="h-3 w-8 rounded-lg" />
        <Skeleton className="h-3 w-8 rounded-lg" />
        <Skeleton className="h-3 w-8 rounded-lg" />
      </div>
    </div>
  )
}

// News Card - minimalista
function SkeletonNewsCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="w-full h-32 rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// Match Row - minimalista
function SkeletonMatchRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2.5 w-28" />
      </div>
      <Skeleton className="h-4 w-14" />
    </div>
  )
}

// Server Row - minimalista
function SkeletonServerRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <Skeleton className="w-14 h-10 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  )
}

// Chart - minimalista
function SkeletonChart({ className, height = 180 }: { className?: string; height?: number }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-10" />
        </div>
      </div>
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  )
}

// Profile Header - minimalista
function SkeletonProfileHeader({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-0', className)}>
      <Skeleton className="w-full h-28 rounded-t-md" />
      <div className="flex items-end gap-4 -mt-10 px-4 pb-4">
        <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-12">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-2 pt-12">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Profile Stats Grid - minimalista
function SkeletonProfileStats({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonStatBox key={i} />
      ))}
    </div>
  )
}

// Clan Member Row - minimalista
function SkeletonClanMemberRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <SkeletonAvatar size="md" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-4 w-14" />
    </div>
  )
}

// Tournament Card - minimalista
function SkeletonTournamentCard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="w-full h-28 rounded-lg" />
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

// Match Detail Player Row - minimalista
function SkeletonMatchPlayerRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 py-1.5', className)}>
      <Skeleton className="w-4 h-4" />
      <SkeletonAvatar size="sm" />
      <Skeleton className="h-3 w-24 flex-1" />
      <Skeleton className="h-3 w-6" />
      <Skeleton className="h-3 w-6" />
      <Skeleton className="h-3 w-8" />
      <Skeleton className="h-3 w-10" />
    </div>
  )
}

// Match Detail Full - minimalista
function SkeletonMatchDetail({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-8 w-20 mx-auto" />
          <Skeleton className="h-3 w-14 mx-auto" />
        </div>
      </div>
      {/* Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((team) => (
          <div key={team} className="space-y-2">
            <Skeleton className="h-4 w-20 mb-3" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonMatchPlayerRow key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Activity Chart - minimalista
function SkeletonActivityChart({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="h-4 w-28" />
      <div className="flex items-end gap-0.5 h-20">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
        <Skeleton className="h-2.5 w-6" />
      </div>
    </div>
  )
}

// Weapon Stats Row - minimalista
function SkeletonWeaponRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5', className)}>
      <Skeleton className="w-7 h-7" />
      <Skeleton className="h-3 w-20 flex-1" />
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-2 w-20 rounded-full" />
    </div>
  )
}

// Clan Card - minimalista
function SkeletonClanCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <Skeleton className="w-4 h-4" />
      <Skeleton className="w-8 h-8 rounded-lg" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2.5 w-14" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  )
}

// News Article Detail - minimalista
function SkeletonNewsArticle({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Skeleton className="w-full h-56 rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-2.5 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${75 + Math.random() * 25}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Homepage Full Skeleton - minimalista
function SkeletonHomepage() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <Skeleton className="w-full h-40 rounded-lg" />

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </div>

      {/* Rankings */}
      <div className="space-y-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonRankingRow key={i} />
        ))}
      </div>
    </div>
  )
}

// Profile Full Skeleton - sidebar desde el inicio
function SkeletonProfile() {
  return (
    <div className="glass-card-elevated rounded-xl overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          <Skeleton className="w-full h-28 sm:h-32 md:h-36 rounded-none" />

          <div className="relative -mt-10 sm:-mt-12 px-5 lg:px-7 pb-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-4">
              <Skeleton className="w-20 h-20 rounded-xl" />
              <div className="flex-1 space-y-1.5 pt-2">
                <Skeleton className="h-5 w-32 mx-auto sm:mx-0" />
                <div className="flex gap-2 justify-center sm:justify-start">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 lg:p-6 space-y-4">
            <div className="flex gap-0.5 pb-2 section-divider bg-foreground/[0.02] rounded-lg p-0.5 w-fit">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-12 rounded-md" />
              ))}
            </div>

            <div className="flex gap-0.5 bg-foreground/[0.02] rounded-lg p-0.5 w-fit">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-md" />
              ))}
            </div>

            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-3 stat-card">
                  <Skeleton className="w-14 h-9 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-2 w-20" />
                  </div>
                  <Skeleton className="w-10 h-4 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-foreground/[0.04] bg-black/[0.01] p-5 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>

          <div className="space-y-3 pt-4 section-divider">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 section-divider">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 rounded-lg" />
          </div>

          <div className="space-y-3 pt-4 section-divider">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Clan Detail Full Skeleton - minimalista
function SkeletonClanDetail() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </div>

      {/* Members */}
      <div className="space-y-1">
        <Skeleton className="h-4 w-20 mb-3" />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonClanMemberRow key={i} />
        ))}
      </div>
    </div>
  )
}

// Esport/Tournaments Skeleton - minimalista
function SkeletonEsport() {
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>

      {/* Tournament Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTournamentCard key={i} />
        ))}
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  // Templates específicos
  SkeletonStatBox,
  SkeletonRankingRow,
  SkeletonNewsCard,
  SkeletonMatchRow,
  SkeletonServerRow,
  SkeletonChart,
  SkeletonProfileHeader,
  SkeletonProfileStats,
  SkeletonClanMemberRow,
  SkeletonTournamentCard,
  SkeletonMatchPlayerRow,
  SkeletonMatchDetail,
  SkeletonActivityChart,
  SkeletonWeaponRow,
  SkeletonClanCard,
  SkeletonNewsArticle,
  // Full page skeletons
  SkeletonHomepage,
  SkeletonProfile,
  SkeletonClanDetail,
  SkeletonEsport,
}
