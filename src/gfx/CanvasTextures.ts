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

export function ensureBossSkeletonTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_boss_skeleton', 42, 54, (ctx) => {
    ctx.clearRect(0,0,42,54);
    const bone = '#f0e8d8';
    const shade = 'rgba(0,0,0,0.9)';
    const armor = '#5a4a3a';
    const armorShade = '#3a2a1a';

    // Helmet
    ctx.fillStyle = armor;
    ctx.beginPath(); ctx.ellipse(21, 13, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = armorShade;
    ctx.fillRect(14, 12, 14, 3);

    // Skull
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.ellipse(21, 14, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.ellipse(17, 14, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(25, 14, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.strokeStyle = bone; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const y = 24 + i * 4;
      ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(27, y); ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(21, 24); ctx.lineTo(21, 40); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(18, 42); ctx.lineTo(24, 42); ctx.stroke();

    // Limbs
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, 28); ctx.lineTo(8, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 28); ctx.lineTo(34, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, 44); ctx.lineTo(14, 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, 44); ctx.lineTo(28, 50); ctx.stroke();
  });
}

/**
 * Texture du Chevalier (Knight) - Bleu armure lourde
 */
export function ensureKnightTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_knight', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs chevalier
    const armor = '#4a7ba7'; // Bleu métallique
    const armorLight = '#6a9bc7';
    const armorDark = '#2a5b87';
    const plume = '#c74444'; // Plume rouge
    const metal = '#c0c0c0'; // Métal argent

    // Casque avec visière
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.ellipse(14, 9, 7.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Plume rouge sur le casque
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.quadraticCurveTo(12, 2, 10, 5);
    ctx.quadraticCurveTo(11, 3, 14, 4);
    ctx.fill();

    // Visière (fente horizontale)
    ctx.fillStyle = 'rgba(20,20,20,0.9)';
    ctx.fillRect(9, 9, 10, 2);

    // Détails casque
    ctx.strokeStyle = armorLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(14, 9, 7.5, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();

    // Torse - armure à plaques
    ctx.fillStyle = armorDark;
    ctx.fillRect(10, 15, 8, 10);

    ctx.fillStyle = armor;
    ctx.fillRect(11, 16, 6, 8);

    // Ligne centrale armure
    ctx.strokeStyle = armorLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.lineTo(14, 24);
    ctx.stroke();

    // Bouclier (petit, sur le côté)
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.ellipse(7, 20, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = armorDark;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Épée (sur l'autre côté)
    ctx.strokeStyle = metal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(21, 17);
    ctx.lineTo(23, 23);
    ctx.stroke();

    // Garde épée
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(19, 18);
    ctx.lineTo(25, 18);
    ctx.stroke();

    // Jambes blindées
    ctx.fillStyle = armorDark;
    ctx.fillRect(11, 25, 3, 8);
    ctx.fillRect(14, 25, 3, 8);

    // Bottes
    ctx.fillStyle = armor;
    ctx.fillRect(10, 33, 4, 3);
    ctx.fillRect(14, 33, 4, 3);
  });
}

/**
 * Texture du Veilleur (Watcher) - Vert agile avec capuche
 */
export function ensureWatcherTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_watcher', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs veilleur
    const cloak = '#3a5f3a'; // Vert forêt
    const cloakDark = '#2a4f2a';
    const leather = '#8b6f47'; // Cuir marron
    const eye = '#90ee90'; // Vert lumineux

    // Capuche
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.arc(14, 9, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cloakDark;
    ctx.beginPath();
    ctx.arc(14, 8, 7, 0, Math.PI);
    ctx.fill();

    // Visage dans l'ombre
    ctx.fillStyle = 'rgba(20,20,20,0.95)';
    ctx.beginPath();
    ctx.ellipse(14, 10, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yeux brillants verts (signature du veilleur)
    ctx.fillStyle = eye;
    ctx.shadowColor = eye;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.ellipse(12, 10, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 10, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cape/manteau
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(9, 14);
    ctx.lineTo(6, 28);
    ctx.lineTo(9, 30);
    ctx.lineTo(10, 15);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(19, 14);
    ctx.lineTo(22, 28);
    ctx.lineTo(19, 30);
    ctx.lineTo(18, 15);
    ctx.fill();

    // Torse - armure légère en cuir
    ctx.fillStyle = leather;
    ctx.fillRect(11, 15, 6, 9);

    // Sangles cuir
    ctx.strokeStyle = cloakDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(11, 18);
    ctx.lineTo(17, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, 21);
    ctx.lineTo(17, 21);
    ctx.stroke();

    // Dagues croisées (dans le dos visible)
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 17);
    ctx.lineTo(9, 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(17, 17);
    ctx.lineTo(19, 13);
    ctx.stroke();

    // Jambes
    ctx.fillStyle = cloakDark;
    ctx.fillRect(11, 24, 3, 9);
    ctx.fillRect(14, 24, 3, 9);

    // Bottes légères
    ctx.fillStyle = leather;
    ctx.fillRect(10, 33, 4, 3);
    ctx.fillRect(14, 33, 4, 3);
  });
}

/**
 * Texture de l'Arbalétrier (Arbalest) - Rouge/Marron avec arbalète
 */
export function ensureArbalestTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_arbalest', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs arbalétrier
    const tunic = '#a04040'; // Rouge/brun
    const tunicDark = '#804020';
    const wood = '#6b4423'; // Bois arbalète
    const metal = '#c0c0c0';
    const leather = '#5a4a3a';

    // Chapeau/casque léger
    ctx.fillStyle = leather;
    ctx.beginPath();
    ctx.ellipse(14, 8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bord du chapeau
    ctx.fillStyle = tunicDark;
    ctx.beginPath();
    ctx.ellipse(14, 9, 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visage
    ctx.fillStyle = '#f4d0a8';
    ctx.beginPath();
    ctx.ellipse(14, 11, 4.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yeux concentrés (tireur d'élite)
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(12, 11, 1, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 11, 1, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tunique
    ctx.fillStyle = tunic;
    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.lineTo(10, 26);
    ctx.lineTo(18, 26);
    ctx.lineTo(18, 15);
    ctx.fill();

    // Ceinture
    ctx.fillStyle = leather;
    ctx.fillRect(10, 23, 8, 2);

    // Détails tunique
    ctx.strokeStyle = tunicDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 15);
    ctx.lineTo(14, 26);
    ctx.stroke();

    // ARBALÈTE (caractéristique principale)
    // Corps de l'arbalète
    ctx.fillStyle = wood;
    ctx.fillRect(19, 18, 8, 3);

    // Arc de l'arbalète
    ctx.strokeStyle = wood;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(23, 19.5, 5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Corde
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 16);
    ctx.lineTo(20, 23);
    ctx.stroke();

    // Mécanisme
    ctx.fillStyle = metal;
    ctx.fillRect(18, 19, 2, 2);

    // Carreau (flèche)
    ctx.strokeStyle = wood;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 19.5);
    ctx.lineTo(20, 19.5);
    ctx.stroke();

    // Pointe du carreau
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(15, 19.5);
    ctx.lineTo(13, 18.5);
    ctx.lineTo(13, 20.5);
    ctx.fill();

    // Carquois sur le dos
    ctx.fillStyle = leather;
    ctx.fillRect(8, 16, 2, 8);
    ctx.strokeStyle = tunicDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, 14);
    ctx.lineTo(9, 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 14);
    ctx.lineTo(7, 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, 14);
    ctx.lineTo(11, 16);
    ctx.stroke();

    // Jambes
    ctx.fillStyle = tunicDark;
    ctx.fillRect(11, 26, 3, 7);
    ctx.fillRect(14, 26, 3, 7);

    // Bottes
    ctx.fillStyle = leather;
    ctx.fillRect(10, 33, 4, 3);
    ctx.fillRect(14, 33, 4, 3);
  });
}

export function ensureRectangleTexture(scene: Phaser.Scene, key: string, width: number, height: number, color: number): string {
  return ensureCanvasTexture(scene, key, width, height, (ctx) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, width, height);
  });
}
