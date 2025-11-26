
import Phaser from 'phaser';
import { HealthComponent } from '../components/HealthComponent';
import { GameConstants } from '../scenes/GameConstants';

export class AllyFactory {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public createAlly(kind: 'knight' | 'watcher' | 'arbalest', x: number, y: number): Phaser.GameObjects.Image {
        const ally = this.scene.add.image(x, y, kind);
        ally.setDepth(10);
        this.scene.physics.add.existing(ally);
        const body = ally.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setSize(24, 32);
        body.setOffset(12, 16);
        body.setCollideWorldBounds(true);
        
        const def = GameConstants.UNIT_DEFS[kind];
        new HealthComponent(ally, def.hp);
        
        return ally;
    }
}
