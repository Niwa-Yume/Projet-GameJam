import { Building, type BuildingConfig } from './Building';

export class Forge extends Building {
    constructor(config: BuildingConfig) {
        super({ ...config, maxLevel: 3 });
    }

    public getDisplayName(): string {
        return 'Forge';
    }

    public update(_delta: number): void {
        // Logique passive
    }

    protected onUpgrade(): void {
        this.maxHp = Math.floor(this.maxHp * 1.2);
        this.hp = this.maxHp;
        console.log(`Forge niveau ${this.level}`);
    }

    protected onDestroy(): void {
        console.log('Forge détruite');
    }

    public getDetailedStats(): string {
        return `Niveau: ${this.level} • HP: ${this.hp.toFixed(0)}/${this.maxHp}`;
    }
}