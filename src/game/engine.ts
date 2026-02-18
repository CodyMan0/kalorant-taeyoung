import * as THREE from 'three';

export interface Engine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  hemisphere: THREE.HemisphereLight;
}

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(0, 10, 15);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Sun (directional light)
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // Ambient light
  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambient);

  // Hemisphere light
  const hemisphere = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4);
  scene.add(hemisphere);

  return { scene, camera, renderer, sun, ambient, hemisphere };
}

export function updateDayNightCycle(engine: Engine, timeOfDay: number): void {
  // timeOfDay: 0-1 where 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  const sunAngle = timeOfDay * Math.PI * 2 - Math.PI / 2;
  const sunHeight = Math.sin(sunAngle);
  const sunX = Math.cos(sunAngle) * 80;

  engine.sun.position.set(sunX, Math.max(sunHeight * 80, -10), 30);

  const dayIntensity = Math.max(0, sunHeight);
  engine.sun.intensity = dayIntensity * 1.5;
  engine.ambient.intensity = 0.2 + dayIntensity * 0.4;

  // Sky color transitions
  const nightColor = new THREE.Color(0x0a0a2e);
  const dayColor = new THREE.Color(0x87ceeb);
  const sunsetColor = new THREE.Color(0xff6b35);

  let skyColor: THREE.Color;
  if (sunHeight > 0.2) {
    skyColor = dayColor;
  } else if (sunHeight > -0.1) {
    const t = (sunHeight + 0.1) / 0.3;
    skyColor = nightColor.clone().lerp(sunsetColor, t);
    if (t > 0.5) {
      skyColor.lerp(dayColor, (t - 0.5) * 2);
    }
  } else {
    skyColor = nightColor;
  }

  engine.scene.background = skyColor;
  if (engine.scene.fog) {
    (engine.scene.fog as THREE.Fog).color = skyColor;
  }

  // Sun color
  if (sunHeight < 0.3 && sunHeight > -0.1) {
    engine.sun.color.set(0xff8844);
  } else {
    engine.sun.color.set(0xffffff);
  }
}

// Stars mesh for space effect
let starsMesh: THREE.Points | null = null;

function getOrCreateStars(scene: THREE.Scene): THREE.Points {
  if (starsMesh) return starsMesh;
  const starsGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 1] = Math.random() * 800 + 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
  starsMesh = new THREE.Points(starsGeo, starsMat);
  starsMesh.visible = false;
  scene.add(starsMesh);
  return starsMesh;
}

let planetsMeshes: THREE.Object3D[] = [];
let sunMeshRef: THREE.Mesh | null = null;

function getOrCreatePlanets(scene: THREE.Scene): THREE.Object3D[] {
  if (planetsMeshes.length > 0) return planetsMeshes;

  // Sun (태양) - huge glowing sphere
  const sunGeo = new THREE.SphereGeometry(200, 24, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  sunMeshRef = new THREE.Mesh(sunGeo, sunMat);
  sunMeshRef.position.set(800, 500, -1200);
  sunMeshRef.visible = false;
  scene.add(sunMeshRef);
  planetsMeshes.push(sunMeshRef);

  // Sun glow
  const glowGeo = new THREE.SphereGeometry(260, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.3 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(sunMeshRef.position);
  glow.visible = false;
  scene.add(glow);
  planetsMeshes.push(glow);

  // 수성 Mercury - small, gray
  const planets = [
    { name: '수성', radius: 12, color: 0xaaaaaa, emissive: 0x333333, pos: [500, 400, -800], ring: false },
    // 금성 Venus - yellowish white, thick atmosphere feel
    { name: '금성', radius: 25, color: 0xffe4b5, emissive: 0x554422, pos: [350, 350, -600], ring: false },
    // 지구 Earth - blue and green
    { name: '지구', radius: 30, color: 0x2266cc, emissive: 0x112244, pos: [150, 300, -400], ring: false },
    // 화성 Mars - red
    { name: '화성', radius: 20, color: 0xcc4422, emissive: 0x441111, pos: [-100, 350, -500], ring: false },
    // 목성 Jupiter - huge, orange-brown striped
    { name: '목성', radius: 120, color: 0xdd8844, emissive: 0x442211, pos: [-500, 500, -900], ring: false },
    // 토성 Saturn - golden with rings
    { name: '토성', radius: 100, color: 0xddcc77, emissive: 0x443311, pos: [-800, 450, -700], ring: true },
    // 천왕성 Uranus - light blue
    { name: '천왕성', radius: 55, color: 0x66ddee, emissive: 0x113333, pos: [-400, 600, -1100], ring: true },
    // 해왕성 Neptune - deep blue
    { name: '해왕성', radius: 50, color: 0x3344ff, emissive: 0x111144, pos: [300, 650, -1400], ring: false },
  ];

  planets.forEach(p => {
    const geo = new THREE.SphereGeometry(p.radius, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      emissive: p.emissive,
      emissiveIntensity: 0.8,
      roughness: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
    mesh.visible = false;
    scene.add(mesh);
    planetsMeshes.push(mesh);

    // Earth special: add green continents
    if (p.name === '지구') {
      const landGeo = new THREE.SphereGeometry(p.radius * 1.005, 24, 24);
      const landMat = new THREE.MeshStandardMaterial({
        color: 0x44aa44, emissive: 0x112211, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.6, roughness: 0.8
      });
      const land = new THREE.Mesh(landGeo, landMat);
      land.position.copy(mesh.position);
      land.rotation.set(0.3, 0.5, 0);
      land.visible = false;
      scene.add(land);
      planetsMeshes.push(land);

      // Moon
      const moonGeo = new THREE.SphereGeometry(8, 12, 12);
      const moonMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x222222, emissiveIntensity: 0.5 });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.position.set(p.pos[0] + 60, p.pos[1] + 20, p.pos[2] - 30);
      moon.visible = false;
      scene.add(moon);
      planetsMeshes.push(moon);
    }

    // Jupiter special: add Great Red Spot hint
    if (p.name === '목성') {
      const spotGeo = new THREE.SphereGeometry(p.radius * 1.003, 24, 24);
      const spotMat = new THREE.MeshStandardMaterial({
        color: 0xcc6633, emissive: 0x331100, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.4
      });
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.copy(mesh.position);
      spot.visible = false;
      scene.add(spot);
      planetsMeshes.push(spot);
    }

    // Saturn & Uranus rings
    if (p.ring) {
      const ringInner = p.name === '토성' ? p.radius * 1.3 : p.radius * 1.5;
      const ringOuter = p.name === '토성' ? p.radius * 2.2 : p.radius * 2.0;
      const ringColor = p.name === '토성' ? 0xddcc88 : 0x88ddee;
      const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: ringColor,
        emissive: ringColor,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(mesh.position);
      ring.rotation.x = p.name === '토성' ? Math.PI * 0.35 : Math.PI * 0.45;
      ring.visible = false;
      scene.add(ring);
      planetsMeshes.push(ring);
    }

    // Planet name label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 128, 44);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSpriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
    const labelSprite = new THREE.Sprite(labelSpriteMat);
    labelSprite.position.set(p.pos[0], p.pos[1] + p.radius + 20, p.pos[2]);
    labelSprite.scale.set(p.radius * 1.5, p.radius * 0.4, 1);
    labelSprite.visible = false;
    scene.add(labelSprite);
    planetsMeshes.push(labelSprite);
  });

  return planetsMeshes;
}

export function updateSpaceTransition(engine: Engine, playerY: number): void {
  const spaceStartHeight = 80;
  const spaceFullHeight = 250;
  const t = Math.max(0, Math.min(1, (playerY - spaceStartHeight) / (spaceFullHeight - spaceStartHeight)));

  if (t > 0) {
    const spaceColor = new THREE.Color(0x020010);
    const currentBg = engine.scene.background as THREE.Color;
    if (currentBg) {
      const blended = currentBg.clone().lerp(spaceColor, t);
      engine.scene.background = blended;
      if (engine.scene.fog) {
        (engine.scene.fog as THREE.Fog).color = blended;
        (engine.scene.fog as THREE.Fog).near = 200 + t * 600;
        (engine.scene.fog as THREE.Fog).far = 500 + t * 1500;
      }
    }
  }

  // Show stars when entering space
  const stars = getOrCreateStars(engine.scene);
  stars.visible = t > 0.05;
  if (stars.material instanceof THREE.PointsMaterial) {
    stars.material.opacity = t;
    stars.material.transparent = true;
  }

  // Show planets when entering space (visible early at t > 0.1)
  const planets = getOrCreatePlanets(engine.scene);
  const planetAlpha = Math.max(0, (t - 0.1) / 0.5);
  planets.forEach(p => {
    p.visible = t > 0.1;
    const mat = (p as THREE.Mesh).material;
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.opacity = Math.min(1, planetAlpha);
      mat.transparent = planetAlpha < 1;
    }
    if (mat instanceof THREE.MeshBasicMaterial) {
      mat.opacity = Math.min(1, planetAlpha);
      mat.transparent = planetAlpha < 1;
    }
    if (mat instanceof THREE.SpriteMaterial) {
      mat.opacity = Math.min(1, planetAlpha);
    }
  });
  // Slowly rotate planets (spheres only)
  if (t > 0.1) {
    planets.forEach((p, i) => {
      if ((p as THREE.Mesh).geometry instanceof THREE.SphereGeometry) {
        p.rotation.y += 0.0005 * (i % 3 + 1);
      }
    });
  }

}

export function handleResize(engine: Engine): void {
  engine.camera.aspect = window.innerWidth / window.innerHeight;
  engine.camera.updateProjectionMatrix();
  engine.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function disposeEngine(engine: Engine): void {
  engine.renderer.dispose();
  engine.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
}
