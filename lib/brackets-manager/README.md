# BracketsManager

Sistema completo de gestión de brackets de torneo basado en [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js).

## Características

Implementación completa de todos los módulos de brackets-manager.js:

- ✅ **CREATE** - Generación de brackets Double Elimination y Single Elimination
- ✅ **UPDATE** - Actualización de resultados y manejo de forfeits
- ✅ **GET** - Consultas de estado del bracket
- ✅ **FIND** - Búsqueda de matches y participantes
- ✅ **RESET** - Reseteo de estado del bracket
- ✅ **DELETE** - Eliminación de datos del bracket

## Instalación

El módulo ya está integrado en el proyecto. Importa desde:

```typescript
import { BracketsManager } from '@/lib/brackets-manager'
```

## Uso

### CREATE - Generar Brackets

#### Double Elimination

```typescript
await BracketsManager.create.doubleElimination(
  tournamentId: string,
  registrationIds: string[],
  shuffle?: boolean
)
```

Genera un bracket de doble eliminación completo con:
- Upper bracket (winners)
- Lower bracket (losers)
- Grand Final
- Linking automático entre matches
- Balance de BYEs

#### Single Elimination

```typescript
await BracketsManager.create.singleElimination(
  tournamentId: string,
  registrationIds: string[],
  shuffle?: boolean
)
```

Genera un bracket de eliminación simple con linking automático.

### UPDATE - Actualizar Resultados

#### Actualizar Resultado de Match

```typescript
await BracketsManager.update.matchResult(matchId: string, result: {
  winnerId: string
  score1?: number
  score2?: number
  forfeit?: boolean
})
```

Actualiza el resultado de un match y **avanza automáticamente**:
- Winner al siguiente match (nextMatchId)
- Loser al lower bracket (nextLoserMatchId) si aplica

#### Resetear Resultado de Match

```typescript
await BracketsManager.update.resetMatchResult(matchId: string)
```

Limpia el resultado de un match específico y remueve participantes de matches dependientes.

#### Declarar Forfeit

```typescript
await BracketsManager.update.forfeitMatch(
  matchId: string,
  forfeitingParticipantId: string
)
```

Marca un match como forfeit, otorgando victoria al oponente.

### GET - Consultar Estado

#### Obtener Seeding

```typescript
const seeding = await BracketsManager.get.seeding(tournamentId: string)
// Returns: Seeding[]
```

Retorna el orden de seeding del torneo.

#### Obtener Standings Finales

```typescript
const standings = await BracketsManager.get.finalStandings(tournamentId: string)
// Returns: Standings[]
```

Retorna la clasificación final con posiciones, wins/losses.

#### Obtener Próximos Matches

```typescript
const nextMatches = await BracketsManager.get.nextMatches(tournamentId: string)
// Returns: NextMatch[]
```

Retorna todos los matches PENDING con ambos participantes listos.

#### Obtener Estado de Participante

```typescript
const status = await BracketsManager.get.participantStatus(
  tournamentId: string,
  registrationId: string
)
// Returns: ParticipantStatus
```

Retorna estado del participante: eliminado, bracket actual, próximo match, stats.

### FIND - Buscar Matches

#### Encontrar Match Específico

```typescript
const match = await BracketsManager.find.match(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS',
  round: number,
  matchNumber: number
)
```

#### Encontrar Matches de Participante

```typescript
const matches = await BracketsManager.find.matchesForParticipant(
  tournamentId: string,
  registrationId: string
)
```

#### Encontrar Próximo Match de Participante

```typescript
const nextMatch = await BracketsManager.find.nextMatchForParticipant(
  tournamentId: string,
  registrationId: string
)
```

#### Encontrar Oponente

```typescript
const opponentId = await BracketsManager.find.opponent(
  matchId: string,
  registrationId: string
)
```

#### Otras Búsquedas

```typescript
// Matches en un bracket específico
await BracketsManager.find.matchesInBracket(tournamentId, 'UPPER')

// Matches en un round específico
await BracketsManager.find.matchesInRound(tournamentId, 'UPPER', 1)

// Matches pendientes (listos para jugar)
await BracketsManager.find.pendingMatches(tournamentId)

// Matches completados
await BracketsManager.find.completedMatches(tournamentId)
```

### RESET - Resetear Estado

#### Resetear Todos los Resultados

```typescript
await BracketsManager.reset.allResults(tournamentId: string)
```

Limpia todos los resultados pero mantiene la estructura del bracket.

#### Resetear desde Round Específico

```typescript
await BracketsManager.reset.fromRound(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS',
  round: number
)
```

Resetea matches desde un round específico en adelante.

#### Resetear Seeding

```typescript
await BracketsManager.reset.seeding(tournamentId: string)
```

Limpia todas las asignaciones de participantes (vuelve a estado inicial).

#### Resetear Solo Resultados

```typescript
await BracketsManager.reset.results(tournamentId: string)
```

Limpia scores y winners pero mantiene participantes asignados.

#### Resetear Bracket Específico

```typescript
await BracketsManager.reset.bracket(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS'
)
```

### DELETE - Eliminar Datos

#### Eliminar Todos los Matches

```typescript
const count = await BracketsManager.delete.allMatches(tournamentId: string)
```

#### Eliminar Bracket Específico

```typescript
const count = await BracketsManager.delete.bracket(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS'
)
```

#### Eliminar desde Round Específico

```typescript
const count = await BracketsManager.delete.fromRound(
  tournamentId: string,
  bracket: 'UPPER' | 'LOWER' | 'FINALS',
  round: number
)
```

#### Eliminar Match Específico

```typescript
await BracketsManager.delete.match(matchId: string)
```

⚠️ Falla si otros matches dependen del resultado.

#### Eliminar BYE Matches

```typescript
const count = await BracketsManager.delete.byeMatches(tournamentId: string)
```

#### Eliminar Matches Pendientes

```typescript
const count = await BracketsManager.delete.pendingMatches(tournamentId: string)
```

#### Eliminar Torneo Completo

```typescript
await BracketsManager.delete.tournament(tournamentId: string)
```

⚠️ Elimina el torneo y TODOS sus datos relacionados (matches, registrations, maps).

## Tipos

```typescript
import type {
  MatchStatus,
  Bracket,
  MatchResult,
  MatchWithParticipants,
  Seeding,
  Standings,
  NextMatch,
  ParticipantStatus,
} from '@/lib/brackets-manager'
```

## Estructura del Módulo

```
lib/brackets-manager/
├── index.ts              # Exportaciones principales
├── types.ts              # Tipos compartidos
├── update.ts             # UPDATE module
├── get.ts                # GET module
├── find.ts               # FIND module
├── reset.ts              # RESET module
├── delete.ts             # DELETE module
├── single-elimination.ts # Generador Single Elimination
└── README.md             # Esta documentación

lib/
├── brackets-generator-v2.ts  # Generador Double Elimination
└── brackets-helpers.ts       # Funciones helper compartidas
```

## Ejemplos de Uso Completo

### Ejemplo: Crear y Ejecutar Torneo

```typescript
// 1. Crear bracket
await BracketsManager.create.doubleElimination(
  tournamentId,
  registrationIds,
  false // no shuffle
)

// 2. Obtener próximos matches
const nextMatches = await BracketsManager.get.nextMatches(tournamentId)

// 3. Actualizar resultado del primer match
await BracketsManager.update.matchResult(nextMatches[0].matchId, {
  winnerId: 'registration-id-1',
  score1: 2,
  score2: 0,
})

// 4. Verificar que el winner avanzó
const participant1Status = await BracketsManager.get.participantStatus(
  tournamentId,
  'registration-id-1'
)
console.log('Next match:', participant1Status.nextMatchId)

// 5. Al final, obtener standings
const standings = await BracketsManager.get.finalStandings(tournamentId)
console.log('Champion:', standings[0])
```

### Ejemplo: Manejo de Errores

```typescript
try {
  await BracketsManager.update.matchResult(matchId, {
    winnerId: 'invalid-id',
  })
} catch (error) {
  // Error: Winner must be one of the match participants
  console.error(error.message)
}
```

### Ejemplo: Resetear Torneo

```typescript
// Opción 1: Resetear solo resultados
await BracketsManager.reset.results(tournamentId)

// Opción 2: Resetear todo (volver a seeding)
await BracketsManager.reset.seeding(tournamentId)

// Opción 3: Eliminar y recrear
await BracketsManager.delete.allMatches(tournamentId)
await BracketsManager.create.doubleElimination(tournamentId, registrationIds)
```

## Diferencias con brackets-manager.js Original

1. **Integración Prisma**: Usa Prisma ORM en vez de almacenamiento genérico
2. **TypeScript Nativo**: Tipos específicos para el schema del proyecto
3. **Async/Await**: Todas las operaciones son asíncronas
4. **Clan System**: Integrado con sistema de clanes del proyecto
5. **Match Advancement**: Lógica de avance automático mejorada

## Testing

Para verificar que el bracket está correctamente generado:

```bash
# Verificar estructura y linking
npx tsx scripts/verify-bracket-linking.ts

# Ver estructura del bracket
npx tsx scripts/check-bracket.ts

# Regenerar bracket de prueba
npx tsx scripts/regenerate-bracket.ts
```

## Troubleshooting

### Winners no avanzan

Verifica que los matches tienen `nextMatchId` y `nextLoserMatchId` configurados:

```typescript
const match = await prisma.tournamentMatch.findUnique({
  where: { id: matchId },
  select: { nextMatchId: true, nextLoserMatchId: true },
})
console.log(match) // Deben tener valores, no null
```

### Bracket tiene matches extra

Usa el script de verificación:

```bash
npx tsx scripts/verify-bracket-linking.ts
```

Debe mostrar: ✅ All matches are properly linked!

### Estructura incorrecta

Para 8-team double elimination debe ser:
- Upper: 7 matches (4+2+1)
- Lower: 6 matches (2+2+1+1)
- Grand Final: 1 match
- **Total: 14 matches**

## Contribuir

Este módulo está basado en brackets-manager.js. Para nuevas features o bugs, verificar primero la implementación original:
https://github.com/Drarig29/brackets-manager.js

## Licencia

Mismo que brackets-manager.js: MIT
