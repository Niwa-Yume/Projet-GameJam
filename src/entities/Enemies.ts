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

// MINI-BOSS : Squelette géant plus gros et plus menaçant
export function createBossSkeletonEnemy(scene: Phaser.Scene, x: number, y: number, sizeMultiplier: number): Phaser.GameObjects.Image {
  const key = ensureSkeletonTexture(scene);
  const img = scene.add.image(x, y, key).setDepth(9); // Depth +1 pour passer au-dessus

  // Taille augmentée
  img.setScale(sizeMultiplier);

  scene.physics.add.existing(img);
  const body = img.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setSize(16 * sizeMultiplier, 24 * sizeMultiplier, true);

  // Animation plus lente et plus menaçante
  scene.tweens.add({
    targets: img,
    angle: { from: -3, to: 3 },
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.InOut'
  });

  // Aura rouge intimidante autour du boss
  const aura = scene.add.graphics({ x, y }).setDepth(8);
  aura.setBlendMode(Phaser.BlendModes.ADD);

  const drawBossAura = () => {
    aura.clear();
    const time = Date.now() * 0.002;
    const pulse = Math.sin(time) * 0.3 + 0.7;

    // Aura rouge menaçante
    aura.fillStyle(0xff3333, 0.2 * pulse);
    aura.fillCircle(0, 0, 30 * sizeMultiplier);

    aura.fillStyle(0xff6633, 0.15 * pulse);
    aura.fillCircle(0, 0, 40 * sizeMultiplier);

    // Anneaux pulsants
    aura.lineStyle(2, 0xff4444, 0.4 * pulse);
    aura.strokeCircle(0, 0, 25 * sizeMultiplier + Math.sin(time * 2) * 5);
  };

  const auraTimer = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      if (!img.scene) return;
      aura.setPosition(img.x, img.y);
      drawBossAura();
    }
  });

  // Stocker l'aura et le timer pour nettoyage
  img.setData('bossAura', aura);
  img.setData('auraTimer', auraTimer);

  // Marquer comme boss
  img.setData('isBoss', true);

  // Nettoyage à la destruction
  img.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (auraTimer) auraTimer.remove(false);
    if (aura && aura.scene) aura.destroy();
  });

  return img;
}

