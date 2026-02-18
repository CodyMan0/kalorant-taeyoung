import * as THREE from 'three';
import { NPC } from './types';
import { playSiren } from './audio';

const PATROL_SPEED = 4;
const CHASE_SPEED = 12;
const CATCH_DISTANCE = 3.5;
const CHASE_RANGE = 25;
const SPEECH_DURATION = 2;

const SPEECHES = [
  '거기 서!! 🚨',
  '도망치지 마!!! 😡',
  '움직이면 쏜다!!! 🔫',
  '체포한다!!!',
  '멈춰!!!! 🛑',
  '경찰이다!!!',
  '꼼짝마!!!',
  '너 끝났어!!!',
  '도망칠 수 없다!!!',
];

function createNPCMesh(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const blue = 0x1a3a6a;
  const skin = 0xffcc99;

  // Head
  const headGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  const headMat = new THREE.MeshStandardMaterial({ color: skin });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 3.0;
  head.castShadow = true;
  group.add(head);

  // Hat
  const hatGeo = new THREE.BoxGeometry(1.2, 0.3, 1.2);
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x112244 });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 3.65;
  group.add(hat);

  // Body
  const bodyGeo = new THREE.BoxGeometry(1.2, 1.6, 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({ color: blue });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.6;
  body.castShadow = true;
  group.add(body);

  // Badge
  const badgeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);
  const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(-0.3, 2.0, 0.38);
  group.add(badge);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.4, 1.3, 0.4);
  const armMat = new THREE.MeshStandardMaterial({ color: blue });
  const la = new THREE.Mesh(armGeo, armMat);
  la.position.set(-0.8, 1.7, 0);
  la.castShadow = true;
  group.add(la);
  const ra = new THREE.Mesh(armGeo, armMat);
  ra.position.set(0.8, 1.7, 0);
  ra.castShadow = true;
  group.add(ra);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x111133 });
  const ll = new THREE.Mesh(legGeo, legMat);
  ll.position.set(-0.3, 0.5, 0);
  ll.castShadow = true;
  group.add(ll);
  const rl = new THREE.Mesh(legGeo, legMat);
  rl.position.set(0.3, 0.5, 0);
  rl.castShadow = true;
  group.add(rl);

  return group;
}

function createSpeechBubble(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  // Bubble background
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 72, 12);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tail
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(120, 76);
  ctx.lineTo(128, 92);
  ctx.lineTo(136, 76);
  ctx.fill();

  // Text
  ctx.fillStyle = '#cc0000';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 40);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1.5, 1);
  sprite.position.y = 4.5;
  return sprite;
}

export function createNPCs(scene: THREE.Scene): NPC[] {
  const positions: [number, number][] = [
    [40, 40], [70, 50], [50, 70], [-20, 10], [10, -20],
    [0, 50], [60, 0], [-40, 40],
    // New outer NPCs
    [150, 80], [-150, 100], [180, -80], [-120, -120],
    [100, 150], [-100, -150], [200, 0], [-200, 0],
  ];

  return positions.map(([x, z], i) => {
    const mesh = createNPCMesh(scene);
    mesh.position.set(x, 0, z);
    scene.add(mesh);

    const patrolTarget = new THREE.Vector3(
      x + (Math.random() - 0.5) * 30,
      0,
      z + (Math.random() - 0.5) * 30
    );

    return {
      id: `npc_${i}`,
      mesh,
      position: new THREE.Vector3(x, 0, z),
      rotation: Math.random() * Math.PI * 2,
      speed: PATROL_SPEED,
      state: 'patrol' as const,
      patrolTarget,
      speechBubble: null,
      speechTimer: 0,
      health: 100,
      isDead: false,
      respawnTimer: 0,
      hitTimer: 0,
      deathAnim: 0,
    };
  });
}

let sirenCooldown = 0;

export function updateNPCs(
  npcs: NPC[],
  playerPos: THREE.Vector3,
  wantedLevel: number,
  delta: number,
  scene: THREE.Scene,
  playerFlying: boolean = false
): { caught: boolean } {
  let caught = false;
  sirenCooldown -= delta;

  for (const npc of npcs) {
    // Dead NPC - play death animation then hide
    if (npc.isDead) {
      if (npc.deathAnim > 0) {
        npc.deathAnim -= delta;
        // Fall over animation
        const fallProgress = 1 - npc.deathAnim;
        npc.mesh.rotation.x = fallProgress * (Math.PI / 2); // tilt forward
        npc.mesh.position.y = npc.position.y - fallProgress * 0.8; // sink down
        // Fade red
        npc.mesh.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = npc.deathAnim;
          }
        });
        if (npc.deathAnim <= 0) {
          npc.mesh.visible = false;
        }
        continue;
      }

      npc.respawnTimer -= delta;
      if (npc.respawnTimer <= 0) {
        npc.isDead = false;
        npc.health = 100;
        npc.mesh.visible = true;
        npc.mesh.rotation.x = 0;
        // Reset materials
        npc.mesh.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        });
        // Respawn at random position away from player
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        npc.position.set(
          playerPos.x + Math.cos(angle) * dist,
          0,
          playerPos.z + Math.sin(angle) * dist
        );
        npc.position.x = Math.max(-280, Math.min(280, npc.position.x));
        npc.position.z = Math.max(-280, Math.min(280, npc.position.z));
        npc.mesh.position.copy(npc.position);
      }
      continue;
    }

    const dx = playerPos.x - npc.position.x;
    const dz = playerPos.z - npc.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    // State transitions - chase when player is in sight range
    const chaseRange = CHASE_RANGE + wantedLevel * 15;
    const loseRange = chaseRange + 30; // Don't stop chasing immediately
    if (npc.state === 'chase') {
      // Already chasing - only stop if player gets far enough away
      if (distToPlayer > loseRange) {
        npc.state = 'patrol';
        npc.speed = PATROL_SPEED;
      } else {
        npc.speed = CHASE_SPEED + wantedLevel * 1;
        if (distToPlayer < 10) {
          npc.speed *= 1.15;
        }
      }
    } else {
      // Not chasing - start chase only when close enough (line of sight)
      if (distToPlayer < chaseRange) {
        npc.state = 'chase';
        showSpeech(npc, scene);
        npc.speed = CHASE_SPEED + wantedLevel * 1;
      } else {
        npc.state = 'patrol';
        npc.speed = PATROL_SPEED;
      }
    }

    // Speech timer
    if (npc.speechTimer > 0) {
      npc.speechTimer -= delta;
      if (npc.speechTimer <= 0 && npc.speechBubble) {
        npc.mesh.remove(npc.speechBubble);
        npc.speechBubble = null;
      }
    }

    let targetX: number, targetZ: number;

    if (npc.state === 'chase') {
      // Predictive targeting - aim ahead of player's movement
      const predictFactor = Math.min(distToPlayer * 0.08, 3);
      targetX = playerPos.x + dx * predictFactor * 0.3;
      targetZ = playerPos.z + dz * predictFactor * 0.3;

      // Siren sound - more frequent when close
      const sirenInterval = distToPlayer < 15 ? 0.5 : 1;
      if (sirenCooldown <= 0 && distToPlayer < 50) {
        playSiren();
        sirenCooldown = sirenInterval;
      }

      // Frequent aggressive speech
      if (Math.random() < 0.02 && !npc.speechBubble) {
        showSpeech(npc, scene);
      }

      // Check catch - also check Y distance
      const dyPlayer = Math.abs(playerPos.y - npc.position.y);
      if (distToPlayer < CATCH_DISTANCE && dyPlayer < 3) {
        caught = true;
      }
    } else {
      // Patrol toward target
      targetX = npc.patrolTarget.x;
      targetZ = npc.patrolTarget.z;

      const dxP = targetX - npc.position.x;
      const dzP = targetZ - npc.position.z;
      const distToTarget = Math.sqrt(dxP * dxP + dzP * dzP);

      if (distToTarget < 2) {
        // New patrol target
        npc.patrolTarget.set(
          npc.position.x + (Math.random() - 0.5) * 40,
          0,
          npc.position.z + (Math.random() - 0.5) * 40
        );
        // Clamp to world
        npc.patrolTarget.x = Math.max(-270, Math.min(270, npc.patrolTarget.x));
        npc.patrolTarget.z = Math.max(-270, Math.min(270, npc.patrolTarget.z));
      }
    }

    // Move toward target
    const toTargetX = targetX - npc.position.x;
    const toTargetZ = targetZ - npc.position.z;
    const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);

    if (toTargetLen > 0.5) {
      const moveX = (toTargetX / toTargetLen) * npc.speed * delta;
      const moveZ = (toTargetZ / toTargetLen) * npc.speed * delta;

      npc.position.x += moveX;
      npc.position.z += moveZ;
      npc.rotation = Math.atan2(toTargetX, toTargetZ);
    }

    // NPC flying - chase player in the air when player is flying (slowly)
    if (playerFlying && npc.state === 'chase') {
      const targetY = playerPos.y;
      const dy = targetY - npc.position.y;
      npc.position.y += dy * 0.5 * delta;
    } else {
      // Return to ground
      npc.position.y += (0 - npc.position.y) * 3 * delta;
    }

    // World bounds
    npc.position.x = Math.max(-290, Math.min(290, npc.position.x));
    npc.position.z = Math.max(-290, Math.min(290, npc.position.z));

    npc.mesh.position.copy(npc.position);
    npc.mesh.rotation.y = npc.rotation;

    // Hit stagger animation
    if (npc.hitTimer > 0) {
      npc.hitTimer -= delta;
      // Wobble when hit
      npc.mesh.rotation.z = Math.sin(npc.hitTimer * 30) * 0.3;
      npc.mesh.position.y = npc.position.y + Math.abs(Math.sin(npc.hitTimer * 20)) * 0.2;
      if (npc.hitTimer <= 0) {
        npc.mesh.rotation.z = 0;
        // Reset red flash
        npc.mesh.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        });
      }
    }

    // Walk animation - faster when chasing
    const animSpeed = npc.state === 'chase' ? 0.02 : 0.008;
    const animSwing = npc.state === 'chase' ? 0.9 : 0.4;
    const walkAnim = Math.sin(Date.now() * animSpeed + parseInt(npc.id.split('_')[1]) * 100) * animSwing;
    const children = npc.mesh.children;
    // Arms are at index 4 and 5, legs at 6 and 7
    if (children[4]) children[4].rotation.x = walkAnim;
    if (children[5]) children[5].rotation.x = -walkAnim;
    if (children[6]) children[6].rotation.x = -walkAnim * 0.8;
    if (children[7]) children[7].rotation.x = walkAnim * 0.8;
  }

  return { caught };
}

export function damageNPC(npc: NPC, damage: number): boolean {
  if (npc.isDead) return false;
  npc.health -= damage;
  npc.hitTimer = 0.3; // stagger for 0.3 seconds

  // Hit flash - turn red briefly
  npc.mesh.children.forEach((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material.emissive = new THREE.Color(0xff0000);
      child.material.emissiveIntensity = 0.8;
    }
  });

  if (npc.health <= 0) {
    npc.isDead = true;
    npc.deathAnim = 1.0; // 1 second death animation
    npc.respawnTimer = 8;
    if (npc.speechBubble) {
      npc.mesh.remove(npc.speechBubble);
      npc.speechBubble = null;
    }
    return true; // killed
  }
  return false;
}

function showSpeech(npc: NPC, scene: THREE.Scene): void {
  if (npc.speechBubble) {
    npc.mesh.remove(npc.speechBubble);
  }
  const text = SPEECHES[Math.floor(Math.random() * SPEECHES.length)];
  npc.speechBubble = createSpeechBubble(text);
  npc.mesh.add(npc.speechBubble);
  npc.speechTimer = SPEECH_DURATION;
  void scene; // scene available for future use
}
