/**
 * OfflineProgressCalculator: Calcule la progression quand le jeu est fermé
 * 
 * Responsabilités:
 * - Détecter le temps passé hors ligne
 * - Calculer les âmes gagnées pendant l'absence
 * - Calculer les vagues complétées en mode auto
 */

import type { GameSaveData, OfflineProgressResult } from '../types/SaveData';

export class OfflineProgressCalculator {
  private static readonly MAX_OFFLINE_TIME = 8 * 60 * 60 * 1000; // 8 heures max
  private static readonly SECONDS_PER_WAVE_AUTO = 30; // 30 secondes par vague en mode auto

  /**
   * Calcule la progression hors ligne
   */
  public static calculate(saveData: GameSaveData): OfflineProgressResult {
    const now = Date.now();
    const timeElapsedMs = now - saveData.lastSaveTimestamp;
    const cappedTimeMs = Math.min(timeElapsedMs, this.MAX_OFFLINE_TIME);
    
    const timeElapsedSeconds = Math.floor(cappedTimeMs / 1000);
    const timeElapsedMinutes = Math.floor(timeElapsedSeconds / 60);
    const timeElapsedHours = Math.floor(timeElapsedMinutes / 60);

    // Calculer les âmes gagnées
    const productionPerSecond = saveData.soulProductionRate * saveData.soulProductionMultiplier;
    let soulsEarned = Math.floor(productionPerSecond * timeElapsedSeconds);

    // Calculer les vagues complétées en mode auto
    let wavesCompleted = 0;
    if (saveData.autoWaveMode && saveData.lastWaveCompletedTimestamp) {
      const timeSinceLastWave = now - saveData.lastWaveCompletedTimestamp;
      const cappedTimeSinceWave = Math.min(timeSinceLastWave, this.MAX_OFFLINE_TIME);
      wavesCompleted = Math.floor(cappedTimeSinceWave / 1000 / this.SECONDS_PER_WAVE_AUTO);
    }

    const newWaveNumber = saveData.wave + wavesCompleted;

    // Ne pas dépasser la capacité max
    const currentSouls = saveData.soulShards;
    const maxSouls = saveData.maxSoulShards;
    const cappedSouls = Math.min(currentSouls + soulsEarned, maxSouls);
    soulsEarned = cappedSouls - currentSouls;

    return {
      timeElapsedMs: cappedTimeMs,
      timeElapsedSeconds,
      timeElapsedMinutes,
      timeElapsedHours,
      soulsEarned,
      cappedSouls,
      wavesCompleted,
      newWaveNumber
    };
  }
}

