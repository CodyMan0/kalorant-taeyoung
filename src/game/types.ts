import * as THREE from 'three';

export type Role = 'prisoner' | 'police';

export interface PlayerState {
  name: string;
  role: Role;
  health: number;
  maxHealth: number;
  money: number;
  sprintEnergy: number;
  maxSprintEnergy: number;
  wantedLevel: number;
  isInJail: boolean;
  hasEscaped: boolean;
  isInVehicle: boolean;
  currentVehicleId: string | null;
  isSprinting: boolean;
  isJumping: boolean;
  canDoubleJump: boolean;
  jumpCount: number;
  lastJumpPressed: boolean;
  isFlying: boolean;
  lastSpaceTap: number;
  isShooting: boolean;
  shootCooldown: number;
  stabCooldown: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  mesh: THREE.Group;
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  isOccupied: boolean;
  color: number;
  steerAngle: number;
}

export type VehicleType = 'police_car' | 'sports_car' | 'truck' | 'motorcycle';

export interface NPC {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  state: 'patrol' | 'chase' | 'idle';
  patrolTarget: THREE.Vector3;
  speechBubble: THREE.Sprite | null;
  speechTimer: number;
  health: number;
  isDead: boolean;
  respawnTimer: number;
  hitTimer: number;
  deathAnim: number;
}

export interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  type: 'solid' | 'breakable' | 'trigger';
  tag?: string;
}

export interface RobberyLocation {
  id: string;
  name: string;
  position: THREE.Vector3;
  reward: number;
  isBeingRobbed: boolean;
  robberyProgress: number;
  cooldownTimer: number;
  cooldownDuration: number;
  robberyDuration: number;
  mesh: THREE.Group;
  triggerZone: Collider;
}

export interface GameState {
  isStarted: boolean;
  isPaused: boolean;
  player: PlayerState;
  vehicles: Vehicle[];
  npcs: NPC[];
  robberyLocations: RobberyLocation[];
  colliders: Collider[];
  timeOfDay: number;
  daySpeed: number;
}

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  interact: boolean;
  shoot: boolean;
  stab: boolean;
}

export interface MobileControls {
  joystickX: number;
  joystickY: number;
  jumpPressed: boolean;
  sprintPressed: boolean;
  interactPressed: boolean;
  cameraRotX: number;
  cameraRotY: number;
}

export interface GameConfig {
  playerName: string;
  role: Role;
}

// ===== Multiplayer Types =====

export interface RemotePlayerState {
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
}

export interface RemotePlayer {
  id: string;
  name: string;
  role: Role;
  color: number;
  state: RemotePlayerState;
  mesh: THREE.Group | null;
  nameSprite: THREE.Sprite | null;
  lastUpdate: number;
  // Interpolation targets
  targetPosition: { x: number; y: number; z: number };
  targetRotation: number;
}

export interface MultiplayerState {
  connected: boolean;
  playerId: string | null;
  players: Map<string, RemotePlayer>;
  playerCount: number;
  roomCapacity: number;
}

export interface ServerToClientEvents {
  welcome: (data: { id: string; players: RemotePlayerState[] }) => void;
  playerJoined: (data: { id: string; name: string; role: Role; color: number }) => void;
  playerLeft: (data: { id: string }) => void;
  playersUpdate: (data: { players: Record<string, RemotePlayerState> }) => void;
  playerShoot: (data: { id: string; origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }) => void;
  playerStab: (data: { id: string; targetId: string }) => void;
  chat: (data: { id: string; name: string; message: string }) => void;
}

export interface ClientToServerEvents {
  join: (data: { name: string; role: Role; color: number }) => void;
  update: (data: {
    position: { x: number; y: number; z: number };
    rotation: number;
    isFlying: boolean;
    isShooting: boolean;
    isInVehicle: boolean;
    vehicleType: string | null;
    health: number;
    money: number;
    wantedLevel: number;
  }) => void;
  shoot: (data: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }) => void;
  stab: (data: { targetId: string }) => void;
  chat: (data: { message: string }) => void;
}
