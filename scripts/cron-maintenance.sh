#!/bin/bash
#
# QuakeClub - Script de Mantenimiento Automático
# 
# Este script ejecuta las tareas de mantenimiento de forma periódica.
# Configurar en crontab apuntando a la ruta donde lo hayas instalado, por ejemplo:
#   */5 * * * * /ruta/al/proyecto/scripts/cron-maintenance.sh >> /ruta/al/proyecto/logs/cron.log 2>&1
#

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Configuración
BASE_URL="${INTERNAL_BASE_URL:-http://localhost:3000}"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

echo "[$TIMESTAMP] === Iniciando mantenimiento automático ==="

# Función para ejecutar una tarea de mantenimiento
run_maintenance() {
    local action=$1
    local description=$2
    
    echo "[$TIMESTAMP] Ejecutando: $description ($action)"
    
    # Usar curl para llamar al API interno
    # Nota: Este endpoint requiere autenticación de admin
    # Por seguridad, solo permitimos ejecutar desde localhost
    response=$(curl -s -X POST "$BASE_URL/api/cron/maintenance" \
        -H "Content-Type: application/json" \
        -H "X-Cron-Secret: ${CRON_SECRET:?ERROR: CRON_SECRET no está definido}" \
        -d "{\"action\": \"$action\"}" \
        --max-time 120 2>&1) || true
    
    if [ -n "$response" ]; then
        echo "  Resultado: $response"
    else
        echo "  Sin respuesta o timeout"
    fi
}

# Ejecutar tareas de mantenimiento
# Orden de prioridad: más frecuentes primero

# 1. Limpiar caché de rankings (rápido, siempre útil)
run_maintenance "clear-rankings-cache" "Limpiar caché de rankings"

# 2. Sincronizar wins/losses (importante para datos correctos)
run_maintenance "sync-wins-losses" "Sincronizar wins/losses desde partidos"

# 3. Verificar consistencia (diagnóstico)
run_maintenance "check-consistency" "Verificar consistencia de datos"

# 4. Limpiar sesiones expiradas (limpieza)
run_maintenance "clean-sessions" "Limpiar sesiones expiradas"

# 5. Corregir usernames rotos (ocasional)
run_maintenance "fix-usernames" "Corregir usernames rotos"

# 6. Recalcular ELO de clanes (cada ejecución)
run_maintenance "recalculate-clan-elo" "Recalcular ELO de clanes"

# 7. Sincronizar perfiles de Steam (solo si hay pendientes)
# Esta tarea es más pesada, ejecutar con menos frecuencia
HOUR=$(date '+%H')
if [ "$((HOUR % 6))" -eq "0" ]; then
    run_maintenance "sync-steam-profiles" "Sincronizar perfiles desde Steam"
fi

echo "[$TIMESTAMP] === Mantenimiento completado ==="
echo ""
