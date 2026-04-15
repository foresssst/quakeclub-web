#!/bin/bash
# Cron script para ejecutar TODAS las tareas de mantenimiento
# Ejecutado cada 1 minuto por cron

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Log file
LOG_FILE="${PROJECT_ROOT}/logs/maintenance.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Timestamp
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

# URL base del API
API_URL="http://localhost:3000/api/cron/maintenance"
CRON_SECRET="${CRON_SECRET:?ERROR: CRON_SECRET no está definido}"

# Funcion para ejecutar una tarea
run_task() {
    local action=$1
    local result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "X-Cron-Secret: $CRON_SECRET" \
        -d "{\"action\": \"$action\"}" 2>/dev/null)

    if [ -n "$result" ]; then
        echo "  [$action] $result" >> "$LOG_FILE"
    else
        echo "  [$action] ERROR: No response" >> "$LOG_FILE"
    fi
}

# Ejecutar todas las tareas en orden
run_task "sync-wins-losses"
run_task "fix-elo-bounds"
run_task "recalculate-clan-elo"
run_task "fix-usernames"
run_task "clean-sessions"
run_task "check-consistency"
run_task "clear-rankings-cache"

# sync-steam-profiles solo cada 30 ejecuciones (~30 min) para no abusar del API de Steam
COUNTER_FILE="/tmp/steam_sync_counter"
if [ -f "$COUNTER_FILE" ]; then
    COUNTER=$(cat "$COUNTER_FILE")
else
    COUNTER=0
fi

COUNTER=$((COUNTER + 1))
if [ $COUNTER -ge 30 ]; then
    run_task "sync-steam-profiles"
    COUNTER=0
fi
echo $COUNTER > "$COUNTER_FILE"

echo "" >> "$LOG_FILE"

# Mantener el log pequeño (ultimas 2000 lineas)
tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
