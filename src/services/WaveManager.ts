/**
 * WaveManager: Gestion des vagues
 */

import { GameState } from './GameState';

export class WaveManager {
  private static instance: WaveManager;
  private gameState: GameState;

  private constructor() {
    this.gameState = GameState.getInstance();
  }

  public static getInstance(): WaveManager {
    if (!WaveManager.instance) {
      WaveManager.instance = new WaveManager();
    }
    return WaveManager.instance;
  }

  public startWave(): any {
    const currentWave = this.gameState.get('wave');
    const nextWave = currentWave + 1;

    this.gameState.set('wave', nextWave);
    this.gameState.set('waveActive', true);

    return {
      waveNumber: nextWave,
      totalEnemies: 5 + (nextWave - 1) * 2,
      bossCount: nextWave % 5 === 0 ? 1 : 0,
      reward: Math.floor(20 * Math.pow(1.5, nextWave / 5))
    };
  }

  public isWaveActive(): boolean {
    return this.gameState.get('waveActive');
  }

  public reset(): void {
    console.log('WaveManager reset');
  }
}

