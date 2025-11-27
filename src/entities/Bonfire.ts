import Phaser from 'phaser';

/**
 * Crée le visuel du Bonfire (Sanctuaire) - Style Dark Souls Épuré
 */
export function createBonfire(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    container.setName('Sanctuary');
    container.setDepth(10);

    const graphics = scene.add.graphics();

    // --- 1. Le Tas d'Os et de Cendres (Base) ---
    // Ombre portée
    graphics.fillStyle(0x000000, 0.6);
    graphics.fillEllipse(0, 20, 50, 20);

    // Cendres (Gris sombre)
    graphics.fillStyle(0x202020, 1);
    graphics.fillCircle(0, 15, 25);

    // Quelques os/crânes suggérés (Gris clair)
    graphics.fillStyle(0x505050, 1);
    graphics.fillCircle(-10, 18, 5); // Crâne gauche
    graphics.fillCircle(8, 20, 6);   // Crâne droit
    graphics.fillStyle(0x303030, 1);
    graphics.fillCircle(-5, 12, 8);  // Os central

    // --- 2. L'Épée Torsadée (Coiled Sword) ---
    // Lame sombre et rouillée
    graphics.fillStyle(0x4a4a4a, 1);

    // On dessine l'épée avec une forme irrégulière pour l'effet "fondu"
    graphics.beginPath();
    graphics.moveTo(-3, -40); // Pointe haut
    graphics.lineTo(4, -35);  // Renflement
    graphics.lineTo(2, -20);  // Torsion
    graphics.lineTo(5, -10);  // Base lame
    graphics.lineTo(3, 5);    // Enfoncée dans les cendres
    graphics.lineTo(-3, 5);
    graphics.lineTo(-4, -15);
    graphics.lineTo(-2, -30);
    graphics.closePath();
    graphics.fillPath();

    // Garde (tordue)
    graphics.lineStyle(3, 0x333333);
    graphics.beginPath();
    graphics.moveTo(-12, -12);
    graphics.lineTo(10, -8);
    graphics.strokePath();

    // --- 3. Effets de Lumière (Le Feu) ---
    // Cœur du feu (Statique)
    const core = scene.add.circle(0, 5, 6, 0xffaa00, 0.9);
    core.setBlendMode(Phaser.BlendModes.ADD);

    // Halo pulsant (Dynamique)
    const glow = scene.add.circle(0, 0, 30, 0xff4400, 0.3);
    glow.setBlendMode(Phaser.BlendModes.SCREEN);

    // Animation de "Respiration" du feu
    scene.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.4 },
        scale: { from: 1, to: 1.2 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // Particules simples (Étincelles qui montent)
    const particles = scene.add.graphics();
    particles.setBlendMode(Phaser.BlendModes.ADD);

    // Animation manuelle des particules pour éviter le ParticleManager complexe
    scene.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 2000,
        loop: -1,
        onUpdate: () => {
            particles.clear();
            particles.fillStyle(0xffcc00, 0.8);
            const time = Date.now() / 1000;
            // Créer 3-4 étincelles qui flottent
            for(let i=0; i<3; i++) {
                const yOffset = (time * 20 + i * 30) % 50; // Monte
                const xOffset = Math.sin(time * 5 + i) * 5; // Ondule
                const alpha = 1 - (yOffset / 50); // Disparait en haut
                particles.fillStyle(0xffcc00, alpha);
                particles.fillRect(xOffset, -10 - yOffset, 2, 2);
            }
        }
    });

    container.add([graphics, glow, core, particles]);
    return container;
}