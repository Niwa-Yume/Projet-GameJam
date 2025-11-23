import Phaser from 'phaser';
import { ensureKnightTexture, ensureWatcherTexture, ensureArbalestTexture } from '../gfx/CanvasTextures';
import type { AllyType } from './Ally';

/**
 * Crée le sprite d'un Chevalier
 */
export function createKnightSprite(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const key = ensureKnightTexture(scene);
  const img = scene.add.image(x, y, key).setDepth(8);
  scene.physics.add.existing(img);
  const body = img.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setSize(16, 24, true);

  // Animation légère - mouvement de garde
  scene.tweens.add({
    targets: img,
    y: y - 2,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });

  return img;
}

/**
 * Crée le sprite d'un Veilleur
 */
export function createWatcherSprite(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const key = ensureWatcherTexture(scene);
  const img = scene.add.image(x, y, key).setDepth(8);
  scene.physics.add.existing(img);
  const body = img.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setSize(16, 24, true);

  // Animation agile - oscillation rapide
  scene.tweens.add({
    targets: img,
    angle: { from: -3, to: 3 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });

  // Effet yeux brillants
  const glowTimer = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (!img.scene) return;
      // L'effet de lueur est déjà dans la texture
    }
  });

  img.setData('glowTimer', glowTimer);

  img.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (glowTimer) glowTimer.remove(false);
  });

  return img;
}

/**
 * Crée le sprite d'un Arbalétrier
 */
export function createArbalestSprite(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const key = ensureArbalestTexture(scene);
  const img = scene.add.image(x, y, key).setDepth(8);
  scene.physics.add.existing(img);
  const body = img.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setSize(16, 24, true);

  // Animation stable - tireur d'élite concentré
  scene.tweens.add({
    targets: img,
    scaleX: { from: 0.98, to: 1.02 },
    scaleY: { from: 1.02, to: 0.98 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });

  return img;
}

/**
 * Factory pour créer le bon sprite selon le type d'allié
 */
export function createAllySprite(scene: Phaser.Scene, type: AllyType, x: number, y: number): Phaser.GameObjects.Image {
  switch (type) {
    case 'knight':
      return createKnightSprite(scene, x, y);
    case 'watcher':
      return createWatcherSprite(scene, x, y);
    case 'arbalest':
      return createArbalestSprite(scene, x, y);
    default:
      throw new Error(`Type d'allié inconnu: ${type}`);
  }
}

/**
 * Effet de combat pour un allié (flash ou autre)
 */
export function allyAttackEffect(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  // Flash blanc lors de l'attaque
  sprite.setTint(0xffffff);

  scene.time.delayedCall(100, () => {
    if (sprite && sprite.scene) {
      sprite.clearTint();
    }
  });
}

/**
 * Effet de prise de dégâts pour un allié
 */
export function allyDamageEffect(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  // Flash rouge
  sprite.setTint(0xff4444);

  scene.time.delayedCall(150, () => {
    if (sprite && sprite.scene) {
      sprite.clearTint();
    }
  });

  // Shake léger
  scene.tweens.add({
    targets: sprite,
    x: sprite.x + 3,
    duration: 50,
    yoyo: true,
    repeat: 2
  });
}

/**
 * Effet de mort pour un allié
 */
export function allyDeathEffect(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
  // Tween de disparition
  scene.tweens.add({
    targets: sprite,
    alpha: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    angle: 90,
    duration: 500,
    ease: 'Power2',
    onComplete: () => {
      if (sprite && sprite.scene) {
        sprite.destroy();
      }
    }
  });

  // Particules d'âme (optionnel)
  const particles = scene.add.particles(sprite.x, sprite.y, 'tex_ember', {
    speed: { min: 20, max: 60 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 800,
    gravityY: -50,
    quantity: 8
  });

  scene.time.delayedCall(1000, () => {
    if (particles && particles.scene) {
      particles.destroy();
    }
  });
}

