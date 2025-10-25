import Phaser from 'phaser';
import { ensureSkeletonTexture } from '../gfx/CanvasTextures';

export function createSkeletonEnemy(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const key = ensureSkeletonTexture(scene);
  const img = scene.add.image(x, y, key).setDepth(8);
  scene.physics.add.existing(img);
  const body = img.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setSize(16, 24, true);
  // IMPORTANT: ne pas tweener x/y d'un objet avec un body Arcade
  // Ambiance: très légère oscillation d'angle, sans toucher la position
  scene.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return img;
}
