
import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { BuildingManager } from './BuildingManager';
import { EnemyFactory } from '../factories/EnemyFactory';
import { HealthComponent } from '../components/HealthComponent';

type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class EnemyManager {
    private scene: Phaser.Scene;
    private buildingManager: BuildingManager;
    private enemies: Phaser.Physics.Arcade.Group;
    private sanctuaryPos: { x: number; y: number };
    private enemySpeed: number;
    private factory: EnemyFactory;

    constructor(scene: Phaser.Scene, buildingManager: BuildingManager, enemiesGroup: Phaser.Physics.Arcade.Group, bulletsGroup: Phaser.Physics.Arcade.Group, sanctuaryPos: { x: number; y: number }, initialSpeed: number) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this.enemies = enemiesGroup;
        this.sanctuaryPos = sanctuaryPos;
        this.enemySpeed = initialSpeed;
        this.factory = new EnemyFactory(scene);
    }

    public update(dt: number): void {
        const eList = this.enemies.getChildren() as EnemyGO[];
        for (const enemy of eList) {
            let target = enemy.getData('target') as Phaser.GameObjects.Rectangle | undefined;

            if (!target || !target.active) {
                target = this.buildingManager.findBuildingAt(enemy.x, enemy.y);
                if (target) {
                    enemy.setData('target', target);
                    (enemy.body as Phaser.Physics.Arcade.Body)?.setVelocity(0, 0);
                } else {
                    this.followPathStep(enemy);
                }
            }

            if (target && target.active) {
                const dpsMultiplier = (enemy.getData('dpsMultiplier') as number) ?? 1;
                const finalDps = GameConstants.ENEMY_DPS * dpsMultiplier;
                const targetHealth = target.getData('health') as HealthComponent;
                if(targetHealth) {
                    targetHealth.takeDamage(finalDps * dt);
                }
                
                if (!target.active) {
                    enemy.setData('target', undefined);
                    this.buildingManager.recomputeGrid();
                    this.scene.game.events.emit('grid-updated');
                    this.updateEnemyVelocityAlongPath(enemy);
                }
            }
        }
        
        this.checkSanctuaryCollision();
        this.checkStuckEnemies();
    }
    
    private checkSanctuaryCollision(): void {
        const enemies = this.enemies.getChildren().slice();
        for (const obj of enemies) {
            const enemy = obj as EnemyGO;
            if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.sanctuaryPos.x, this.sanctuaryPos.y) <= 48) {
                enemy.destroy();
                this.enemies.remove(enemy as any, true, false);
                this.scene.game.events.emit('enemy-reached-sanctuary');
            }
        }
    }
    
    private checkStuckEnemies(): void {
        const nowMs = this.scene.time.now;
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            const enemy = obj as EnemyGO;
            const body = (enemy as any).body as Phaser.Physics.Arcade.Body | undefined;
            if (!body) continue;
            if ((body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y) < 1) {
                let stuckSince = (enemy.getData('stuckSince') as number) ?? 0;
                if (!stuckSince) enemy.setData('stuckSince', nowMs);
                else if (nowMs - stuckSince > 800) {
                    this.scene.game.events.emit('grid-updated');
                    enemy.setData('stuckSince', nowMs + 400);
                }
            } else {
                if (enemy.getData('stuckSince')) enemy.setData('stuckSince', 0);
            }
        }
    }

    public spawnEnemy(waveNumber: number, spawnsRemaining: number): EnemyGO {
        const startCell = this.buildingManager.pickSpawnCell();
        const sx = startCell ? this.buildingManager.cellToWorld(startCell.cx, startCell.cy).x : -16;
        const sy = startCell ? this.buildingManager.cellToWorld(startCell.cx, startCell.cy).y : Phaser.Math.Between(32, this.scene.game.canvas.height - 32);

        const isBossWave = waveNumber % GameConstants.BOSS_WAVE_INTERVAL === 0;
        const waveHpMultiplier = 1 + (waveNumber - 1) * 0.2;
        let enemy: Phaser.GameObjects.Image;
        let health: HealthComponent;

        if (isBossWave && spawnsRemaining % 5 === 0) {
            enemy = this.factory.createEnemy('boss_skeleton', sx, sy);
            const maxHp = GameConstants.ENEMY_HP * waveHpMultiplier * GameConstants.BOSS_HP_MULTIPLIER;
            health = new HealthComponent(enemy, maxHp);
            enemy.setData({ isBoss: true, dpsMultiplier: GameConstants.BOSS_DPS_MULTIPLIER, speedMultiplier: GameConstants.BOSS_SPEED_MULTIPLIER });
            this.scene.game.events.emit('notify', `💀 MINI-BOSS APPARU ! 💀`, 'error');
        } else {
            enemy = this.factory.createEnemy('skeleton', sx, sy);
            const maxHp = GameConstants.ENEMY_HP * waveHpMultiplier;
            health = new HealthComponent(enemy, maxHp);
            enemy.setData({ isBoss: false, dpsMultiplier: 1, speedMultiplier: 1 });
        }
        
        // Attach the HealthComponent to the enemy object
        enemy.setData('health', health);

        enemy.on('died', () => {
            this.scene.game.events.emit('enemy-killed', enemy.getData('isBoss'));
            if (this.enemies.contains(enemy)) this.enemies.remove(enemy, true, false);
            enemy.destroy();
        });

        this.enemies.add(enemy);
        const targetCell = this.buildingManager.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
        let pathPixels: { x: number; y: number; }[] | null = null;
        if (startCell) {
            const path = this.buildingManager.findPath(startCell, targetCell);
            if (path) {
                pathPixels = path.map(p => this.buildingManager.cellToWorld(p.cx, p.cy));
                if (pathPixels.length && Phaser.Math.Distance.Between(pathPixels[0].x, pathPixels[0].y, enemy.x, enemy.y) < 4) {
                    pathPixels.shift();
                }
            }
        }
        enemy.setData({ path: pathPixels, pathIndex: 0, target: undefined });
        this.updateEnemyVelocityAlongPath(enemy);
        return enemy;
    }

    public updateEnemyVelocityAlongPath(enemy: EnemyGO): void {
        const body = (enemy as any).body as Phaser.Physics.Arcade.Body | undefined;
        if (!body) return;
        const path = enemy.getData('path') as { x: number; y: number }[] | null;
        const idx = (enemy.getData('pathIndex') as number) ?? 0;
        const finalSpeed = this.enemySpeed * ((enemy.getData('speedMultiplier') as number) ?? 1);
        if (!path || idx >= path.length) {
            this.seek(body, enemy.x, enemy.y, this.sanctuaryPos.x, this.sanctuaryPos.y, finalSpeed);
            return;
        }
        this.seek(body, enemy.x, enemy.y, path[idx].x, path[idx].y, finalSpeed);
    }

    public followPathStep(enemy: EnemyGO): void {
        let path = enemy.getData('path') as { x: number; y: number }[] | null;
        let idx = (enemy.getData('pathIndex') as number) ?? 0;
        if (!path || path.length === 0) {
            const curC = this.buildingManager.worldToCell(enemy.x, enemy.y);
            const goalC = this.buildingManager.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
            path = (this.buildingManager.findPath(curC, goalC) || []).map(c => this.buildingManager.cellToWorld(c.cx, c.cy));
            enemy.setData({ path, pathIndex: 0 });
            idx = 0;
        }
        if (!path || path.length === 0) {
            this.updateEnemyVelocityAlongPath(enemy);
            return;
        }
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, path[idx].x, path[idx].y) <= 8) {
            enemy.setData('pathIndex', ++idx);
        }
        this.updateEnemyVelocityAlongPath(enemy);
    }

    private seek(body: Phaser.Physics.Arcade.Body, fromX: number, fromY: number, toX: number, toY: number, speed: number): void {
        const len = Math.hypot(toX - fromX, toY - fromY) || 1;
        body.setVelocity((toX - fromX) / len * speed, (toY - fromY) / len * speed);
    }
    
    public setSpeed(speed: number): void {
        this.enemySpeed = speed;
    }

    public getEnemyCount(): number {
        return this.enemies.getLength();
    }

    public getEnemies(): Phaser.Physics.Arcade.Group {
        return this.enemies;
    }
}
