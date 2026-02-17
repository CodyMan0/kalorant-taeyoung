import * as THREE from 'three';
import { PlayerState, Role, Collider, KeyState, MobileControls } from './types';
import { playFootstep, playJump, playLand } from './audio';

export interface PlayerController {
  mesh: THREE.Group;
  state: PlayerState;
  camera: THREE.PerspectiveCamera;
  cameraDistance: number;
  cameraAngleX: number;
  cameraAngleY: number;
  footstepTimer: number;
  animTimer: number;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
}

export function createPlayer(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  name: string,
  role: Role
): PlayerController {
  const group = new THREE.Group();

  const bodyColor = role === 'prisoner' ? 0xff6600 : 0x2244aa;
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

  // Wings (hidden by default, shown when flying)
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), wingMat);
  leftWing.position.set(-1.8, 2.0, -0.2);
  leftWing.rotation.z = 0.3;
  leftWing.visible = false;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), wingMat);
  rightWing.position.set(1.8, 2.0, -0.2);
  rightWing.rotation.z = -0.3;
  rightWing.visible = false;
  group.add(rightWing);

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

  const startPos = role === 'prisoner'
    ? new THREE.Vector3(-80, 0, -80)
    : new THREE.Vector3(60, 0, 60);

  group.position.copy(startPos);
  scene.add(group);

  const state: PlayerState = {
    name,
    role,
    health: 100,
    maxHealth: 100,
    money: role === 'police' ? 1000 : 0,
    sprintEnergy: 100,
    maxSprintEnergy: 100,
    wantedLevel: 0,
    isInJail: role === 'prisoner',
    hasEscaped: role === 'police',
    isInVehicle: false,
    currentVehicleId: null,
    isSprinting: false,
    isJumping: false,
    canDoubleJump: true,
    jumpCount: 0,
    lastJumpPressed: false,
    isFlying: false,
    lastSpaceTap: 0,
    isShooting: false,
    shootCooldown: 0,
    stabCooldown: 0,
    position: startPos.clone(),
    velocity: new THREE.Vector3(),
    rotation: 0,
  };

  return {
    mesh: group,
    state,
    camera,
    cameraDistance: 8,
    cameraAngleX: 0,
    cameraAngleY: 0.3,
    footstepTimer: 0,
    animTimer: 0,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftWing,
    rightWing,
  };
}

const GRAVITY = -25;
const JUMP_FORCE = 10;
const MOVE_SPEED = 14;
const SPRINT_MULTIPLIER = 2.2;
const SPRINT_DRAIN = 20;
const SPRINT_REGEN = 15;
const PLAYER_RADIUS = 0.6;
const PLAYER_HEIGHT = 3.8;

function checkCollision(pos: THREE.Vector3, colliders: Collider[], excludeTags?: string[]): { collided: boolean; pushOut: THREE.Vector3 } {
  const pushOut = new THREE.Vector3();
  let collided = false;

  const playerMin = new THREE.Vector3(pos.x - PLAYER_RADIUS, pos.y, pos.z - PLAYER_RADIUS);
  const playerMax = new THREE.Vector3(pos.x + PLAYER_RADIUS, pos.y + PLAYER_HEIGHT, pos.z + PLAYER_RADIUS);

  for (const c of colliders) {
    if (c.type === 'trigger') continue;
    if (excludeTags && c.tag && excludeTags.includes(c.tag)) continue;

    if (
      playerMin.x < c.max.x && playerMax.x > c.min.x &&
      playerMin.y < c.max.y && playerMax.y > c.min.y &&
      playerMin.z < c.max.z && playerMax.z > c.min.z
    ) {
      collided = true;

      // Find smallest overlap axis
      const overlapX1 = c.max.x - playerMin.x;
      const overlapX2 = playerMax.x - c.min.x;
      const overlapZ1 = c.max.z - playerMin.z;
      const overlapZ2 = playerMax.z - c.min.z;

      const minOverlapX = overlapX1 < overlapX2 ? overlapX1 : -overlapX2;
      const minOverlapZ = overlapZ1 < overlapZ2 ? overlapZ1 : -overlapZ2;

      if (Math.abs(minOverlapX) < Math.abs(minOverlapZ)) {
        pushOut.x += minOverlapX;
      } else {
        pushOut.z += minOverlapZ;
      }
    }
  }

  return { collided, pushOut };
}

export function updatePlayer(
  player: PlayerController,
  keys: KeyState,
  mobile: MobileControls,
  colliders: Collider[],
  delta: number,
  isInVehicle: boolean
): void {
  if (isInVehicle) {
    player.mesh.visible = false;
    return;
  }
  player.mesh.visible = true;

  const state = player.state;

  // Movement direction from keys and mobile
  let inputX = 0;
  let inputZ = 0;

  if (keys.forward || mobile.joystickY < -0.2) inputZ = -1;
  if (keys.backward || mobile.joystickY > 0.2) inputZ = 1;
  if (keys.left || mobile.joystickX < -0.2) inputX = -1;
  if (keys.right || mobile.joystickX > 0.2) inputX = 1;

  // Use mobile joystick magnitude for analog control
  if (Math.abs(mobile.joystickX) > 0.2 || Math.abs(mobile.joystickY) > 0.2) {
    inputX = mobile.joystickX;
    inputZ = mobile.joystickY;
  }

  // Sprint
  const wantsSprint = keys.sprint || mobile.sprintPressed;
  if (wantsSprint && state.sprintEnergy > 0 && (inputX !== 0 || inputZ !== 0)) {
    state.isSprinting = true;
    state.sprintEnergy = Math.max(0, state.sprintEnergy - SPRINT_DRAIN * delta);
  } else {
    state.isSprinting = false;
    state.sprintEnergy = Math.min(state.maxSprintEnergy, state.sprintEnergy + SPRINT_REGEN * delta);
  }

  const speed = MOVE_SPEED * (state.isSprinting ? SPRINT_MULTIPLIER : 1);

  // Move relative to camera direction
  const cameraDir = new THREE.Vector3();
  cameraDir.x = Math.sin(player.cameraAngleX);
  cameraDir.z = Math.cos(player.cameraAngleX);

  const right = new THREE.Vector3(-cameraDir.z, 0, cameraDir.x);

  const moveDir = new THREE.Vector3();
  moveDir.addScaledVector(cameraDir, inputZ);
  moveDir.addScaledVector(right, -inputX);

  if (moveDir.length() > 0) {
    moveDir.normalize();
    state.velocity.x = moveDir.x * speed;
    state.velocity.z = moveDir.z * speed;

    // Face movement direction
    const targetRot = Math.atan2(moveDir.x, moveDir.z);
    let diff = targetRot - state.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.rotation += diff * Math.min(1, delta * 10);
  } else {
    state.velocity.x *= 0.85;
    state.velocity.z *= 0.85;
  }

  // Jump
  const wantsJump = keys.jump || mobile.jumpPressed;
  const onGround = state.position.y <= 0.01 || (state.position.y > 0 && state.velocity.y <= 0 && state.position.y < 0.5);

  // Double-tap space to toggle flying
  if (wantsJump && !state.lastJumpPressed) {
    const now = Date.now();
    if (now - state.lastSpaceTap < 300) {
      state.isFlying = !state.isFlying;
      state.velocity.y = 0;
      state.lastSpaceTap = 0;
    } else {
      state.lastSpaceTap = now;

      if (!state.isFlying) {
        if (onGround) {
          state.velocity.y = JUMP_FORCE;
          state.isJumping = true;
          state.jumpCount = 1;
          playJump();
        } else if (state.isJumping && state.jumpCount < 100) {
          state.velocity.y = JUMP_FORCE * Math.max(0.3, 1 - state.jumpCount * 0.007);
          state.jumpCount++;
          playJump();
        }
      }
    }
  }
  state.lastJumpPressed = wantsJump;

  // Flying mode
  if (state.isFlying) {
    state.velocity.y = 0;
    state.isJumping = false;
    const flySpeed = state.isSprinting ? 20 : 12;
    if (wantsJump) state.velocity.y = flySpeed;
    if (keys.sprint && !keys.forward && !keys.backward && !keys.left && !keys.right) {
      state.velocity.y = -flySpeed;
    }
  }

  // Gravity (disabled when flying)
  if (!state.isFlying) {
    state.velocity.y += GRAVITY * delta;
  }

  // Apply velocity
  const newPos = state.position.clone();
  newPos.x += state.velocity.x * delta;
  newPos.z += state.velocity.z * delta;
  newPos.y += state.velocity.y * delta;

  // Ground collision
  if (newPos.y < 0 && !state.isFlying) {
    newPos.y = 0;
    state.velocity.y = 0;
    if (state.isJumping) {
      state.isJumping = false;
      state.jumpCount = 0;
      playLand();
    }
    if (state.isFlying) state.isFlying = false;
  }

  // World collision (skip when flying - pass through walls)
  if (!state.isFlying) {
    const excludeTags: string[] = [];
    if (state.hasEscaped || state.role === 'police') {
      excludeTags.push('prison_wall');
    }

    const { collided, pushOut } = checkCollision(newPos, colliders, excludeTags);
    if (collided) {
      newPos.x += pushOut.x;
      newPos.z += pushOut.z;
    }
  }

  // World bounds
  newPos.x = Math.max(-280, Math.min(280, newPos.x));
  newPos.z = Math.max(-280, Math.min(280, newPos.z));

  state.position.copy(newPos);
  player.mesh.position.copy(state.position);
  player.mesh.rotation.y = state.rotation;

  // Wings visibility & animation
  player.leftWing.visible = state.isFlying;
  player.rightWing.visible = state.isFlying;
  if (state.isFlying) {
    const wingFlap = Math.sin(Date.now() * 0.008) * 0.3;
    player.leftWing.rotation.z = 0.3 + wingFlap;
    player.rightWing.rotation.z = -0.3 - wingFlap;
  }

  // Character tilt - lean forward when moving, more when sprinting
  const isMoving = Math.abs(state.velocity.x) > 0.5 || Math.abs(state.velocity.z) > 0.5;
  const targetTilt = state.isFlying ? 0 : isMoving ? (state.isSprinting ? -0.25 : -0.12) : 0;
  player.mesh.rotation.x += (targetTilt - player.mesh.rotation.x) * 0.1;

  // Walk/run animation
  if (isMoving && !state.isJumping && !state.isFlying) {
    const animSpeed = state.isSprinting ? 12 : 8;
    player.animTimer += delta * animSpeed;
    const swing = Math.sin(player.animTimer) * 0.6;

    player.leftArm.rotation.x = swing;
    player.rightArm.rotation.x = -swing;
    player.leftLeg.rotation.x = -swing;
    player.rightLeg.rotation.x = swing;

    // Footstep sounds
    player.footstepTimer += delta;
    const footstepInterval = state.isSprinting ? 0.25 : 0.4;
    if (player.footstepTimer > footstepInterval) {
      player.footstepTimer = 0;
      playFootstep();
    }
  } else {
    player.animTimer = 0;
    player.leftArm.rotation.x *= 0.9;
    player.rightArm.rotation.x *= 0.9;
    player.leftLeg.rotation.x *= 0.9;
    player.rightLeg.rotation.x *= 0.9;
  }

  // Jump pose
  if (state.isJumping && !state.isFlying) {
    player.leftArm.rotation.x = -0.8;
    player.rightArm.rotation.x = -0.8;
    player.leftLeg.rotation.x = 0.3;
    player.rightLeg.rotation.x = -0.3;
  }

  // Flying pose - arms spread, legs together
  if (state.isFlying) {
    player.leftArm.rotation.x = -0.2;
    player.leftArm.rotation.z = -1.2;
    player.rightArm.rotation.x = -0.2;
    player.rightArm.rotation.z = 1.2;
    player.leftLeg.rotation.x = 0.1;
    player.rightLeg.rotation.x = 0.1;
  } else {
    player.leftArm.rotation.z = 0;
    player.rightArm.rotation.z = 0;
  }
}

export function updateCamera(player: PlayerController): void {
  const target = player.state.position.clone();
  target.y += 2.5;

  const camX = target.x + Math.sin(player.cameraAngleX) * Math.cos(player.cameraAngleY) * player.cameraDistance;
  const camY = target.y + Math.sin(player.cameraAngleY) * player.cameraDistance;
  const camZ = target.z + Math.cos(player.cameraAngleX) * Math.cos(player.cameraAngleY) * player.cameraDistance;

  player.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
  player.camera.lookAt(target);
}

export function handleMouseMove(player: PlayerController, dx: number, dy: number): void {
  player.cameraAngleX -= dx * 0.003;
  player.cameraAngleY = Math.max(-0.2, Math.min(1.2, player.cameraAngleY + dy * 0.003));
}

export function handleScroll(player: PlayerController, deltaY: number): void {
  player.cameraDistance = Math.max(3, Math.min(20, player.cameraDistance + deltaY * 0.01));
}

export function isNearPosition(player: PlayerController, pos: THREE.Vector3, range: number): boolean {
  const dx = player.state.position.x - pos.x;
  const dz = player.state.position.z - pos.z;
  return Math.sqrt(dx * dx + dz * dz) < range;
}

export function isInTrigger(player: PlayerController, trigger: Collider): boolean {
  const p = player.state.position;
  return (
    p.x > trigger.min.x && p.x < trigger.max.x &&
    p.z > trigger.min.z && p.z < trigger.max.z
  );
}

export function respawnInJail(player: PlayerController): void {
  player.state.position.set(-80, 0, -80);
  player.state.velocity.set(0, 0, 0);
  player.state.isInJail = true;
  player.state.hasEscaped = false;
  player.state.wantedLevel = 0;
  player.state.health = player.state.maxHealth;
  player.state.isFlying = false;
  player.state.isJumping = false;
  player.state.jumpCount = 0;
  player.state.lastJumpPressed = false;
  player.state.lastSpaceTap = 0;
  player.state.isSprinting = false;
  player.state.sprintEnergy = player.state.maxSprintEnergy;
  player.state.isInVehicle = false;
  player.state.currentVehicleId = null;
  player.state.rotation = 0;
  player.mesh.position.copy(player.state.position);
  player.mesh.rotation.set(0, 0, 0);
  player.leftWing.visible = false;
  player.rightWing.visible = false;
}
