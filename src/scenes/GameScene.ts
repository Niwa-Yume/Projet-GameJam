import Phaser from 'phaser';
import { createBonfire } from '../entities/Bonfire';
import { SaveSystem } from '../utils/SaveSystem';
import { GameConstants } from './GameConstants';
import { PathfindingGrid } from './PathfindingGrid';
import { BuildingManager } from '../managers/BuildingManager';
import { EnemyManager } from '../managers/EnemyManager';
import { AllyManager } from '../managers/AllyManager';
import { WaveManager } from '../managers/WaveManager';
import { EconomyManager } from '../managers/EconomyManager';
import { HealthComponent } from '../components/HealthComponent';
import { ensureRectangleTexture } from '../gfx/CanvasTextures'; // Import the new function

type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class GameScene extends Phaser.Scene {
    // Groups
    private enemies!: Phaser.Physics.Arcade.Group;
    private bullets!: Phaser.Physics.Arcade.Group;
    private allies!: Phaser.GameObjects.Group;

    // Managers
    private buildingManager!: BuildingManager;
    private enemyManager!: EnemyManager;
    private allyManager!: AllyManager;
    private waveManager!: WaveManager;
    private economyManager!: EconomyManager;

    // Scene state
    private sanctuaryPos!: { x: number; y: number };
    
    // Other
    private autoSaveTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super('GameScene');
    }

    preload() {}

    create() {
        if (this.physics.world) this.physics.world.resume();

        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaW = GameConstants.GAME_AREA_WIDTH;
        const gameAreaH = GameConstants.GAME_AREA_HEIGHT;
        this.add.rectangle(gameAreaX, gameAreaY, gameAreaW, gameAreaH, 0x1a1612, 1).setOrigin(0, 0).setDepth(-10);
        this.add.graphics().lineStyle(3, 0xd4af37, 0.6).strokeRect(gameAreaX, gameAreaY, gameAreaW, gameAreaH).setDepth(100);

        const TS = GameConstants.TILE_SIZE;
        this.sanctuaryPos = { x: gameAreaX + Math.floor(gameAreaW / TS / 2) * TS + TS / 2, y: gameAreaY + Math.floor(gameAreaH / TS / 2) * TS + TS / 2 };

        const saveData = SaveSystem.load();
        let offlineProgress = null;
        if (saveData) {
            offlineProgress = SaveSystem.calculateOfflineProgress(saveData);
            this.registry.set('offlineProgress', offlineProgress);
            this.registry.set('hasOfflineProgress', offlineProgress.timeElapsedSeconds > 60);
            if (offlineProgress.timeElapsedSeconds > 60 && offlineProgress.soulsEarned > 0) {
                this.registry.set('offlineProgressData', { formattedTime: SaveSystem.formatTimeElapsed(offlineProgress.timeElapsedSeconds), soulsEarned: offlineProgress.soulsEarned });
            }
        }

        this.initRegistry(saveData, offlineProgress);
        this.scene.launch('UIScene');
        createBonfire(this, this.sanctuaryPos.x, this.sanctuaryPos.y);

        const pathfindingGrid = new PathfindingGrid(gameAreaW, gameAreaH);
        this.bullets = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.allies = this.add.group();
        
        this.buildingManager = new BuildingManager(this, pathfindingGrid, this.sanctuaryPos, this.enemies);
        this.enemyManager = new EnemyManager(this, this.buildingManager, this.enemies, this.bullets, this.sanctuaryPos, GameConstants.ENEMY_SPEED);
        this.allyManager = new AllyManager(this, this.buildingManager, this.allies, this.enemies, this.sanctuaryPos);
        this.waveManager = new WaveManager(this, this.enemyManager);
        this.economyManager = new EconomyManager(this, this.buildingManager);

        // Collisions entre les ennemis et les bâtiments
        this.physics.add.collider(this.enemies, this.buildingManager.walls);
        this.physics.add.collider(this.enemies, this.buildingManager.towers);
        this.physics.add.collider(this.enemies, this.buildingManager.generators);
        this.physics.add.collider(this.enemies, this.buildingManager.campfires);
        this.physics.add.collider(this.enemies, this.buildingManager.forges);
        this.physics.add.collider(this.enemies, this.buildingManager.storages);
        this.physics.add.collider(this.enemies, this.buildingManager.barracks);

        // Overlap entre les balles et les ennemis
        this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, undefined, this);

        this.startAutoSave();
        this.registerGameEvents();

        if (saveData?.buildings?.length) this.buildingManager.restoreBuildings(saveData.buildings);
        if (saveData?.allies?.length) this.allyManager.restoreAllies(saveData.allies);

        if (this.registry.get('autoWaveMode') && offlineProgress?.wavesCompleted >= 0) {
            this.registry.set('nextWaveIn', 3);
            this.time.delayedCall(3000, () => this.game.events.emit('start-wave'));
        }
    }
    
    update(time: number, delta: number): void {
        if ((this.registry.get('sanctuaryHP') as number) <= 0) return;

        this.buildingManager.update(time);
        this.enemyManager.update(delta / 1000);
        this.allyManager.update(time);
        this.waveManager.update();

        this.cleanupBullets();
    }

    private initRegistry(saveData: any, offlineProgress: any): void {
        if (saveData && offlineProgress) {
            this.registry.set('soulShards', offlineProgress.cappedSouls);
            this.registry.set('maxSoulShards', saveData.maxSoulShards);
            this.registry.set('sanctuaryHP', saveData.sanctuaryHP);
            this.registry.set('wave', offlineProgress.newWaveNumber);
            this.registry.set('forgeCount', saveData.forgeCount);
            this.registry.set('barracksCount', saveData.barracksCount);
            this.registry.set('autoWaveMode', saveData.autoWaveMode ?? false);
            this.registry.set('autoRecruitEnabled', saveData.autoRecruitEnabled ?? false);
            this.registry.set('towerCost', saveData.towerCost);
            this.registry.set('soulProductionRate', saveData.soulProductionRate);
            this.registry.set('soulProductionMultiplier', saveData.soulProductionMultiplier);
        } else {
            this.registry.set('soulShards', 100);
            this.registry.set('maxSoulShards', 100);
            this.registry.set('sanctuaryHP', 5);
            this.registry.set('wave', 0);
            this.registry.set('forgeCount', 0);
            this.registry.set('barracksCount', 0);
            this.registry.set('soulProductionRate', GameConstants.PASSIVE_SOUL_RATE);
            this.registry.set('soulProductionMultiplier', 1.0);
            this.registry.set('generatorCount', 0);
            this.registry.set('totalSoulProduction', GameConstants.PASSIVE_SOUL_RATE);
            this.registry.set('autoRecruitEnabled', false);
            this.registry.set('autoWaveMode', false);
        }
        this.registry.set('waveActive', false);
        this.registry.set('waveTotal', 0);
        this.registry.set('waveRemaining', 0);
        this.registry.set('nextWaveIn', 0);
    }

    private registerGameEvents(): void {
        this.game.events.on('grid-updated', this.recomputeAllEnemyPaths, this);
        this.game.events.on('enemy-reached-sanctuary', this.onEnemyReachedSanctuary, this);
        this.game.events.on('fire-bullet', this.fireBullet, this);
        this.game.events.on('wave-ended-autowave', () => SaveSystem.save(this.registry, this.buildingManager.collectBuildingsData(), this.allyManager.collectAlliesData()), this);
        
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('grid-updated', this.recomputeAllEnemyPaths, this);
            this.game.events.off('enemy-reached-sanctuary', this.onEnemyReachedSanctuary, this);
            this.game.events.off('fire-bullet', this.fireBullet, this);
            this.game.events.off('wave-ended-autowave');
            if (this.autoSaveTimer) this.time.removeEvent(this.autoSaveTimer);

            // Destroy managers when GameScene shuts down
            this.buildingManager.destroy(); // Assuming destroy methods exist for managers
            this.enemyManager.destroy();
            this.allyManager.destroy();
            this.waveManager.destroy(); // Call destroy on WaveManager
            this.economyManager.destroy();
        });
    }

    private onBulletHitEnemy(bullet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject): void {
        // 1. D'abord, on récupère les infos (Type de balle et Composant PV de l'ennemi)
        const bulletType = bullet.getData('type');
        const health = enemy.getData('health') as HealthComponent;

        // DEBUG : On vérifie si la collision est bien détectée par le moteur physique
        // Si tu ne vois pas ce message, c'est que les Hitbox ne se touchent pas !
        console.log(`💥 IMPACT ! Balle (${bulletType}) touche Ennemi (${enemy.name})`);

        if (health) {
            // 2. On calcule les dégâts
            const damage = (bulletType === 'tower') ? GameConstants.TOWER_DMG : GameConstants.ALLY_DMG;

            // 3. On applique les dégâts
            health.takeDamage(damage);
        } else {
            console.warn(`⚠️ L'ennemi ${enemy.name} n'a pas de HealthComponent !`);
        }

        // 4. À LA FIN, on détruit la balle
        bullet.destroy();
    }

    private onEnemyReachedSanctuary(): void {
        this.decWaveRemaining(1);
        const nextHP = Math.max(0, (this.registry.get('sanctuaryHP') as number) - 1);
        this.registry.set('sanctuaryHP', nextHP);
        if (nextHP <= 0) {
            this.physics.world.pause();
            this.scene.pause();
            this.registry.set('waveActive', false);
        }
    }
    
    private cleanupBullets(): void {
        for (const obj of this.bullets.getChildren().slice()) {
            const b = obj as Phaser.GameObjects.GameObject & { x: number; y: number };
            if (b.x < -32 || b.y < -32 || b.x > this.game.canvas.width + 32 || b.y > this.game.canvas.height + 32) {
                this.bullets.remove(b as any, true, false);
                (b as any).destroy?.();
            }
        }
    }

    private fireBullet(data: { x: number, y: number, target: EnemyGO, type: 'tower' | 'ally' }): void {
        let bullet: Phaser.GameObjects.Sprite; // Changed to Sprite
        let textureKey: string;
        let bulletSize: number;
        let bulletColor: number;

        if (data.type === 'tower') {
            bulletSize = 10;
            bulletColor = 0xff0000; // Red for tower bullets
            textureKey = ensureRectangleTexture(this, 'bullet_tower_tex', bulletSize, bulletSize, bulletColor);
            
            // Create sprite using the physics group's create method
            bullet = this.bullets.create(data.x, data.y, textureKey) as Phaser.GameObjects.Sprite;
            bullet.setDepth(12);

            // Fireball graphics logic
            const fireball = this.add.graphics({ x: data.x, y: data.y }).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
            const fireTimer = this.time.addEvent({ delay: 16, loop: true, callback: () => {
                if (!fireball.scene) return;
                fireball.clear();
                const time = Date.now() * 0.01, flicker = Math.sin(time) * 0.2 + 0.8;
                fireball.fillStyle(0xff6633, 0.9 * flicker).fillCircle(0, 0, 5);
                fireball.fillStyle(0xff8844, 0.7 * flicker).fillCircle(0, 0, 7);
                fireball.fillStyle(0xffaa44, 0.5 * flicker).fillCircle(0, 0, 9);
                for (let i = 0; i < 4; i++) {
                    const angle = time * 0.5 + (i * Math.PI / 2), dist = 6 + Math.sin(time + i) * 2;
                    fireball.fillStyle(0xffcc66, 0.6 * flicker).fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 2);
                }
                fireball.setPosition(bullet.x, bullet.y);
            }});
            bullet.setData('fireballGraphics', fireball);
            bullet.setData('fireTimer', fireTimer);
            this.tweens.add({ targets: fireball, angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });
            bullet.once(Phaser.GameObjects.Events.DESTROY, () => {
                if (fireTimer) fireTimer.remove(false);
                if (fireball?.scene) fireball.destroy();
            });

        } else { // ally
            bulletSize = 6;
            bulletColor = 0x00ff00; // Green for ally bullets
            textureKey = ensureRectangleTexture(this, 'bullet_ally_tex', bulletSize, bulletSize, bulletColor);
            
            // Create sprite using the physics group's create method
            bullet = this.bullets.create(data.x, data.y, textureKey) as Phaser.GameObjects.Sprite;
            bullet.setDepth(12);
        }
        
        // Ensure the physics body is enabled and active
        (bullet.body as Phaser.Physics.Arcade.Body).enable = true;
        (bullet.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        
        // Set the type data
        bullet.setData('type', data.type); 
        console.log(`fireBullet: Bullet ID: ${bullet.id}, Type: ${bullet.getData('type')}`); // Debug log
        
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        const len = Math.hypot(data.target.x - data.x, data.target.y - data.y) || 1;
        const speed = (data.type === 'tower') ? GameConstants.BULLET_SPEED : GameConstants.BULLET_SPEED * 0.9;
        body.setVelocity((data.target.x - data.x) / len * speed, (data.target.y - data.y) / len * speed);
    }

    private recomputeAllEnemyPaths(): void {
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            this.enemyManager.updateEnemyVelocityAlongPath(obj);
        }
    }

    private decWaveRemaining(delta: number): void {
        if (!this.registry.get('waveActive')) return;
        this.registry.set('waveRemaining', Math.max(0, (this.registry.get('waveRemaining') as number) - delta));
    }

    private startAutoSave(): void {
        this.autoSaveTimer = this.time.addEvent({
            delay: 30000,
            loop: true,
            callback: () => SaveSystem.save(this.registry, this.buildingManager.collectBuildingsData(), this.allyManager.collectAlliesData()),
        });
    }
}
