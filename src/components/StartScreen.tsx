'use client';

import { useState } from 'react';
import { GameConfig } from '@/game/types';

interface StartScreenProps {
  onStart: (config: GameConfig) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [name, setName] = useState('');
  const [showControls, setShowControls] = useState(false);

  const handleStart = () => {
    if (!name.trim()) return;
    onStart({ playerName: name.trim(), role: 'prisoner' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      {/* Animated background bars */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-full w-1 bg-yellow-500"
            style={{
              left: `${i * 9}%`,
              animationDelay: `${i * 0.1}s`,
              animation: 'pulse 2s ease-in-out infinite alternate',
              opacity: 0.3 + (i % 3) * 0.2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-4 py-6 sm:px-4">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 drop-shadow-lg">
            JAILBREAK
          </h1>
          <p className="mt-2 text-base sm:text-xl text-yellow-300/80 font-semibold tracking-widest">
            탈옥 대작전
          </p>
        </div>

        {!showControls ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            {/* Name input */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                플레이어 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요..."
                maxLength={12}
                className="w-full px-4 py-3 bg-gray-800/80 border-2 border-gray-600 rounded-lg text-white text-lg focus:outline-none focus:border-yellow-500 transition-colors placeholder:text-gray-500"
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
            </div>

            {/* Buttons */}
            <button
              onClick={handleStart}
              disabled={!name.trim()}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-xl rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              게임 시작
            </button>

            <button
              onClick={() => setShowControls(true)}
              className="text-gray-400 hover:text-white transition-colors text-sm underline"
            >
              조작법 보기
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm sm:max-w-md">
            <div className="w-full bg-gray-800/80 rounded-lg p-6 border border-gray-700 max-h-[60vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-yellow-400 mb-4 text-center">
                조작법
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="text-gray-400">이동</div>
                <div className="text-white">WASD / 방향키</div>
                <div className="text-gray-400">점프</div>
                <div className="text-white">스페이스바 (2단 점프)</div>
                <div className="text-gray-400">달리기</div>
                <div className="text-white">Shift</div>
                <div className="text-gray-400">상호작용</div>
                <div className="text-white">E (탈옥/탑승/강도)</div>
                <div className="text-gray-400">카메라</div>
                <div className="text-white">마우스 (클릭 후)</div>
                <div className="text-gray-400">줌</div>
                <div className="text-white">마우스 휠</div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-bold text-blue-400 mb-2">차량</h3>
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="text-gray-400">탑승/하차</div>
                  <div className="text-white">E (차량 근처)</div>
                  <div className="text-gray-400">가속</div>
                  <div className="text-white">W</div>
                  <div className="text-gray-400">브레이크/후진</div>
                  <div className="text-white">S</div>
                  <div className="text-gray-400">조향</div>
                  <div className="text-white">A / D</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                <p className="text-gray-400 text-xs">모바일: 가상 조이스틱 + 버튼</p>
              </div>
            </div>
            <button
              onClick={() => setShowControls(false)}
              className="text-yellow-400 hover:text-yellow-300 transition-colors font-semibold"
            >
              돌아가기
            </button>
          </div>
        )}

        <p className="text-gray-600 text-xs">v1.0 - Three.js + Next.js</p>
      </div>
    </div>
  );
}
