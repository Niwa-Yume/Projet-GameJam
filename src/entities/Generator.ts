/**
 * Generator: Entité Générateur d'âmes
 *
 * Responsabilités:
 * - Produire des âmes passivement
 * - Améliorer le rendement
 */

import { Building, type BuildingConfig } from './Building';

export class Generator extends Building {
  private baseYield: number = 1.0; // âmes par tick (2 secondes)
  private yieldMultiplier: number = 1.0;

  private accumulatedTime: number = 0;
  private productionInterval: number = 2000; // 2 secondes

  constructor(config: BuildingConfig) {
    super({ ...config, maxLevel: 5 });
  }

  public getDisplayName(): string {
    return 'Générateur';
  }

  /**
   * Rendement effectif (âmes par production)
   */
  public getYield(): number {
    return this.baseYield * this.yieldMultiplier * (1 + (this.level - 1) * 0.30); // +30% par niveau
  }

  /**
   * Production par seconde
   */
  public getProductionPerSecond(): number {
    return this.getYield() / (this.productionInterval / 1000);
  }

  /**
   * Applique un multiplicateur (ex: depuis forge)
   */
  public setYieldMultiplier(multiplier: number): void {
    this.yieldMultiplier = multiplier;
  }

  /**
   * Récupère le multiplicateur actuel
   */
  public getYieldMultiplier(): number {
    return this.yieldMultiplier;
  }

  /**
   * Mise à jour avec production d'âmes
   */
  public update(delta: number): void {
    if (!this.getIsActive()) return;

    this.accumulatedTime += delta;

    // Vérifier si on doit produire
    if (this.accumulatedTime >= this.productionInterval) {
      this.accumulatedTime -= this.productionInterval;
      // La production effective sera gérée par EconomyManager
      // qui écoute les événements de production
    }
  }

  /**
   * Vérifie s'il faut produire maintenant
   * @returns Le montant à produire, ou 0 si pas encore le moment
   */
  public checkProduction(): number {
    if (this.accumulatedTime >= this.productionInterval) {
      this.accumulatedTime -= this.productionInterval;
      return this.getYield();
    }
    return 0;
  }

  /**
   * Force une production immédiate
   */
  public forceProduction(): number {
    this.accumulatedTime = 0;
    return this.getYield();
  }

  protected onUpgrade(): void {
    this.maxHp = Math.floor(this.maxHp * 1.1);
    this.hp = this.maxHp;

    console.log(`✨ Générateur amélioré au niveau ${this.level}`);
    console.log(`   Production: ${this.getYield().toFixed(2)} âmes/2s`);
    console.log(`   Par seconde: ${this.getProductionPerSecond().toFixed(2)} âmes/s`);
  }

  protected onDestroy(): void {
    console.log(`💥 Générateur détruit`);
  }

  public getDetailedStats(): string {
    return [
      `Production: ${this.getYield().toFixed(2)} âmes/2s`,
      `Par seconde: ${this.getProductionPerSecond().toFixed(2)} âmes/s`,
      `Multiplicateur: x${this.yieldMultiplier.toFixed(2)}`,
      `HP: ${this.hp.toFixed(0)}/${this.maxHp}`
    ].join(' • ');
  }
}

