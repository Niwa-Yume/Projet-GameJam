/**
 * Generator: Entité Générateur d'âmes
 */

import { Building, type BuildingConfig } from './Building';

export class Generator extends Building {
    private baseYield: number = 1.0;
    private yieldMultiplier: number = 1.0;
    private accumulatedTime: number = 0;
    private productionInterval: number = 2000;

    constructor(config: BuildingConfig) {
        super({ ...config, maxLevel: 5 });
    }

    public getDisplayName(): string {
        return 'Générateur';
    }

    public getYield(): number {
        return this.baseYield * this.yieldMultiplier * (1 + (this.level - 1) * 0.30);
    }

    public getProductionPerSecond(): number {
        return this.getYield() / (this.productionInterval / 1000);
    }

    public setYieldMultiplier(multiplier: number): void {
        this.yieldMultiplier = multiplier;
    }

    public getYieldMultiplier(): number {
        return this.yieldMultiplier;
    }

    // --- AJOUT IMPORTANT : Alias pour la compatibilité avec BuildingFactory ---
    public getProductionMultiplier(): number {
        return this.getYieldMultiplier();
    }
    // ------------------------------------------------------------------------

    public update(delta: number): void {
        if (!this.getIsActive()) return;
        this.accumulatedTime += delta;
    }

    public checkProduction(): number {
        if (this.accumulatedTime >= this.productionInterval) {
            this.accumulatedTime -= this.productionInterval;
            return this.getYield();
        }
        return 0;
    }

    public forceProduction(): number {
        this.accumulatedTime = 0;
        return this.getYield();
    }

    protected onUpgrade(): void {
        this.maxHp = Math.floor(this.maxHp * 1.1);
        this.hp = this.maxHp;
        // Augmente le multiplicateur à chaque niveau
        this.yieldMultiplier += 0.5;
    }

    protected onDestroy(): void {
        console.log(`💥 Générateur détruit`);
    }

    public getDetailedStats(): string {
        return [
            `Prod: ${this.getYield().toFixed(1)}/2s`,
            `Mult: x${this.yieldMultiplier.toFixed(1)}`,
            `HP: ${this.hp.toFixed(0)}`
        ].join(' • ');
    }
}