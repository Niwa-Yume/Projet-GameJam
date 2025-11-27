import Phaser from 'phaser';

// On étend EventEmitter pour que la méthode .on() existe et fonctionne !
export class HealthComponent extends Phaser.Events.EventEmitter {
    private gameObject: Phaser.GameObjects.GameObject;
    private hp: number;
    private maxHp: number;

    constructor(gameObject: Phaser.GameObjects.GameObject, maxHp: number) {
        super(); // Obligatoire quand on étend une classe

        this.gameObject = gameObject;
        this.maxHp = maxHp;
        this.hp = maxHp;

        // Debug log
        console.log(`HealthComponent créé pour ${gameObject.constructor.name} avec maxHp: ${maxHp}`);

        this.gameObject.setData('health', this);
    }

    public takeDamage(amount: number): void {
        console.log(`GameObject prend ${amount} dégâts. PV actuels: ${this.hp}`);

        this.hp = Math.max(0, this.hp - amount);

        // On émet l'événement standard Phaser sur l'objet ET l'événement local sur le composant (alias 'change')
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
        this.emit('health-changed', this.hp, this.maxHp);
        this.emit('change', this.hp, this.maxHp); // Pour compatibilité

        console.log(`GameObject PV après dégâts: ${this.hp}`);

        if (this.hp === 0) {
            console.log(`GameObject est mort !`);
            this.die();
        }
    }

    public heal(amount: number): void {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
        this.emit('health-changed', this.hp, this.maxHp);
        this.emit('heal', this.hp, this.maxHp);
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
        this.emit('change', this.hp, this.maxHp);
    }

    public setHp(hp: number): void {
        this.hp = Phaser.Math.Clamp(hp, 0, this.maxHp);
        this.gameObject.emit('health-changed', this.hp, this.maxHp);
        this.emit('change', this.hp, this.maxHp);
    }

    private die(): void {
        // C'est ici que la magie opère pour la Factory : on émet 'die'
        this.emit('die');
        this.emit('died');
        this.gameObject.emit('died');
        this.destroy();
    }

    public destroy(): void {
        this.gameObject.setData('health', null);
        super.destroy(); // Appel correct à la méthode parent
        // Optionnel : détruire l'objet parent automatiquement
        // this.gameObject.destroy();
    }
}