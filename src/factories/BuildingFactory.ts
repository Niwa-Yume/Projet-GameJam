import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { attachHealthBar } from '../ui/HealthBar';
import { HealthComponent } from '../components/HealthComponent';

type BuildingKind = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';

export class BuildingFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public createBuilding(kind: BuildingKind, x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        switch (kind) {
            case 'tower': return this.createTower(x, y, buildingManager);
            case 'wall': return this.createWall(x, y, buildingManager);
            case 'generator': return this.createGenerator(x, y, buildingManager);
            case 'campfire': return this.createCampfire(x, y, buildingManager);
            case 'forge': return this.createForge(x, y, buildingManager);
            case 'storage': return this.createStorage(x, y, buildingManager);
            case 'barracks': return this.createBarracks(x, y, buildingManager);
        }
    }

    private createTower(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        // ... existing code ...
        const towerContainer = this.scene.add.container(x, y).setDepth(10);
        this.scene.physics.add.existing(towerContainer, true); // Add static physics body
        const tower = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const shadow = this.scene.add.graphics().fillStyle(0x0a0a08, 0.7).fillEllipse(0, 26, 52, 14);
        const base = this.scene.add.graphics().fillStyle(0x2a2520, 1).fillRect(-24, 16, 48, 8).lineStyle(2, 0x1a1510, 1).strokeRect(-24, 16, 48, 8);
        const towerBody = this.scene.add.graphics().fillStyle(0x3a3530, 1).fillEllipse(0, -8, 28, 12).fillRect(-14, -8, 28, 24).fillEllipse(0, 16, 28, 12);
        towerBody.lineStyle(2, 0x2a2520, 1).strokeEllipse(0, -8, 28, 12).strokeRect(-14, -8, 28, 24);
        const battlements = this.scene.add.graphics().fillStyle(0x3a3530, 1);
        for (let i = 0; i < 5; i++) {
            const bx = -12 + i * 6;
            battlements.fillTriangle(bx, -8, bx + 3, -16, bx + 6, -8).lineStyle(1, 0x2a2520, 1).strokeTriangle(bx, -8, bx + 3, -16, bx + 6, -8);
        }
        const embrasure = this.scene.add.graphics().fillStyle(0x0a0a08, 1).fillRect(-3, -2, 6, 10);
        const brazier = this.scene.add.graphics().fillStyle(0x4a4a3a, 1).fillEllipse(0, -18, 12, 6).fillRect(-6, -18, 12, 4).fillEllipse(0, -14, 12, 6);
        const soulFlame = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const glow = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const fireTimer = this.scene.time.addEvent({
            delay: 16, loop: true, callback: () => {
                if (!towerContainer.scene) return;
                const time = Date.now() * 0.001;
                const wave = Math.sin(time * 3) * 1.5;
                const height = 8 + Math.sin(time * 2.5) * 2;
                soulFlame.clear().fillStyle(0xff6633, 0.6).fillTriangle(-4 + wave, -16, 0, -16 - height, 4 + wave, -16);
                glow.clear().fillStyle(0xff6633, 0.3 + (Math.sin(time * 2) * 0.5 + 0.5) * 0.2).fillCircle(0, -16, 14);
            }
        });

        towerContainer.add([shadow, base, towerBody, battlements, embrasure, brazier, soulFlame, glow, tower]);
        new HealthComponent(towerContainer, 100);
        towerContainer.setData({ interactiveChild: tower, fireTimer, glow });
        attachHealthBar(this.scene, towerContainer);
        const rangeGfx = this.scene.add.graphics().setDepth(9).setVisible(false);
        tower.on('pointerover', () => { rangeGfx.clear().lineStyle(1, 0x6b8fa5, 0.85).strokeCircle(x, y, GameConstants.TOWER_RANGE).setVisible(true); });
        tower.on('pointerout', () => rangeGfx.setVisible(false));
        tower.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!p.rightButtonDown()) buildingManager.showUpgradeMenu(towerContainer, 'tower'); });

        towerContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            rangeGfx.destroy();
            fireTimer.remove();
        });

        return towerContainer;
    }

    private createWall(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        // ... existing code ...
        const wallContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(wallContainer, true); // Add static physics body
        const wall = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const wallBase = this.scene.add.graphics().fillStyle(0x3a3530, 1).fillRect(-24, -24, 48, 48);
        const stones = this.scene.add.graphics().lineStyle(1.5, 0x2a2520, 0.9).lineBetween(-24, -8, 24, -8).lineBetween(-24, 8, 24, 8);
        wallContainer.add([wallBase, stones, wall]);
        new HealthComponent(wallContainer, 200);
        wallContainer.setData({ interactiveChild: wall });
        attachHealthBar(this.scene, wallContainer);
        wall.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(wallContainer, 'wall'); });

        return wallContainer;
    }

    private createGenerator(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        // ... existing code ...
        const genContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(genContainer, true); // Add static physics body
        const gen = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const shadows = this.scene.add.graphics().fillStyle(0x0a0a08, 0.7).fillEllipse(0, 26, 50, 12);
        const ground = this.scene.add.graphics().fillStyle(0x2a2520, 1).fillEllipse(0, 18, 46, 14);
        const rift = this.scene.add.graphics().fillStyle(0x0a0a18, 1).beginPath().moveTo(0, -4).lineTo(-10, 2).lineTo(-8, 10).lineTo(0, 14).lineTo(8, 10).lineTo(10, 2).closePath().fillPath();
        const riftGlow = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const souls = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const floatingStones: Phaser.GameObjects.Graphics[] = [];
        for (let i = 0; i < 5; i++) {
            floatingStones.push(this.scene.add.graphics());
        }

        const soulParticles: { x: number, y: number, vx: number, vy: number, life: number, alpha: number }[] = [];

        const riftTimer = this.scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!genContainer.scene) return;
                const time = this.scene.time.now * 0.001;
                riftGlow.clear().fillStyle(0xaa66ff, 0.3 + (Math.sin(time * 2) * 0.5 + 0.5) * 0.2).fillEllipse(0, 6, 20, 10);

                // Floating stones logic
                floatingStones.forEach((stone, i) => {
                    const angle = time * 0.5 + (i * (Math.PI * 2 / floatingStones.length));
                    const radius = 20 + Math.sin(time * 0.3 + i) * 3;
                    const stoneX = Math.cos(angle) * radius;
                    const stoneY = Math.sin(angle) * radius * 0.5 + 4;
                    const size = 3 + Math.sin(time * 1.2 + i) * 1.5;
                    stone.clear().fillStyle(0x1a1510, 1).fillEllipse(stoneX, stoneY, size, size * 0.8);
                });

                // Soul particles logic
                if (Phaser.Math.Between(0, 10) > 8) {
                    soulParticles.push({
                        x: Phaser.Math.FloatBetween(-5, 5),
                        y: Phaser.Math.FloatBetween(2, 8),
                        vx: Phaser.Math.FloatBetween(-0.2, 0.2),
                        vy: Phaser.Math.FloatBetween(-0.8, -0.4),
                        life: 1,
                        alpha: Phaser.Math.FloatBetween(0.3, 0.8)
                    });
                }

                souls.clear();
                for (let i = soulParticles.length - 1; i >= 0; i--) {
                    const p = soulParticles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 0.01;
                    p.alpha = p.life;

                    if (p.life <= 0) {
                        soulParticles.splice(i, 1);
                    } else {
                        souls.fillStyle(0x9a7bff, p.alpha).fillCircle(p.x, p.y, Phaser.Math.FloatBetween(1, 3));
                    }
                }
            }
        });

        const genTimer = this.scene.time.addEvent({
            delay: GameConstants.GENERATOR_TICK_MS,
            loop: true,
            callback: () => {
                const mul = (genContainer.getData('yieldMul') as number) ?? 1;
                this.scene.game.events.emit('add-shards', GameConstants.GENERATOR_YIELD * mul);
            }
        });

        genContainer.add([shadows, ground, rift, riftGlow, ...floatingStones, souls, gen]);
        new HealthComponent(genContainer, 120);
        genContainer.setData({ interactiveChild: gen, riftTimer, genTimer, yieldMul: 1 });
        attachHealthBar(this.scene, genContainer);
        gen.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!p.rightButtonDown()) buildingManager.showUpgradeMenu(genContainer, 'generator'); });
        genContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            riftTimer.remove();
            genTimer.remove();
        });

        return genContainer;
    }

    private createCampfire(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const fireContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(fireContainer, true);

        // Zone interactive (invisible)
        const hitArea = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });

        const graphics = this.scene.add.graphics();

        // 1. Socle (Cendres et Os)
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(0, 15, 40, 15); // Ombre
        graphics.fillStyle(0x202020, 1);
        graphics.fillCircle(0, 10, 20); // Cendres

        // Os décoratifs
        graphics.fillStyle(0xdddddd, 1);
        graphics.save();
        graphics.translateCanvas(0, 10);
        graphics.rotateCanvas(0.5);
        graphics.fillRect(-10, -2, 20, 4);
        graphics.restore();
        graphics.save();
        graphics.translateCanvas(0, 10);
        graphics.rotateCanvas(-0.8);
        graphics.fillRect(-8, -2, 16, 3);
        graphics.restore();

        // 2. Épée Torsadée (Coiled Sword)
        graphics.fillStyle(0x555555, 1);
        graphics.beginPath();
        graphics.moveTo(-2, -30);
        graphics.lineTo(3, -25);
        graphics.lineTo(1, -15);
        graphics.lineTo(4, -5);
        graphics.lineTo(2, 5);
        graphics.lineTo(-2, 5);
        graphics.lineTo(-3, -10);
        graphics.lineTo(-1, -20);
        graphics.closePath();
        graphics.fillPath();

        // Garde
        graphics.lineStyle(2, 0x333333);
        graphics.moveTo(-8, -8);
        graphics.lineTo(8, -6);
        graphics.strokePath();

        // 3. Feu et Lumière
        const fireCore = this.scene.add.circle(0, 5, 8, 0xffaa00, 0.8).setBlendMode(Phaser.BlendModes.ADD);
        const light = this.scene.add.circle(0, 0, 40, 0xff6600, 0.2).setBlendMode(Phaser.BlendModes.SCREEN);
        const particles = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

        fireContainer.add([graphics, light, fireCore, particles, hitArea]);

        // Animations (Pulsation et Particules)
        const pulseTween = this.scene.tweens.add({
            targets: [fireCore, light],
            scaleX: 1.1,
            scaleY: 1.2,
            alpha: 0.6,
            duration: 1000 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const particleTween = this.scene.tweens.addCounter({
            from: 0,
            to: 100,
            duration: 3000,
            loop: -1,
            onUpdate: () => {
                if (!particles.scene) return;
                particles.clear();
                const t = Date.now() / 800;
                particles.fillStyle(0xffcc33, 0.8);
                for(let i = 0; i < 3; i++) {
                    const offset = i * 2;
                    const px = Math.sin(t + offset) * 5;
                    const py = -10 - (Math.abs(Math.sin(t * 1.5 + offset)) * 20);
                    const size = 2 - (Math.abs(py)/20);
                    if (size > 0) particles.fillCircle(px, py, size);
                }
            }
        });

        new HealthComponent(fireContainer, 100);
        fireContainer.setData({ interactiveChild: hitArea });
        attachHealthBar(this.scene, fireContainer);
        hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(fireContainer, 'campfire'); });

        fireContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            pulseTween.remove();
            particleTween.remove();
        });

        return fireContainer;
    }

    private createForge(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const forgeContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(forgeContainer, true);

        const hitArea = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const g = this.scene.add.graphics();

        // Ombre
        g.fillStyle(0x000000, 0.5);
        g.fillEllipse(0, 20, 40, 15);

        // 1. Souche (Billot)
        g.fillStyle(0x3e2723, 1);
        g.fillRect(-15, 0, 30, 20);
        g.lineStyle(1, 0x5d4037);
        g.strokeEllipse(0, 0, 15, 5);

        // 2. Enclume (Noir)
        g.fillStyle(0x1a1a1a, 1);
        g.fillRect(-12, -5, 24, 5); // Base
        g.fillRect(-8, -12, 16, 7); // Col
        g.fillRect(-15, -18, 30, 8); // Tête
        g.beginPath();
        g.moveTo(15, -18);
        g.lineTo(25, -18); // Corne
        g.lineTo(15, -12);
        g.fillPath();

        // 3. Marteau
        g.fillStyle(0x5d4037, 1);
        g.fillRect(8, 5, 4, 20);
        g.fillStyle(0x424242, 1);
        g.fillRect(5, 5, 10, 6);

        // Effet Chaleur
        const glow = this.scene.add.circle(-10, -15, 5, 0xff5722, 0).setBlendMode(Phaser.BlendModes.ADD);

        forgeContainer.add([g, glow, hitArea]);

        const glowTween = this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.4 },
            scale: { from: 1, to: 2 },
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        new HealthComponent(forgeContainer, 120);
        forgeContainer.setData({ interactiveChild: hitArea });
        attachHealthBar(this.scene, forgeContainer);
        hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(forgeContainer, 'forge'); });

        forgeContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            glowTween.remove();
        });

        return forgeContainer;
    }

    private createStorage(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const storageContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(storageContainer, true);

        const hitArea = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });

        // Ombre (fixe)
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillEllipse(0, 12, 36, 12);

        // Corps du Mimic (Animé)
        const bodyGroup = this.scene.add.container(0, 0);
        const g = this.scene.add.graphics();

        // Coffre
        g.fillStyle(0x2d1e16, 1);
        g.fillRect(-16, -16, 32, 24);
        g.lineStyle(2, 0x555555);
        g.strokeRect(-16, -16, 32, 24);

        // Couvercle
        g.fillStyle(0x3e2723, 1);
        g.beginPath();
        g.moveTo(-18, -16);
        g.lineTo(18, -16);
        g.lineTo(16, -26);
        g.lineTo(-16, -26);
        g.closePath();
        g.fillPath();

        // Dents
        g.fillStyle(0xdddddd, 1);
        g.fillTriangle(-10, -16, -6, -16, -8, -20);
        g.fillTriangle(6, -16, 10, -16, 8, -20);

        // Chaîne Droite (Mimic)
        g.lineStyle(2, 0xaaaaaa);
        g.beginPath();
        g.moveTo(18, -12);
        g.lineTo(30, -8);
        g.strokePath();

        bodyGroup.add(g);
        storageContainer.add([shadow, bodyGroup, hitArea]);

        const breatheTween = this.scene.tweens.add({
            targets: bodyGroup,
            scaleY: 1.05,
            scaleX: 1.02,
            y: -2,
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        new HealthComponent(storageContainer, 140);
        storageContainer.setData({ interactiveChild: hitArea, capInc: 50 });
        attachHealthBar(this.scene, storageContainer);
        hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(storageContainer, 'storage'); });

        storageContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            breatheTween.remove();
        });

        return storageContainer;
    }

    private createBarracks(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const barracksContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(barracksContainer, true);

        const hitArea = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const g = this.scene.add.graphics();

        // Ombre
        g.fillStyle(0x000000, 0.5);
        g.fillEllipse(0, 20, 50, 20);

        // Structure (Taverne)
        g.fillStyle(0x4e342e, 1);
        g.fillRect(-20, -10, 40, 30);

        // Poutres
        g.fillStyle(0x3e2723, 1);
        g.fillRect(-22, -10, 4, 30);
        g.fillRect(18, -10, 4, 30);

        // Toit
        g.fillStyle(0x263238, 1);
        g.beginPath();
        g.moveTo(-28, -10);
        g.lineTo(0, -35);
        g.lineTo(28, -10);
        g.fillPath();

        // Fenêtre & Enseigne
        g.fillStyle(0xffb300, 1);
        g.fillRect(-8, 0, 16, 12); // Fenêtre
        g.fillStyle(0x5d4037, 1);
        g.fillRect(20, -5, 10, 2); // Support enseigne
        g.fillStyle(0x8d6e63, 1);
        g.fillRect(24, -5, 8, 10); // Panneau

        // Lumière chaude
        const light = this.scene.add.circle(0, 6, 20, 0xffb300, 0.2).setBlendMode(Phaser.BlendModes.ADD);

        barracksContainer.add([g, light, hitArea]);

        const lightTween = this.scene.tweens.add({
            targets: light,
            alpha: { from: 0.1, to: 0.3 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Bounce.easeInOut'
        });

        new HealthComponent(barracksContainer, 150);
        barracksContainer.setData({ interactiveChild: hitArea });
        attachHealthBar(this.scene, barracksContainer);
        hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(barracksContainer, 'barracks'); });

        barracksContainer.once(Phaser.GameObjects.Events.DESTROY, () => {
            lightTween.remove();
        });

        return barracksContainer;
    }
}