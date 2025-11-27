import Phaser from 'phaser';
import { Building, type BuildingConfig } from './Building';

export class Campfire extends Building {
    private baseHealAmount: number = 1; // HP par tick
    private healRadius: number = 100;
    private healInterval: number = 2000; // 2 secondes
    private accumulatedTime: number = 0;

    // Bonus de production (10% de base)
    private productionBonus: number = 0.10;

    constructor(config: BuildingConfig) {
        super({ ...config, maxLevel: 3 });
    }

    public getDisplayName(): string {
        return 'Feu de camp';
    }

    /**
     * Montant de soin par tick
     */
    public getHealAmount(): number {
        return this.baseHealAmount * (1 + (this.level - 1) * 0.5); // +50% par niveau
    }

    /**
     * Rayon de soin
     */
    public getHealRadius(): number {
        return this.healRadius * (1 + (this.level - 1) * 0.2); // +20% par niveau
    }

    /**
     * Bonus de production global
     */
    public getProductionBonus(): number {
        return this.productionBonus * (1 + (this.level - 1) * 0.3); // +30% par niveau
    }

    /**
     * Vérifie s'il faut soigner maintenant
     */
    public shouldHeal(): boolean {
        return this.accumulatedTime >= this.healInterval && this.getIsActive();
    }

    /**
     * Réinitialise le timer de soin
     */
    public resetHealTimer(): void {
        this.accumulatedTime = 0;
    }

    public update(delta: number): void {
        if (!this.getIsActive()) return;
        this.accumulatedTime += delta;
    }

    protected onUpgrade(): void {
        this.maxHp = Math.floor(this.maxHp * 1.1);
        this.hp = this.maxHp;

        console.log(`✨ Feu de camp amélioré au niveau ${this.level}`);
        console.log(`   Soin: ${this.getHealAmount()} HP/2s`);
        console.log(`   Rayon: ${this.getHealRadius()}px`);
        console.log(`   Bonus production: +${(this.getProductionBonus() * 100).toFixed(0)}%`);
    }

    protected onDestroy(): void {
        console.log(`💥 Feu de camp éteint`);
    }

    public getDetailedStats(): string {
        return [
            `Soin: +${this.getHealAmount()} HP/2s`,
            `Rayon: ${this.getHealRadius().toFixed(0)}px`,
            `Bonus prod: +${(this.getProductionBonus() * 100).toFixed(0)}%`,
            `HP: ${this.hp.toFixed(0)}/${this.maxHp}`
        ].join(' • ');
    }

    /**
     * Crée le visuel "Dark Souls" procédural pour le bâtiment
     */
    public createVisuals(scene: Phaser.Scene): void {
        const container = scene.add.container(this.x, this.y);

        const graphics = scene.add.graphics();

        // --- 1. Le Socle (Cendres et Os) ---
        // Ombre au sol
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(0, 15, 40, 15);

        // Tas de cendres
        graphics.fillStyle(0x202020, 1);
        graphics.fillCircle(0, 10, 20);

        // Quelques os blancs/gris qui dépassent du tas
        graphics.fillStyle(0xdddddd, 1);
        // Os 1
        graphics.save();
        graphics.translateCanvas(0, 10);
        graphics.rotateCanvas(0.5);
        graphics.fillRect(-10, -2, 20, 4);
        graphics.restore();
        // Os 2
        graphics.save();
        graphics.translateCanvas(0, 10);
        graphics.rotateCanvas(-0.8);
        graphics.fillRect(-8, -2, 16, 3);
        graphics.restore();

        // --- 2. L'Épée Torsadée (Version plus petite que le Sanctuaire) ---
        graphics.fillStyle(0x555555, 1); // Acier gris terne

        // Lame tordue plantée
        graphics.beginPath();
        graphics.moveTo(-2, -30); // Pointe haute
        graphics.lineTo(3, -25);
        graphics.lineTo(1, -15);  // Torsion
        graphics.lineTo(4, -5);
        graphics.lineTo(2, 5);
        graphics.lineTo(-2, 5);
        graphics.lineTo(-3, -10);
        graphics.lineTo(-1, -20);
        graphics.closePath();
        graphics.fillPath();

        // Garde simple
        graphics.lineStyle(2, 0x333333);
        graphics.moveTo(-8, -8);
        graphics.lineTo(8, -6);
        graphics.strokePath();

        // --- 3. Le Feu et la Lumière ---
        // Cœur chaud (Fixe)
        const fireCore = scene.add.circle(0, 5, 8, 0xffaa00, 0.8);
        fireCore.setBlendMode(Phaser.BlendModes.ADD);

        // Halo de lumière (Pulsant)
        const light = scene.add.circle(0, 0, 40, 0xff6600, 0.2);
        light.setBlendMode(Phaser.BlendModes.SCREEN);

        // Animation de respiration du feu
        scene.tweens.add({
            targets: [fireCore, light],
            scaleX: 1.1,
            scaleY: 1.2,
            alpha: 0.6,
            duration: 1000 + Math.random() * 500, // Variation aléatoire
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Particules de braises (Via un Graphics animé pour éviter les textures externes)
        const particles = scene.add.graphics();
        particles.setBlendMode(Phaser.BlendModes.ADD);

        // Animation manuelle des particules
        scene.tweens.addCounter({
            from: 0,
            to: 100,
            duration: 3000,
            loop: -1,
            onUpdate: () => {
                particles.clear();
                const t = Date.now() / 800;
                particles.fillStyle(0xffcc33, 0.8);

                // 3 petites particules qui orbitent et montent
                for(let i = 0; i < 3; i++) {
                    const offset = i * 2;
                    const px = Math.sin(t + offset) * 5;
                    const py = -10 - (Math.abs(Math.sin(t * 1.5 + offset)) * 20);
                    const size = 2 - (Math.abs(py)/20); // Rétrécit en montant
                    if (size > 0) particles.fillCircle(px, py, size);
                }
            }
        });

        container.add([graphics, light, fireCore, particles]);
        this.sprite = container;
    }
}