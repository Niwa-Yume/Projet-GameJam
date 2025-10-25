import Phaser from 'phaser';

export function attachHealthBar(scene: Phaser.Scene, go: Phaser.GameObjects.Rectangle): void {
  const bar = scene.add.graphics().setDepth(go.depth + 1);
  go.setData('hpBar', bar);
  const redraw = () => updateHealthBar(go);
  go.on(Phaser.GameObjects.Events.DESTROY, () => { bar.destroy(); });
  redraw();
}

export function updateHealthBar(go: Phaser.GameObjects.Rectangle): void {
  const bar = go.getData('hpBar') as Phaser.GameObjects.Graphics | undefined;
  const hp = (go.getData('hp') as number) ?? 0;
  const maxHp = (go.getData('maxHp') as number) ?? 1;
  if (!bar) return;
  const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
  const w = 48, h = 5;
  const x = go.x - w / 2;
  const y = go.y - 36;
  bar.clear();
  bar.fillStyle(0x000000, 0.55); bar.fillRect(x - 1, y - 1, w + 2, h + 2);
  bar.fillStyle(0x1a1714, 0.95); bar.fillRect(x, y, w, h);
  const color = ratio <= 0.2 ? 0x7a1a1a : 0x6d5a3a;
  bar.fillStyle(color, 0.95); bar.fillRect(x, y, w * ratio, h);
  bar.lineStyle(1, 0x9f8d62, 0.7); bar.strokeRect(x, y, w, h);
}
