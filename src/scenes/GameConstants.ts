/**
 * Constantes de gameplay pour GameScene
 * Centralise toutes les valeurs configurables du jeu
 */

export class GameConstants {
  // ========== GRILLE ET DIMENSIONS ==========
  static readonly TILE_SIZE = 64;
  static readonly GAME_AREA_WIDTH = 800;
  static readonly GAME_AREA_HEIGHT = 600;
  static readonly UI_MARGIN_LEFT = 250;
  static readonly UI_MARGIN_TOP = 50;

  // ========== ENNEMIS ==========
  static readonly ENEMY_SPEED = 80;
  static readonly ENEMY_DPS = 30; // Dégâts par seconde infligés aux bâtiments
  static readonly ATTACK_RANGE = 28; // Rayon pour contact avec bâtiment 48x48
  static readonly SHARD_REWARD = 5; // Récompense par kill

  // ========== MINI-BOSS (tous les 5 niveaux) ==========
  static readonly BOSS_WAVE_INTERVAL = 5; // Apparaît toutes les 5 vagues
  static readonly BOSS_HP_MULTIPLIER = 5; // 5x plus de HP
  static readonly BOSS_SPEED_MULTIPLIER = 1.3; // 30% plus rapide
  static readonly BOSS_DPS_MULTIPLIER = 2; // 2x plus de dégâts
  static readonly BOSS_SIZE_MULTIPLIER = 1.8; // 80% plus gros
  static readonly BOSS_REWARD_MULTIPLIER = 10; // 10x la récompense normale

  // ========== TOURS ==========
  static readonly TOWER_RANGE = 160; // Portée en pixels
  static readonly TOWER_FIRE_RATE = 500; // ms entre deux tirs
  static readonly BULLET_SPEED = 300; // pixels/s

  // ========== GÉNÉRATEURS ==========
  static readonly GENERATOR_TICK_MS = 2000; // Production toutes les 2s
  static readonly GENERATOR_YIELD = 2; // Éclats produits par tick

  // ========== PRODUCTION PASSIVE ==========
  static readonly PASSIVE_SOUL_RATE = 0.5; // Âmes par seconde (base)

  // ========== CAMPFIRES (AURAS) ==========
  static readonly CAMPFIRE_RADIUS = 120;
  static readonly CAMPFIRE_HEAL = 5; // PV par tick
  static readonly CAMPFIRE_TICK_MS = 1500;

  // ========== COÛTS INITIAUX ==========
  static readonly INITIAL_TOWER_COST = 25;
  static readonly INITIAL_WALL_COST = 5;
  static readonly INITIAL_GENERATOR_COST = 40;
  static readonly INITIAL_CAMPFIRE_COST = 35;
  static readonly INITIAL_FORGE_COST = 60;
  static readonly INITIAL_STORAGE_COST = 45;
  static readonly INITIAL_BARRACKS_COST = 70;

  // ========== UNITÉS ==========
  static readonly UNIT_DEFS = {
    knight: {
      cost: 20,
      trainMs: 2000,
      speed: 110,
      atkRange: 20,
      atkRateMs: 700,
      role: 'melee' as const
    },
    watcher: {
      cost: 35,
      trainMs: 3000,
      speed: 125,
      atkRange: 26,
      atkRateMs: 550,
      role: 'melee' as const
    },
    arbalest: {
      cost: 30,
      trainMs: 2500,
      speed: 120,
      atkRange: 180,
      atkRateMs: 800,
      role: 'ranged' as const
    }
  };

  // ========== SAUVEGARDE ==========
  static readonly AUTO_SAVE_INTERVAL_MS = 30000; // 30 secondes
}

