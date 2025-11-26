
import Phaser from 'phaser';
import { HealthComponent } from '../components/HealthComponent';
import { GameConstants } from '../scenes/GameConstants';
import { ensureKnightTexture, ensureWatcherTexture, ensureArbalestTexture } from '../gfx/CanvasTextures';

export class AllyFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public createAlly(kind: 'knight' | 'watcher' | 'arbalest', x: number, y: number): Phaser.GameObjects.Image {
        let textureKey: string;
        switch (kind) {
            case 'knight':
                textureKey = ensureKnightTexture(this.scene);
                break;
            case 'watcher':
                textureKey = ensureWatcherTexture(this.scene);
                break;
            case 'arbalest':
                textureKey = ensureArbalestTexture(this.scene);
                break;
        }
        
        const ally = this.scene.add.image(x, y, textureKey);
        ally.setDepth(10);
        this.scene.physics.add.existing(ally);
        const body = ally.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setSize(24, 32);
        body.setOffset(2, 2);
        body.setCollideWorldBounds(true);
        
        const def = GameConstants.UNIT_DEFS[kind];
        new HealthComponent(ally, def.hp);
        
        return ally;
    }
}
