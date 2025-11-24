/**
 * Types et interfaces pour le système de sauvegarde
 */

/**
 * Interface pour sauvegarder un allié individuel
 */
export interface SavedAlly {
  kind: 'knight' | 'watcher' | 'arbalest';
  x: number;
  y: number;
  level: number;
  kills: number;
  hp: number;
}

/**
 * Interface pour sauvegarder un bâtiment individuel
 */
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

/**
 * Interface pour les données de sauvegarde du jeu
 */
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

  // Liste complète des bâtiments avec leur position
  buildings: SavedBuilding[];

  // Liste des alliés
  allies?: SavedAlly[];

  // Progression des vagues hors-ligne
  autoWaveMode: boolean; // Mode automatique activé ?
  autoRecruitEnabled?: boolean;
  lastWaveCompletedTimestamp?: number; // Timestamp de la dernière vague terminée

  // Timestamp de sauvegarde
  lastSaveTimestamp: number;

  // Version de sauvegarde (pour compatibilité future)
  version: number;
}

/**
 * Interface pour les résultats de calcul de progression hors-ligne
 */
export interface OfflineProgressResult {
  timeElapsedMs: number;
  timeElapsedSeconds: number;
  timeElapsedMinutes: number;
  timeElapsedHours: number;
  soulsEarned: number;
  cappedSouls: number;
  wavesCompleted: number;
  newWaveNumber: number;
}
