'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameConfig, KeyState, MobileControls, Vehicle, Role } from '@/game/types';
import { Engine, createEngine, updateDayNightCycle, updateSpaceTransition, handleResize, disposeEngine } from '@/game/engine';
import { buildWorld } from '@/game/world';
import { PlayerController, createPlayer, updatePlayer, updateCamera, handleMouseMove, handleScroll, isNearPosition, respawnInJail } from '@/game/player';
import { createVehicles, findNearestVehicle, enterVehicle, exitVehicle, updateVehicle, updateVehicleCamera } from '@/game/vehicles';
import { createNPCs, updateNPCs, damageNPC } from '@/game/npc';
import { createRobberyState, attemptRobbery, updateRobbery, updateCooldowns, getNearbyRobberyInfo, RobberyState } from '@/game/robbery';
import { initAudio, playDoorOpen, playGunshot, playNpcDeath, playStab, playTeleport } from '@/game/audio';
import { connectToServer, disconnectFromServer, sendPlayerState, sendShoot, updateOtherPlayerMeshes, getOtherPlayers } from '@/game/multiplayer';
import HUD from './HUD';
import StartScreen from './StartScreen';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const keysRef = useRef<KeyState>({
    forward: false, backward: false, left: false, right: false,
    jump: false, sprint: false, interact: false, shoot: false, stab: false,
  });
  const mobileRef = useRef<MobileControls>({
    joystickX: 0, joystickY: 0,
    jumpPressed: false, sprintPressed: false, interactPressed: false,
    cameraRotX: 0, cameraRotY: 0,
  });
  const vehiclesRef = useRef<Vehicle[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const robberyStateRef = useRef<RobberyState>(createRobberyState());
  const interactCooldownRef = useRef(0);
  const worldDataRef = useRef<ReturnType<typeof buildWorld> | null>(null);

  const [gameStarted, setGameStarted] = useState(false);
  const [playerState, setPlayerState] = useState<GameConfig | null>(null);
  const [hudData, setHudData] = useState({
    health: 100, maxHealth: 100,
    money: 0, sprintEnergy: 100, maxSprintEnergy: 100,
    wantedLevel: 0, isInJail: false, hasEscaped: false,
    isInVehicle: false, role: 'prisoner' as Role,
    position: { x: 0, y: 0, z: 0 }, rotation: 0,
    name: '',
  });
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);
  const [interactionHint, setInteractionHint] = useState<string | null>(null);
  const [robberyDisplay, setRobberyDisplay] = useState<RobberyState>(createRobberyState());
  const [isMobile, setIsMobile] = useState(false);
  const [npcsData, setNpcsData] = useState<{ position: { x: number; z: number }; state: string }[]>([]);
  const [caughtScreen, setCaughtScreen] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [otherPlayersMinimapData, setOtherPlayersMinimapData] = useState<{ x: number; z: number; role: string }[]>([]);
  const bulletsRef = useRef<{ mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[]>([]);
  const mpSendTimerRef = useRef(0);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const initGame = useCallback((config: GameConfig) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    initAudio();

    const engine = createEngine(canvas);
    engineRef.current = engine;

    // Build world
    const worldData = buildWorld(engine.scene);
    worldDataRef.current = worldData;

    // Create player
    const player = createPlayer(engine.scene, engine.camera, config.playerName, config.role);
    playerRef.current = player;

    // Create vehicles
    const vehicles = createVehicles(engine.scene);
    vehiclesRef.current = vehicles;

    // Create NPCs
    const npcs = createNPCs(engine.scene);

    // Connect to multiplayer server (gracefully fails if server unavailable)
    const playerColor = config.role === 'prisoner' ? 0xff6600 : 0x2244aa;
    connectToServer(config.playerName, config.role, playerColor, (count) => {
      setPlayerCount(count);
    });

    // Escape collider reference
    const escapeCollider = worldData.prisonEscapeCollider;

    // Time of day
    let timeOfDay = 0.35; // Start at morning

    // HUD update throttle
    let hudUpdateTimer = 0;

    // Game loop
    const gameLoop = (time: number) => {
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      const keys = keysRef.current;
      const mobile = mobileRef.current;

      // Day/night cycle
      timeOfDay += delta * 0.005;
      if (timeOfDay > 1) timeOfDay -= 1;
      updateDayNightCycle(engine, timeOfDay);
      updateSpaceTransition(engine, player.state.position.y);

      // Street lights based on time
      const isDark = timeOfDay < 0.2 || timeOfDay > 0.75;
      worldData.streetLights.forEach((light) => {
        light.intensity = isDark ? 1.5 : 0;
      });

      // Interact cooldown
      if (interactCooldownRef.current > 0) {
        interactCooldownRef.current -= delta;
      }

      const wantsInteract = keys.interact || mobile.interactPressed;

      // Handle interactions
      if (wantsInteract && interactCooldownRef.current <= 0) {
        interactCooldownRef.current = 0.3;

        if (player.state.isInVehicle && player.state.currentVehicleId) {
          // Exit vehicle
          const vehicle = vehicles.find((v) => v.id === player.state.currentVehicleId);
          if (vehicle) {
            const exitPos = exitVehicle(vehicle);
            player.state.position.copy(exitPos);
            player.mesh.position.copy(exitPos);
            player.state.isInVehicle = false;
            player.state.currentVehicleId = null;
            setCurrentVehicle(null);
          }
        } else if (!player.state.isInVehicle) {
          // Try enter vehicle
          const nearVehicle = findNearestVehicle(vehicles, player.state.position, 5);
          if (nearVehicle) {
            enterVehicle(nearVehicle);
            player.state.isInVehicle = true;
            player.state.currentVehicleId = nearVehicle.id;
            setCurrentVehicle(nearVehicle);
            playDoorOpen();
          }
          // Try escape prison
          else if (player.state.isInJail && isNearPosition(player, escapeCollider.min.clone().add(escapeCollider.max).multiplyScalar(0.5), 4)) {
            player.state.isInJail = false;
            player.state.hasEscaped = true;
            player.state.wantedLevel = Math.min(5, player.state.wantedLevel + 1);
            playDoorOpen();
            // Remove breakable wall visually
            engine.scene.traverse((obj) => {
              if (obj instanceof THREE.Mesh && obj.userData.breakable) {
                obj.visible = false;
              }
            });
            // Remove collider
            const idx = worldData.colliders.indexOf(escapeCollider);
            if (idx > -1) worldData.colliders.splice(idx, 1);
          }
          // Try robbery
          else if (player.state.hasEscaped || player.state.role === 'police') {
            attemptRobbery(player, worldData.robberyLocations, robberyStateRef.current);
          }
        }
      }

      // Update robbery
      const { moneyEarned, wantedIncrease } = updateRobbery(player, robberyStateRef.current, delta);
      if (moneyEarned > 0) {
        player.state.money += moneyEarned;
        player.state.wantedLevel = Math.min(5, player.state.wantedLevel + wantedIncrease);
      }
      updateCooldowns(worldData.robberyLocations, delta);

      // Update player or vehicle
      if (player.state.isInVehicle && player.state.currentVehicleId) {
        const vehicle = vehicles.find((v) => v.id === player.state.currentVehicleId);
        if (vehicle) {
          updateVehicle(
            vehicle,
            keys.forward || mobile.joystickY < -0.2,
            keys.backward || mobile.joystickY > 0.2,
            keys.left || mobile.joystickX < -0.2,
            keys.right || mobile.joystickX > 0.2,
            delta
          );
          player.state.position.copy(vehicle.position);
          updateVehicleCamera(engine.camera, vehicle);
        }
      } else {
        updatePlayer(player, keys, mobile, worldData.colliders, delta, false);
        updateCamera(player);
      }

      // Update NPCs
      const { caught } = updateNPCs(npcs, player.state.position, player.state.wantedLevel, delta, engine.scene, player.state.isFlying);
      if (caught && !caughtScreen && !player.state.isFlying && !player.state.isInVehicle) {
        setCaughtScreen(true);
        player.state.money = Math.max(0, player.state.money - 1000);
        setCurrentVehicle(null);
        vehicles.forEach((v) => {
          if (v.id === player.state.currentVehicleId) {
            v.isOccupied = false;
            v.speed = 0;
          }
        });
        player.state.isInVehicle = false;
        player.state.currentVehicleId = null;
        // Freeze player, then respawn after delay
        player.state.velocity.set(0, 0, 0);
        setTimeout(() => {
          respawnInJail(player);
          setCaughtScreen(false);
        }, 2500);
      }

      // HP unlimited - always full
      player.state.health = player.state.maxHealth;

      // Shooting system
      if (player.state.shootCooldown > 0) player.state.shootCooldown -= delta;
      if (keys.shoot && player.state.shootCooldown <= 0) {
        player.state.shootCooldown = 0.2;
        player.state.isShooting = true;
        playGunshot();

        // Create bullet
        const bulletGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);

        // Shoot from player position in camera direction
        const shootDir = new THREE.Vector3(
          -Math.sin(player.cameraAngleX),
          0,
          -Math.cos(player.cameraAngleX)
        ).normalize();

        bullet.position.set(
          player.state.position.x + shootDir.x * 1.5,
          player.state.position.y + 2,
          player.state.position.z + shootDir.z * 1.5
        );

        const bulletSpeed = 80;
        const vel = shootDir.multiplyScalar(bulletSpeed);
        engine.scene.add(bullet);
        bulletsRef.current.push({ mesh: bullet, velocity: vel, life: 2 });

        // Broadcast shoot to other players
        sendShoot(
          { x: bullet.position.x, y: bullet.position.y, z: bullet.position.z },
          { x: shootDir.x, y: 0, z: shootDir.z }
        );
      } else {
        player.state.isShooting = false;
      }

      // Update bullets
      const bullets = bulletsRef.current;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.x += b.velocity.x * delta;
        b.mesh.position.y += b.velocity.y * delta;
        b.mesh.position.z += b.velocity.z * delta;
        b.life -= delta;

        // Check hit NPCs
        let hitNpc = false;
        for (const npc of npcs) {
          if (npc.isDead) continue;
          const dx = b.mesh.position.x - npc.position.x;
          const dy = b.mesh.position.y - (npc.position.y + 1.5);
          const dz = b.mesh.position.z - npc.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 2) {
            const killed = damageNPC(npc, 34);
            if (killed) {
              playNpcDeath();
              player.state.money += 50000;
              player.state.wantedLevel = Math.min(5, player.state.wantedLevel + 1);
            }
            hitNpc = true;
            break;
          }
        }

        if (b.life <= 0 || hitNpc) {
          engine.scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          (b.mesh.material as THREE.Material).dispose();
          bullets.splice(i, 1);
        }
      }

      // Stab ability - T key: teleport behind nearest NPC and assassinate
      if (player.state.stabCooldown > 0) player.state.stabCooldown -= delta;
      if (keys.stab && player.state.stabCooldown <= 0) {
        player.state.stabCooldown = 1.5; // 1.5s cooldown

        // Find nearest alive NPC within range
        let nearestNpc: typeof npcs[0] | null = null;
        let nearestDist = 50; // max range 50
        for (const npc of npcs) {
          if (npc.isDead) continue;
          const dx = player.state.position.x - npc.position.x;
          const dz = player.state.position.z - npc.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestNpc = npc;
          }
        }

        if (nearestNpc) {
          playTeleport();

          // Teleport behind the NPC
          const behindX = nearestNpc.position.x - Math.sin(nearestNpc.rotation) * 2;
          const behindZ = nearestNpc.position.z - Math.cos(nearestNpc.rotation) * 2;
          player.state.position.set(behindX, nearestNpc.position.y, behindZ);
          player.mesh.position.copy(player.state.position);

          // Face the NPC
          const toNpcX = nearestNpc.position.x - player.state.position.x;
          const toNpcZ = nearestNpc.position.z - player.state.position.z;
          player.state.rotation = Math.atan2(toNpcX, toNpcZ);
          player.mesh.rotation.y = player.state.rotation;

          // Instant kill stab
          setTimeout(() => {
            if (nearestNpc && !nearestNpc.isDead) {
              playStab();
              const killed = damageNPC(nearestNpc, 200); // instant kill
              if (killed) {
                playNpcDeath();
                player.state.money += 50000;
                player.state.wantedLevel = Math.min(5, player.state.wantedLevel + 2);
              }
            }
          }, 150);
        }
      }

      // === Multiplayer: send state & update remote players ===
      mpSendTimerRef.current += delta;
      if (mpSendTimerRef.current >= 0.05) { // 20Hz
        mpSendTimerRef.current = 0;
        sendPlayerState({
          position: { x: player.state.position.x, y: player.state.position.y, z: player.state.position.z },
          rotation: player.state.rotation,
          isFlying: player.state.isFlying,
          isShooting: player.state.isShooting,
          isInVehicle: player.state.isInVehicle,
          vehicleType: player.state.currentVehicleId ? (vehicles.find(v => v.id === player.state.currentVehicleId)?.type || null) : null,
          health: player.state.health,
          money: player.state.money,
          wantedLevel: player.state.wantedLevel,
        });
      }

      // Update remote player meshes (interpolation + bullet spawning)
      const { remoteBullets } = updateOtherPlayerMeshes(engine.scene, delta);

      // Spawn remote player bullets
      for (const rb of remoteBullets) {
        const bulletGeo = new THREE.SphereGeometry(0.15, 6, 6);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xff4444 }); // Red for other players
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.copy(rb.origin);
        const vel = rb.direction.normalize().multiplyScalar(80);
        engine.scene.add(bullet);
        bulletsRef.current.push({ mesh: bullet, velocity: vel, life: 2 });
      }

      // Update other players minimap data (throttled with HUD)
      const otherPlayers = getOtherPlayers();
      setOtherPlayersMinimapData(otherPlayers.map(p => ({
        x: p.targetPosition.x,
        z: p.targetPosition.z,
        role: p.role,
      })));

      // Interaction hints
      let hint: string | null = null;
      if (!player.state.isInVehicle) {
        const nearVehicle = findNearestVehicle(vehicles, player.state.position, 5);
        if (nearVehicle) {
          const typeNames: Record<string, string> = {
            police_car: '경찰차',
            sports_car: '스포츠카',
            truck: '트럭',
            motorcycle: '오토바이',
          };
          hint = `[E] ${typeNames[nearVehicle.type] || nearVehicle.type} 탑승`;
        }
        if (player.state.isInJail && isNearPosition(player, escapeCollider.min.clone().add(escapeCollider.max).multiplyScalar(0.5), 4)) {
          hint = '[E] 벽을 부수고 탈옥하기';
        }
        const robberyHint = getNearbyRobberyInfo(player, worldData.robberyLocations);
        if (robberyHint) hint = robberyHint;
      } else {
        hint = '[E] 하차';
      }

      // Update HUD (throttled)
      hudUpdateTimer += delta;
      if (hudUpdateTimer > 0.05) {
        hudUpdateTimer = 0;
        setHudData({
          health: player.state.health,
          maxHealth: player.state.maxHealth,
          money: player.state.money,
          sprintEnergy: player.state.sprintEnergy,
          maxSprintEnergy: player.state.maxSprintEnergy,
          wantedLevel: player.state.wantedLevel,
          isInJail: player.state.isInJail,
          hasEscaped: player.state.hasEscaped,
          isInVehicle: player.state.isInVehicle,
          role: player.state.role,
          position: { x: player.state.position.x, y: player.state.position.y, z: player.state.position.z },
          rotation: player.state.rotation,
          name: player.state.name,
        });
        setInteractionHint(hint);
        setRobberyDisplay({ ...robberyStateRef.current });
        setCurrentVehicle(player.state.currentVehicleId ? vehicles.find((v) => v.id === player.state.currentVehicleId) || null : null);
        setNpcsData(npcs.map((n) => ({ position: { x: n.position.x, z: n.position.z }, state: n.state })));
      }

      // Render
      engine.renderer.render(engine.scene, engine.camera);
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    // Event listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': k.forward = true; break;
        case 'KeyS': case 'ArrowDown': k.backward = true; break;
        case 'KeyA': case 'ArrowLeft': k.left = true; break;
        case 'KeyD': case 'ArrowRight': k.right = true; break;
        case 'Space': k.jump = true; e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': k.sprint = true; break;
        case 'KeyE': k.interact = true; break;
        case 'KeyF': k.shoot = true; break;
        case 'KeyT': k.stab = true; break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': k.forward = false; break;
        case 'KeyS': case 'ArrowDown': k.backward = false; break;
        case 'KeyA': case 'ArrowLeft': k.left = false; break;
        case 'KeyD': case 'ArrowRight': k.right = false; break;
        case 'Space': k.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': k.sprint = false; break;
        case 'KeyE': k.interact = false; break;
        case 'KeyF': k.shoot = false; break;
        case 'KeyT': k.stab = false; break;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && e.button === 0) {
        keysRef.current.shoot = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keysRef.current.shoot = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        const p = playerRef.current;
        if (p) handleMouseMove(p, e.movementX, e.movementY);
      }
    };

    const onWheel = (e: WheelEvent) => {
      const p = playerRef.current;
      if (p) handleScroll(p, e.deltaY);
    };

    const onClick = () => {
      canvas.requestPointerLock();
    };

    const onResize = () => {
      if (engineRef.current) handleResize(engineRef.current);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameRef.current);
      disconnectFromServer();
      if (engineRef.current) disposeEngine(engineRef.current);
    };
  }, []);

  const handleStart = useCallback((config: GameConfig) => {
    setPlayerState(config);
    setGameStarted(true);
  }, []);

  // Initialize game after start screen
  useEffect(() => {
    if (gameStarted && playerState) {
      const cleanup = initGame(playerState);
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [gameStarted, playerState, initGame]);

  const handleMobileJoystick = useCallback((x: number, y: number) => {
    mobileRef.current.joystickX = x;
    mobileRef.current.joystickY = y;
  }, []);

  const handleMobileButton = useCallback(
    (button: 'jump' | 'sprint' | 'interact' | 'shoot' | 'stab', pressed: boolean) => {
      switch (button) {
        case 'jump': mobileRef.current.jumpPressed = pressed; break;
        case 'sprint': mobileRef.current.sprintPressed = pressed; break;
        case 'interact': mobileRef.current.interactPressed = pressed; break;
        case 'shoot': keysRef.current.shoot = pressed; break;
        case 'stab': keysRef.current.stab = pressed; break;
      }
    },
    []
  );

  const handleMobileCameraMove = useCallback((dx: number, dy: number) => {
    const p = playerRef.current;
    if (p) handleMouseMove(p, dx, dy);
  }, []);

  // Build HUD player state object
  const hudPlayerState = {
    name: hudData.name,
    role: hudData.role,
    health: hudData.health,
    maxHealth: hudData.maxHealth,
    money: hudData.money,
    sprintEnergy: hudData.sprintEnergy,
    maxSprintEnergy: hudData.maxSprintEnergy,
    wantedLevel: hudData.wantedLevel,
    isInJail: hudData.isInJail,
    hasEscaped: hudData.hasEscaped,
    isInVehicle: hudData.isInVehicle,
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
    position: new THREE.Vector3(hudData.position.x, hudData.position.y, hudData.position.z),
    velocity: new THREE.Vector3(),
    rotation: hudData.rotation,
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {!gameStarted && <StartScreen onStart={handleStart} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {caughtScreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 pointer-events-none">
          <div className="text-red-500 text-5xl sm:text-7xl font-black animate-pulse mb-4">🚨 체포 🚨</div>
          <div className="text-white text-xl sm:text-3xl font-bold mb-2">경찰에게 잡혔습니다!</div>
          <div className="text-gray-400 text-sm sm:text-lg">감옥으로 이송 중...</div>
          <div className="text-yellow-400 text-sm sm:text-lg mt-4">💰 -1000원</div>
        </div>
      )}

      {gameStarted && (
        <HUD
          player={hudPlayerState}
          vehicles={vehiclesRef.current}
          npcs={npcsData as never}
          robberyLocations={worldDataRef.current?.robberyLocations || []}
          robberyState={robberyDisplay}
          currentVehicle={currentVehicle}
          interactionHint={interactionHint}
          isMobile={isMobile}
          onMobileJoystick={handleMobileJoystick}
          onMobileButton={handleMobileButton}
          onMobileCameraMove={handleMobileCameraMove}
          playerCount={playerCount}
          otherPlayers={otherPlayersMinimapData}
        />
      )}
    </div>
  );
}

// Need THREE import for Vector3 usage in HUD state
import * as THREE from 'three';
