/**
 * FULL BIDIRECTIONAL SYNC: users.json <-> Player DB
 * 
 * 1. Custom avatars from users.json -> Player.avatar (if user has uploaded /avatars/*)
 * 2. Latest username from Player DB -> users.json
 * 3. Country code sync
 * 4. Report
 */
import { prisma } from '../lib/prisma'
import fs from 'fs'
import path from 'path'

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json')

interface UserEntry {
  username: string
  passwordHash?: string
  steamId?: string
  id: string
  isAdmin?: boolean
  avatar?: string
  banner?: string
  countryCode?: string
  createdAt?: string
}

async function main() {
  // Load users.json
  const raw = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8')) as [string, UserEntry][]
  const usersMap = new Map(raw)

  let avatarsSynced = 0
  let usernamesSynced = 0
  let countrySynced = 0
  let playersCreated = 0

  const steamUsers = Array.from(usersMap.entries()).filter(([_, u]) => u.steamId)
  console.log(`users.json: ${steamUsers.length} steam users`)

  for (const [key, user] of steamUsers) {
    if (!user.steamId) continue

    const player = await prisma.player.findUnique({
      where: { steamId: user.steamId },
      select: { id: true, username: true, avatar: true, countryCode: true }
    })

    if (!player) {
      // Create missing Player record
      const now = new Date()
      await prisma.player.create({
        data: {
          id: `player_${user.steamId}_${Date.now()}`,
          steamId: user.steamId,
          username: user.username,
          avatar: user.avatar || null,
          countryCode: user.countryCode || null,
          createdAt: now,
          updatedAt: now,
        }
      })
      playersCreated++
      console.log(`  CREATED Player for ${user.steamId} (${user.username})`)
      continue
    }

    // 1. Sync custom avatar from users.json -> Player DB
    // Custom avatars start with /avatars/ (uploaded by user)
    if (user.avatar && user.avatar.startsWith('/avatars/') && player.avatar !== user.avatar) {
      await prisma.player.update({
        where: { steamId: user.steamId },
        data: { avatar: user.avatar }
      })
      avatarsSynced++
      console.log(`  AVATAR ${user.steamId}: Player.avatar = "${user.avatar}" (was "${player.avatar || 'null'}")`)
    }

    // 2. Sync latest username from Player DB -> users.json
    // Player DB gets updated by game events, so it's more current
    if (player.username && player.username !== user.username) {
      user.username = player.username
      usersMap.set(key, user)
      usernamesSynced++
      console.log(`  USERNAME ${user.steamId}: users.json = "${player.username}" (was "${user.username}")`)
    }

    // 3. Sync country code (DB is more authoritative - set by game IP)
    if (player.countryCode && player.countryCode !== user.countryCode) {
      user.countryCode = player.countryCode
      usersMap.set(key, user)
      countrySynced++
    }
  }

  // Save updated users.json
  const updated = Array.from(usersMap.entries())
  fs.writeFileSync(USERS_PATH, JSON.stringify(updated))
  
  console.log(`\n=== SYNC COMPLETE ===`)
  console.log(`  Custom avatars synced to Player DB: ${avatarsSynced}`)
  console.log(`  Usernames synced to users.json: ${usernamesSynced}`)
  console.log(`  Country codes synced: ${countrySynced}`)
  console.log(`  Players created: ${playersCreated}`)
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
