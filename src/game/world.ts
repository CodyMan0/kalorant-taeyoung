import * as THREE from 'three';
import { Collider, RobberyLocation } from './types';

interface WorldResult {
  colliders: Collider[];
  robberyLocations: RobberyLocation[];
  prisonEscapeCollider: Collider;
  streetLights: THREE.PointLight[];
  trafficCars: TrafficCar[];
  spacePortal: SpacePortal;
}

export interface TrafficCar {
  mesh: THREE.Group;
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  routeIndex: number;
  route: THREE.Vector3[];
  currentTarget: number;
}

function box(
  scene: THREE.Scene,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function addCollider(colliders: Collider[], x: number, y: number, z: number, w: number, h: number, d: number, type: Collider['type'] = 'solid', tag?: string): Collider {
  const c: Collider = {
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    type,
    tag,
  };
  colliders.push(c);
  return c;
}

function createGround(scene: THREE.Scene): void {
  // Main ground
  const groundGeo = new THREE.PlaneGeometry(1200, 1200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createRoad(scene: THREE.Scene, x1: number, z1: number, x2: number, z2: number, width = 10): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const roadGeo = new THREE.PlaneGeometry(width, length);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = angle;
  road.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
  road.receiveShadow = true;
  scene.add(road);

  // Lane markings
  const stripeCount = Math.floor(length / 8);
  for (let i = 0; i < stripeCount; i++) {
    const t = (i + 0.5) / stripeCount;
    const sx = x1 + dx * t;
    const sz = z1 + dz * t;
    const stripeGeo = new THREE.PlaneGeometry(0.3, 3);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = angle;
    stripe.position.set(sx, 0.03, sz);
    scene.add(stripe);
  }
}

function createPrison(scene: THREE.Scene, colliders: Collider[]): Collider {
  const px = -80, pz = -80;

  // Prison floor
  box(scene, 40, 0.2, 40, px, 0.1, pz, 0x808080, false, true);

  // Walls
  // Front wall (with gate)
  box(scene, 15, 6, 1, px - 12.5, 3, pz - 20, 0x666666);
  addCollider(colliders, px - 12.5, 3, pz - 20, 15, 6, 1);
  box(scene, 15, 6, 1, px + 12.5, 3, pz - 20, 0x666666);
  addCollider(colliders, px + 12.5, 3, pz - 20, 15, 6, 1);
  // Gate bars
  for (let i = -3; i <= 3; i++) {
    box(scene, 0.2, 6, 0.2, px + i * 1.2, 3, pz - 20, 0x444444);
  }
  // Gate top
  box(scene, 10, 1, 1, px, 5.5, pz - 20, 0x666666);
  addCollider(colliders, px, 3, pz - 20, 10, 6, 1);

  // Back wall
  box(scene, 40, 6, 1, px, 3, pz + 20, 0x666666);
  addCollider(colliders, px, 3, pz + 20, 40, 6, 1);

  // Left wall
  box(scene, 1, 6, 40, px - 20, 3, pz, 0x666666);
  addCollider(colliders, px - 20, 3, pz, 1, 6, 40);

  // Right wall - BREAKABLE SECTION in the middle
  box(scene, 1, 6, 14, px + 20, 3, pz - 13, 0x666666);
  addCollider(colliders, px + 20, 3, pz - 13, 1, 6, 14);
  box(scene, 1, 6, 14, px + 20, 3, pz + 13, 0x666666);
  addCollider(colliders, px + 20, 3, pz + 13, 1, 6, 14);

  // Breakable wall section (lighter color to hint)
  const breakableWall = box(scene, 1, 6, 12, px + 20, 3, pz, 0x998877);
  breakableWall.userData.breakable = true;
  const escapeCollider = addCollider(colliders, px + 20, 3, pz, 1, 6, 12, 'breakable', 'prison_wall');

  // Prison cells
  for (let i = 0; i < 4; i++) {
    const cellZ = pz - 14 + i * 8;
    // Cell back wall
    box(scene, 6, 4, 0.3, px - 14, 2, cellZ - 3, 0x777777);
    addCollider(colliders, px - 14, 2, cellZ - 3, 6, 4, 0.3);
    // Cell side wall
    box(scene, 0.3, 4, 6, px - 11, 2, cellZ, 0x777777);
    addCollider(colliders, px - 11, 2, cellZ, 0.3, 4, 6);
    // Bed
    box(scene, 3, 0.5, 1.5, px - 15, 0.5, cellZ, 0x8B4513);
    // Cell bars
    for (let b = 0; b < 4; b++) {
      box(scene, 0.15, 4, 0.15, px - 17 + b * 1.5, 2, cellZ + 3, 0x444444);
    }
  }

  // Yard area (right side)
  // Exercise equipment (simple boxes)
  box(scene, 2, 3, 0.5, px + 5, 1.5, pz - 5, 0x555555);
  box(scene, 4, 0.3, 0.3, px + 5, 3, pz - 5, 0x555555);
  // Bench
  box(scene, 3, 0.5, 1, px + 10, 0.5, pz + 5, 0x8B4513);

  // Guard tower
  box(scene, 3, 8, 3, px, 4, pz - 18, 0x555555);
  box(scene, 5, 0.3, 5, px, 8.15, pz - 18, 0x555555);
  addCollider(colliders, px, 4, pz - 18, 3, 8, 3);

  // Sign
  const signGeo = new THREE.PlaneGeometry(8, 2);
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 64;
  const signCtx = signCanvas.getContext('2d')!;
  signCtx.fillStyle = '#333';
  signCtx.fillRect(0, 0, 256, 64);
  signCtx.fillStyle = '#fff';
  signCtx.font = 'bold 32px Arial';
  signCtx.textAlign = 'center';
  signCtx.fillText('교도소', 128, 42);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMat = new THREE.MeshStandardMaterial({ map: signTex });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(px, 7, pz - 20.6);
  scene.add(sign);

  return escapeCollider;
}

function createBuilding(
  scene: THREE.Scene,
  colliders: Collider[],
  x: number, z: number,
  w: number, h: number, d: number,
  color: number,
  label?: string
): THREE.Group {
  const group = new THREE.Group();

  // Main structure
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, h / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Roof
  const roofGeo = new THREE.BoxGeometry(w + 1, 0.5, d + 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, h + 0.25, 0);
  roof.castShadow = true;
  group.add(roof);

  // Windows
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x223344, roughness: 0.3 });
  const floors = Math.floor(h / 4);
  for (let f = 0; f < floors; f++) {
    const wy = 2 + f * 4;
    const windowsPerSide = Math.floor(w / 4);
    for (let wi = 0; wi < windowsPerSide; wi++) {
      const wx = -w / 2 + 2 + wi * 4;
      // Front
      const wgeo = new THREE.BoxGeometry(1.5, 1.5, 0.1);
      const wm1 = new THREE.Mesh(wgeo, windowMat);
      wm1.position.set(wx, wy, d / 2 + 0.06);
      group.add(wm1);
      // Back
      const wm2 = new THREE.Mesh(wgeo, windowMat);
      wm2.position.set(wx, wy, -d / 2 - 0.06);
      group.add(wm2);
    }
  }

  // Door
  const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.5, d / 2 + 0.11);
  group.add(door);

  // Label
  if (label) {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, 128, 42);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(w * 0.8, 1.5);
    const labelMat = new THREE.MeshStandardMaterial({ map: labelTex });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, h - 1, d / 2 + 0.15);
    group.add(labelMesh);
  }

  group.position.set(x, 0, z);
  scene.add(group);

  addCollider(colliders, x, h / 2, z, w, h, d);

  return group;
}

function createBank(scene: THREE.Scene, colliders: Collider[]): { group: THREE.Group; triggerZone: Collider } {
  const x = 30, z = -30;
  const group = createBuilding(scene, colliders, x, z, 16, 10, 14, 0xd4a843, '은행 BANK');

  // Columns
  for (let i = -1; i <= 1; i += 2) {
    const col = box(scene, 1.2, 10, 1.2, x + i * 5, 5, z + 7.5, 0xcccccc);
    col.castShadow = true;
  }

  // Money symbol on top
  const dollarCanvas = document.createElement('canvas');
  dollarCanvas.width = 64;
  dollarCanvas.height = 64;
  const dctx = dollarCanvas.getContext('2d')!;
  dctx.fillStyle = '#ffd700';
  dctx.font = 'bold 48px Arial';
  dctx.textAlign = 'center';
  dctx.fillText('$', 32, 48);
  const dollarTex = new THREE.CanvasTexture(dollarCanvas);
  const dollarGeo = new THREE.PlaneGeometry(3, 3);
  const dollarMat = new THREE.MeshStandardMaterial({ map: dollarTex, transparent: true });
  const dollar = new THREE.Mesh(dollarGeo, dollarMat);
  dollar.position.set(x, 12, z + 7.2);
  scene.add(dollar);

  const triggerZone: Collider = {
    min: new THREE.Vector3(x - 4, 0, z - 2),
    max: new THREE.Vector3(x + 4, 4, z + 9),
    type: 'trigger',
    tag: 'bank',
  };

  return { group, triggerZone };
}

function createJewelryStore(scene: THREE.Scene, colliders: Collider[]): { group: THREE.Group; triggerZone: Collider } {
  const x = -30, z = 30;
  const group = createBuilding(scene, colliders, x, z, 12, 8, 10, 0x9933cc, '보석상 JEWELRY');

  // Diamond shape on front
  const diamondGeo = new THREE.OctahedronGeometry(1.5);
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x006666, roughness: 0.1, metalness: 0.8 });
  const diamond = new THREE.Mesh(diamondGeo, diamondMat);
  diamond.position.set(x, 10, z + 5.5);
  diamond.rotation.y = Math.PI / 4;
  scene.add(diamond);

  const triggerZone: Collider = {
    min: new THREE.Vector3(x - 3, 0, z - 1),
    max: new THREE.Vector3(x + 3, 4, z + 7),
    type: 'trigger',
    tag: 'jewelry',
  };

  return { group, triggerZone };
}

function createPoliceStation(scene: THREE.Scene, colliders: Collider[]): void {
  const x = 60, z = 60;
  createBuilding(scene, colliders, x, z, 18, 10, 14, 0x2244aa, '경찰서 POLICE');

  // Police light on top
  const lightGeo = new THREE.BoxGeometry(4, 1, 1);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(x, 11, z);
  scene.add(light);
}

function createApartments(scene: THREE.Scene, colliders: Collider[]): void {
  // Original buildings
  createBuilding(scene, colliders, 80, -40, 14, 20, 14, 0xbb9977, '아파트');
  createBuilding(scene, colliders, 100, -40, 14, 24, 14, 0xaa8866, '아파트');
  createBuilding(scene, colliders, -60, 50, 12, 16, 12, 0x998877);
  createBuilding(scene, colliders, 0, 70, 14, 18, 12, 0xbbaa99, '상가');

  // New outer buildings
  createBuilding(scene, colliders, 150, 80, 16, 22, 16, 0xcc9988, '주상복합');
  createBuilding(scene, colliders, -150, 100, 14, 18, 14, 0xbbaa77, '오피스텔');
  createBuilding(scene, colliders, 180, -80, 18, 30, 16, 0xaa9999, '타워');
  createBuilding(scene, colliders, -180, -60, 12, 14, 12, 0x889988, '편의점');
  createBuilding(scene, colliders, 120, 140, 14, 16, 14, 0x998866, '마트');
  createBuilding(scene, colliders, -120, -120, 16, 20, 14, 0xbb8877, '병원');
  createBuilding(scene, colliders, 0, -150, 20, 12, 18, 0xaabb99, '학교');
  createBuilding(scene, colliders, -160, 0, 14, 16, 14, 0xccaa88, '카페');
  createBuilding(scene, colliders, 160, 0, 16, 20, 14, 0x99aacc, '쇼핑몰');
}

function createGasStation(scene: THREE.Scene, colliders: Collider[]): void {
  const x = -50, z = -20;

  // Canopy
  box(scene, 14, 0.3, 10, x, 5, z, 0xcc0000, true, true);
  // Pillars
  box(scene, 0.8, 5, 0.8, x - 6, 2.5, z - 4, 0xdddddd);
  addCollider(colliders, x - 6, 2.5, z - 4, 0.8, 5, 0.8);
  box(scene, 0.8, 5, 0.8, x + 6, 2.5, z - 4, 0xdddddd);
  addCollider(colliders, x + 6, 2.5, z - 4, 0.8, 5, 0.8);
  box(scene, 0.8, 5, 0.8, x - 6, 2.5, z + 4, 0xdddddd);
  addCollider(colliders, x - 6, 2.5, z + 4, 0.8, 5, 0.8);
  box(scene, 0.8, 5, 0.8, x + 6, 2.5, z + 4, 0xdddddd);
  addCollider(colliders, x + 6, 2.5, z + 4, 0.8, 5, 0.8);

  // Fuel pumps
  for (let i = -1; i <= 1; i += 2) {
    box(scene, 1, 2.5, 0.8, x + i * 3, 1.25, z, 0xeeeeee);
    addCollider(colliders, x + i * 3, 1.25, z, 1, 2.5, 0.8);
  }

  // Store
  createBuilding(scene, colliders, x + 12, z, 8, 5, 8, 0xeeeeee, '주유소');
}

function createBridge(scene: THREE.Scene, colliders: Collider[]): void {
  const bx = 0, bz = -50;

  // Bridge deck
  box(scene, 12, 0.5, 30, bx, 3, bz, 0x888888, false, true);
  addCollider(colliders, bx, 3, bz, 12, 0.5, 30);

  // Ramps
  const rampGeo = new THREE.BoxGeometry(12, 0.5, 10);
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  const ramp1 = new THREE.Mesh(rampGeo, rampMat);
  ramp1.position.set(bx, 1.5, bz - 20);
  ramp1.rotation.x = -Math.atan2(3, 10);
  ramp1.receiveShadow = true;
  scene.add(ramp1);

  const ramp2 = new THREE.Mesh(rampGeo, rampMat);
  ramp2.position.set(bx, 1.5, bz + 20);
  ramp2.rotation.x = Math.atan2(3, 10);
  ramp2.receiveShadow = true;
  scene.add(ramp2);

  // Railings
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      box(scene, 0.2, 2, 0.2, bx + side * 5.5, 4, bz - 14 + i * 4, 0x666666);
    }
    box(scene, 0.3, 0.3, 30, bx + side * 5.5, 4.5, bz, 0x666666);
  }

  // Water under bridge
  const waterGeo = new THREE.PlaneGeometry(40, 50);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2266aa, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.8 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(bx, 0.05, bz);
  scene.add(water);
}

function createTrees(scene: THREE.Scene, colliders: Collider[]): void {
  const treePositions = [
    [20, 20], [-20, -20], [50, 30], [-40, 60], [70, -10],
    [-70, 30], [40, 70], [-50, -50], [90, 20], [-80, 0],
    [10, 50], [-10, 80], [60, -60], [-30, -60], [80, 60],
    [30, 50], [-60, -30], [50, -70], [-70, 70], [100, 0],
    [-90, -20], [110, 40], [-40, 90], [70, 80], [-80, -60],
    // Outer trees (reduced for performance)
    [150, 50], [-150, 50], [150, -50], [-150, -50],
    [200, 0], [-200, 0], [0, 200], [0, -200],
  ];

  treePositions.forEach(([tx, tz]) => {
    const trunkH = 3 + Math.random() * 2;
    const leafSize = 3 + Math.random() * 2;

    // Trunk
    box(scene, 0.8, trunkH, 0.8, tx, trunkH / 2, tz, 0x8B4513);
    addCollider(colliders, tx, trunkH / 2, tz, 0.8, trunkH, 0.8);

    // Leaves (blocky)
    box(scene, leafSize, leafSize, leafSize, tx, trunkH + leafSize / 2, tz, 0x228B22);
    if (Math.random() > 0.5) {
      box(scene, leafSize * 0.7, leafSize * 0.7, leafSize * 0.7, tx + 1, trunkH + leafSize, tz + 0.5, 0x2da832);
    }
  });
}

function createStreetLights(scene: THREE.Scene, colliders: Collider[]): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  const positions = [
    [0, 0], [20, 0], [40, 0], [60, 0], [-20, 0], [-40, 0], [-60, 0],
    [80, 0], [100, 0], [-80, 0], [-100, 0],
    [0, 20], [0, 40], [0, 60], [0, -20], [0, -40], [0, -60],
    [0, 80], [0, 100], [0, -80], [0, -100],
    [30, -30], [-30, 30], [60, 60], [-50, -20],
    // Outer ring lights
    [150, 150], [-150, 150], [150, -150], [-150, -150],
    [200, 0], [-200, 0], [0, 200], [0, -200],
    [100, 150], [-100, 150], [100, -150], [-100, -150],
  ];

  positions.forEach(([lx, lz]) => {
    // Pole
    box(scene, 0.3, 6, 0.3, lx, 3, lz, 0x555555);
    addCollider(colliders, lx, 3, lz, 0.3, 6, 0.3);

    // Arm
    box(scene, 2, 0.2, 0.2, lx + 1, 6, lz, 0x555555);

    // Light fixture
    box(scene, 1, 0.3, 0.5, lx + 2, 5.8, lz, 0xffffcc);

    // Point light
    const pointLight = new THREE.PointLight(0xffdd88, 0, 20);
    pointLight.position.set(lx + 2, 5.5, lz);
    scene.add(pointLight);
    lights.push(pointLight);
  });

  return lights;
}

function createMountains(scene: THREE.Scene): void {
  const positions = [
    [-400, -400, 80], [-300, -400, 60], [-200, -400, 70],
    [200, -400, 75], [300, -400, 55], [400, -400, 85],
    [-400, 400, 70], [-400, 200, 75], [400, 400, 65],
    [400, 200, 80], [-400, -200, 60], [400, -200, 70],
  ];

  positions.forEach(([mx, mz, mh]) => {
    const mountainGeo = new THREE.ConeGeometry(40 + Math.random() * 30, mh, 6);
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x666655, roughness: 1 });
    const mountain = new THREE.Mesh(mountainGeo, mountainMat);
    mountain.position.set(mx, mh / 2, mz);
    mountain.castShadow = true;
    scene.add(mountain);

    // Snow cap
    if (mh > 60) {
      const snowGeo = new THREE.ConeGeometry(10, mh * 0.3, 6);
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(mx, mh * 0.85, mz);
      scene.add(snow);
    }
  });
}

function createFences(scene: THREE.Scene, colliders: Collider[]): void {
  // Fences around some areas
  const fenceSegments: [number, number, number, number][] = [
    [-40, -60, 20, -60],   // South fence
    [40, 80, 40, 100],     // East area
  ];

  fenceSegments.forEach(([x1, z1, x2, z2]) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const segments = Math.floor(length / 3);
    const angle = Math.atan2(dx, dz);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const fx = x1 + dx * t;
      const fz = z1 + dz * t;
      // Post
      box(scene, 0.2, 2, 0.2, fx, 1, fz, 0x888888);
    }

    // Rail
    const railGeo = new THREE.BoxGeometry(0.1, 0.1, length);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set((x1 + x2) / 2, 1.5, (z1 + z2) / 2);
    rail1.rotation.y = angle;
    scene.add(rail1);

    const rail2 = rail1.clone();
    rail2.position.y = 0.5;
    scene.add(rail2);

    addCollider(colliders, (x1 + x2) / 2, 1, (z1 + z2) / 2,
      Math.abs(dx) < 1 ? 0.3 : Math.abs(dx), 2,
      Math.abs(dz) < 1 ? 0.3 : Math.abs(dz));
  });
}

function createTrafficCarMesh(scene: THREE.Scene, color: number): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(2.2, 1.0, 4.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  // Roof
  const roofGeo = new THREE.BoxGeometry(1.8, 0.8, 2.5);
  const roofMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 1.7, -0.3);
  roof.castShadow = true;
  group.add(roof);

  // Windows
  const winMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.5 });
  const frontWinGeo = new THREE.BoxGeometry(1.6, 0.6, 0.1);
  const frontWin = new THREE.Mesh(frontWinGeo, winMat);
  frontWin.position.set(0, 1.6, 0.95);
  group.add(frontWin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 6);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const wheelPositions = [[-1.0, 0.35, 1.3], [1.0, 0.35, 1.3], [-1.0, 0.35, -1.3], [1.0, 0.35, -1.3]];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  });

  // Headlights
  const lightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.3 });
  const hl1 = new THREE.Mesh(lightGeo, lightMat);
  hl1.position.set(-0.7, 0.7, 2.26);
  group.add(hl1);
  const hl2 = new THREE.Mesh(lightGeo, lightMat);
  hl2.position.set(0.7, 0.7, 2.26);
  group.add(hl2);

  // Taillights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.2 });
  const tl1 = new THREE.Mesh(lightGeo, tailMat);
  tl1.position.set(-0.7, 0.7, -2.26);
  group.add(tl1);
  const tl2 = new THREE.Mesh(lightGeo, tailMat);
  tl2.position.set(0.7, 0.7, -2.26);
  group.add(tl2);

  scene.add(group);
  return group;
}

export function createTrafficCars(scene: THREE.Scene): TrafficCar[] {
  const colors = [0xcc2222, 0x2266cc, 0x22cc44, 0xcccc22, 0xcc6622, 0x8822cc, 0x22cccc, 0xffffff, 0x444444];

  const routes: THREE.Vector3[][] = [
    // Main horizontal road left-right
    [new THREE.Vector3(-250, 0.1, 3), new THREE.Vector3(250, 0.1, 3)],
    // Main horizontal road right-left
    [new THREE.Vector3(250, 0.1, -3), new THREE.Vector3(-250, 0.1, -3)],
    // Main vertical road down-up
    [new THREE.Vector3(3, 0.1, -250), new THREE.Vector3(3, 0.1, 250)],
    // Main vertical road up-down
    [new THREE.Vector3(-3, 0.1, 250), new THREE.Vector3(-3, 0.1, -250)],
    // Outer ring top
    [new THREE.Vector3(-200, 0.1, 148), new THREE.Vector3(200, 0.1, 148)],
    // Outer ring bottom
    [new THREE.Vector3(200, 0.1, -148), new THREE.Vector3(-200, 0.1, -148)],
    // Outer ring left
    [new THREE.Vector3(-198, 0.1, -150), new THREE.Vector3(-198, 0.1, 150)],
    // Outer ring right
    [new THREE.Vector3(198, 0.1, 150), new THREE.Vector3(198, 0.1, -150)],
  ];

  const cars: TrafficCar[] = [];

  routes.forEach((route, ri) => {
    // 2 cars per route
    for (let c = 0; c < 1; c++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mesh = createTrafficCarMesh(scene, color);
      const t = (c + 0.5) / 2;
      const startPos = route[0].clone().lerp(route[1], t);
      mesh.position.copy(startPos);

      const dx = route[1].x - route[0].x;
      const dz = route[1].z - route[0].z;
      const rotation = Math.atan2(dx, dz);
      mesh.rotation.y = rotation;

      cars.push({
        mesh,
        position: startPos.clone(),
        rotation,
        speed: 8 + Math.random() * 12,
        routeIndex: ri,
        route,
        currentTarget: 1,
      });
    }
  });

  return cars;
}

export function updateTrafficCars(cars: TrafficCar[], delta: number): void {
  for (const car of cars) {
    const target = car.route[car.currentTarget];
    const dx = target.x - car.position.x;
    const dz = target.z - car.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 5) {
      // Reverse route direction
      car.currentTarget = car.currentTarget === 0 ? 1 : 0;
    }

    const dirX = dx / dist;
    const dirZ = dz / dist;

    car.position.x += dirX * car.speed * delta;
    car.position.z += dirZ * car.speed * delta;
    car.position.y = 0.1;

    car.rotation = Math.atan2(dirX, dirZ);
    car.mesh.position.copy(car.position);
    car.mesh.rotation.y = car.rotation;
  }
}

export interface SpacePortal {
  mesh: THREE.Group;
  position: THREE.Vector3;
  ringMeshes: THREE.Mesh[];
  particleMesh: THREE.Points;
}

export function createSpacePortal(scene: THREE.Scene): SpacePortal {
  const group = new THREE.Group();
  const portalY = 50;
  const portalPos = new THREE.Vector3(0, portalY, 0);

  // Main ring
  const ringGeo = new THREE.TorusGeometry(12, 1.5, 12, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x6633ff, emissive: 0x4422cc, emissiveIntensity: 1.0, metalness: 0.8, roughness: 0.2
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Inner glow ring
  const innerRingGeo = new THREE.TorusGeometry(10, 0.8, 12, 32);
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 1.5, transparent: true, opacity: 0.7
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2;
  group.add(innerRing);

  // Portal surface (semi-transparent disc)
  const discGeo = new THREE.CircleGeometry(10, 24);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x2200ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  // Particles around portal
  const particleCount = 80;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 8;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x88ffff, size: 0.8, transparent: true, opacity: 0.8 });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // "SPACE PORTAL" label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext('2d')!;
  ctx.fillStyle = '#6633ff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🌌 우주 포탈 🌌', 256, 70);
  ctx.fillStyle = '#88ffff';
  ctx.font = '24px Arial';
  ctx.fillText('여기로 들어가면 우주로!', 256, 110);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSpriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
  const label = new THREE.Sprite(labelSpriteMat);
  label.position.y = 18;
  label.scale.set(16, 4, 1);
  group.add(label);

  // Beam of light going up from portal
  const beamGeo = new THREE.CylinderGeometry(2, 8, 50, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x4422ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -25; // beam goes downward from portal to ground
  group.add(beam);

  group.position.copy(portalPos);
  scene.add(group);

  return {
    mesh: group,
    position: portalPos,
    ringMeshes: [ring, innerRing],
    particleMesh: particles,
  };
}

export function updateSpacePortal(portal: SpacePortal, delta: number): void {
  // Rotate rings
  portal.ringMeshes[0].rotation.z += delta * 0.5;
  portal.ringMeshes[1].rotation.z -= delta * 0.8;

  // Rotate particles
  portal.particleMesh.rotation.y += delta * 0.3;

  // Pulsing glow
  const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
  portal.ringMeshes.forEach(r => {
    if (r.material instanceof THREE.MeshStandardMaterial) {
      r.material.emissiveIntensity = pulse * 1.5;
    }
  });
}

export function buildWorld(scene: THREE.Scene): WorldResult {
  const colliders: Collider[] = [];

  createGround(scene);

  // Roads (connecting key locations)
  // Main horizontal road
  createRoad(scene, -300, 0, 300, 0, 12);
  // Main vertical road
  createRoad(scene, 0, -300, 0, 300, 12);
  // To prison
  createRoad(scene, -80, 0, -80, -60, 8);
  createRoad(scene, -80, 0, 0, 0, 8);
  // To bank
  createRoad(scene, 0, -30, 30, -30, 8);
  // To police station
  createRoad(scene, 60, 0, 60, 60, 8);
  // To jewelry
  createRoad(scene, -30, 0, -30, 30, 8);
  // Ring road (outer)
  createRoad(scene, -200, 150, 200, 150, 10);
  createRoad(scene, -200, -150, 200, -150, 10);
  createRoad(scene, -200, -150, -200, 150, 10);
  createRoad(scene, 200, -150, 200, 150, 10);
  // Inner ring
  createRoad(scene, -60, 80, 80, 80, 8);
  // Diagonal roads
  createRoad(scene, 100, 0, 200, 100, 8);
  createRoad(scene, -100, 0, -200, -100, 8);

  // Prison
  const prisonEscapeCollider = createPrison(scene, colliders);

  // Bank (robbery location)
  const bankResult = createBank(scene, colliders);

  // Jewelry store (robbery location)
  const jewelryResult = createJewelryStore(scene, colliders);

  // Police station
  createPoliceStation(scene, colliders);

  // Other buildings
  createApartments(scene, colliders);
  createGasStation(scene, colliders);

  // Bridge
  createBridge(scene, colliders);

  // Trees
  createTrees(scene, colliders);

  // Street lights
  const streetLights = createStreetLights(scene, colliders);

  // Mountains
  createMountains(scene);

  // Fences
  createFences(scene, colliders);

  // Robbery locations
  const robberyLocations: RobberyLocation[] = [
    {
      id: 'bank',
      name: '은행',
      position: new THREE.Vector3(30, 0, -30),
      reward: 5000,
      isBeingRobbed: false,
      robberyProgress: 0,
      cooldownTimer: 0,
      cooldownDuration: 60,
      robberyDuration: 5,
      mesh: bankResult.group,
      triggerZone: bankResult.triggerZone,
    },
    {
      id: 'jewelry',
      name: '보석상',
      position: new THREE.Vector3(-30, 0, 30),
      reward: 3000,
      isBeingRobbed: false,
      robberyProgress: 0,
      cooldownTimer: 0,
      cooldownDuration: 45,
      robberyDuration: 4,
      mesh: jewelryResult.group,
      triggerZone: jewelryResult.triggerZone,
    },
  ];

  // Traffic cars
  const trafficCars = createTrafficCars(scene);

  // Space portal
  const spacePortal = createSpacePortal(scene);

  return { colliders, robberyLocations, prisonEscapeCollider, streetLights, trafficCars, spacePortal };
}
