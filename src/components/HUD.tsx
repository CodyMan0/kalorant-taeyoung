'use client';

import { useEffect, useRef, useCallback } from 'react';
import { PlayerState, Vehicle, NPC, RobberyLocation } from '@/game/types';
import { RobberyState } from '@/game/robbery';

interface HUDProps {
  player: PlayerState;
  vehicles: Vehicle[];
  npcs: NPC[];
  robberyLocations: RobberyLocation[];
  robberyState: RobberyState;
  currentVehicle: Vehicle | null;
  interactionHint: string | null;
  isMobile: boolean;
  onMobileJoystick: (x: number, y: number) => void;
  onMobileButton: (button: 'jump' | 'sprint' | 'interact' | 'shoot' | 'stab', pressed: boolean) => void;
  onMobileCameraMove: (dx: number, dy: number) => void;
  playerCount?: number;
  otherPlayers?: { x: number; z: number; role: string }[];
}

export default function HUD({
  player,
  npcs,
  robberyLocations,
  robberyState,
  currentVehicle,
  interactionHint,
  isMobile,
  onMobileJoystick,
  onMobileButton,
  onMobileCameraMove,
  playerCount = 0,
  otherPlayers = [],
}: HUDProps) {
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const joystickRef = useRef<{ active: boolean; startX: number; startY: number; id: number | null }>({
    active: false,
    startX: 0,
    startY: 0,
    id: null,
  });
  const cameraRef = useRef<{ active: boolean; lastX: number; lastY: number; id: number | null }>({
    active: false,
    lastX: 0,
    lastY: 0,
    id: null,
  });

  // Minimap drawing
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const scale = 0.4;

    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, size, size);

    // Roads (simplified)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    const toMap = (x: number, z: number): [number, number] => {
      const mx = size / 2 + (x - player.position.x) * scale;
      const mz = size / 2 + (z - player.position.z) * scale;
      return [mx, mz];
    };

    // Buildings
    const buildings = [
      { x: -80, z: -80, color: '#666', label: '교도소' },
      { x: 30, z: -30, color: '#d4a843', label: '은행' },
      { x: -30, z: 30, color: '#933', label: '보석상' },
      { x: 60, z: 60, color: '#22a', label: '경찰서' },
    ];
    buildings.forEach((b) => {
      const [bx, bz] = toMap(b.x, b.z);
      if (bx > -10 && bx < size + 10 && bz > -10 && bz < size + 10) {
        ctx.fillStyle = b.color;
        ctx.fillRect(bx - 5, bz - 5, 10, 10);
      }
    });

    // Robbery locations
    robberyLocations.forEach((loc) => {
      const [rx, rz] = toMap(loc.position.x, loc.position.z);
      if (rx > 0 && rx < size && rz > 0 && rz < size) {
        ctx.fillStyle = loc.cooldownTimer > 0 ? '#555' : '#ff0';
        ctx.beginPath();
        ctx.arc(rx, rz, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // NPCs
    npcs.forEach((npc) => {
      const [nx, nz] = toMap(npc.position.x, npc.position.z);
      if (nx > 0 && nx < size && nz > 0 && nz < size) {
        ctx.fillStyle = npc.state === 'chase' ? '#f00' : '#44f';
        ctx.beginPath();
        ctx.arc(nx, nz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Other multiplayer players
    otherPlayers.forEach((op) => {
      const [ox, oz] = toMap(op.x, op.z);
      if (ox > 0 && ox < size && oz > 0 && oz < size) {
        ctx.fillStyle = op.role === 'prisoner' ? '#f90' : '#48f';
        ctx.beginPath();
        ctx.arc(ox, oz, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });

    // Player (always center)
    ctx.fillStyle = player.role === 'prisoner' ? '#f60' : '#22f';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Direction indicator
    const dirX = size / 2 + Math.sin(player.rotation) * 8;
    const dirZ = size / 2 + Math.cos(player.rotation) * 8;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(dirX, dirZ);
    ctx.stroke();

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  });

  // Mobile joystick handlers
  const handleJoystickStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      joystickRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        id: touch.identifier,
      };
    },
    []
  );

  const handleJoystickMove = useCallback(
    (e: React.TouchEvent) => {
      if (!joystickRef.current.active) return;
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === joystickRef.current.id
      );
      if (!touch) return;
      const dx = (touch.clientX - joystickRef.current.startX) / 50;
      const dy = (touch.clientY - joystickRef.current.startY) / 50;
      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));
      onMobileJoystick(clampedX, clampedY);
    },
    [onMobileJoystick]
  );

  const handleJoystickEnd = useCallback(() => {
    joystickRef.current.active = false;
    joystickRef.current.id = null;
    onMobileJoystick(0, 0);
  }, [onMobileJoystick]);

  // Camera touch on right side
  const handleCameraStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    cameraRef.current = {
      active: true,
      lastX: touch.clientX,
      lastY: touch.clientY,
      id: touch.identifier,
    };
  }, []);

  const handleCameraMove = useCallback(
    (e: React.TouchEvent) => {
      if (!cameraRef.current.active) return;
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === cameraRef.current.id
      );
      if (!touch) return;
      const dx = touch.clientX - cameraRef.current.lastX;
      const dy = touch.clientY - cameraRef.current.lastY;
      cameraRef.current.lastX = touch.clientX;
      cameraRef.current.lastY = touch.clientY;
      onMobileCameraMove(dx * 2, dy * 2);
    },
    [onMobileCameraMove]
  );

  const handleCameraEnd = useCallback(() => {
    cameraRef.current.active = false;
    cameraRef.current.id = null;
  }, []);

  const stars = '★'.repeat(player.wantedLevel) + '☆'.repeat(5 - player.wantedLevel);

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* Top-left: Health & Sprint */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-2">
        {/* Health bar */}
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-[10px] sm:text-sm font-bold w-6">HP</span>
          <div className="w-24 sm:w-36 h-3 sm:h-4 bg-gray-800/80 rounded-full overflow-hidden border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
              style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
            />
          </div>
          <span className="text-white text-[10px] sm:text-xs">{Math.round(player.health)}</span>
        </div>
        {/* Sprint bar */}
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-[10px] sm:text-sm font-bold w-6">SP</span>
          <div className="w-24 sm:w-36 h-2 sm:h-3 bg-gray-800/80 rounded-full overflow-hidden border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-200"
              style={{
                width: `${(player.sprintEnergy / player.maxSprintEnergy) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Top-right: Money & Wanted level */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col items-end gap-2">
        {playerCount > 0 && (
          <div className="bg-gray-900/80 px-3 py-1 rounded-lg border border-cyan-700">
            <span className="text-cyan-400 font-bold text-xs sm:text-sm">
              👥 {playerCount}/20
            </span>
          </div>
        )}
        <div className="bg-gray-900/80 px-2 py-1 sm:px-4 sm:py-2 rounded-lg border border-gray-700">
          <span className="text-green-400 font-bold text-base sm:text-lg">
            $ {player.money.toLocaleString()}
          </span>
        </div>
        <div className="bg-gray-900/80 px-3 py-1 rounded-lg border border-gray-700">
          <span className="text-yellow-400 text-base sm:text-lg tracking-wider">{stars}</span>
        </div>
        {player.isInJail && (
          <div className="bg-red-900/80 px-3 py-1 rounded-lg border border-red-700 animate-pulse">
            <span className="text-red-300 text-sm font-bold">수감 중</span>
          </div>
        )}
        {player.role === 'police' && (
          <div className="bg-blue-900/80 px-2 py-1 sm:px-3 sm:py-1 rounded-lg border border-blue-500">
            <span className="text-blue-300 text-xs sm:text-sm font-bold">👮 경찰</span>
          </div>
        )}
      </div>

      {/* Minimap - bottom right */}
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4">
        <canvas
          ref={minimapRef}
          width={140}
          height={140}
          className="rounded-lg border-2 border-gray-600 opacity-80 w-[100px] h-[100px] sm:w-[140px] sm:h-[140px]"
        />
      </div>

      {/* Vehicle speed */}
      {currentVehicle && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/80 px-4 py-2 sm:px-6 sm:py-3 rounded-lg border border-gray-600">
          <div className="text-center">
            <div className="text-gray-400 text-xs">속도</div>
            <div className="text-white text-xl sm:text-2xl font-bold">
              {Math.abs(Math.round(currentVehicle.speed))} km/h
            </div>
          </div>
        </div>
      )}

      {/* Interaction hint */}
      {interactionHint && (
        <div className="absolute bottom-16 sm:bottom-24 left-1/2 -translate-x-1/2 bg-gray-900/90 px-3 py-2 sm:px-5 sm:py-3 rounded-lg border border-yellow-600 animate-pulse">
          <span className="text-yellow-300 text-xs sm:text-sm font-semibold">
            {interactionHint}
          </span>
        </div>
      )}

      {/* Robbery progress bar */}
      {robberyState.showProgressBar && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-gray-900/90 px-4 py-3 sm:px-8 sm:py-4 rounded-lg border border-red-600">
            <div className="text-red-400 text-sm font-bold mb-2 text-center">
              강도 진행 중...
            </div>
            <div className="w-36 sm:w-48 h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-100"
                style={{ width: `${robberyState.progressPercent}%` }}
              />
            </div>
            <div className="text-center text-gray-400 text-xs mt-1">
              {Math.round(robberyState.progressPercent)}%
            </div>
          </div>
        </div>
      )}

      {/* Robbery message */}
      {robberyState.message && !robberyState.showProgressBar && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 px-6 py-3 rounded-lg border border-yellow-500">
          <span className="text-yellow-300 font-bold">{robberyState.message}</span>
        </div>
      )}

      {/* Mobile controls */}
      {isMobile && (
        <>
          {/* Joystick area - left side */}
          <div
            className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/10 border-2 border-white/30 pointer-events-auto touch-none"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/30 border border-white/50" />
          </div>

          {/* Camera area - right middle */}
          <div
            className="absolute top-0 right-0 w-1/3 h-2/3 pointer-events-auto touch-none"
            onTouchStart={handleCameraStart}
            onTouchMove={handleCameraMove}
            onTouchEnd={handleCameraEnd}
          />

          {/* Action buttons - right side */}
          <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 grid grid-cols-2 gap-2 sm:gap-3 pointer-events-auto">
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600/60 border-2 border-red-400 text-white font-bold text-[10px] sm:text-xs active:bg-red-500/80"
              onTouchStart={() => onMobileButton('shoot', true)}
              onTouchEnd={() => onMobileButton('shoot', false)}
            >
              🔫
            </button>
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600/60 border-2 border-blue-400 text-white font-bold text-[10px] sm:text-xs active:bg-blue-500/80"
              onTouchStart={() => onMobileButton('jump', true)}
              onTouchEnd={() => onMobileButton('jump', false)}
            >
              점프
            </button>
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-600/60 border-2 border-purple-400 text-white font-bold text-[10px] sm:text-xs active:bg-purple-500/80"
              onTouchStart={() => onMobileButton('stab', true)}
              onTouchEnd={() => onMobileButton('stab', false)}
            >
              🗡️
            </button>
            <button
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-yellow-600/60 border-2 border-yellow-400 text-white font-bold text-[10px] sm:text-xs active:bg-yellow-500/80"
              onTouchStart={() => onMobileButton('sprint', true)}
              onTouchEnd={() => onMobileButton('sprint', false)}
            >
              달리기
            </button>
            <button
              className="col-span-2 h-14 sm:h-16 rounded-full bg-green-600/60 border-2 border-green-400 text-white font-bold text-[10px] sm:text-xs active:bg-green-500/80"
              onTouchStart={() => onMobileButton('interact', true)}
              onTouchEnd={() => onMobileButton('interact', false)}
            >
              E
            </button>
          </div>
        </>
      )}
    </div>
  );
}
