#!/bin/bash
# Cron script para sincronizar wins/losses automáticamente
# Ejecutado cada X minutos por cron

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Log file con timestamp
LOG_FILE="${PROJECT_ROOT}/logs/sync-wins-losses.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Ejecutar el script y guardar log
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"
npx tsx scripts/sync-wins-losses.ts >> "$LOG_FILE" 2>&1
echo "" >> "$LOG_FILE"

# Mantener el log pequeño (últimas 1000 líneas)
tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
