
import Phaser from 'phaser';

export class HealthComponent {
    private gameObject: Phaser.GameObjects.GameObject;
    private hp: number;
    private maxHp: number;

    constructor(gameObject: Phaser.GameObjects.GameObject, maxHp: number) {
        this.gameObject = gameObject;
        this.maxHp = maxHp;
        this.hp = maxHp;

        // Debug log: Confirme la création du HealthComponent
        console.log(`HealthComponent créé pour ${gameObject.constructor.name} (ID: ${gameObject.id}) avec maxHp: ${maxHp}`);

        this.gameObject.setData('health', this);
    }

    public takeDamage(amount: number): void {
        // Debug log: Affiche les dégâts reçus et les PV actuels
        console.log(`GameObject (ID: ${this.gameObject.id}) prend ${amount} dégâts. PV actuels: ${this.hp}`);

        this.hp = Math.max(0, this.hp - amount);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);

        // Debug log: Affiche les PV après les dégâts
        console.log(`GameObject (ID: ${this.gameObject.id}) PV après dégâts: ${this.hp}`);

        if (this.hp === 0) {
            // Debug log: Confirme la mort de l'entité
            console.log(`GameObject (ID: ${this.gameObject.id}) est mort !`);
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
