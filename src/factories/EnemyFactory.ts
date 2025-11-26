
import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { ensureBossSkeletonTexture, ensureSkeletonTexture } from '../gfx/CanvasTextures';

export class EnemyFactory {
    private scene: Phaser.Scene;
    private skeletonTextureKey: string;
    private bossSkeletonTextureKey: string;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.skeletonTextureKey = ensureSkeletonTexture(this.scene);
        this.bossSkeletonTextureKey = ensureBossSkeletonTexture(this.scene);
    }

    public createEnemy(kind: 'skeleton' | 'boss_skeleton', x: number, y: number): Phaser.GameObjects.Image {
        switch (kind) {
            case 'skeleton':
                return this.createSkeletonEnemy(x, y);
            case 'boss_skeleton':
                return this.createBossSkeletonEnemy(x, y);
        }
    }

    private createSkeletonEnemy(x: number, y: number): Phaser.GameObjects.Image {
        const enemy = this.scene.add.image(x, y, this.skeletonTextureKey);
        enemy.setDepth(10);
        this.scene.physics.add.existing(enemy);
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setSize(24, 32);
        body.setOffset(12, 16);
        return enemy;
    }

    private createBossSkeletonEnemy(x: number, y: number): Phaser.GameObjects.Image {
        const enemy = this.scene.add.image(x, y, this.bossSkeletonTextureKey);
        enemy.setDepth(11);
        enemy.setScale(GameConstants.BOSS_SIZE_MULTIPLIER);
        this.scene.physics.add.existing(enemy);
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setSize(32 * GameConstants.BOSS_SIZE_MULTIPLIER, 48 * GameConstants.BOSS_SIZE_MULTIPLIER);
        body.setOffset(16, 16);
        return enemy;
    }
}
