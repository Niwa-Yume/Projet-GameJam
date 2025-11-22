/**
 * Wall: Entité Mur défensif
 *
 * Responsabilités:
 * - Bloquer les ennemis
 * - Encaisser les dégâts
 */

import { Building, type BuildingConfig } from './Building';

export class Wall extends Building {
  constructor(config: BuildingConfig) {
    super({ ...config, maxLevel: 3, baseHp: config.baseHp || 100 });
  }

  public getDisplayName(): string {
    return 'Mur';
  }

  /**
   * Les murs ne peuvent pas être upgradés (ou seulement HP)
   */
  public upgrade(): boolean {
    if (!super.upgrade()) return false;

    // Upgrade = juste plus de HP
    return true;
  }

  public update(_delta: number): void {
    // Les murs n'ont pas de logique active
  }

  protected onUpgrade(): void {
    // Chaque niveau = +50% HP
    this.maxHp = Math.floor(this.maxHp * 1.5);
    this.hp = this.maxHp;

    console.log(`✨ Mur renforcé au niveau ${this.level}`);
    console.log(`   HP: ${this.maxHp}`);
  }

  protected onDestroy(): void {
    console.log(`💥 Mur détruit`);
  }

  public getDetailedStats(): string {
    return `Durabilité: ${this.hp.toFixed(0)}/${this.maxHp} PV`;
  }
}

