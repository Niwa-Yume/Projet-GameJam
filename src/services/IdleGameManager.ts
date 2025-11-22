/**
 * IdleGameManager: Gestionnaire du mode Idle
 *
 * Responsabilités:
 * - Auto-construction de bâtiments
 * - Auto-recrutement d'alliés
 * - Auto-lancement de vagues
 * - Auto-upgrades
 * - Stratégie automatique
 */

import { GameState } from './GameState';
import { EconomyManager } from './EconomyManager';
import { WaveManager } from './WaveManager';
import { BuildingManager } from '../entities/BuildingManager';
import { AllyManager } from '../entities/AllyManager';
import { type BuildingType } from '../entities/Building';

export interface IdleGameConfig {
  autoWave: boolean;
  autoBuild: boolean;
  autoRecruit: boolean;
  autoUpgrade: boolean;
  buildPriority: BuildingType[];
  soulReservePercent: number; // % d'âmes à garder en réserve
}

export class IdleGameManager {
  private static instance: IdleGameManager;

  private gameState: GameState;
  private economy: EconomyManager;
  private waveManager: WaveManager;
  private buildingManager: BuildingManager;
  private allyManager: AllyManager;

  // Configuration
  private config: IdleGameConfig = {
    autoWave: true,
    autoBuild: true,
    autoRecruit: true,
    autoUpgrade: false,
    buildPriority: ['generator', 'tower', 'campfire', 'wall', 'storage', 'barracks'],
    soulReservePercent: 20 // Garder 20% en réserve
  };

  // Timers
  private lastBuildAttempt: number = 0;
  private buildInterval: number = 5000; // Essayer de construire toutes les 5s

  private lastUpgradeAttempt: number = 0;
  private upgradeInterval: number = 10000; // Essayer d'améliorer toutes les 10s

  private waveDelay: number = 5000; // 5 secondes entre les vagues
  private lastWaveEnd: number = 0;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.economy = EconomyManager.getInstance();
    this.waveManager = WaveManager.getInstance();
    this.buildingManager = BuildingManager.getInstance();
    this.allyManager = AllyManager.getInstance();
  }

  public static getInstance(): IdleGameManager {
    if (!IdleGameManager.instance) {
      IdleGameManager.instance = new IdleGameManager();
    }
    return IdleGameManager.instance;
  }

  /**
   * Active le mode idle complet
   */
  public activateIdleMode(): void {
    this.config.autoWave = true;
    this.config.autoBuild = true;
    this.config.autoRecruit = true;
    this.config.autoUpgrade = true;
    this.allyManager.setAutoRecruit(true);

    console.log('🤖 MODE IDLE ACTIVÉ');
    console.log('  ✓ Auto-vagues');
    console.log('  ✓ Auto-construction');
    console.log('  ✓ Auto-recrutement');
    console.log('  ✓ Auto-upgrades');
  }

  /**
   * Désactive le mode idle
   */
  public deactivateIdleMode(): void {
    this.config.autoWave = false;
    this.config.autoBuild = false;
    this.config.autoRecruit = false;
    this.config.autoUpgrade = false;
    this.allyManager.setAutoRecruit(false);

    console.log('👤 MODE MANUEL ACTIVÉ');
  }

  /**
   * Configure le mode idle
   */
  public setConfig(config: Partial<IdleGameConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.autoRecruit !== undefined) {
      this.allyManager.setAutoRecruit(config.autoRecruit);
    }
  }

  /**
   * Mise à jour principale (à appeler dans GameScene.update)
   */
  public update(currentTime: number): void {
    // Auto-vagues
    if (this.config.autoWave) {
      this.processAutoWave(currentTime);
    }

    // Auto-construction
    if (this.config.autoBuild && currentTime - this.lastBuildAttempt >= this.buildInterval) {
      this.processAutoBuild();
      this.lastBuildAttempt = currentTime;
    }

    // Auto-upgrades
    if (this.config.autoUpgrade && currentTime - this.lastUpgradeAttempt >= this.upgradeInterval) {
      this.processAutoUpgrade();
      this.lastUpgradeAttempt = currentTime;
    }
  }

  /**
   * Gère le lancement automatique des vagues
   */
  private processAutoWave(currentTime: number): void {
    const waveActive = this.gameState.get('waveActive');

    if (!waveActive) {
      // Vague terminée, attendre un peu avant la suivante
      if (currentTime - this.lastWaveEnd >= this.waveDelay) {
        const config = this.waveManager.startWave();
        if (config) {
          console.log(`🤖 Auto-vague ${config.waveNumber} lancée`);
        }
      }
    } else {
      // Vague en cours, mettre à jour le timer
      this.lastWaveEnd = currentTime;
    }
  }

  /**
   * Gère la construction automatique
   */
  private processAutoBuild(): void {
    const souls = this.gameState.get('soulShards');
    const maxSouls = this.gameState.get('maxSoulShards');

    // Ne construire que si on a assez d'âmes (au-dessus de la réserve)
    const reserveAmount = maxSouls * (this.config.soulReservePercent / 100);
    const availableSouls = souls - reserveAmount;

    if (availableSouls <= 0) return;

    // Essayer de construire selon la priorité
    for (const buildingType of this.config.buildPriority) {
      const cost = this.economy.getBuildingCost(buildingType);

      if (availableSouls >= cost) {
        // Vérifier la stratégie selon le type
        if (this.shouldBuild(buildingType)) {
          if (this.economy.purchaseBuilding(buildingType)) {
            console.log(`🤖 Auto-construction: ${buildingType} (${cost} âmes)`);
            // Ne construire qu'un seul bâtiment par cycle
            return;
          }
        }
      }
    }
  }

  /**
   * Détermine si on devrait construire ce type de bâtiment
   */
  private shouldBuild(type: BuildingType): boolean {
    const stats = this.buildingManager.getStats();
    const wave = this.gameState.get('wave');

    switch (type) {
      case 'generator':
        // Toujours construire des générateurs (max 10)
        return stats.byType.generator < 10;

      case 'tower':
        // Plus de tours au fur et à mesure
        const maxTowers = 5 + Math.floor(wave / 5);
        return stats.byType.tower < maxTowers;

      case 'wall':
        // Moins de murs (défense passive)
        return stats.byType.wall < Math.floor(wave / 3);

      case 'campfire':
        // 1 feu de camp toutes les 3 tours
        const maxCampfires = Math.ceil(stats.byType.tower / 3);
        return stats.byType.campfire < maxCampfires;

      case 'storage':
        // 1 réserve tous les 5 générateurs
        const maxStorage = Math.ceil(stats.byType.generator / 5);
        return stats.byType.storage < maxStorage;

      case 'forge':
        // 1 seule forge suffit
        return stats.byType.forge < 1;

      case 'barracks':
        // 1 caserne toutes les 5 vagues
        const maxBarracks = Math.ceil(wave / 5) || 1;
        return stats.byType.barracks < maxBarracks;

      default:
        return false;
    }
  }

  /**
   * Gère les améliorations automatiques
   */
  private processAutoUpgrade(): void {
    const souls = this.gameState.get('soulShards');
    const buildings = this.buildingManager.getAllBuildings();

    // Trier par priorité: générateurs > tours > autres
    const sortedBuildings = buildings
      .filter(b => b.canUpgrade())
      .sort((a: any, b: any) => {
        const priorityA = this.getUpgradePriority(a.type);
        const priorityB = this.getUpgradePriority(b.type);
        return priorityB - priorityA;
      });

    // Essayer d'améliorer le premier bâtiment qu'on peut se permettre
    for (const building of sortedBuildings) {
      const cost = building.getUpgradeCost();

      if (souls >= cost) {
        if (this.economy.spendSouls(cost)) {
          building.upgrade();
          console.log(`🤖 Auto-upgrade: ${building.getDisplayName()} niveau ${building.getStats().level}`);
          return; // Un seul upgrade par cycle
        }
      }
    }
  }

  /**
   * Priorité d'upgrade (plus haut = plus prioritaire)
   */
  private getUpgradePriority(type: BuildingType): number {
    const priorities: Record<BuildingType, number> = {
      generator: 100,  // Économie d'abord
      tower: 80,       // Puis défense
      campfire: 60,    // Puis survie
      storage: 50,
      forge: 40,
      barracks: 30,
      wall: 20
    };

    return priorities[type] || 0;
  }

  /**
   * Récupère les statistiques du mode idle
   */
  public getIdleStats(): {
    mode: 'idle' | 'manual';
    autoWave: boolean;
    autoBuild: boolean;
    autoRecruit: boolean;
    autoUpgrade: boolean;
    nextWaveIn?: number;
  } {
    return {
      mode: this.config.autoWave && this.config.autoBuild ? 'idle' : 'manual',
      autoWave: this.config.autoWave,
      autoBuild: this.config.autoBuild,
      autoRecruit: this.config.autoRecruit,
      autoUpgrade: this.config.autoUpgrade
    };
  }

  /**
   * Réinitialise
   */
  public reset(): void {
    this.lastBuildAttempt = 0;
    this.lastUpgradeAttempt = 0;
    this.lastWaveEnd = 0;
    console.log('🔄 IdleGameManager réinitialisé');
  }
}

