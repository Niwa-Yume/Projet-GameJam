/**
 * Building: Classe de base pour tous les bâtiments
 *
 * Responsabilités:
 * - Gérer les propriétés communes (HP, position, niveau)
 * - Logique d'upgrade
 * - Logique de vente
 * - État du bâtiment (actif, détruit, en construction)
 *
 * Principe: Séparation LOGIQUE (ici) et RENDU (GameScene)
 */

export type BuildingType = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';

export interface BuildingStats {
  hp: number;
  maxHp: number;
  level: number;
  maxLevel: number;
}

export interface BuildingConfig {
  type: BuildingType;
  x: number;
  y: number;
  baseCost: number;
  baseHp: number;
  maxLevel?: number;
}

export abstract class Building {
  // Identité
  public readonly id: string;
  public readonly type: BuildingType;

  // Position
  public x: number;
  public y: number;

  // Stats
  protected hp: number;
  protected maxHp: number;
  protected level: number;
  protected maxLevel: number;

  // Coûts
  protected baseCost: number;
  protected upgradeCostMultiplier: number = 1.5;

  // État
  protected isDestroyed: boolean = false;
  protected isActive: boolean = true;

  // Référence au sprite (pour le rendu)
  public sprite?: Phaser.GameObjects.GameObject;

  constructor(config: BuildingConfig) {
    this.id = `${config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type;
    this.x = config.x;
    this.y = config.y;
    this.baseCost = config.baseCost;
    this.hp = config.baseHp;
    this.maxHp = config.baseHp;
    this.level = 1;
    this.maxLevel = config.maxLevel ?? 3;
  }

  /**
   * Récupère les stats actuelles
   */
  public getStats(): BuildingStats {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      level: this.level,
      maxLevel: this.maxLevel
    };
  }

  /**
   * Inflige des dégâts au bâtiment
   * @returns true si le bâtiment est détruit
   */
  public takeDamage(damage: number): boolean {
    if (this.isDestroyed) return true;

    this.hp = Math.max(0, this.hp - damage);

    if (this.hp <= 0) {
      this.destroy();
      return true;
    }

    return false;
  }

  /**
   * Soigne le bâtiment
   */
  public heal(amount: number): void {
    if (this.isDestroyed) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Améliore le bâtiment au niveau supérieur
   * @returns true si l'upgrade a réussi
   */
  public upgrade(): boolean {
    if (this.level >= this.maxLevel) return false;
    if (this.isDestroyed) return false;

    this.level++;
    this.onUpgrade();

    return true;
  }

  /**
   * Calcule le coût d'upgrade
   */
  public getUpgradeCost(): number {
    if (this.level >= this.maxLevel) return 0;
    return Math.floor(this.baseCost * Math.pow(this.upgradeCostMultiplier, this.level));
  }

  /**
   * Calcule le prix de revente
   */
  public getSellPrice(): number {
    const totalCost = this.getTotalInvestedCost();
    return Math.floor(totalCost * 0.75); // 75% de remboursement
  }

  /**
   * Calcule le coût total investi (construction + upgrades)
   */
  public getTotalInvestedCost(): number {
    let total = this.baseCost;
    for (let lvl = 1; lvl < this.level; lvl++) {
      total += Math.floor(this.baseCost * Math.pow(this.upgradeCostMultiplier, lvl));
    }
    return total;
  }

  /**
   * Vérifie si le bâtiment peut être amélioré
   */
  public canUpgrade(): boolean {
    return this.level < this.maxLevel && !this.isDestroyed;
  }

  /**
   * Détruit le bâtiment
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.isActive = false;
    this.hp = 0;
    this.onDestroy();
  }

  /**
   * Active/désactive le bâtiment
   */
  public setActive(active: boolean): void {
    this.isActive = active;
  }

  /**
   * Vérifie si le bâtiment est actif
   */
  public getIsActive(): boolean {
    return this.isActive && !this.isDestroyed;
  }

  /**
   * Récupère une description du bâtiment
   */
  public getDescription(): string {
    return `${this.getDisplayName()} (Niv. ${this.level})`;
  }

  /**
   * Récupère le nom d'affichage
   */
  public abstract getDisplayName(): string;

  /**
   * Appelé lors d'une mise à jour (60x/sec)
   * À surcharger dans les classes enfants
   */
  public abstract update(delta: number): void;

  /**
   * Appelé lors d'un upgrade
   * À surcharger dans les classes enfants
   */
  protected abstract onUpgrade(): void;

  /**
   * Appelé lors de la destruction
   * À surcharger dans les classes enfants
   */
  protected abstract onDestroy(): void;

  /**
   * Récupère les stats détaillées (pour l'UI)
   */
  public abstract getDetailedStats(): string;
}

