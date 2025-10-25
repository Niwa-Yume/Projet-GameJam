import Phaser from 'phaser';

export function ensureCanvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return key;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  draw(ctx);
  tex.refresh();
  return key;
}

export function ensureFlameTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_flame', 32, 48, (ctx) => {
    ctx.clearRect(0,0,32,48);
    const grd = ctx.createRadialGradient(16, 36, 2, 16, 24, 16);
    grd.addColorStop(0, 'rgba(255,230,128,0.95)');
    grd.addColorStop(0.4, 'rgba(255,160,64,0.9)');
    grd.addColorStop(1, 'rgba(120,32,8,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(16, 28, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, 20, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
  });
}

export function ensureEmberTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_ember', 8, 8, (ctx) => {
    ctx.clearRect(0,0,8,8);
    const grd = ctx.createRadialGradient(4, 4, 0.5, 4, 4, 4);
    grd.addColorStop(0, 'rgba(255,220,140,1)');
    grd.addColorStop(0.6, 'rgba(180,80,20,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(4,4,4,0,Math.PI*2); ctx.fill();
  });
}

export function ensureSmokeTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_smoke', 24, 24, (ctx) => {
    ctx.clearRect(0,0,24,24);
    const grd = ctx.createRadialGradient(12, 12, 2, 12, 12, 12);
    grd.addColorStop(0, 'rgba(90,90,90,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(12,12,12,0,Math.PI*2); ctx.fill();
  });
}

export function ensureSkeletonTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_skeleton', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);
    const bone = '#e8e2d0';
    const shade = 'rgba(0,0,0,0.9)';
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.ellipse(14, 9, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.ellipse(11, 9, 2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17, 9, 2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bone;
    ctx.fillRect(9, 13, 10, 2);
    ctx.strokeStyle = bone; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = 16 + i * 3;
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(18, y); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 16); ctx.lineTo(14, 26); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, 28); ctx.lineTo(16, 28); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(9, 18); ctx.lineTo(6, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(19, 18); ctx.lineTo(22, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, 30); ctx.lineTo(9, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, 30); ctx.lineTo(19, 34); ctx.stroke();
  });
}

