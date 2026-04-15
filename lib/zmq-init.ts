// Inicializa el listener ZMQ cuando arranca el servidor Next.js
import { startZmqListener, stopZmqListener } from './zmq-listener';

// Flag global para persistir entre hot reloads en dev mode
const ZMQ_INIT_KEY = '__zmq_initialized__';

export async function initializeZmqListener() {
  // Solo inicializar en el servidor
  if (typeof window !== 'undefined') return;
  
  // Verificar si ya está inicializado globalmente
  if ((global as any)[ZMQ_INIT_KEY]) {
    return;
  }

    try {
      await startZmqListener();
      (global as any)[ZMQ_INIT_KEY] = true;
    } catch (error) {
      console.error('[ZMQ] Error iniciando listener:', error);
    }
}

// Cleanup cuando el módulo se descarga (para dev mode)
if (typeof window === 'undefined' && process.env.NODE_ENV === 'development') {
  // Registrar cleanup solo una vez
  const CLEANUP_KEY = '__zmq_cleanup_registered__';
  if (!(global as any)[CLEANUP_KEY]) {
    (global as any)[CLEANUP_KEY] = true;
    
    process.on('SIGTERM', async () => {
      await stopZmqListener();
    });
    
    process.on('SIGINT', async () => {
      console.log('[ZMQ] Cerrando...');
      await stopZmqListener();
      process.exit(0);
    });
  }
}

// Auto-inicializar
if (typeof window === 'undefined') {
  initializeZmqListener().catch(console.error);
}
