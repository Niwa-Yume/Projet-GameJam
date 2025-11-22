/**
 * AllyManager: Gestionnaire des alliés (recrues)
 *
 * Responsabilités:
 * - Gérer tous les alliés
 * - Auto-recrutement basé sur les casernes
 * - Respawn automatique
 * - Combat automatique
 */

import { Ally, Knight, Watcher, Arbalest, type AllyType, type AllyConfig } from './Ally';

export class AllyManager {
  private static instance: AllyManager;
  private allies: Map<string, Ally> = new Map();

  // Configuration auto-recrutement
  private autoRecruitEnabled: boolean = false;
  private autoRecruitInterval: number = 10000; // 10 secondes
  private lastAutoRecruit: number = 0;

  // Limite d'alliés par caserne
  private readonly MAX_ALLIES_PER_BARRACKS = 3;

  private constructor() {}

  public static getInstance(): AllyManager {
    if (!AllyManager.instance) {
      AllyManager.instance = new AllyManager();
    }
    return AllyManager.instance;
  }

  /**
   * Crée un nouvel allié
   */
  public createAlly(type: AllyType, x: number, y: number, barracksId: string): Ally {
    const config: AllyConfig = { type, x, y, barracksId };

    let ally: Ally;
    switch (type) {
      case 'knight':
        ally = new Knight(config);
        break;
      case 'watcher':
        ally = new Watcher(config);
        break;
      case 'arbalest':
        ally = new Arbalest(config);
        break;
      default:
        throw new Error(`Type d'allié inconnu: ${type}`);
    }

    this.allies.set(ally.id, ally);
    console.log(`👥 ${ally.getDisplayName()} recruté (${ally.id})`);

    return ally;
  }

  /**
   * Supprime un allié
   */
  public removeAlly(id: string): void {
    const ally = this.allies.get(id);
    if (ally) {
      this.allies.delete(id);
      console.log(`❌ ${ally.getDisplayName()} retiré`);
    }
  }

  /**
   * Récupère tous les alliés
   */
  public getAllAllies(): Ally[] {
    return Array.from(this.allies.values());
  }

  /**
   * Récupère les alliés vivants
   */
  public getAliveAllies(): Ally[] {
    return this.getAllAllies().filter(a => a.getIsAlive());
  }

  /**
   * Récupère les alliés morts
   */
  public getDeadAllies(): Ally[] {
    return this.getAllAllies().filter(a => !a.getIsAlive());
  }

  /**
   * Récupère les alliés d'une caserne spécifique
   */
  public getAlliesByBarracks(barracksId: string): Ally[] {
    return this.getAllAllies().filter(a => a.barracksId === barracksId);
  }

  /**
   * Compte les alliés vivants d'une caserne
   */
  public countAliveByBarracks(barracksId: string): number {
    return this.getAlliesByBarracks(barracksId).filter(a => a.getIsAlive()).length;
  }

  /**
   * Active/désactive l'auto-recrutement
   */
  public setAutoRecruit(enabled: boolean): void {
    this.autoRecruitEnabled = enabled;
    console.log(`🤖 Auto-recrutement: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Définit l'intervalle d'auto-recrutement
   */
  public setAutoRecruitInterval(ms: number): void {
    this.autoRecruitInterval = ms;
  }

  /**
   * Mise à jour globale
   */
  public update(delta: number, enemies: any[], currentTime: number, barracks: any[]): void {
    // Mettre à jour tous les alliés
    this.allies.forEach(ally => {
      if (ally.getIsAlive()) {
        ally.update(delta, enemies);
      }
    });

    // Auto-recrutement
    if (this.autoRecruitEnabled && currentTime - this.lastAutoRecruit >= this.autoRecruitInterval) {
      this.processAutoRecruit(barracks, currentTime);
    }

    // Auto-respawn des morts
    this.processAutoRespawn(barracks);
  }

  /**
   * Traite l'auto-recrutement
   */
  private processAutoRecruit(barracks: any[], currentTime: number): void {
    barracks.forEach(barrack => {
      if (!barrack.getIsActive()) return;

      const aliveCount = this.countAliveByBarracks(barrack.id);

      // Recruter si sous la limite
      if (aliveCount < this.MAX_ALLIES_PER_BARRACKS) {
        // Choix aléatoire du type
        const types: AllyType[] = ['knight', 'watcher', 'arbalest'];
        const randomType = types[Math.floor(Math.random() * types.length)];

        // Créer l'allié
        this.createAlly(randomType, barrack.x, barrack.y, barrack.id);

        console.log(`🤖 Auto-recrutement: ${randomType} à la caserne ${barrack.id}`);
      }
    });

    this.lastAutoRecruit = currentTime;
  }

  /**
   * Respawn automatique des alliés morts
   */
  private processAutoRespawn(barracks: any[]): void {
    const deadAllies = this.getDeadAllies();

    deadAllies.forEach(ally => {
      // Trouver la caserne d'origine
      const barrack = barracks.find(b => b.id === ally.barracksId);

      if (barrack && barrack.getIsActive()) {
        // Respawn à la caserne
        ally.respawn(barrack.x, barrack.y);
      }
    });
  }

  /**
   * Statistiques
   */
  public getStats(): {
    total: number;
    alive: number;
    dead: number;
    byType: Record<AllyType, number>;
  } {
    const all = this.getAllAllies();
    const byType: Record<AllyType, number> = {
      knight: 0,
      watcher: 0,
      arbalest: 0
    };

    all.forEach(a => {
      byType[a.type]++;
    });

    return {
      total: all.length,
      alive: this.getAliveAllies().length,
      dead: this.getDeadAllies().length,
      byType
    };
  }

  /**
   * Réinitialise
   */
  public reset(): void {
    this.allies.clear();
    this.autoRecruitEnabled = false;
    this.lastAutoRecruit = 0;
    console.log('🔄 AllyManager réinitialisé');
  }
}

