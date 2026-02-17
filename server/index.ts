import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';

// ===== Types =====

type Role = 'prisoner' | 'police';

interface PlayerData {
  id: string;
  name: string;
  role: Role;
  color: number;
  position: { x: number; y: number; z: number };
  rotation: number;
  isFlying: boolean;
  isShooting: boolean;
  isInVehicle: boolean;
  vehicleType: string | null;
  health: number;
  money: number;
  wantedLevel: number;
  lastUpdate: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ===== Config =====

const PORT = parseInt(process.env.PORT || '3001', 10);
const MAX_PLAYERS_PER_ROOM = 20;
const TICK_RATE = 20; // 20Hz broadcast
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 60; // max 60 messages per second per client
const STALE_PLAYER_TIMEOUT = 10000; // 10 seconds without update = disconnect

// ===== Server Setup =====

const app = express();
app.use(cors());

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Jailbreak Multiplayer Server',
    players: players.size,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 5000,
  pingTimeout: 10000,
});

// ===== State =====

const players: Map<string, PlayerData> = new Map();
const rateLimits: Map<string, RateLimitEntry> = new Map();

// ===== Rate Limiting =====

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(socketId);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimits.set(socketId, entry);
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ===== Validation =====

function isValidPosition(pos: unknown): pos is { x: number; y: number; z: number } {
  if (!pos || typeof pos !== 'object') return false;
  const p = pos as Record<string, unknown>;
  return (
    typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number' &&
    isFinite(p.x) && isFinite(p.y) && isFinite(p.z) &&
    Math.abs(p.x) < 10000 && Math.abs(p.y) < 10000 && Math.abs(p.z) < 10000
  );
}

function isValidRotation(rot: unknown): rot is number {
  return typeof rot === 'number' && isFinite(rot);
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return '???';
  return name.slice(0, 20).replace(/[<>&"']/g, '');
}

// ===== Socket Handling =====

io.on('connection', (socket: Socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Check room capacity
  if (players.size >= MAX_PLAYERS_PER_ROOM) {
    socket.emit('error', { message: '서버가 가득 찼습니다 (최대 20명)' });
    socket.disconnect();
    return;
  }

  // Handle join
  socket.on('join', (data: { name: string; role: Role; color: number }) => {
    if (!checkRateLimit(socket.id)) return;

    const name = sanitizeName(data.name);
    const role = data.role === 'police' ? 'police' : 'prisoner';
    const color = typeof data.color === 'number' && isFinite(data.color) ? data.color : 0xff6600;

    const startPos = role === 'prisoner'
      ? { x: -80, y: 0, z: -80 }
      : { x: 60, y: 0, z: 60 };

    const playerData: PlayerData = {
      id: socket.id,
      name,
      role,
      color,
      position: startPos,
      rotation: 0,
      isFlying: false,
      isShooting: false,
      isInVehicle: false,
      vehicleType: null,
      health: 100,
      money: role === 'police' ? 1000 : 0,
      wantedLevel: 0,
      lastUpdate: Date.now(),
    };

    players.set(socket.id, playerData);

    // Send welcome with all current players
    const allPlayers = Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      color: p.color,
      position: p.position,
      rotation: p.rotation,
      isFlying: p.isFlying,
      isShooting: p.isShooting,
      isInVehicle: p.isInVehicle,
      vehicleType: p.vehicleType,
      health: p.health,
      money: p.money,
      wantedLevel: p.wantedLevel,
    }));

    socket.emit('welcome', { id: socket.id, players: allPlayers });

    // Broadcast new player to others
    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      name,
      role,
      color,
    });

    console.log(`[JOIN] ${name} (${role}) - Total: ${players.size}/${MAX_PLAYERS_PER_ROOM}`);
  });

  // Handle position/state update
  socket.on('update', (data: {
    position: { x: number; y: number; z: number };
    rotation: number;
    isFlying: boolean;
    isShooting: boolean;
    isInVehicle: boolean;
    vehicleType: string | null;
    health: number;
    money: number;
    wantedLevel: number;
  }) => {
    if (!checkRateLimit(socket.id)) return;

    const player = players.get(socket.id);
    if (!player) return;

    // Validate
    if (!isValidPosition(data.position)) return;
    if (!isValidRotation(data.rotation)) return;

    // Update state
    player.position = data.position;
    player.rotation = data.rotation;
    player.isFlying = !!data.isFlying;
    player.isShooting = !!data.isShooting;
    player.isInVehicle = !!data.isInVehicle;
    player.vehicleType = data.vehicleType || null;
    player.health = typeof data.health === 'number' ? Math.max(0, Math.min(100, data.health)) : 100;
    player.money = typeof data.money === 'number' ? Math.max(0, data.money) : 0;
    player.wantedLevel = typeof data.wantedLevel === 'number' ? Math.max(0, Math.min(5, data.wantedLevel)) : 0;
    player.lastUpdate = Date.now();
  });

  // Handle shooting
  socket.on('shoot', (data: {
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!players.has(socket.id)) return;
    if (!isValidPosition(data.origin) || !isValidPosition(data.direction)) return;

    socket.broadcast.emit('playerShoot', {
      id: socket.id,
      origin: data.origin,
      direction: data.direction,
    });
  });

  // Handle stab
  socket.on('stab', (data: { targetId: string }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!players.has(socket.id)) return;
    if (typeof data.targetId !== 'string') return;

    socket.broadcast.emit('playerStab', {
      id: socket.id,
      targetId: data.targetId,
    });
  });

  // Handle chat
  socket.on('chat', (data: { message: string }) => {
    if (!checkRateLimit(socket.id)) return;
    const player = players.get(socket.id);
    if (!player) return;

    const message = typeof data.message === 'string'
      ? data.message.slice(0, 200).replace(/[<>&]/g, '')
      : '';
    if (!message) return;

    io.emit('chat', {
      id: socket.id,
      name: player.name,
      message,
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`[-] Disconnected: ${player.name} (${reason}) - Total: ${players.size - 1}`);
      players.delete(socket.id);
      rateLimits.delete(socket.id);
      io.emit('playerLeft', { id: socket.id });
    }
  });
});

// ===== Broadcast Loop =====

setInterval(() => {
  if (players.size === 0) return;

  const now = Date.now();
  const playersObj: Record<string, {
    id: string;
    name: string;
    role: Role;
    color: number;
    position: { x: number; y: number; z: number };
    rotation: number;
    isFlying: boolean;
    isShooting: boolean;
    isInVehicle: boolean;
    vehicleType: string | null;
    health: number;
    money: number;
    wantedLevel: number;
  }> = {};

  // Build update and remove stale players
  const staleIds: string[] = [];
  for (const [id, player] of players) {
    if (now - player.lastUpdate > STALE_PLAYER_TIMEOUT) {
      staleIds.push(id);
      continue;
    }
    playersObj[id] = {
      id: player.id,
      name: player.name,
      role: player.role,
      color: player.color,
      position: player.position,
      rotation: player.rotation,
      isFlying: player.isFlying,
      isShooting: player.isShooting,
      isInVehicle: player.isInVehicle,
      vehicleType: player.vehicleType,
      health: player.health,
      money: player.money,
      wantedLevel: player.wantedLevel,
    };
  }

  // Remove stale players
  for (const id of staleIds) {
    const player = players.get(id);
    if (player) {
      console.log(`[STALE] Removing ${player.name} (no update for ${STALE_PLAYER_TIMEOUT / 1000}s)`);
      players.delete(id);
      rateLimits.delete(id);
      io.emit('playerLeft', { id });
      // Force disconnect the socket
      const socket = io.sockets.sockets.get(id);
      if (socket) socket.disconnect(true);
    }
  }

  // Broadcast to all
  if (Object.keys(playersObj).length > 0) {
    io.emit('playersUpdate', { players: playersObj });
  }
}, 1000 / TICK_RATE);

// ===== Clean up rate limits periodically =====

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of rateLimits) {
    if (now > entry.resetAt && !players.has(id)) {
      rateLimits.delete(id);
    }
  }
}, 60000);

// ===== Start =====

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Jailbreak Multiplayer Server           ║
║   Port: ${PORT}                            ║
║   Max Players: ${MAX_PLAYERS_PER_ROOM}                       ║
║   Tick Rate: ${TICK_RATE}Hz                        ║
╚══════════════════════════════════════════╝
  `);
});
