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
 * Texture du Chevalier (Knight) - Style Elite Knight Dark Souls
 * Armure sombre usée par le temps, épaulières imposantes, casque fermé
 */
export function ensureKnightTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_knight', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs Dark Souls - armure sombre et usée
    const armorDark = '#2a2a2a';
    const armorMid = '#3d3d3d';
    const armorLight = '#555555';
    const rust = '#4a3528';
    const cape = '#1a1a1a';
    const capeHighlight = '#2d2525';
    const eyeGlow = '#cc4400';

    // Cape déchirée dans le dos
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.lineTo(5, 32);
    ctx.lineTo(8, 34);
    ctx.lineTo(11, 33);
    ctx.lineTo(10, 15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 14);
    ctx.lineTo(23, 32);
    ctx.lineTo(20, 34);
    ctx.lineTo(17, 33);
    ctx.lineTo(18, 15);
    ctx.fill();
    // Déchirures
    ctx.fillStyle = capeHighlight;
    ctx.fillRect(6, 30, 2, 3);
    ctx.fillRect(21, 28, 2, 4);

    // Casque fermé Elite Knight style
    ctx.fillStyle = armorMid;
    ctx.beginPath();
    ctx.ellipse(14, 9, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visière en T (style Dark Souls)
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(10, 8, 8, 2);
    ctx.fillRect(13, 8, 2, 5);

    // Lueur orange dans la visière
    ctx.fillStyle = eyeGlow;
    ctx.shadowColor = eyeGlow;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(12, 9, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 9, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Crête du casque
    ctx.fillStyle = armorLight;
    ctx.beginPath();
    ctx.moveTo(14, 2);
    ctx.lineTo(12, 5);
    ctx.lineTo(16, 5);
    ctx.fill();

    // Épaulières imposantes
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    ctx.ellipse(8, 15, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, 15, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Détails épaulières
    ctx.strokeStyle = rust;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(8, 15, 3, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(20, 15, 3, 0, Math.PI);
    ctx.stroke();

    // Torse - armure à plaques lourde
    ctx.fillStyle = armorDark;
    ctx.fillRect(9, 15, 10, 12);

    ctx.fillStyle = armorMid;
    ctx.fillRect(10, 16, 8, 10);

    // Détails plaques
    ctx.strokeStyle = armorLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.lineTo(14, 26);
    ctx.stroke();
    ctx.strokeStyle = rust;
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.lineTo(18, 20);
    ctx.stroke();

    // Grande épée sur l'épaule
    ctx.fillStyle = '#444444';
    ctx.fillRect(21, 8, 3, 20);
    ctx.fillStyle = armorLight;
    ctx.fillRect(21, 6, 3, 3);
    // Garde
    ctx.fillStyle = rust;
    ctx.fillRect(19, 9, 7, 2);

    // Bouclier Grass Crest style
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    ctx.ellipse(6, 20, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a5f3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(6, 20, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Jambes blindées
    ctx.fillStyle = armorDark;
    ctx.fillRect(10, 27, 4, 7);
    ctx.fillRect(14, 27, 4, 7);

    // Genouillères
    ctx.fillStyle = armorMid;
    ctx.beginPath();
    ctx.ellipse(12, 28, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 28, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottes lourdes
    ctx.fillStyle = armorDark;
    ctx.fillRect(9, 33, 5, 3);
    ctx.fillRect(14, 33, 5, 3);
  });
}

/**
 * Texture du Veilleur (Watcher) - Style Abyss Watcher Dark Souls 3
 * Chapeau pointu, cape flottante, épée enflammée
 */
export function ensureWatcherTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_watcher', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs Abyss Watcher
    const cloakDark = '#1a1a1a';
    const cloak = '#2d2d2d';
    const cloakHighlight = '#3a3a3a';
    const leather = '#3d2d1d';
    const flame = '#ff6600';
    const flameCore = '#ffaa00';
    const metal = '#6a6a6a';

    // Grande cape flottante (signature des Abyss Watchers)
    ctx.fillStyle = cloakDark;
    ctx.beginPath();
    ctx.moveTo(6, 12);
    ctx.lineTo(2, 34);
    ctx.lineTo(7, 36);
    ctx.lineTo(10, 34);
    ctx.lineTo(9, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.lineTo(26, 34);
    ctx.lineTo(21, 36);
    ctx.lineTo(18, 34);
    ctx.lineTo(19, 14);
    ctx.fill();
    // Détails déchirés
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(3, 32);
    ctx.lineTo(5, 35);
    ctx.lineTo(6, 32);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, 33);
    ctx.lineTo(24, 36);
    ctx.lineTo(25, 33);
    ctx.fill();

    // Chapeau pointu (signature)
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(7, 11);
    ctx.lineTo(21, 11);
    ctx.closePath();
    ctx.fill();
    // Bord du chapeau
    ctx.fillStyle = cloakHighlight;
    ctx.beginPath();
    ctx.ellipse(14, 11, 8, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visage dans l'ombre
    ctx.fillStyle = 'rgba(10,10,10,0.98)';
    ctx.beginPath();
    ctx.ellipse(14, 12, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yeux rouges perçants (corrompus par l'Abyss)
    ctx.fillStyle = '#cc2222';
    ctx.shadowColor = '#cc2222';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(12, 12, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 12, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Torse - armure légère style Legion
    ctx.fillStyle = leather;
    ctx.fillRect(10, 15, 8, 10);

    // Détails armure
    ctx.strokeStyle = cloakHighlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 15);
    ctx.lineTo(14, 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 18);
    ctx.lineTo(18, 18);
    ctx.stroke();

    // Épaulières légères
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.ellipse(9, 15, 2.5, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(19, 15, 2.5, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Épée enflammée Farron (signature)
    ctx.fillStyle = metal;
    ctx.fillRect(21, 10, 2, 16);
    // Garde
    ctx.fillRect(19, 12, 6, 2);
    // Flammes sur la lame
    ctx.fillStyle = flame;
    ctx.shadowColor = flame;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(22, 10);
    ctx.quadraticCurveTo(24, 8, 23, 5);
    ctx.quadraticCurveTo(22, 8, 22, 10);
    ctx.fill();
    ctx.fillStyle = flameCore;
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.quadraticCurveTo(23, 9, 22.5, 7);
    ctx.quadraticCurveTo(22, 10, 22, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dague dans l'autre main
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.lineTo(4, 12);
    ctx.lineTo(5, 12);
    ctx.lineTo(7, 18);
    ctx.fill();

    // Jambes
    ctx.fillStyle = cloakDark;
    ctx.fillRect(10, 25, 4, 8);
    ctx.fillRect(14, 25, 4, 8);

    // Bottes légères
    ctx.fillStyle = leather;
    ctx.fillRect(9, 33, 5, 3);
    ctx.fillRect(14, 33, 5, 3);
  });
}

/**
 * Texture de l'Arbalétrier (Arbalest) - Style Silver Knight Archer Dark Souls
 * Armure argentée élégante, grand arc, posture noble
 */
export function ensureArbalestTexture(scene: Phaser.Scene): string {
  return ensureCanvasTexture(scene, 'tex_arbalest', 28, 36, (ctx) => {
    ctx.clearRect(0,0,28,36);

    // Couleurs Silver Knight
    const armorSilver = '#b8b8c8';
    const armorLight = '#d8d8e8';
    const armorDark = '#888898';
    const capeDark = '#1a1a2a';
    const cape = '#2a2a3a';
    const gold = '#c9a227';
    const bow = '#4a3a2a';
    const bowLight = '#6a5a4a';

    // Cape courte royale
    ctx.fillStyle = capeDark;
    ctx.beginPath();
    ctx.moveTo(7, 14);
    ctx.lineTo(4, 28);
    ctx.lineTo(8, 30);
    ctx.lineTo(10, 16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, 14);
    ctx.lineTo(24, 28);
    ctx.lineTo(20, 30);
    ctx.lineTo(18, 16);
    ctx.fill();
    // Bordure dorée
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 28);
    ctx.lineTo(8, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24, 28);
    ctx.lineTo(20, 30);
    ctx.stroke();

    // Casque Silver Knight (élégant, pointu)
    ctx.fillStyle = armorSilver;
    ctx.beginPath();
    ctx.ellipse(14, 9, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crête du casque
    ctx.fillStyle = armorLight;
    ctx.beginPath();
    ctx.moveTo(14, 1);
    ctx.lineTo(11, 6);
    ctx.lineTo(17, 6);
    ctx.closePath();
    ctx.fill();

    // Visière fendue (style Silver Knight)
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(10, 9, 8, 1.5);
    ctx.fillRect(13, 8, 2, 4);

    // Lueur bleue froide dans les yeux
    ctx.fillStyle = '#6688cc';
    ctx.shadowColor = '#6688cc';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.ellipse(12, 9.5, 0.8, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 9.5, 0.8, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Détails dorés casque
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(14, 9, 7, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();

    // Torse - armure Silver Knight élégante
    ctx.fillStyle = armorDark;
    ctx.fillRect(9, 14, 10, 12);

    ctx.fillStyle = armorSilver;
    ctx.fillRect(10, 15, 8, 10);

    // Détails plaques
    ctx.strokeStyle = armorLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 15);
    ctx.lineTo(14, 25);
    ctx.stroke();

    // Symbole du soleil (Anor Londo)
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(14, 19, 2, 0, Math.PI * 2);
    ctx.fill();
    // Rayons
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      ctx.beginPath();
      ctx.moveTo(14 + Math.cos(angle) * 2.5, 19 + Math.sin(angle) * 2.5);
      ctx.lineTo(14 + Math.cos(angle) * 4, 19 + Math.sin(angle) * 4);
      ctx.stroke();
    }

    // Épaulières élégantes
    ctx.fillStyle = armorSilver;
    ctx.beginPath();
    ctx.ellipse(8, 15, 3.5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(20, 15, 3.5, 2.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Bordure dorée
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(8, 15, 3, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(20, 15, 3, 0, Math.PI);
    ctx.stroke();

    // DRAGONSLAYER GREATBOW (grand arc)
    ctx.fillStyle = bow;
    ctx.fillRect(23, 4, 2, 26);
    // Arc courbé
    ctx.strokeStyle = bowLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(22, 17, 12, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
    // Corde
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 6);
    ctx.lineTo(24, 28);
    ctx.stroke();
    // Flèche énorme
    ctx.fillStyle = bow;
    ctx.fillRect(15, 16.5, 8, 1.5);
    // Pointe de flèche
    ctx.fillStyle = armorSilver;
    ctx.beginPath();
    ctx.moveTo(15, 17.25);
    ctx.lineTo(12, 16);
    ctx.lineTo(12, 18.5);
    ctx.fill();
    // Empennage
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(23, 16);
    ctx.lineTo(25, 15);
    ctx.lineTo(25, 19);
    ctx.lineTo(23, 18);
    ctx.fill();

    // Carquois sur le dos
    ctx.fillStyle = armorDark;
    ctx.fillRect(5, 14, 3, 10);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(5, 14, 3, 10);
    // Flèches visibles
    ctx.fillStyle = bow;
    ctx.fillRect(5.5, 10, 0.8, 5);
    ctx.fillRect(6.5, 11, 0.8, 4);
    ctx.fillRect(7.5, 10, 0.8, 5);

    // Jambes blindées
    ctx.fillStyle = armorDark;
    ctx.fillRect(10, 26, 4, 7);
    ctx.fillRect(14, 26, 4, 7);

    // Genouillères
    ctx.fillStyle = armorSilver;
    ctx.beginPath();
    ctx.ellipse(12, 27, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 27, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottes élégantes
    ctx.fillStyle = armorSilver;
    ctx.fillRect(9, 33, 5, 3);
    ctx.fillRect(14, 33, 5, 3);
  });
}

export function ensureRectangleTexture(scene: Phaser.Scene, key: string, width: number, height: number, color: number): string {
  return ensureCanvasTexture(scene, key, width, height, (ctx) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, width, height);
  });
}
