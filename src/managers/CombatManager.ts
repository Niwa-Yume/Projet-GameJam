
import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { BuildingManager } from './BuildingManager';
import { AllyManager } from './AllyManager';
import { EnemyManager } from './EnemyManager';
import { HealthComponent } from '../components/HealthComponent';

type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class CombatManager {
    private scene: Phaser.Scene;
    private buildingManager: BuildingManager;
    private allyManager: AllyManager;
    private enemyManager: EnemyManager;
    private bullets: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene, buildingManager: BuildingManager, allyManager: AllyManager, enemyManager: EnemyManager, bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this.allyManager = allyManager;
        this.enemyManager = enemyManager;
        this.bullets = bulletsGroup;

        this.scene.game.events.on('fire-bullet', this.fireBullet, this);
        this.scene.physics.add.overlap(this.bullets, this.enemyManager.getEnemies(), this.onBulletHitEnemy, undefined, this);
    }

    public update(time: number): void {
        this.updateTowers(time);
        this.cleanupBullets();
    }

    private updateTowers(time: number): void {
        for (const obj of this.buildingManager.towers.getChildren()) {
            const tower = obj as Phaser.GameObjects.Rectangle;
            if (time < ((tower.getData('nextFire') as number) ?? 0)) continue;
            const towerX = (tower.getData('worldX') as number) ?? tower.x;
            const towerY = (tower.getData('worldY') as number) ?? tower.y;
            const target = this.findTarget(towerX, towerY, GameConstants.TOWER_RANGE);
            if (!target) continue;
            this.fireFromTower(tower, target);
            tower.setData('nextFire', time + GameConstants.TOWER_FIRE_RATE * ((tower.getData('fireRateMul') as number) ?? 1));
        }
    }

    private findTarget(x: number, y: number, range: number): EnemyGO | null {
        let best: EnemyGO | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const obj of this.enemyManager.getEnemies().getChildren() as EnemyGO[]) {
            const d = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
            if (d <= range && d < bestD) { best = obj; bestD = d; }
        }
        return best;
    }

    private fireFromTower(tower: Phaser.GameObjects.Rectangle, target: EnemyGO): void {
        const glow = tower.getData('glow') as Phaser.GameObjects.Graphics | undefined;
        if (glow) this.scene.tweens.add({ targets: glow, alpha: { from: 1.0, to: 0.3 }, duration: 150, ease: 'Quad.Out' });
        const towerX = (tower.getData('worldX') as number) ?? tower.x;
        const towerY = (tower.getData('worldY') as number) ?? tower.y;
        this.fireBullet({ x: towerX, y: towerY, target, type: 'tower' });
    }

    private fireBullet(data: { x: number, y: number, target: EnemyGO, type: 'tower' | 'ally' }): void {
        if (data.type === 'tower') {
            const bullet = this.scene.add.rectangle(data.x, data.y, 10, 10, 0, 0).setDepth(12);
            const fireball = this.scene.add.graphics({ x: data.x, y: data.y }).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
            const fireTimer = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
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
            bullet.setData({ fireballGraphics: fireball, fireTimer });
            this.bullets.add(bullet);
            this.scene.physics.add.existing(bullet);
            const body = bullet.body as Phaser.Physics.Arcade.Body;
            body.setAllowGravity(false);
            const len = Math.hypot(data.target.x - data.x, data.target.y - data.y) || 1;
            body.setVelocity((data.target.x - data.x) / len * GameConstants.BULLET_SPEED, (data.target.y - data.y) / len * GameConstants.BULLET_SPEED);
            this.scene.tweens.add({ targets: fireball, angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });
            bullet.once(Phaser.GameObjects.Events.DESTROY, () => {
                if (fireTimer) fireTimer.remove(false);
                if (fireball?.scene) fireball.destroy();
            });
        } else { // ally
            const bullet = this.scene.add.rectangle(data.x, data.y, 6, 6, 0xbfa76a).setDepth(12);
            this.bullets.add(bullet);
            this.scene.physics.add.existing(bullet);
            const body = bullet.body as Phaser.Physics.Arcade.Body;
            body.setAllowGravity(false);
            const len = Math.hypot(data.target.x - data.x, data.target.y - data.y) || 1;
            body.setVelocity((data.target.x - data.x) / len * (GameConstants.BULLET_SPEED * 0.9), (data.target.y - data.y) / len * (GameConstants.BULLET_SPEED * 0.9));
        }
    }

    private onBulletHitEnemy(bulletObj: any, enemyObj: any): void {
        const bulletGO = bulletObj.gameObject ?? bulletObj;
        const enemyGO = enemyObj.gameObject ?? enemyObj;
        
        if (this.bullets.contains(bulletGO as any)) this.bullets.remove(bulletGO as any, true, false);
        bulletGO.destroy();
        
        const health = enemyGO.getData('health') as HealthComponent;
        if (health) {
            health.takeDamage(1);
            this.scene.tweens.add({ targets: enemyGO, tint: 0xff0000, duration: 100, yoyo: true, onComplete: () => (enemyGO as Phaser.GameObjects.Image).clearTint() });
        }
    }

    private cleanupBullets(): void {
        for (const obj of this.bullets.getChildren().slice()) {
            const b = obj as Phaser.GameObjects.GameObject & { x: number; y: number };
            if (b.x < -32 || b.y < -32 || b.x > this.scene.game.canvas.width + 32 || b.y > this.scene.game.canvas.height + 32) {
                this.bullets.remove(b as any, true, false);
                (b as any).destroy?.();
            }
        }
    }
}
