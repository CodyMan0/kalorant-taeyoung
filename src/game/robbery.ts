import { RobberyLocation } from './types';
import { PlayerController, isInTrigger } from './player';
import { playRobberyAlarm, playCoinCollect } from './audio';

export interface RobberyState {
  activeRobbery: RobberyLocation | null;
  showProgressBar: boolean;
  progressPercent: number;
  message: string;
  messageTimer: number;
}

export function createRobberyState(): RobberyState {
  return {
    activeRobbery: null,
    showProgressBar: false,
    progressPercent: 0,
    message: '',
    messageTimer: 0,
  };
}

export function attemptRobbery(
  player: PlayerController,
  locations: RobberyLocation[],
  robberyState: RobberyState
): void {
  if (robberyState.activeRobbery) return;

  for (const loc of locations) {
    if (loc.cooldownTimer > 0) continue;
    if (loc.isBeingRobbed) continue;

    if (isInTrigger(player, loc.triggerZone)) {
      loc.isBeingRobbed = true;
      loc.robberyProgress = 0;
      robberyState.activeRobbery = loc;
      robberyState.showProgressBar = true;
      robberyState.progressPercent = 0;
      robberyState.message = `${loc.name} 강도 진행 중...`;
      robberyState.messageTimer = 10;
      playRobberyAlarm();
      return;
    }
  }
}

export function updateRobbery(
  player: PlayerController,
  robberyState: RobberyState,
  delta: number
): { moneyEarned: number; wantedIncrease: number } {
  let moneyEarned = 0;
  let wantedIncrease = 0;

  // Update message timer
  if (robberyState.messageTimer > 0) {
    robberyState.messageTimer -= delta;
    if (robberyState.messageTimer <= 0) {
      robberyState.message = '';
    }
  }

  const loc = robberyState.activeRobbery;
  if (!loc) return { moneyEarned, wantedIncrease };

  // Check if player left the area
  if (!isInTrigger(player, loc.triggerZone)) {
    cancelRobbery(robberyState);
    robberyState.message = '범위를 벗어나 강도가 취소되었습니다!';
    robberyState.messageTimer = 3;
    return { moneyEarned, wantedIncrease };
  }

  // Progress the robbery
  loc.robberyProgress += delta;
  robberyState.progressPercent = Math.min(100, (loc.robberyProgress / loc.robberyDuration) * 100);

  if (loc.robberyProgress >= loc.robberyDuration) {
    // Robbery complete!
    moneyEarned = loc.reward;
    wantedIncrease = loc.id === 'bank' ? 2 : 1;

    loc.isBeingRobbed = false;
    loc.robberyProgress = 0;
    loc.cooldownTimer = loc.cooldownDuration;

    robberyState.activeRobbery = null;
    robberyState.showProgressBar = false;
    robberyState.progressPercent = 0;
    robberyState.message = `${loc.name} 강도 성공! +$${moneyEarned.toLocaleString()}`;
    robberyState.messageTimer = 4;

    playCoinCollect();
  }

  return { moneyEarned, wantedIncrease };
}

function cancelRobbery(robberyState: RobberyState): void {
  if (robberyState.activeRobbery) {
    robberyState.activeRobbery.isBeingRobbed = false;
    robberyState.activeRobbery.robberyProgress = 0;
    robberyState.activeRobbery = null;
  }
  robberyState.showProgressBar = false;
  robberyState.progressPercent = 0;
}

export function updateCooldowns(locations: RobberyLocation[], delta: number): void {
  for (const loc of locations) {
    if (loc.cooldownTimer > 0) {
      loc.cooldownTimer -= delta;
    }
  }
}

export function getNearbyRobberyInfo(
  player: PlayerController,
  locations: RobberyLocation[]
): string | null {
  for (const loc of locations) {
    if (isInTrigger(player, loc.triggerZone)) {
      if (loc.cooldownTimer > 0) {
        return `${loc.name} - 쿨다운 ${Math.ceil(loc.cooldownTimer)}초`;
      }
      if (loc.isBeingRobbed) {
        return `${loc.name} - 강도 진행 중...`;
      }
      return `[E] ${loc.name} 강도하기 (+$${loc.reward.toLocaleString()})`;
    }
  }
  return null;
}
