import * as THREE from 'three';
import { Vehicle, VehicleType } from './types';
import { startEngineSound, stopEngineSound, updateEngineSound } from './audio';

function createVehicleMesh(type: VehicleType, color: number): THREE.Group {
  const group = new THREE.Group();

  if (type === 'motorcycle') {
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 2.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.6, 0.3, 1.2);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 1.3, -0.2);
    group.add(seat);

    // Handlebars
    const hGeo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
    const hMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const handlebar = new THREE.Mesh(hGeo, hMat);
    handlebar.position.set(0, 1.4, 1.0);
    group.add(handlebar);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const fw = new THREE.Mesh(wheelGeo, wheelMat);
    fw.rotation.z = Math.PI / 2;
    fw.position.set(0, 0.5, 1.1);
    group.add(fw);
    const bw = new THREE.Mesh(wheelGeo, wheelMat);
    bw.rotation.z = Math.PI / 2;
    bw.position.set(0, 0.5, -1.1);
    group.add(bw);

    return group;
  }

  // Car dimensions based on type
  let bw = 2.2, bh = 1.2, bd = 4;
  let cabH = 1.0, cabD = 2.5;

  if (type === 'truck') {
    bw = 2.6; bh = 1.5; bd = 5.5;
    cabH = 1.4; cabD = 2;
  } else if (type === 'sports_car') {
    bw = 2.2; bh = 0.8; bd = 4.2;
    cabH = 0.7; cabD = 2;
  }

  // Body
  const bodyGeo = new THREE.BoxGeometry(bw, bh, bd);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6 + bh / 2;
  body.castShadow = true;
  group.add(body);

  // Cabin/roof
  const cabGeo = new THREE.BoxGeometry(bw - 0.3, cabH, cabD);
  const cabMat = new THREE.MeshStandardMaterial({
    color: type === 'police_car' ? 0xffffff : 0x88bbdd,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7,
  });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(0, 0.6 + bh + cabH / 2, type === 'truck' ? bd / 2 - cabD / 2 - 0.5 : -0.2);
  cab.castShadow = true;
  group.add(cab);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const wheelPositions = [
    [-bw / 2 - 0.1, 0.4, bd / 2 - 0.8],
    [bw / 2 + 0.1, 0.4, bd / 2 - 0.8],
    [-bw / 2 - 0.1, 0.4, -bd / 2 + 0.8],
    [bw / 2 + 0.1, 0.4, -bd / 2 + 0.8],
  ];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Headlights
  const hlGeo = new THREE.BoxGeometry(0.4, 0.3, 0.1);
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.5 });
  const hl1 = new THREE.Mesh(hlGeo, hlMat);
  hl1.position.set(-bw / 2 + 0.4, 0.9, bd / 2 + 0.05);
  group.add(hl1);
  const hl2 = new THREE.Mesh(hlGeo, hlMat);
  hl2.position.set(bw / 2 - 0.4, 0.9, bd / 2 + 0.05);
  group.add(hl2);

  // Taillights
  const tlGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
  const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
  const tl1 = new THREE.Mesh(tlGeo, tlMat);
  tl1.position.set(-bw / 2 + 0.4, 0.9, -bd / 2 - 0.05);
  group.add(tl1);
  const tl2 = new THREE.Mesh(tlGeo, tlMat);
  tl2.position.set(bw / 2 - 0.4, 0.9, -bd / 2 - 0.05);
  group.add(tl2);

  // Police car special
  if (type === 'police_car') {
    // Light bar
    const barGeo = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 0.5 });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, 0.6 + bh + cabH + 0.15, -0.2);
    group.add(bar);

    const barGeo2 = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const barMat2 = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const bar2 = new THREE.Mesh(barGeo2, barMat2);
    bar2.position.set(0, 0.6 + bh + cabH + 0.15, 0.1);
    group.add(bar2);

    // "경찰" text
    const policeCanvas = document.createElement('canvas');
    policeCanvas.width = 128;
    policeCanvas.height = 64;
    const pctx = policeCanvas.getContext('2d')!;
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, 128, 64);
    pctx.fillStyle = '#0033aa';
    pctx.font = 'bold 30px Arial';
    pctx.textAlign = 'center';
    pctx.fillText('경찰', 64, 42);
    const policeTex = new THREE.CanvasTexture(policeCanvas);
    const policeGeo = new THREE.PlaneGeometry(1.5, 0.6);
    const policeMat = new THREE.MeshStandardMaterial({ map: policeTex });
    const policeLabel = new THREE.Mesh(policeGeo, policeMat);
    policeLabel.position.set(0, 1.2, bd / 2 + 0.06);
    group.add(policeLabel);
  }

  // Truck cargo
  if (type === 'truck') {
    const cargoGeo = new THREE.BoxGeometry(bw - 0.2, 2.5, bd * 0.5);
    const cargoMat = new THREE.MeshStandardMaterial({ color: 0x886644 });
    const cargo = new THREE.Mesh(cargoGeo, cargoMat);
    cargo.position.set(0, 0.6 + bh + 1.25, -bd / 2 + bd * 0.25 + 0.5);
    cargo.castShadow = true;
    group.add(cargo);
  }

  return group;
}

export function createVehicles(scene: THREE.Scene): Vehicle[] {
  const vehicleSpecs: { type: VehicleType; color: number; pos: [number, number, number]; rot: number }[] = [
    { type: 'police_car', color: 0xffffff, pos: [55, 0, 50], rot: 0 },
    { type: 'police_car', color: 0xffffff, pos: [65, 0, 50], rot: 0 },
    { type: 'sports_car', color: 0xff2222, pos: [20, 0, 5], rot: Math.PI / 2 },
    { type: 'sports_car', color: 0x22ff22, pos: [-15, 0, -5], rot: -Math.PI / 2 },
    { type: 'truck', color: 0x886644, pos: [-45, 0, -25], rot: 0 },
    { type: 'motorcycle', color: 0xffaa00, pos: [5, 0, 15], rot: Math.PI / 4 },
    { type: 'motorcycle', color: 0xff00ff, pos: [-25, 0, -10], rot: -Math.PI / 3 },
    { type: 'sports_car', color: 0x2244ff, pos: [80, 0, -35], rot: Math.PI },
    { type: 'truck', color: 0x448844, pos: [-55, 0, 50], rot: Math.PI / 2 },
    { type: 'police_car', color: 0xffffff, pos: [-70, 0, -60], rot: Math.PI },
  ];

  return vehicleSpecs.map((spec, i) => {
    const mesh = createVehicleMesh(spec.type, spec.color);
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.rotation.y = spec.rot;
    scene.add(mesh);

    const maxSpeed = spec.type === 'sports_car' ? 50 :
                     spec.type === 'motorcycle' ? 45 :
                     spec.type === 'police_car' ? 40 :
                     30;

    return {
      id: `vehicle_${i}`,
      type: spec.type,
      mesh,
      position: new THREE.Vector3(spec.pos[0], spec.pos[1], spec.pos[2]),
      rotation: spec.rot,
      speed: 0,
      maxSpeed,
      acceleration: spec.type === 'sports_car' ? 20 : spec.type === 'truck' ? 10 : 15,
      isOccupied: false,
      color: spec.color,
      steerAngle: 0,
    };
  });
}

export function findNearestVehicle(vehicles: Vehicle[], pos: THREE.Vector3, range: number): Vehicle | null {
  let nearest: Vehicle | null = null;
  let nearestDist = range;

  for (const v of vehicles) {
    if (v.isOccupied) continue;
    const dx = v.position.x - pos.x;
    const dz = v.position.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearest = v;
      nearestDist = dist;
    }
  }

  return nearest;
}

export function enterVehicle(vehicle: Vehicle): void {
  vehicle.isOccupied = true;
  startEngineSound();
}

export function exitVehicle(vehicle: Vehicle): THREE.Vector3 {
  vehicle.isOccupied = false;
  vehicle.speed = 0;
  stopEngineSound();

  // Return exit position (to the left of the vehicle)
  const exitPos = vehicle.position.clone();
  exitPos.x += Math.cos(vehicle.rotation) * 3;
  exitPos.z -= Math.sin(vehicle.rotation) * 3;
  exitPos.y = 0;
  return exitPos;
}

export function updateVehicle(
  vehicle: Vehicle,
  forward: boolean,
  backward: boolean,
  left: boolean,
  right: boolean,
  delta: number
): void {
  if (!vehicle.isOccupied) return;

  // Acceleration
  if (forward) {
    vehicle.speed = Math.min(vehicle.maxSpeed, vehicle.speed + vehicle.acceleration * delta);
  } else if (backward) {
    vehicle.speed = Math.max(-vehicle.maxSpeed * 0.4, vehicle.speed - vehicle.acceleration * 1.5 * delta);
  } else {
    // Deceleration
    if (Math.abs(vehicle.speed) < 0.5) {
      vehicle.speed = 0;
    } else {
      vehicle.speed *= (1 - 3 * delta);
    }
  }

  // Steering
  const steerSpeed = 2.5;
  if (left && Math.abs(vehicle.speed) > 0.5) {
    vehicle.steerAngle = Math.min(0.8, vehicle.steerAngle + steerSpeed * delta);
  } else if (right && Math.abs(vehicle.speed) > 0.5) {
    vehicle.steerAngle = Math.max(-0.8, vehicle.steerAngle - steerSpeed * delta);
  } else {
    vehicle.steerAngle *= (1 - 5 * delta);
  }

  // Apply steering to rotation
  if (Math.abs(vehicle.speed) > 0.5) {
    const turnRate = vehicle.steerAngle * (vehicle.speed / vehicle.maxSpeed) * 2;
    vehicle.rotation += turnRate * delta;
  }

  // Move
  vehicle.position.x += Math.sin(vehicle.rotation) * vehicle.speed * delta;
  vehicle.position.z += Math.cos(vehicle.rotation) * vehicle.speed * delta;

  // World bounds
  vehicle.position.x = Math.max(-270, Math.min(270, vehicle.position.x));
  vehicle.position.z = Math.max(-270, Math.min(270, vehicle.position.z));

  // Update mesh
  vehicle.mesh.position.copy(vehicle.position);
  vehicle.mesh.rotation.y = vehicle.rotation;

  // Engine sound
  updateEngineSound(vehicle.speed);
}

export function updateVehicleCamera(
  camera: THREE.PerspectiveCamera,
  vehicle: Vehicle
): void {
  const behindDist = 10;
  const height = 5;

  const targetX = vehicle.position.x - Math.sin(vehicle.rotation) * behindDist;
  const targetZ = vehicle.position.z - Math.cos(vehicle.rotation) * behindDist;
  const targetY = vehicle.position.y + height;

  camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08);

  const lookAt = vehicle.position.clone();
  lookAt.y += 1.5;
  camera.lookAt(lookAt);
}
