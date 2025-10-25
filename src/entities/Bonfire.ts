import Phaser from 'phaser';
import { ensureEmberTexture, ensureFlameTexture, ensureSmokeTexture } from '../gfx/CanvasTextures';

export function createBonfire(scene: Phaser.Scene, x: number, y: number): void {
  const cont = scene.add.container(0, 0).setDepth(5);
  const base = scene.add.graphics();
  base.fillStyle(0x1b1916, 1).fillCircle(x, y + 12, 22).lineStyle(1, 0x3e372d, 0.7).strokeCircle(x, y + 12, 22);
  const stones = scene.add.graphics();
  stones.fillStyle(0x2b2723, 1);
  const placeStone = (ang: number, r: number, w: number, h: number) => {
    const cx = x + Math.cos(ang) * r;
    const cy = y + 12 + Math.sin(ang) * r;
    stones.fillRect(cx - w/2, cy - h/2, w, h);
  };
  for (let i = 0; i < 6; i++) placeStone((i / 6) * Math.PI * 2, 18 + Phaser.Math.Between(-2,2), Phaser.Math.Between(6,10), Phaser.Math.Between(3,5));
  stones.lineStyle(1, 0x3e372d, 0.5).strokeCircle(x, y + 12, 16);

  const logs = scene.add.graphics();
  logs.fillStyle(0x3a2b1d, 1);
  const drawLog = (ang: number) => {
    logs.save(); logs.translateCanvas(x, y + 6); logs.rotateCanvas(ang); logs.fillRect(-14, -3, 28, 6); logs.restore();
  };
  drawLog(0.6); drawLog(-0.6); logs.lineStyle(1, 0x2a1e14, 0.9);

  const swordGlow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const sword = scene.add.graphics();
  const drawSword = () => {
    swordGlow.clear(); sword.clear();
    sword.fillStyle(0x3e372d, 1).fillRect(x - 8, y + 2, 16, 2);
    sword.fillStyle(0x2b2520, 1).fillRect(x - 1.5, y - 10, 3, 12);
    sword.fillStyle(0xffd79a, 1).fillRect(x - 1, y - 36, 2, 26);
    swordGlow.fillStyle(0xffc67a, 0.22).fillEllipse(x, y - 22, 14, 34);
  };
  drawSword();
  scene.tweens.add({ targets: swordGlow, duration: 1000, yoyo: true, repeat: -1, alpha: { from: 0.18, to: 0.3 } });

  const halo = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const drawHalo = (alpha: number, r: number) => {
    halo.clear(); halo.fillStyle(0xffb46a, alpha).fillCircle(x, y, r).lineStyle(1, 0xffdd99, Math.min(1, alpha + 0.1)).strokeCircle(x, y, r + 2);
  };
  drawHalo(0.22, 34);
  scene.tweens.add({ targets: halo, duration: 900, yoyo: true, repeat: -1, onUpdate: (tw) => {
    const v = tw.progress; drawHalo(0.16 + 0.10 * (1 - Math.abs(0.5 - v) * 2), 30 + 6 * v);
  }});

  const flameKey = ensureFlameTexture(scene);
  const flames = scene.add.particles(0, 0, flameKey, {
    x: { min: x - 6, max: x + 6 }, y: { min: y - 6, max: y + 2 },
    speedX: { min: -10, max: 10 }, speedY: { min: -80, max: -140 },
    lifespan: { min: 400, max: 800 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 }, quantity: 1, frequency: 50, tint: [0xffe08a, 0xffb46a, 0xff8a4b], blendMode: 'ADD'
  });
  flames.setDepth(10);

  const emberTex = ensureEmberTexture(scene);
  const sparks = scene.add.particles(0, 0, emberTex, {
    x: { min: x - 4, max: x + 4 }, y: { min: y - 8, max: y - 2 }, speedX: { min: -30, max: 30 }, speedY: { min: -140, max: -180 }, lifespan: { min: 250, max: 450 }, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.8, end: 0 }, quantity: 1, frequency: 250, tint: [0xfff0b3, 0xffd27a], blendMode: 'ADD'
  });
  sparks.setDepth(12);

  const embers = scene.add.particles(0, 0, emberTex, {
    x: { min: x - 10, max: x + 10 }, y: { min: y - 4, max: y + 4 }, speedX: { min: -20, max: 20 }, speedY: { min: -30, max: -60 }, lifespan: { min: 1200, max: 2200 }, scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.6, end: 0 }, quantity: 1, frequency: 90, blendMode: 'ADD'
  });
  embers.setDepth(11);

  const smokeKey = ensureSmokeTexture(scene);
  const smoke = scene.add.particles(0, 0, smokeKey, {
    x: { min: x - 8, max: x + 8 }, y: { min: y - 10, max: y - 2 }, speedX: { min: -10, max: 10 }, speedY: { min: -20, max: -40 }, lifespan: { min: 1200, max: 2000 }, scale: { start: 0.8, end: 1.2 }, alpha: { start: 0.25, end: 0 }, frequency: 110
  });
  smoke.setDepth(6);

  cont.add([base, stones, logs, swordGlow, sword, halo]);
}

