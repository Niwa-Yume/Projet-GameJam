import { Building, type BuildingConfig } from './Building';

export class Storage extends Building {
    constructor(config: BuildingConfig) {
        super({ ...config, maxLevel: 5 });
    }

    public getDisplayName(): string {
        return 'Réserve (Mimic)';
    }

    public update(_delta: number): void {}

    protected onUpgrade(): void {
        this.maxHp = Math.floor(this.maxHp * 1.3);
        this.hp = this.maxHp;
    }

    protected onDestroy(): void {}

    public getDetailedStats(): string {
        return `Stock Max: +${this.level * 50} • HP: ${this.hp.toFixed(0)}/${this.maxHp}`;
    }
}