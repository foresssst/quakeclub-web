/**
 * Listener ZMQ de QuakeClub
 * 
 * Este módulo se conecta a los servidores de Quake Live vía ZeroMQ para recibir
 * estadísticas de partidos en tiempo real.
 * 
 * PROTOCOLO ZMQ:
 * - Usa patrón Publisher-Subscriber (PUB-SUB)
 * - Autenticación PLAIN con usuario/contraseña
 * - Mensajes en formato JSON con TYPE y DATA
 * 
 * TIPOS DE MENSAJES:
 * - MATCH_STARTED: Inicio de partido
 * - PLAYER_STATS: Estadísticas de jugador durante el partido
 * - MATCH_REPORT: Reporte final del partido (contiene todos los datos)
 * - PLAYER_CONNECT/DISCONNECT: Conexión/desconexión de jugadores
 * 
 * GESTIÓN DE CONEXIONES:
 * - Reconexión automática cada 5 minutos si el servidor está offline
 * - Reconexión por inactividad después de 15 minutos sin mensajes
 * - Log de estado cada 30 segundos
 */

import * as zmq from 'zeromq';
import { MatchTracker } from './zmq-tracker';
import * as fs from 'fs';
import * as path from 'path';

// Capturar errores de conexión ZMQ que escapan del try-catch
// Solo registrar una vez usando un flag global
const ZMQ_ERROR_HANDLER_KEY = '__zmq_error_handler_registered__';
if (!(global as any)[ZMQ_ERROR_HANDLER_KEY]) {
  (global as any)[ZMQ_ERROR_HANDLER_KEY] = true;

  process.on('uncaughtException', (error: any) => {
    const isZmqConnectionError = error?.code === 'ECONNRESET' ||
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('aborted');

    if (isZmqConnectionError) {
      // Ignorar silenciosamente - el listener se reconectará automáticamente
      return;
    }

    // Loguear otros errores pero no crashear
    console.error('[FATAL] Uncaught exception:', error);
  });
}

// Endpoint de la API interna (no se usa actualmente, MatchTracker guarda directo a DB)
// API_KEY se obtiene de variable de entorno si fuera necesario
const API_ENDPOINT = 'http://localhost:3000/api/match';

// Intervalos de reconexión (en milisegundos)
const OFFLINE_SERVER_RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutos - servidor offline
const IDLE_RECONNECT_INTERVAL = 15 * 60 * 1000; // 15 minutos - sin mensajes
const RECONNECT_RANDOMIZED_INTERVAL = 10 * 1000; // ±10 segundos - aleatorización

interface ZmqMessage {
  TYPE: string;
  DATA: any;
}

interface ServerConfig {
  ip: string;
  port: number;
  password: string;
  serverType: string; // "public" | "competitive"
}

// Estados del servidor ZMQ
interface ServerState {
  connecting: boolean;
  connected: boolean;
  active: boolean;
  disconnected: boolean;
  lastMessageTime: number;
  lastMessageType: string;
  connectTime: number;
}

// Carga servidores desde archivo .env.zmq (fallback)
function loadServerConfigFromFile(): ServerConfig[] {
  const servers: ServerConfig[] = [];
  const envPath = path.join(process.cwd(), '.env.zmq');

  if (!fs.existsSync(envPath)) {
    console.warn('[ZMQ] Archivo .env.zmq no encontrado');
    return [];
  }

  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;

      const match = line.match(/QUAKE_SERVER_\d+=(.+)/);
      if (!match) continue;

      const serverStr = match[1].trim();
      const serverMatch = serverStr.match(/^([^:]+):(\d+)\/(.+)$/);
      if (serverMatch) {
        servers.push({
          ip: serverMatch[1],
          port: parseInt(serverMatch[2]),
          password: serverMatch[3],
          serverType: 'public', // Archivos env solo soportan servidores públicos
        });
      }
    }
  } catch (error) {
    console.error('[ZMQ] Error leyendo .env.zmq:', error);
  }

  return servers;
}

// Carga servidores desde la base de datos (preferido)
async function loadServerConfigFromDatabase(): Promise<ServerConfig[]> {
  try {
    // Import dinámico para evitar dependencia circular
    const { prisma } = await import('./prisma');
    const { decrypt } = await import('./crypto');

    const dbServers = await prisma.zmqServerConfig.findMany({
      where: { enabled: true },
      orderBy: [{ ip: 'asc' }, { port: 'asc' }]
    });

    return dbServers.map(server => ({
      ip: server.ip,
      port: server.port,
      password: decrypt(server.password),
      serverType: server.serverType || 'public',
    }));
  } catch (error) {
    console.warn('[ZMQ] No se pudo cargar servidores desde BD, usando archivo:', error);
    return [];
  }
}

// Función principal para cargar configuración de servidores
// Prioriza base de datos, fallback a archivo .env.zmq
async function loadServerConfig(): Promise<ServerConfig[]> {
  // Intentar cargar desde base de datos primero
  const dbServers = await loadServerConfigFromDatabase();

  if (dbServers.length > 0) {
    console.log(`[ZMQ] ${dbServers.length} servidores cargados desde base de datos`);
    return dbServers;
  }

  // Fallback al archivo .env.zmq
  const fileServers = loadServerConfigFromFile();
  if (fileServers.length > 0) {
    console.log(`[ZMQ] ${fileServers.length} servidores cargados desde .env.zmq`);
  }

  return fileServers;
}

// Set global para persistir entre recargas del módulo en dev mode
const PROCESSED_MATCHES_KEY = '__zmq_processed_matches__';
if (!(global as any)[PROCESSED_MATCHES_KEY]) {
  (global as any)[PROCESSED_MATCHES_KEY] = new Set<string>();
}
const globalProcessedMatches: Set<string> = (global as any)[PROCESSED_MATCHES_KEY];

class QuakeLiveZmqSubscriber {
  private sockets: Map<string, any> = new Map();
  private running = false;
  private trackers: Map<string, MatchTracker> = new Map();
  private servers: ServerConfig[] = [];
  private serverStates: Map<string, ServerState> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private idleTimers: Map<string, NodeJS.Timeout> = new Map();
  private statusInterval?: NodeJS.Timeout;
  private initialized = false;

  constructor() {
    // Los servidores se cargan en init() ya que loadServerConfig es async
    this.servers = [];
  }

  // Inicialización async - debe llamarse antes de start()
  async init(): Promise<void> {
    if (this.initialized) return;
    this.servers = await loadServerConfig();
    this.initialized = true;
  }

  private resetState(addr: string): void {
    this.serverStates.set(addr, {
      connecting: false,
      connected: false,
      active: false,
      disconnected: true,
      lastMessageTime: 0,
      lastMessageType: '',
      connectTime: 0,
    });
  }

  private async subscribeToServer(config: ServerConfig, isReconnect = false): Promise<void> {
    const addr = `${config.ip}:${config.port}`;
    let state = this.serverStates.get(addr);

    if (!state) {
      this.resetState(addr);
      state = this.serverStates.get(addr)!;
    }

    if (state.connecting || state.connected) return;

    state.connecting = true;
    state.disconnected = false;
    state.connectTime = Date.now();

    try {
      const socket = new zmq.Subscriber();

      if (config.password) {
        socket.zapDomain = 'stats';
        socket.plainUsername = 'stats';
        socket.plainPassword = config.password;
      }

      const url = `tcp://${config.ip}:${config.port}`;
      console.log(`[ZMQ] Conectando a ${url} (pass: ${config.password ? "sí" : "no"})`);
      // Log silencioso - solo loguear cuando se conecta exitosamente

      socket.connect(url);
      socket.subscribe('');

      this.sockets.set(addr, socket);
      this.trackers.set(addr, new MatchTracker(config.serverType));

      this.listenToSocket(addr, socket, isReconnect);

    } catch (error) {
      console.error(`[ZMQ] ${addr}: Error al suscribirse`, error);
      state.connecting = false;
      state.disconnected = true;
      this.startReconnectTimer(addr, config);
    }
  }


  /**
   * Actualiza el estado del servidor en la base de datos
   */
  private async updateServerStatusInDb(ip: string, port: number, status: 'CONNECTED' | 'DISCONNECTED'): Promise<void> {
    try {
      const { prisma } = await import('./prisma');
      await prisma.zmqServerConfig.updateMany({
        where: { ip, port }, // ZMQ port
        data: {
          status,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.warn(`[ZMQ] ${ip}:${port}: No se pudo actualizar estado a ${status}`, error);
    }
  }

  private async listenToSocket(addr: string, socket: any, isReconnect: boolean): Promise<void> {
    const [ip, portStr] = addr.split(':');
    const port = parseInt(portStr);

    try {
      for await (const [msg] of socket) {
        const state = this.serverStates.get(addr);
        if (!state) continue;

        // Primer mensaje = conexión exitosa
        if (!state.connected) {
          state.connected = true;
          state.connecting = false;
          state.disconnected = false;
          // Solo loguear primera conexión o reconexiones
          if (isReconnect) {
            console.log(`[ZMQ] ${addr}: Reconectado ✓`);
          }
          this.resetIdleTimeout(addr);
          // Actualizar estado en BD
          this.updateServerStatusInDb(ip, port, 'CONNECTED');
        }

        state.lastMessageTime = Date.now();

        try {
          const message: ZmqMessage = JSON.parse(msg.toString());
          state.lastMessageType = message.TYPE;

          // Solo loggear eventos importantes de matches
          if (message.TYPE === 'MATCH_STARTED') {
            state.active = true;
            const map = message.DATA?.MAP || 'unknown';
            const gameType = message.DATA?.GAME_TYPE || 'unknown';
            console.log(`[ZMQ] ${addr}: 🎮 Match iniciado - ${map} (${gameType})`);
          } else if (message.TYPE === 'MATCH_REPORT') {
            state.active = false;
            // El log del match procesado se hace en handleMessage
          }

          await this.handleMessage(addr, message);
        } catch (error) {
          console.error(`[ZMQ] ${addr}: Error procesando mensaje:`, error);
        }

        this.resetIdleTimeout(addr);
      }
    } catch (error: any) {
      // Ignorar errores de conexión reseteada (son normales cuando el servidor se reinicia)
      const isConnectionError = error?.code === 'ECONNRESET' ||
        error?.code === 'ECONNREFUSED' ||
        error?.message?.includes('aborted');

      if (isConnectionError) {
        console.log(`[ZMQ] ${addr}: Conexión perdida, reconectando...`);
      } else {
        console.error(`[ZMQ] ${addr}: Error en listener:`, error);
      }

      this.disconnect(addr);
      this.updateServerStatusInDb(ip, port, 'DISCONNECTED');
      const config = this.servers.find(s => `${s.ip}:${s.port}` === addr);
      if (config) this.startReconnectTimer(addr, config);
    }
  }

  private startReconnectTimer(addr: string, config: ServerConfig): void {
    const existing = this.reconnectTimers.get(addr);
    if (existing) clearTimeout(existing);

    const randomDelay = (Math.random() - 0.5) * RECONNECT_RANDOMIZED_INTERVAL;
    const delay = OFFLINE_SERVER_RETRY_INTERVAL + randomDelay;

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(addr);
      this.subscribeToServer(config, true);
    }, delay);

    this.reconnectTimers.set(addr, timer);
    // Log silencioso - no saturar con reintentos
  }

  private resetIdleTimeout(addr: string): void {
    const existing = this.idleTimers.get(addr);
    if (existing) clearTimeout(existing);

    const randomDelay = (Math.random() - 0.5) * RECONNECT_RANDOMIZED_INTERVAL;
    const delay = IDLE_RECONNECT_INTERVAL + randomDelay;

    const timer = setTimeout(() => {
      // Reconexión silenciosa por idle
      this.idleTimers.delete(addr);
      const config = this.servers.find(s => `${s.ip}:${s.port}` === addr);
      if (config) {
        this.disconnect(addr);
        this.subscribeToServer(config, true);
      }
    }, delay);

    this.idleTimers.set(addr, timer);
  }

  private disconnect(addr: string): void {
    const socket = this.sockets.get(addr);
    if (socket) {
      try { socket.close(); } catch { }
      this.sockets.delete(addr);
    }

    const state = this.serverStates.get(addr);
    if (state) {
      state.connected = false;
      state.connecting = false;
      state.active = false;
      state.disconnected = true;
    }

    const idleTimer = this.idleTimers.get(addr);
    if (idleTimer) {
      clearTimeout(idleTimer);
      this.idleTimers.delete(addr);
    }
  }

  /**
   * Actualiza automáticamente el nombre del servidor en ZmqServerConfig
   * cuando se recibe SERVER_TITLE desde ZMQ
   */
  private async updateServerNameInConfig(ip: string, port: number, serverName: string): Promise<void> {
    try {
      const { prisma } = await import('./prisma');

      // Buscar el servidor por IP y puerto ZMQ
      const server = await prisma.zmqServerConfig.findFirst({
        where: { ip, port }
      });

      if (!server) {
        // Si no encontramos por puerto ZMQ, buscar por gamePort
        const serverByGamePort = await prisma.zmqServerConfig.findFirst({
          where: { ip, gamePort: port }
        });

        if (serverByGamePort && serverByGamePort.name !== serverName) {
          await prisma.zmqServerConfig.update({
            where: { id: serverByGamePort.id },
            data: {
              name: serverName,
              lastSeen: new Date()
            }
          });
          console.log(`[ZMQ] 📝 Nombre actualizado: ${serverByGamePort.name} -> ${serverName}`);
        }
        return;
      }

      // Solo actualizar si el nombre cambió
      if (server.name !== serverName) {
        await prisma.zmqServerConfig.update({
          where: { id: server.id },
          data: {
            name: serverName,
            lastSeen: new Date()
          }
        });
        console.log(`[ZMQ] 📝 Nombre actualizado: ${server.name} -> ${serverName}`);
      } else {
        // Solo actualizar lastSeen
        await prisma.zmqServerConfig.update({
          where: { id: server.id },
          data: { lastSeen: new Date() }
        });
      }
    } catch (error) {
      // Silencioso - no queremos fallar por no poder actualizar el nombre
      console.warn('[ZMQ] No se pudo actualizar nombre del servidor:', error);
    }
  }

  private async handleMessage(addr: string, message: ZmqMessage): Promise<void> {
    const tracker = this.trackers.get(addr);
    if (!tracker) return;

    try {
      // Extraer IP y puerto
      const [ip, portStr] = addr.split(':');
      const port = parseInt(portStr);

      // Capturar nombre del servidor automáticamente en ZmqServerConfig
      if (message.TYPE === 'MATCH_STARTED' && message.DATA?.SERVER_TITLE) {
        this.updateServerNameInConfig(ip, port, message.DATA.SERVER_TITLE);
      }

      // Si es MATCH_REPORT, verificar si ya lo procesamos ANTES de enviarlo al tracker
      if (message.TYPE === 'MATCH_REPORT') {
        const matchId = message.DATA?.MATCH_GUID;
        if (matchId) {
          if (globalProcessedMatches.has(matchId)) {
            // Ya procesamos este match, ignorar silenciosamente
            return;
          }
          globalProcessedMatches.add(matchId);

          // Limpiar matches antiguos del Set para evitar memory leaks
          if (globalProcessedMatches.size > 1000) {
            const matchArray = Array.from(globalProcessedMatches);
            globalProcessedMatches.clear();
            matchArray.slice(-500).forEach(id => globalProcessedMatches.add(id));
          }
        }
      }

      // MatchTracker usa processMessage() como método principal
      tracker.processMessage(message.TYPE, message.DATA);
    } catch (error) {
      console.error(`[ZMQ] ${addr}: Error manejando ${message.TYPE}`, error);
    }
  }

  private startStatusLogger(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);

    // Log de estado cada 5 minutos (solo en desarrollo se puede bajar)
    const STATUS_INTERVAL = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 60 * 1000;

    this.statusInterval = setInterval(() => {
      const activeServers = Array.from(this.serverStates.entries())
        .filter(([, state]) => state.active || state.connected);

      const activeCount = activeServers.filter(([, s]) => s.active).length;
      const connectedCount = activeServers.length;
      const totalCount = this.serverStates.size;

      console.log(`[ZMQ] Estado: ${activeCount} activos, ${connectedCount}/${totalCount} conectados`);
    }, STATUS_INTERVAL);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Asegurar que init() se ejecutó primero
    if (!this.initialized) {
      await this.init();
    }

    if (this.servers.length === 0) {
      console.warn('[ZMQ] No hay servidores configurados (ni en BD ni en .env.zmq)');
      return;
    }

    this.running = true;
    console.log(`[ZMQ] Iniciando listener para ${this.servers.length} servidores...`);

    for (const server of this.servers) {
      await this.subscribeToServer(server);
    }

    this.startStatusLogger();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = undefined;
    }

    for (const [addr] of this.sockets) {
      this.disconnect(addr);
    }

    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }

  getStatus(): Array<{ addr: string; state: ServerState }> {
    const status: Array<{ addr: string; state: ServerState }> = [];
    for (const [addr, state] of this.serverStates.entries()) {
      status.push({ addr, state });
    }
    return status;
  }
}

let listenerInstance: QuakeLiveZmqSubscriber | null = null;

export async function startZmqListener(): Promise<void> {
  if (listenerInstance) {
    console.log('[ZMQ] Listener ya iniciado');
    return;
  }

  listenerInstance = new QuakeLiveZmqSubscriber();
  await listenerInstance.start();
}

export async function stopZmqListener(): Promise<void> {
  if (!listenerInstance) return;

  await listenerInstance.stop();
  listenerInstance = null;
}

export function getZmqListenerStatus(): Array<{ addr: string; state: ServerState }> | null {
  if (!listenerInstance) return null;
  return listenerInstance.getStatus();
}
