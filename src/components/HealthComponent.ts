
import Phaser from 'phaser';

export class HealthComponent {
    private gameObject: Phaser.GameObjects.GameObject;
    private hp: number;
    private maxHp: number;

    constructor(gameObject: Phaser.GameObjects.GameObject, maxHp: number) {
        this.gameObject = gameObject;
        this.maxHp = maxHp;
        this.hp = maxHp;

        this.gameObject.setData('health', this);
    }

    public takeDamage(amount: number): void {
        if (!this.gameObject.active) return;

        this.hp = Math.max(0, this.hp - amount);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);

        if (this.hp === 0) {
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
        // Check if the gameObject is still active and has a scene before destroying
        if (this.gameObject.active && this.gameObject.scene) {
            this.gameObject.destroy();
        }
        this.gameObject.setData('health', null);
    }
}
