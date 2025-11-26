
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
        const banner = this.scene.add.graphics().setVisible(false);
        towerContainer.add([shadow, base, towerBody, battlements, embrasure, brazier, soulFlame, glow, banner, tower]);
        new HealthComponent(towerContainer, 100);
        towerContainer.setData({ interactiveChild: tower, fireTimer, glow, banner });
        attachHealthBar(this.scene, towerContainer);
        const rangeGfx = this.scene.add.graphics().setDepth(9).setVisible(false);
        tower.on('pointerover', () => { rangeGfx.clear().lineStyle(1, 0x6b8fa5, 0.85).strokeCircle(x, y, GameConstants.TOWER_RANGE).setVisible(true); });
        tower.on('pointerout', () => rangeGfx.setVisible(false));
        tower.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!p.rightButtonDown()) buildingManager.showUpgradeMenu(towerContainer, 'tower'); });
        towerContainer.once(Phaser.GameObjects.Events.DESTROY, () => { rangeGfx.destroy(); fireTimer.remove(); });
        console.log(`BuildingFactory: Created Tower Container with ID: ${towerContainer.id}`); // Debug log
        return towerContainer;
    }

    private createWall(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
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
        console.log(`BuildingFactory: Created Wall Container with ID: ${wallContainer.id}`); // Debug log
        return wallContainer;
    }

    private createGenerator(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
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
        console.log(`BuildingFactory: Created Generator Container with ID: ${genContainer.id}`); // Debug log
        return genContainer;
    }
    private createCampfire(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const fireContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(fireContainer, true); // Add static physics body
        const fire = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const ashCircle = this.scene.add.graphics().fillStyle(0x1a1510, 1).fillEllipse(0, 22, 42, 14);
        const embers = this.scene.add.graphics().fillStyle(0xff4422, 0.8).fillCircle(-10, 19, 2);
        const wood = this.scene.add.graphics().fillStyle(0x1a1510, 1).fillRect(-18, 12, 16, 5);
        const sword = this.scene.add.graphics().fillStyle(0x5a6a7a, 1).beginPath().moveTo(0, -36).lineTo(-2.5, -28).lineTo(-2, 2).lineTo(2, 2).lineTo(2.5, -28).closePath().fillPath();
        const flames = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        fireContainer.add([ashCircle, embers, wood, sword, flames, fire]);
        new HealthComponent(fireContainer, 100);
        fireContainer.setData({ interactiveChild: fire });
        attachHealthBar(this.scene, fireContainer);
        fire.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(fireContainer, 'campfire'); });
        console.log(`BuildingFactory: Created Campfire Container with ID: ${fireContainer.id}`); // Debug log
        return fireContainer;
    }
    private createForge(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const forgeContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(forgeContainer, true); // Add static physics body
        const forge = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const shadows = this.scene.add.graphics().fillStyle(0x0a0a08, 0.7).fillEllipse(0, 26, 46, 10);
        const base = this.scene.add.graphics().fillStyle(0x2a2520, 1).fillRect(-20, 16, 40, 8);
        const anvil = this.scene.add.graphics().fillStyle(0x3a3a3a, 1).fillRect(-10, 8, 20, 8);
        const hotIron = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const hammer = this.scene.add.graphics();
        forgeContainer.add([shadows, base, anvil, hotIron, hammer, forge]);
        new HealthComponent(forgeContainer, 120);
        forgeContainer.setData({ interactiveChild: forge });
        attachHealthBar(this.scene, forgeContainer);
        forge.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(forgeContainer, 'forge'); });
        console.log(`BuildingFactory: Created Forge Container with ID: ${forgeContainer.id}`); // Debug log
        return forgeContainer;
    }
    private createStorage(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const storageContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(storageContainer, true); // Add static physics body
        const stor = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const shadows = this.scene.add.graphics().fillStyle(0x0a0a08, 0.7).fillEllipse(0, 24, 48, 12);
        const mimicBody = this.scene.add.graphics().fillStyle(0x3a2a1a, 1).fillRect(-18, 2, 36, 18);
        storageContainer.add([shadows, mimicBody, stor]);
        new HealthComponent(storageContainer, 140);
        storageContainer.setData({ interactiveChild: stor, capInc: 50 });
        attachHealthBar(this.scene, storageContainer);
        stor.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(storageContainer, 'storage'); });
        console.log(`BuildingFactory: Created Storage Container with ID: ${storageContainer.id}`); // Debug log
        return storageContainer;
    }
    private createBarracks(x: number, y: number, buildingManager: any): Phaser.GameObjects.Container {
        const barracksContainer = this.scene.add.container(x, y).setDepth(9);
        this.scene.physics.add.existing(barracksContainer, true); // Add static physics body
        const br = this.scene.add.rectangle(0, 0, 48, 48, 0, 0).setInteractive({ useHandCursor: true });
        const shadows = this.scene.add.graphics().fillStyle(0x0a0a08, 0.7).fillEllipse(0, 26, 50, 12);
        const building = this.scene.add.graphics().fillStyle(0x3a2a1a, 1).fillRect(-18, -8, 36, 24);
        barracksContainer.add([shadows, building, br]);
        new HealthComponent(barracksContainer, 150);
        barracksContainer.setData({ interactiveChild: br });
        attachHealthBar(this.scene, barracksContainer);
        br.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.rightButtonDown()) buildingManager.showUpgradeMenu(barracksContainer, 'barracks'); });
        console.log(`BuildingFactory: Created Barracks Container with ID: ${barracksContainer.id}`); // Debug log
        return barracksContainer;
    }
}
