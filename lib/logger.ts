/**
 * Sistema de logging con colores ANSI (sin emojis)
 * Todos los mensajes en español
 */

// Códigos de color ANSI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colores de texto
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Colores de fondo
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

/**
 * Logger con prefijo [STATS]
 */
export const statsLogger = {
  header: (text: string) => {
    console.log(`\n${colors.cyan}${colors.bright}========================================${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}${text}${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}========================================${colors.reset}`)
  },

  info: (label: string, value: any) => {
    console.log(`${colors.blue}[STATS]${colors.reset} ${colors.bright}${label}:${colors.reset} ${value}`)
  },

  success: (message: string) => {
    console.log(`${colors.green}[STATS]${colors.reset} ${colors.bright}${message}${colors.reset}`)
  },

  warning: (message: string) => {
    console.log(`${colors.yellow}[STATS]${colors.reset} ${colors.bright}ADVERTENCIA:${colors.reset} ${message}`)
  },

  error: (message: string, error?: any) => {
    console.error(`${colors.red}[STATS]${colors.reset} ${colors.bright}ERROR:${colors.reset} ${message}`, error || '')
  },

  debug: (message: string) => {
    console.log(`${colors.gray}[STATS]${colors.reset} ${message}`)
  },

  ctf: (label: string, value: any) => {
    console.log(`${colors.magenta}[CTF]${colors.reset} ${colors.bright}${label}:${colors.reset} ${value}`)
  },
}

/**
 * Logger para el sistema de rating Glicko
 */
export const ratingLogger = {
  header: (text: string) => {
    console.log(`\n${colors.cyan}${colors.bright}========================================${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}${text}${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}========================================${colors.reset}`)
  },

  info: (message: string, value?: any) => {
    if (value !== undefined) {
      console.log(`${colors.cyan}[RATING]${colors.reset} ${colors.bright}${message}:${colors.reset} ${value}`)
    } else {
      console.log(`${colors.cyan}[RATING]${colors.reset} ${message}`)
    }
  },

  warn: (message: string) => {
    console.log(`${colors.yellow}[RATING]${colors.reset} ${colors.bright}ADVERTENCIA:${colors.reset} ${message}`)
  },

  change: (steamId: string, before: number, after: number, change: number, details?: any) => {
    const changeColor = change > 0 ? colors.green : colors.red
    const sign = change > 0 ? '+' : ''
    let logMessage = `${colors.cyan}[GLICKO]${colors.reset} ${steamId}: ${colors.bright}${Math.round(before)}${colors.reset} → ${colors.bright}${Math.round(after)}${colors.reset} ${changeColor}(${sign}${change})${colors.reset}`
    
    if (details) {
      const detailsStr = Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
      logMessage += ` ${colors.gray}[${detailsStr}]${colors.reset}`
    }
    
    console.log(logMessage)
  },

  calculation: (matchId: string, players: number, required: number) => {
    if (players >= required) {
      console.log(`${colors.green}[RATING]${colors.reset} Rating calculado instantáneamente para match ${matchId} (${players}/${required} jugadores)`)
    } else {
      console.log(`${colors.yellow}[RATING]${colors.reset} Esperando más jugadores para calcular rating: ${players}/${required}`)
    }
  },

  group: (method: string, count: number, groupId?: string) => {
    if (groupId) {
      console.log(`${colors.magenta}[RATING]${colors.reset} Buscando jugadores por ${method}: ${groupId} (encontrados: ${count})`)
    } else {
      console.log(`${colors.magenta}[RATING]${colors.reset} Buscando jugadores por ${method} (encontrados: ${count})`)
    }
  },

  error: (message: string, error?: any) => {
    console.error(`${colors.red}[RATING]${colors.reset} ${colors.bright}ERROR:${colors.reset} ${message}`, error || '')
  },
}

/**
 * Logger para el calculador de ratings batch
 */
export const calculatorLogger = {
  start: (gameType: string) => {
    console.log(`${colors.cyan}[CALCULATOR]${colors.reset} Iniciando cálculo de ratings para ${gameType || 'todos'} los modos de juego...`)
  },

  found: (count: number) => {
    console.log(`${colors.cyan}[CALCULATOR]${colors.reset} Encontrados ${colors.bright}${count}${colors.reset} matches sin ratings`)
  },

  grouped: (count: number) => {
    console.log(`${colors.cyan}[CALCULATOR]${colors.reset} Agrupados en ${colors.bright}${count}${colors.reset} matches distintos`)
  },

  processing: (gameType: string, map: string, players: number) => {
    console.log(`${colors.cyan}[CALCULATOR]${colors.reset} Procesando: ${colors.bright}${gameType}${colors.reset} en ${colors.bright}${map}${colors.reset} con ${colors.bright}${players}${colors.reset} jugadores`)
  },

  skipping: (matchId: string, gameType: string, current: number, required: number) => {
    console.log(`${colors.yellow}[CALCULATOR]${colors.reset} Saltando match ${matchId} (${gameType}): solo ${current}/${required} jugadores`)
  },

  error: (matchId: string, error: any) => {
    console.error(`${colors.red}[CALCULATOR]${colors.reset} Error procesando match ${matchId}:`, error)
  },
}
