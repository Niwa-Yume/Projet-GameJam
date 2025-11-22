/**
 * Campfire: Entité Feu de camp
 *
 * Responsabilités:
 * - Soigner les bâtiments à proximité
 * - Fournir un bonus de production
 */

import { Building, type BuildingConfig } from './Building';

export class Campfire extends Building {
  private baseHealAmount: number = 1; // HP par tick
  private healRadius: number = 100;
  private healInterval: number = 2000; // 2 secondes
  private accumulatedTime: number = 0;

  // Bonus de production (10% de base)
  private productionBonus: number = 0.10;

  constructor(config: BuildingConfig) {
    super({ ...config, maxLevel: 3 });
  }

  public getDisplayName(): string {
    return 'Feu de camp';
  }

  /**
   * Montant de soin par tick
   */
  public getHealAmount(): number {
    return this.baseHealAmount * (1 + (this.level - 1) * 0.5); // +50% par niveau
  }

  /**
   * Rayon de soin
   */
  public getHealRadius(): number {
    return this.healRadius * (1 + (this.level - 1) * 0.2); // +20% par niveau
  }

  /**
   * Bonus de production global
   */
  public getProductionBonus(): number {
    return this.productionBonus * (1 + (this.level - 1) * 0.3); // +30% par niveau
  }

  /**
   * Vérifie s'il faut soigner maintenant
   */
  public shouldHeal(): boolean {
    return this.accumulatedTime >= this.healInterval && this.getIsActive();
  }

  /**
   * Réinitialise le timer de soin
   */
  public resetHealTimer(): void {
    this.accumulatedTime = 0;
  }

  public update(delta: number): void {
    if (!this.getIsActive()) return;
    this.accumulatedTime += delta;
  }

  protected onUpgrade(): void {
    this.maxHp = Math.floor(this.maxHp * 1.1);
    this.hp = this.maxHp;

    console.log(`✨ Feu de camp amélioré au niveau ${this.level}`);
    console.log(`   Soin: ${this.getHealAmount()} HP/2s`);
    console.log(`   Rayon: ${this.getHealRadius()}px`);
    console.log(`   Bonus production: +${(this.getProductionBonus() * 100).toFixed(0)}%`);
  }

  protected onDestroy(): void {
    console.log(`💥 Feu de camp éteint`);
  }

  public getDetailedStats(): string {
    return [
      `Soin: +${this.getHealAmount()} HP/2s`,
      `Rayon: ${this.getHealRadius().toFixed(0)}px`,
      `Bonus prod: +${(this.getProductionBonus() * 100).toFixed(0)}%`,
      `HP: ${this.hp.toFixed(0)}/${this.maxHp}`
    ].join(' • ');
  }
}

