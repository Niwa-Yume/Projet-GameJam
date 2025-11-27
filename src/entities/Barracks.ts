import { Building, type BuildingConfig } from './Building';

export class Barracks extends Building {
    constructor(config: BuildingConfig) {
        super({ ...config, maxLevel: 3 });
    }

    public getDisplayName(): string {
        return 'Caserne';
    }

    public update(_delta: number): void {}

    protected onUpgrade(): void {
        this.maxHp = Math.floor(this.maxHp * 1.2);
        this.hp = this.maxHp;
    }

    protected onDestroy(): void {}

    public getDetailedStats(): string {
        return `Recrutement: Actif • HP: ${this.hp.toFixed(0)}/${this.maxHp}`;
    }
}