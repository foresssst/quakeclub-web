/**
 * Helper centralizado para resolver nombres y avatares de participantes de torneo.
 * Soporta: TournamentTeam > Clan > Player > TBD
 */

export interface ParticipantReg {
  id: string
  clan?: { tag: string; name: string; slug?: string; avatarUrl?: string | null } | null
  player?: { username: string; steamId?: string; avatar?: string | null } | null
  tournamentTeam?: { id: string; tag: string; name: string; avatarUrl?: string | null } | null
}

export function getTeamTag(reg: ParticipantReg | null | undefined): string {
  if (!reg) return 'TBD'
  if (reg.tournamentTeam?.tag) return reg.tournamentTeam.tag
  if (reg.clan?.tag) return reg.clan.tag
  if (reg.player?.username) return reg.player.username
  return 'TBD'
}

export function getTeamName(reg: ParticipantReg | null | undefined): string {
  if (!reg) return 'TBD'
  if (reg.tournamentTeam?.name) return reg.tournamentTeam.name
  if (reg.clan?.name) return reg.clan.name
  if (reg.player?.username) return reg.player.username
  return 'TBD'
}

export function getTeamAvatar(reg: ParticipantReg | null | undefined): string | null {
  if (!reg) return null
  if (reg.tournamentTeam?.avatarUrl) return reg.tournamentTeam.avatarUrl
  if (reg.clan?.avatarUrl) return reg.clan.avatarUrl
  if (reg.player?.avatar) return reg.player.avatar
  return null
}

export function getTeamSlug(reg: ParticipantReg | null | undefined): string | null {
  if (!reg) return null
  // Solo clanes tienen slug (link a /clanes/[slug])
  if (reg.clan?.slug) return `/clanes/${reg.clan.slug}`
  return null
}
