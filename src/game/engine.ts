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
  scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 10, 15);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Sun (directional light)
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
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
