/**
 * Système de sauvegarde et de persistance pour Veil of Shadows
 * Gère la sauvegarde locale et le calcul des gains hors-ligne
 */

// Interface pour sauvegarder un bâtiment individuel
export interface SavedBuilding {
  type: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  upgradeLevel?: number;
  // Propriétés spécifiques
  fireRateMul?: number; // Pour les tours
  damageMul?: number;   // Pour les tours
  yieldMul?: number;    // Pour les générateurs
  capInc?: number;      // Pour les réserves
}

export interface GameSaveData {
  // Ressources
  soulShards: number;
  maxSoulShards: number;

  // Progression
  wave: number;
  sanctuaryHP: number;

  // Économie
  towerCost: number;

  // Production passive
  soulProductionRate: number;
  soulProductionMultiplier: number;

  // Bâtiments construits (comptes)
  forgeCount: number;
  barracksCount: number;

  // NOUVEAU: Liste complète des bâtiments avec leur position
  buildings: SavedBuilding[];

  // Progression des vagues hors-ligne
  autoWaveMode: boolean; // Mode automatique activé ?
  lastWaveCompletedTimestamp?: number; // Timestamp de la dernière vague terminée

  // Timestamp de sauvegarde
  lastSaveTimestamp: number;

  // Version de sauvegarde (pour compatibilité future)
  version: number;
}

export class SaveSystem {
  private static readonly SAVE_KEY = 'veilOfShadows_save';
  private static readonly SAVE_VERSION = 1;

  /**
   * Sauvegarde l'état actuel du jeu
   */
  static save(registry: Phaser.Data.DataManager, buildingsData?: SavedBuilding[]): void {
    const autoWaveMode = (registry.get('autoWaveMode') as boolean) ?? false;
    const waveActive = (registry.get('waveActive') as boolean) ?? false;
    const currentWave = (registry.get('wave') as number) ?? 0;

    // NOUVEAU: Enregistrer le timestamp dès que le mode auto est actif
    // Même si une vague est en cours, on veut calculer la progression hors-ligne
    const timestamp = autoWaveMode ? Date.now() : undefined;

    const saveData: GameSaveData = {
      soulShards: (registry.get('soulShards') as number) ?? 100,
      maxSoulShards: (registry.get('maxSoulShards') as number) ?? 100,
      wave: currentWave,
      sanctuaryHP: (registry.get('sanctuaryHP') as number) ?? 5,
      towerCost: (registry.get('towerCost') as number) ?? 25,
      soulProductionRate: (registry.get('soulProductionRate') as number) ?? 0.5,
      soulProductionMultiplier: (registry.get('soulProductionMultiplier') as number) ?? 1.0,
      forgeCount: (registry.get('forgeCount') as number) ?? 0,
      barracksCount: (registry.get('barracksCount') as number) ?? 0,
      buildings: buildingsData ?? [],
      autoWaveMode: autoWaveMode,
      // Si le mode auto est activé, toujours enregistrer le timestamp (même si vague en cours)
      lastWaveCompletedTimestamp: timestamp,
      lastSaveTimestamp: Date.now(),
      version: SaveSystem.SAVE_VERSION
    };

    try {
      localStorage.setItem(SaveSystem.SAVE_KEY, JSON.stringify(saveData));
      console.log('💾 Jeu sauvegardé ! Âmes:', saveData.soulShards, '| Vague:', saveData.wave, '| Bâtiments:', saveData.buildings.length,
                  '| Auto:', autoWaveMode, '| Active:', waveActive, '| Timestamp:', timestamp ? '✅' : '❌');
    } catch (error) {
      console.error('❌ Erreur de sauvegarde:', error);
    }
  }

  /**
   * Charge la sauvegarde existante
   */
  static load(): GameSaveData | null {
    try {
      const saveString = localStorage.getItem(SaveSystem.SAVE_KEY);
      if (!saveString) return null;

      const saveData = JSON.parse(saveString) as GameSaveData;

      // Vérifier la version
      if (saveData.version !== SaveSystem.SAVE_VERSION) {
        console.warn('⚠️ Version de sauvegarde incompatible');
        return null;
      }

      // IMPORTANT: Initialiser buildings si la propriété n'existe pas (ancienne sauvegarde)
      if (!saveData.buildings) {
        console.warn('⚠️ Ancienne sauvegarde détectée - initialisation buildings: []');
        saveData.buildings = [];
      }

      console.log('📂 Sauvegarde chargée ! Bâtiments:', saveData.buildings?.length ?? 0);
      return saveData;
    } catch (error) {
      console.error('❌ Erreur de chargement:', error);
      return null;
    }
  }

  /**
   * Calcule les gains hors-ligne depuis la dernière sauvegarde
   */
  static calculateOfflineProgress(saveData: GameSaveData): {
    timeElapsedMs: number;
    timeElapsedSeconds: number;
    timeElapsedMinutes: number;
    timeElapsedHours: number;
    soulsEarned: number;
    cappedSouls: number;
    wavesCompleted: number;
    newWaveNumber: number;
  } {
    const now = Date.now();
    const timeElapsedMs = now - saveData.lastSaveTimestamp;
    const timeElapsedSeconds = Math.floor(timeElapsedMs / 1000);
    const timeElapsedMinutes = Math.floor(timeElapsedSeconds / 60);
    const timeElapsedHours = Math.floor(timeElapsedMinutes / 60);

    // Calculer la production d'âmes (rate * multiplier * secondes)
    const productionPerSecond = saveData.soulProductionRate * saveData.soulProductionMultiplier;
    const soulsEarned = productionPerSecond * timeElapsedSeconds;

    console.log('📈 Calcul production hors-ligne:');
    console.log('   - Taux de base:', saveData.soulProductionRate, 'âmes/s');
    console.log('   - Multiplicateur:', saveData.soulProductionMultiplier);
    console.log('   - Production/s:', productionPerSecond);
    console.log('   - Temps écoulé:', timeElapsedSeconds, 's');
    console.log('   - Âmes générées:', soulsEarned);

    // Appliquer le cap de stockage
    const currentSouls = saveData.soulShards;
    const maxSouls = saveData.maxSoulShards;
    const totalSouls = currentSouls + soulsEarned;
    const cappedSouls = Math.min(totalSouls, maxSouls);
    const actualGain = cappedSouls - currentSouls;

    console.log('   - Âmes avant:', currentSouls);
    console.log('   - Total calculé:', totalSouls);
    console.log('   - Cap maximum:', maxSouls);
    console.log('   - Âmes après cap:', cappedSouls);
    console.log('   - Gain réel:', actualGain);

    // Calculer la progression des vagues automatiques
    let wavesCompleted = 0;
    let newWaveNumber = saveData.wave;

    console.log('🌊 Analyse des vagues hors-ligne:');
    console.log('   - Mode auto sauvegardé:', saveData.autoWaveMode);
    console.log('   - Timestamp fin vague:', saveData.lastWaveCompletedTimestamp);

    if (saveData.autoWaveMode && saveData.lastWaveCompletedTimestamp) {
      // Temps entre le dernier timestamp et maintenant
      const timeSinceLastWave = now - saveData.lastWaveCompletedTimestamp;
      const secondsSinceLastWave = Math.floor(timeSinceLastWave / 1000);

      // Dans le jeu, il y a 5 secondes d'attente entre les vagues en mode auto
      // Durée estimée d'une vague : ~30 secondes (avec tours qui défendent)
      // Total : ~35 secondes par vague en mode auto
      const WAVE_CYCLE_TIME = 35; // secondes

      // Calculer combien de vagues ont pu être complétées
      // On soustrait 1 vague car on suppose que vous étiez peut-être en train de faire une vague
      // Cela évite de sur-compter si vous fermez pendant une vague
      const rawWavesCompleted = Math.floor(secondsSinceLastWave / WAVE_CYCLE_TIME);

      // Si au moins 1 cycle complet s'est écoulé, on peut compter les vagues
      if (rawWavesCompleted > 0) {
        wavesCompleted = rawWavesCompleted;
        newWaveNumber = saveData.wave + wavesCompleted;
      }

      // Limiter à un maximum raisonnable (ex: max 100 vagues d'avance)
      if (wavesCompleted > 100) {
        wavesCompleted = 100;
        newWaveNumber = saveData.wave + 100;
      }

      console.log('   ✅ Calcul vagues:');
      console.log('      - Vague sauvegardée:', saveData.wave);
      console.log('      - Temps écoulé:', secondsSinceLastWave, 's (', SaveSystem.formatTimeElapsed(secondsSinceLastWave), ')');
      console.log('      - Cycle vague:', WAVE_CYCLE_TIME, 's');
      console.log('      - Vagues brutes:', rawWavesCompleted);
      console.log('      - Vagues comptées:', wavesCompleted);
      console.log('      - Nouvelle vague:', newWaveNumber);
    } else {
      console.log('   ❌ Pas de progression de vagues:');
      if (!saveData.autoWaveMode) {
        console.log('      - Raison: Mode auto non activé');
      }
      if (!saveData.lastWaveCompletedTimestamp) {
        console.log('      - Raison: Pas de timestamp enregistré');
      }
    }

    return {
      timeElapsedMs,
      timeElapsedSeconds,
      timeElapsedMinutes,
      timeElapsedHours,
      soulsEarned: actualGain,
      cappedSouls,
      wavesCompleted,
      newWaveNumber
    };
  }

  /**
   * Formate le temps écoulé en texte lisible
   */
  static formatTimeElapsed(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Supprime la sauvegarde
   */
  static deleteSave(): void {
    localStorage.removeItem(SaveSystem.SAVE_KEY);
    console.log('🗑️ Sauvegarde supprimée');
  }

  /**
   * Vérifie si une sauvegarde existe
   */
  static hasSave(): boolean {
    return localStorage.getItem(SaveSystem.SAVE_KEY) !== null;
  }

  /**
   * Réinitialise complètement le jeu (supprime la sauvegarde et recharge la page)
   */
  static resetGame(): void {
    console.log('🔄 Réinitialisation complète du jeu...');
    this.deleteSave();
    // Recharger la page pour un reset complet
    window.location.reload();
  }
}

