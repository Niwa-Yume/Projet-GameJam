import Phaser from 'phaser';

export class HealthComponent {
    private gameObject: Phaser.GameObjects.GameObject;
    private hp: number;
    private maxHp: number;

    constructor(gameObject: Phaser.GameObjects.GameObject, maxHp: number) {
        this.gameObject = gameObject;
        this.maxHp = maxHp;
        this.hp = maxHp;

        // Debug log: .id retiré pour éviter l'erreur TS
        console.log(`HealthComponent créé pour ${gameObject.constructor.name} avec maxHp: ${maxHp}`);

        this.gameObject.setData('health', this);
    }

    public takeDamage(amount: number): void {
        console.log(`GameObject prend ${amount} dégâts. PV actuels: ${this.hp}`);

        this.hp = Math.max(0, this.hp - amount);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);

        console.log(`GameObject PV après dégâts: ${this.hp}`);

        if (this.hp === 0) {
            console.log(`GameObject est mort !`);
            this.gameObject.emit('died');
            this.destroy();
        }
    }

    public heal(amount: number): void {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
    }

    public getHp(): number {
        return this.hp;
    }

    public getMaxHp(): number {
        return this.maxHp;
    }

    public setMaxHp(maxHp: number): void {
        this.maxHp = maxHp;
        this.hp = Math.min(this.hp, this.maxHp);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
    }

    public setHp(hp: number): void {
        this.hp = Phaser.Math.Clamp(hp, 0, this.maxHp);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
    }

    private destroy(): void {
        this.gameObject.setData('health', null);
    }
}