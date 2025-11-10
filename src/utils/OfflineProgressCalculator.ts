/**
 * Calculateur de progression hors-ligne
 * Gère les calculs d'âmes et de vagues gagnées pendant l'absence du joueur
 */

import type { GameSaveData, OfflineProgressResult } from '../types/SaveData';
import { formatTimeElapsed } from './TimeFormatter';

export class OfflineProgressCalculator {
  // Constantes de calcul
  private static readonly WAVE_CYCLE_TIME = 35; // secondes par vague en mode auto
  private static readonly MAX_WAVES_OFFLINE = 100; // Limite de vagues hors-ligne

  /**
   * Calcule les gains hors-ligne depuis la dernière sauvegarde
   * @param saveData Données de la sauvegarde
   * @returns Résultats de la progression hors-ligne
   */
  static calculate(saveData: GameSaveData): OfflineProgressResult {
    const now = Date.now();
    const timeElapsedMs = now - saveData.lastSaveTimestamp;
    const timeElapsedSeconds = Math.floor(timeElapsedMs / 1000);
    const timeElapsedMinutes = Math.floor(timeElapsedSeconds / 60);
    const timeElapsedHours = Math.floor(timeElapsedMinutes / 60);

    // Calculer les âmes gagnées
    const { soulsEarned, cappedSouls } = this.calculateSouls(
      saveData,
      timeElapsedSeconds
    );

    // Calculer les vagues complétées
    const { wavesCompleted, newWaveNumber } = this.calculateWaves(
      saveData,
      now
    );

    return {
      timeElapsedMs,
      timeElapsedSeconds,
      timeElapsedMinutes,
      timeElapsedHours,
      soulsEarned,
      cappedSouls,
      wavesCompleted,
      newWaveNumber
    };
  }

  /**
   * Calcule la production d'âmes hors-ligne
   */
  private static calculateSouls(
    saveData: GameSaveData,
    timeElapsedSeconds: number
  ): { soulsEarned: number; cappedSouls: number } {
    const productionPerSecond = saveData.soulProductionRate * saveData.soulProductionMultiplier;
    const totalSoulsGenerated = productionPerSecond * timeElapsedSeconds;

    console.log('📈 Calcul production hors-ligne:');
    console.log('   - Taux de base:', saveData.soulProductionRate, 'âmes/s');
    console.log('   - Multiplicateur:', saveData.soulProductionMultiplier);
    console.log('   - Production/s:', productionPerSecond);
    console.log('   - Temps écoulé:', timeElapsedSeconds, 's');
    console.log('   - Âmes générées:', totalSoulsGenerated);

    // Appliquer le cap de stockage
    const currentSouls = saveData.soulShards;
    const maxSouls = saveData.maxSoulShards;
    const totalSouls = currentSouls + totalSoulsGenerated;
    const cappedSouls = Math.min(totalSouls, maxSouls);
    const actualGain = cappedSouls - currentSouls;

    console.log('   - Âmes avant:', currentSouls);
    console.log('   - Total calculé:', totalSouls);
    console.log('   - Cap maximum:', maxSouls);
    console.log('   - Âmes après cap:', cappedSouls);
    console.log('   - Gain réel:', actualGain);

    return {
      soulsEarned: actualGain,
      cappedSouls
    };
  }

  /**
   * Calcule les vagues complétées hors-ligne
   */
  private static calculateWaves(
    saveData: GameSaveData,
    now: number
  ): { wavesCompleted: number; newWaveNumber: number } {
    let wavesCompleted = 0;
    let newWaveNumber = saveData.wave;

    console.log('🌊 Analyse des vagues hors-ligne:');
    console.log('   - Mode auto sauvegardé:', saveData.autoWaveMode);
    console.log('   - Timestamp fin vague:', saveData.lastWaveCompletedTimestamp);

    if (!saveData.autoWaveMode || !saveData.lastWaveCompletedTimestamp) {
      console.log('   ❌ Pas de progression de vagues:');
      if (!saveData.autoWaveMode) {
        console.log('      - Raison: Mode auto non activé');
      }
      if (!saveData.lastWaveCompletedTimestamp) {
        console.log('      - Raison: Pas de timestamp enregistré');
      }
      return { wavesCompleted: 0, newWaveNumber: saveData.wave };
    }

    // Temps entre le dernier timestamp et maintenant
    const timeSinceLastWave = now - saveData.lastWaveCompletedTimestamp;
    const secondsSinceLastWave = Math.floor(timeSinceLastWave / 1000);

    // Calculer combien de vagues ont pu être complétées
    const rawWavesCompleted = Math.floor(secondsSinceLastWave / this.WAVE_CYCLE_TIME);

    // Si au moins 1 cycle complet s'est écoulé, on peut compter les vagues
    if (rawWavesCompleted > 0) {
      wavesCompleted = Math.min(rawWavesCompleted, this.MAX_WAVES_OFFLINE);
      newWaveNumber = saveData.wave + wavesCompleted;
    }

      console.log('   ✅ Calcul vagues:');
      console.log('      - Vague sauvegardée:', saveData.wave);
      console.log('      - Temps écoulé:', secondsSinceLastWave, 's (', formatTimeElapsed(secondsSinceLastWave), ')');
      console.log('      - Cycle vague:', this.WAVE_CYCLE_TIME, 's');
      console.log('      - Vagues brutes:', rawWavesCompleted);
      console.log('      - Vagues comptées:', wavesCompleted);
      console.log('      - Nouvelle vague:', newWaveNumber);

    return { wavesCompleted, newWaveNumber };
  }
}

