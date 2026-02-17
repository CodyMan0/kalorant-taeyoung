import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { Role, RemotePlayer, RemotePlayerState, MultiplayerState } from './types';

// ===== State =====

let socket: Socket | null = null;
let localPlayerId: string | null = null;
const remotePlayers: Map<string, RemotePlayer> = new Map();
let sendInterval: ReturnType<typeof setInterval> | null = null;
let connected = false;
let onPlayerCountChange: ((count: number) => void) | null = null;

// ===== Remote Player Mesh Creation =====

function createRemotePlayerMesh(name: string, role: Role, color: number): { group: THREE.Group; nameSprite: THREE.Sprite } {
  const group = new THREE.Group();

  const bodyColor = color || (role === 'prisoner' ? 0xff6600 : 0x2244aa);
  const skinColor = 0xffcc99;

  // Head
  const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 3.2;
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.25, 3.3, 0.61);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.25, 3.3, 0.61);
  group.add(rightEye);

  // Mouth
  const mouthGeo = new THREE.BoxGeometry(0.4, 0.08, 0.1);
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, 3.0, 0.61);
  group.add(mouth);

  // Body
  const bodyGeo = new THREE.BoxGeometry(1.4, 1.8, 0.8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.7;
  body.castShadow = true;
  group.add(body);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
  const armMat = new THREE.MeshStandardMaterial({ color: bodyColor });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.95, 1.85, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.95, 1.85, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const legMat = new THREE.MeshStandardMaterial({ color: role === 'prisoner' ? 0xff6600 : 0x222244 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.35, 0.6, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.35, 0.6, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.55, 0.2, 0.7);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.35, 0.1, 0.05);
  group.add(leftShoe);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.35, 0.1, 0.05);
  group.add(rightShoe);

  // Hat for police
  if (role === 'police') {
    const hatGeo = new THREE.BoxGeometry(1.4, 0.3, 1.4);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x112244 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 3.95;
    group.add(hat);
    const hatTopGeo = new THREE.BoxGeometry(1.0, 0.4, 1.0);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.y = 4.15;
    group.add(hatTop);
  }

  // Wings (hidden by default)
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), wingMat);
  leftWing.position.set(-1.8, 2.0, -0.2);
  leftWing.rotation.z = 0.3;
  leftWing.visible = false;
  leftWing.userData.isWing = true;
  leftWing.userData.side = 'left';
  group.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), wingMat);
  rightWing.position.set(1.8, 2.0, -0.2);
  rightWing.rotation.z = -0.3;
  rightWing.visible = false;
  rightWing.userData.isWing = true;
  rightWing.userData.side = 'right';
  group.add(rightWing);

  // Name tag
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 256;
  nameCanvas.height = 64;
  const nctx = nameCanvas.getContext('2d')!;
  nctx.fillStyle = 'rgba(0,0,0,0.6)';
  nctx.roundRect(0, 0, 256, 64, 8);
  nctx.fill();
  nctx.fillStyle = '#ffffff';
  nctx.font = 'bold 28px Arial';
  nctx.textAlign = 'center';
  nctx.fillText(name, 128, 42);
  const nameTex = new THREE.CanvasTexture(nameCanvas);
  const nameSpriteMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false });
  const nameSprite = new THREE.Sprite(nameSpriteMat);
  nameSprite.position.y = 4.5;
  nameSprite.scale.set(3, 0.75, 1);
  group.add(nameSprite);

  return { group, nameSprite };
}

// ===== Connection =====

export function connectToServer(
  name: string,
  role: Role,
  color: number,
  onCountChange?: (count: number) => void
): void {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (!wsUrl) {
    console.log('[Multiplayer] No WS_URL configured, running in single player mode');
    return;
  }

  if (socket?.connected) {
    console.log('[Multiplayer] Already connected');
    return;
  }

  onPlayerCountChange = onCountChange || null;

  console.log(`[Multiplayer] Connecting to ${wsUrl}...`);

  socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Multiplayer] Connected!');
    connected = true;
    socket!.emit('join', { name, role, color });
  });

  socket.on('welcome', (data: { id: string; players: RemotePlayerState[] }) => {
    localPlayerId = data.id;
    console.log(`[Multiplayer] Welcomed as ${data.id}, ${data.players.length} players online`);

    // Add existing players
    for (const p of data.players) {
      if (p.id === localPlayerId) continue;
      addRemotePlayer(p);
    }
    notifyPlayerCount();
  });

  socket.on('playerJoined', (data: { id: string; name: string; role: Role; color: number }) => {
    if (data.id === localPlayerId) return;
    console.log(`[Multiplayer] Player joined: ${data.name}`);
    addRemotePlayer({
      id: data.id,
      name: data.name,
      role: data.role,
      color: data.color,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      isFlying: false,
      isShooting: false,
      isInVehicle: false,
      vehicleType: null,
      health: 100,
      money: 0,
      wantedLevel: 0,
    });
    notifyPlayerCount();
  });

  socket.on('playerLeft', (data: { id: string }) => {
    console.log(`[Multiplayer] Player left: ${data.id}`);
    removeRemotePlayer(data.id);
    notifyPlayerCount();
  });

  socket.on('playersUpdate', (data: { players: Record<string, RemotePlayerState> }) => {
    const now = Date.now();
    for (const [id, state] of Object.entries(data.players)) {
      if (id === localPlayerId) continue;

      let remote = remotePlayers.get(id);
      if (!remote) {
        addRemotePlayer(state);
        remote = remotePlayers.get(id);
        if (!remote) continue;
      }

      // Set interpolation targets
      remote.targetPosition = { ...state.position };
      remote.targetRotation = state.rotation;
      remote.state = { ...state, id };
      remote.lastUpdate = now;
    }
  });

  socket.on('playerShoot', (data: { id: string; origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }) => {
    // Store shoot event for rendering by the game loop
    const remote = remotePlayers.get(data.id);
    if (remote) {
      remote.state.isShooting = true;
      // Store bullet data for spawning
      if (!(remote as RemotePlayer & { pendingBullets?: Array<{ origin: typeof data.origin; direction: typeof data.direction }> }).pendingBullets) {
        (remote as RemotePlayer & { pendingBullets?: Array<{ origin: typeof data.origin; direction: typeof data.direction }> }).pendingBullets = [];
      }
      (remote as RemotePlayer & { pendingBullets?: Array<{ origin: typeof data.origin; direction: typeof data.direction }> }).pendingBullets!.push({
        origin: data.origin,
        direction: data.direction,
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Multiplayer] Disconnected: ${reason}`);
    connected = false;
    notifyPlayerCount();
  });

  socket.on('connect_error', (err) => {
    console.log(`[Multiplayer] Connection error: ${err.message}`);
    connected = false;
  });
}

// ===== Remote Player Management =====

function addRemotePlayer(state: RemotePlayerState): void {
  if (remotePlayers.has(state.id)) return;

  const remote: RemotePlayer = {
    id: state.id,
    name: state.name,
    role: state.role,
    color: state.color,
    state,
    mesh: null,
    nameSprite: null,
    lastUpdate: Date.now(),
    targetPosition: { ...state.position },
    targetRotation: state.rotation,
  };

  remotePlayers.set(state.id, remote);
}

function removeRemotePlayer(id: string): void {
  const remote = remotePlayers.get(id);
  if (remote && remote.mesh) {
    // Dispose mesh
    remote.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
    remote.mesh.parent?.remove(remote.mesh);
  }
  remotePlayers.delete(id);
}

function notifyPlayerCount(): void {
  // count includes local player
  const count = connected ? remotePlayers.size + 1 : 0;
  onPlayerCountChange?.(count);
}

// ===== Sending State =====

export function sendPlayerState(state: {
  position: { x: number; y: number; z: number };
  rotation: number;
  isFlying: boolean;
  isShooting: boolean;
  isInVehicle: boolean;
  vehicleType: string | null;
  health: number;
  money: number;
  wantedLevel: number;
}): void {
  if (!socket?.connected) return;
  socket.emit('update', state);
}

export function sendShoot(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }): void {
  if (!socket?.connected) return;
  socket.emit('shoot', { origin, direction });
}

export function sendStab(targetId: string): void {
  if (!socket?.connected) return;
  socket.emit('stab', { targetId });
}

// ===== Update & Render Other Players =====

export function updateOtherPlayerMeshes(scene: THREE.Scene, delta: number): {
  remoteBullets: Array<{ origin: THREE.Vector3; direction: THREE.Vector3 }>;
} {
  const remoteBullets: Array<{ origin: THREE.Vector3; direction: THREE.Vector3 }> = [];
  const now = Date.now();
  const lerpFactor = Math.min(1, delta * 10); // Smooth interpolation

  for (const [id, remote] of remotePlayers) {
    // Remove stale players (no update for 10s)
    if (now - remote.lastUpdate > 10000) {
      removeRemotePlayer(id);
      continue;
    }

    // Create mesh if needed
    if (!remote.mesh) {
      const { group, nameSprite } = createRemotePlayerMesh(remote.name, remote.role, remote.color);
      group.position.set(remote.targetPosition.x, remote.targetPosition.y, remote.targetPosition.z);
      group.rotation.y = remote.targetRotation;
      scene.add(group);
      remote.mesh = group;
      remote.nameSprite = nameSprite;
    }

    // Interpolate position
    remote.mesh.position.x += (remote.targetPosition.x - remote.mesh.position.x) * lerpFactor;
    remote.mesh.position.y += (remote.targetPosition.y - remote.mesh.position.y) * lerpFactor;
    remote.mesh.position.z += (remote.targetPosition.z - remote.mesh.position.z) * lerpFactor;

    // Interpolate rotation
    let rotDiff = remote.targetRotation - remote.mesh.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    remote.mesh.rotation.y += rotDiff * lerpFactor;

    // Wings visibility
    remote.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isWing) {
        child.visible = remote.state.isFlying;
        if (remote.state.isFlying) {
          const wingFlap = Math.sin(Date.now() * 0.008) * 0.3;
          if (child.userData.side === 'left') {
            child.rotation.z = 0.3 + wingFlap;
          } else {
            child.rotation.z = -0.3 - wingFlap;
          }
        }
      }
    });

    // Walk animation based on movement
    const isMoving =
      Math.abs(remote.targetPosition.x - remote.mesh.position.x) > 0.05 ||
      Math.abs(remote.targetPosition.z - remote.mesh.position.z) > 0.05;

    const children = remote.mesh.children;
    // Arms are indices 5,6 and Legs are 7,8 in our mesh setup
    // We use userData or just the arm/leg reference
    if (isMoving && !remote.state.isFlying) {
      const swing = Math.sin(Date.now() * 0.008) * 0.6;
      if (children[5] instanceof THREE.Mesh) children[5].rotation.x = swing;
      if (children[6] instanceof THREE.Mesh) children[6].rotation.x = -swing;
      if (children[7] instanceof THREE.Mesh) children[7].rotation.x = -swing;
      if (children[8] instanceof THREE.Mesh) children[8].rotation.x = swing;
    }

    // Collect pending bullets from remote players
    const remoteCast = remote as RemotePlayer & { pendingBullets?: Array<{ origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }> };
    if (remoteCast.pendingBullets && remoteCast.pendingBullets.length > 0) {
      for (const b of remoteCast.pendingBullets) {
        remoteBullets.push({
          origin: new THREE.Vector3(b.origin.x, b.origin.y, b.origin.z),
          direction: new THREE.Vector3(b.direction.x, b.direction.y, b.direction.z),
        });
      }
      remoteCast.pendingBullets = [];
    }
  }

  return { remoteBullets };
}

// ===== Getters =====

export function getMultiplayerState(): MultiplayerState {
  return {
    connected,
    playerId: localPlayerId,
    players: remotePlayers,
    playerCount: connected ? remotePlayers.size + 1 : 0,
    roomCapacity: 20,
  };
}

export function getOtherPlayers(): RemotePlayer[] {
  return Array.from(remotePlayers.values());
}

export function isConnected(): boolean {
  return connected;
}

// ===== Disconnect =====

export function disconnectFromServer(): void {
  if (sendInterval) {
    clearInterval(sendInterval);
    sendInterval = null;
  }

  // Clean up all remote player meshes
  for (const [id] of remotePlayers) {
    removeRemotePlayer(id);
  }
  remotePlayers.clear();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  connected = false;
  localPlayerId = null;
  onPlayerCountChange = null;
  console.log('[Multiplayer] Disconnected and cleaned up');
}
