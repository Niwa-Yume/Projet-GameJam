/**
 * Tower: Entité Tour de défense
 *
 * Responsabilités:
 * - Détecter les ennemis à portée
 * - Tirer des projectiles
 * - Gérer la cadence de tir
 * - Améliorer dégâts et portée
 */

import { Building, type BuildingConfig } from './Building';

export interface TowerStats {
  range: number;
  damage: number;
  fireRate: number; // Tirs par seconde
  damageMultiplier: number;
  fireRateMultiplier: number;
}

export class Tower extends Building {
  // Stats de combat
  private baseRange: number = 150;
  private baseDamage: number = 10;
  private baseFireRate: number = 1; // 1 tir/sec

  // Multiplicateurs (augmentent avec les upgrades)
  private damageMultiplier: number = 1.0;
  private fireRateMultiplier: number = 1.0;

  // État de tir
  private lastFireTime: number = 0;
  private currentTarget?: any; // Référence à l'ennemi ciblé

  constructor(config: BuildingConfig) {
    super({ ...config, maxLevel: 5 });
  }

  public getDisplayName(): string {
    return 'Tour';
  }

  /**
   * Récupère les stats de combat
   */
  public getCombatStats(): TowerStats {
    return {
      range: this.getRange(),
      damage: this.getDamage(),
      fireRate: this.getFireRate(),
      damageMultiplier: this.damageMultiplier,
      fireRateMultiplier: this.fireRateMultiplier
    };
  }

  /**
   * Portée effective
   */
  public getRange(): number {
    return this.baseRange * (1 + (this.level - 1) * 0.15); // +15% par niveau
  }

  /**
   * Dégâts effectifs
   */
  public getDamage(): number {
    return this.baseDamage * this.damageMultiplier * (1 + (this.level - 1) * 0.25); // +25% par niveau
  }

  /**
   * Cadence de tir effective (tirs/sec)
   */
  public getFireRate(): number {
    return this.baseFireRate * this.fireRateMultiplier * (1 + (this.level - 1) * 0.20); // +20% par niveau
  }

  /**
   * Délai entre deux tirs (ms)
   */
  public getFireDelay(): number {
    return 1000 / this.getFireRate();
  }

  /**
   * Vérifie si la tour peut tirer
   */
  public canFire(currentTime: number): boolean {
    if (!this.getIsActive()) return false;
    return currentTime - this.lastFireTime >= this.getFireDelay();
  }

  /**
   * Enregistre un tir
   */
  public fire(currentTime: number): void {
    this.lastFireTime = currentTime;
  }

  /**
   * Définit la cible actuelle
   */
  public setTarget(target: any): void {
    this.currentTarget = target;
  }

  /**
   * Récupère la cible actuelle
   */
  public getTarget(): any {
    return this.currentTarget;
  }

  /**
   * Nettoie la cible
   */
  public clearTarget(): void {
    this.currentTarget = undefined;
  }

  /**
   * Applique un buff de dégâts (ex: depuis forge)
   */
  public setDamageMultiplier(multiplier: number): void {
    this.damageMultiplier = multiplier;
  }

  /**
   * Applique un buff de cadence (ex: depuis forge)
   */
  public setFireRateMultiplier(multiplier: number): void {
    this.fireRateMultiplier = multiplier;
  }

  public update(_delta: number): void {
    // Logique de mise à jour (si nécessaire)
    // Par exemple: vérifier si la cible est toujours valide
    if (this.currentTarget && this.currentTarget.active === false) {
      this.clearTarget();
    }
  }

  protected onUpgrade(): void {
    // Augmenter légèrement les HP lors de l'upgrade
    this.maxHp = Math.floor(this.maxHp * 1.1);
    this.hp = this.maxHp; // Heal complet lors de l'upgrade

    console.log(`✨ Tour améliorée au niveau ${this.level}`);
    console.log(`   Portée: ${this.getRange().toFixed(0)}px`);
    console.log(`   Dégâts: ${this.getDamage().toFixed(1)}`);
    console.log(`   Cadence: ${this.getFireRate().toFixed(2)} tirs/sec`);
  }

  protected onDestroy(): void {
    this.clearTarget();
    console.log(`💥 Tour détruite`);
  }

  public getDetailedStats(): string {
    const stats = this.getCombatStats();
    return [
      `Portée: ${stats.range.toFixed(0)}px`,
      `Dégâts: ${stats.damage.toFixed(1)}`,
      `Cadence: ${stats.fireRate.toFixed(2)} tirs/sec`,
      `HP: ${this.hp.toFixed(0)}/${this.maxHp}`
    ].join(' • ');
  }
}

