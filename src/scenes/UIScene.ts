import Phaser from 'phaser';
import { GameScene } from './GameScene';

/**
 * UIScene: scène dédiée à l'interface utilisateur (overlay)
 */
export class UIScene extends Phaser.Scene {
  // Thème Dark Souls-like (palette plus sobre)
  private theme = {
    panelFill: 0x12110f,
    panelAlpha: 0.88,
    panelStroke: 0x3e372d,
    gold: 0x9f8d62,      // doré désaturé
    goldDim: 0x6f634a,   // doré atténué
    accent: 0x6d5a3a,    // laiton/brun pour barres
    text: '#d6ceb1',     // ivoire doux
    textDim: '#8f8466',  // ivoire atténué
    disabled: 0x4b463e,
    buttonFill: 0x0f0e0d,
    buttonFillHover: 0x171411,
    buttonFillActive: 0x1f1b16
  } as const;

  private shardsText!: Phaser.GameObjects.Text;
  private onShardsChanged?: (parent: Phaser.Data.DataManager, value: number, previousValue: number) => void;
  private onMaxShardsChanged?: (parent: Phaser.Data.DataManager, value: number, previousValue: number) => void;

  // PV du sanctuaire
  private hpText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private onHPChanged?: (parent: Phaser.Data.DataManager, value: number, previousValue: number) => void;

  // Nouveau: coût de tour et vague
  private costText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private waveProgBg!: Phaser.GameObjects.Graphics;
  private waveProgFill!: Phaser.GameObjects.Graphics;
  private onCostChanged?: (parent: Phaser.Data.DataManager, value: number, previousValue: number) => void;
  private onWaveChanged?: (parent: Phaser.Data.DataManager, value: number, previousValue: number) => void;

  // Sélecteurs de construction
  private btnTower!: Phaser.GameObjects.Container;
  private btnWall!: Phaser.GameObjects.Container;
  private btnGenerator!: Phaser.GameObjects.Container;
  private btnCampfire!: Phaser.GameObjects.Container;
  private btnForge!: Phaser.GameObjects.Container;
  private btnStorage!: Phaser.GameObjects.Container;
  private btnBarracks!: Phaser.GameObjects.Container; // nouveau
  private currentKind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks' = 'tower';

  // Bouton Lancer Vague
  private waveButton!: Phaser.GameObjects.Container;
  private onWaveActiveChanged?: (parent: Phaser.Data.DataManager, value: boolean, previousValue: boolean) => void;

  // Recrutement
  private recruitKnight!: Phaser.GameObjects.Container;
  private recruitWatcher!: Phaser.GameObjects.Container;
  private recruitArbalest!: Phaser.GameObjects.Container;
  private knightCost = 20;
  private watcherCost = 35;
  private arbalestCost = 30;

  // Tooltip et toast
  private tooltipBg?: Phaser.GameObjects.Rectangle;
  private tooltipTxt?: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Container[] = [];

  // Overlay Game Over
  private gameOverShown = false;
  private gameOverContainer?: Phaser.GameObjects.Container;

  // Overlay Pause
  private pauseContainer?: Phaser.GameObjects.Container;

  // Labels et panneaux
  private waveProgLabel!: Phaser.GameObjects.Text;
  private hpBarLabel!: Phaser.GameObjects.Text;
  // Champs de layout pour barres
  private hpBarX = 0; private hpBarY = 0; private hpBarW = 260; private hpBarH = 8;
  private waveBarX = 0; private waveBarY = 0; private waveBarW = 280; private waveBarH = 6;

  constructor() {
    super('UIScene');
  }

  preload(): void {}

  // Ajoute une vignette sombre aux bords de l'écran
  private addVignetteEdges(thickness = 48, alpha = 0.18): void {
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const edges: Phaser.GameObjects.Rectangle[] = [];
    edges.push(this.add.rectangle(w/2, thickness/2, w, thickness, 0x000000, alpha)); // haut
    edges.push(this.add.rectangle(w/2, h - thickness/2, w, thickness, 0x000000, alpha + 0.05)); // bas un peu plus sombre
    edges.push(this.add.rectangle(thickness/2, h/2, thickness, h, 0x000000, alpha)); // gauche
    edges.push(this.add.rectangle(w - thickness/2, h/2, thickness, h, 0x000000, alpha)); // droite
    for (const r of edges) {
      r.setScrollFactor(0).setDepth(-1).setBlendMode(Phaser.BlendModes.MULTIPLY).disableInteractive();
    }
  }

  private ensureAshTexture(): string {
    const key = 'ash';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, 6, 6);
      if (tex) {
        const ctx = tex.getContext() as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(3, 3, 2, 0, Math.PI * 2); ctx.fill();
        tex.refresh();
      }
    }
    return key;
  }

  private addAshParticles(): void {
    const key = this.ensureAshTexture();
    const pm = this.add.particles(0, 0, key, {
      x: { min: 0, max: this.cameras.main.width },
      y: this.cameras.main.height + 10,
      lifespan: { min: 5000, max: 9000 },
      speedX: { min: -12, max: 12 },
      speedY: { min: -30, max: -50 },
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.18, end: 0 },
      tint: [0x9f8d62, 0x6d5a3a, 0xb3a27a, 0xaaaaaa],
      quantity: 1,
      frequency: 380,
      blendMode: 'ADD'
    });
    pm.setScrollFactor(0).setDepth(0);
  }

  private drawSeparator(x: number, y: number, w: number): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(0);
    g.lineStyle(1, this.theme.goldDim, 0.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.strokePath();
  }

  create(): void {
    const camW = this.cameras.main.width;

    // Constantes layout
    const M = 16;
    const BTN_W = 160, BTN_H = 30, BTN_SP = 10;

    // HUD haut: Âmes à gauche, Vague à droite
    this.addVignetteEdges();
    this.addAshParticles();
    this.drawDiamond(M, M + 14, 8, this.theme.gold).setScrollFactor(0);
    this.shardsText = this.add.text(M + 20, M + 4, this.formatShardsLabel(), this.txtStyle(18)).setScrollFactor(0);

    // Vague à droite
    const rightBase = camW - M;
    const waveHeaderY = M + 4;
    this.waveText = this.add.text(rightBase - 140, waveHeaderY, `Vague: ${(this.registry.get('wave') as number) ?? 1}`, this.txtStyle(14, true)).setOrigin(0, 0).setScrollFactor(0);

    // Bouton Vague sous l'entête
    this.waveButton = this.createActionButton(rightBase, waveHeaderY + 20, 'Lancer Vague', () => {
      const game = this.scene.get('GameScene') as GameScene;
      if (game && typeof game.startNextWave === 'function') game.startNextWave();
    });
    this.waveButton.setScrollFactor(0);

    // Barre de progression de vague sous le bouton
    this.waveBarW = 280; this.waveBarH = 6;
    this.waveBarX = rightBase - this.waveBarW - 140; // alignée à la même colonne que waveText
    this.waveBarY = waveHeaderY + 50;
    this.waveProgBg = this.add.graphics().setScrollFactor(0).setDepth(1);
    this.waveProgFill = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.drawWaveProgress(0, 1, false);
    this.waveProgLabel = this.add.text(this.waveBarX + this.waveBarW/2, this.waveBarY + this.waveBarH/2, '—', this.txtStyle(12, true)).setOrigin(0.5).setScrollFactor(0).setDepth(3);

    // Sanctuaire à gauche, sous les âmes
    const hpHeaderY = M + 28;
    this.drawHeart(M, hpHeaderY + 8, 8, 0xa33a3a).setScrollFactor(0);
    this.hpText = this.add.text(M + 20, hpHeaderY, 'Feu-lien', this.txtStyle(16, true)).setScrollFactor(0);
    this.drawSeparator(M + 20, hpHeaderY + 16, 200);

    // Barre de PV sous le titre
    this.hpBarX = M + 20;
    this.hpBarY = hpHeaderY + 22;
    this.hpBarW = 260;
    this.hpBarH = 8;
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(1);
    const initialHP = (this.registry.get('sanctuaryHP') as number) ?? 5;
    this.hpBarLabel = this.add.text(this.hpBarX + this.hpBarW + 8, this.hpBarY + this.hpBarH/2, `${initialHP}/5`, this.txtStyle(12, true)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2);
    this.redrawHPBar(initialHP);

    // Coût courant (sous les âmes)
    const initialBuildCost = (this.registry.get('buildCost') as number) ?? (this.registry.get('towerCost') as number) ?? 25;
    this.costText = this.add.text(M, this.hpBarY + 18, `Coût actuel: ${initialBuildCost}`, this.txtStyle(14, true)).setScrollFactor(0);

    // Sélecteurs Construction: colonne à gauche, large et espacée
    const selStartY = this.costText.y + 34; // un peu plus d'espace
    this.add.text(M, selStartY - 12, 'Construction', this.txtStyle(15, true)).setScrollFactor(0);
    this.drawSeparator(M, selStartY - 4, 180);
    let by = selStartY + 6;
    const makeBtn = (label: string, kind: typeof this.currentKind) => {
      const btn = this.createSelectButton(M, by, label, () => this.selectKind(kind), () => this.tooltipForKind(kind), BTN_W, BTN_H);
      by += BTN_H + BTN_SP;
      return btn;
    };
    this.btnTower     = makeBtn('1 Tour', 'tower');
    this.btnWall      = makeBtn('2 Mur', 'wall');
    this.btnGenerator = makeBtn('3 Générateur', 'generator');
    this.btnCampfire  = makeBtn('4 Feu', 'campfire');
    this.btnForge     = makeBtn('5 Forge', 'forge');
    this.btnStorage   = makeBtn('6 Réserve', 'storage');
    this.btnBarracks  = makeBtn('7 Caserne', 'barracks');

    const initialKind = (this.registry.get('buildKind') as typeof this.currentKind) ?? 'tower';
    this.currentKind = initialKind;
    this.updateSelectButtons();

    // Recrutement: colonne à droite, sous la barre de vague
    const recXRight = rightBase;
    const recTop = this.waveBarY + 24;
    this.add.text(recXRight, recTop - 10, 'Recrutement', this.txtStyle(16, true)).setOrigin(1, 1).setScrollFactor(0);
    this.drawSeparator(recXRight - 200, recTop - 2, 200);
    this.recruitKnight   = this.createRecruitButton(recXRight, recTop + 6,          `Chevalier (${this.knightCost})`,         () => this.tryRecruit('knight', this.knightCost),   () => 'Chevalier — mêlée, robuste');
    this.recruitWatcher  = this.createRecruitButton(recXRight, recTop + 6 + 28,     `Veilleur (${this.watcherCost})`,        () => this.tryRecruit('watcher', this.watcherCost), () => 'Veilleur — mêlée, rapide');
    this.recruitArbalest = this.createRecruitButton(recXRight, recTop + 6 + 56,     `Arbalétrier (${this.arbalestCost})`,     () => this.tryRecruit('arbalest', this.arbalestCost), () => 'Arbalétrier — distance');

    // État initial bouton vague
    const initialWaveActive = !!(this.registry.get('waveActive') as boolean);
    this.setWaveButtonEnabled(!initialWaveActive);

    // Écouteurs registry
    this.onShardsChanged = () => { this.shardsText.setText(this.formatShardsLabel()); this.updateRecruitUI(); };
    this.registry.events.on('changedata-soulShards', this.onShardsChanged);

    this.onMaxShardsChanged = () => { this.shardsText.setText(this.formatShardsLabel()); };
    this.registry.events.on('changedata-maxSoulShards', this.onMaxShardsChanged);

    this.onHPChanged = (_p: Phaser.Data.DataManager, value: number, previousValue: number) => {
      this.hpText.setText(`Feu-lien: ${value} PV`);
      this.redrawHPBar(value);
      if (typeof previousValue === 'number' && value < previousValue) this.flashDamage();
      if (value <= 0 && !this.gameOverShown) { this.gameOverShown = true; this.showGameOverOverlay(); }
    };
    this.registry.events.on('changedata-sanctuaryHP', this.onHPChanged);

    this.onCostChanged = (_p: Phaser.Data.DataManager, value: number) => { this.costText.setText(`Coût: ${value}`); };
    this.registry.events.on('changedata-buildCost', this.onCostChanged);

    this.onWaveChanged = (_p: Phaser.Data.DataManager, value: number) => { this.waveText.setText(`Vague: ${value}`); };
    this.registry.events.on('changedata-wave', this.onWaveChanged);

    this.registry.events.on('changedata-buildKind', (_p: Phaser.Data.DataManager, value: typeof this.currentKind) => { this.currentKind = value; this.updateSelectButtons(); });
    this.onWaveActiveChanged = (_p: Phaser.Data.DataManager, value: boolean) => { this.setWaveButtonEnabled(!value); };
    this.registry.events.on('changedata-waveActive', this.onWaveActiveChanged);

    this.registry.events.on('changedata-waveRemaining', () => this.updateWaveProgressBar());
    this.registry.events.on('changedata-waveTotal', () => this.updateWaveProgressBar());

    this.registry.events.on('changedata-barracksCount', () => this.updateRecruitUI());

    // Toasts
    this.game.events.on('notify', (msg: string, kind: 'info' | 'error' | 'success' = 'info') => this.showToast(msg, kind));

    // Nettoyage
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.onShardsChanged) this.registry.events.off('changedata-soulShards', this.onShardsChanged);
      if (this.onMaxShardsChanged) this.registry.events.off('changedata-maxSoulShards', this.onMaxShardsChanged);
      if (this.onHPChanged) this.registry.events.off('changedata-sanctuaryHP', this.onHPChanged);
      if (this.onCostChanged) this.registry.events.off('changedata-buildCost', this.onCostChanged);
      if (this.onWaveChanged) this.registry.events.off('changedata-wave', this.onWaveChanged);
      if (this.onWaveActiveChanged) this.registry.events.off('changedata-waveActive', this.onWaveActiveChanged);
      this.registry.events.off('changedata-buildKind');
      this.registry.events.off('changedata-barracksCount');
      this.registry.events.off('changedata-waveRemaining');
      this.registry.events.off('changedata-waveTotal');
      this.game.events.off('notify');
    });

    // États init
    this.updateRecruitUI();
    this.updateWaveProgressBar();

    // ESC pour Pause
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
  }

  // Styles texte plus fins
  private txtStyle(size: number, semi?: boolean): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Cinzel, serif',
      fontSize: `${size}px`,
      color: semi ? this.theme.textDim : this.theme.text,
      stroke: '#000',
      strokeThickness: 0.5,
      shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 1, fill: true }
    };
  }

  // Correction: drawDiamond
  private drawDiamond(x: number, y: number, s: number, color: number): Phaser.GameObjects.Polygon {
    const pts = [ {x:0,y:-s}, {x:s,y:0}, {x:0,y:s}, {x:-s,y:0} ];
    const poly = this.add.polygon(x, y, pts, color, 1).setStrokeStyle(1, 0x000000, 0.6);
    return poly;
  }

  private drawHeart(x: number, y: number, s: number, color: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    // Deux cercles (lobes)
    const r = s * 0.55;
    g.fillCircle(x - s * 0.4, y - s * 0.2, r);
    g.fillCircle(x + s * 0.4, y - s * 0.2, r);
    // Triangle (pointe)
    g.fillTriangle(
      x - s, y,
      x + s, y,
      x, y + s
    );
    return g;
  }

  // Bouton de sélection: traits plus fins
  private createSelectButton(x: number, y: number, label: string, onClick: () => void, getTooltip?: () => string, w = 64, h = 24): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(x + w/2, y + h/2, w, h, this.theme.buttonFill, 0.96)
      .setStrokeStyle(1, this.theme.goldDim, 0.75)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(bg.x, bg.y, label, this.txtStyle(14)).setOrigin(0.5).setScrollFactor(0);
    txt.setShadow(0, 1, '#000', 1, true, true);
    const c = this.add.container(0, 0, [bg, txt]).setScrollFactor(0);
    bg.on('pointerdown', () => { bg.setFillStyle(this.theme.buttonFillActive, 0.96); this.time.delayedCall(100, () => bg.setFillStyle(this.theme.buttonFill, 0.96)); onClick(); });
    bg.on('pointerover', (p: Phaser.Input.Pointer) => { bg.setFillStyle(this.theme.buttonFillHover, 0.96).setStrokeStyle(1, this.theme.gold, 0.85); c.setScale(1.02); if (getTooltip) this.showTooltip(getTooltip(), p.worldX, p.worldY); });
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.96).setStrokeStyle(1, this.theme.goldDim, 0.75); c.setScale(1.0); this.hideTooltip(); });
    return c;
  }

  // Bouton d’action: plus compact (140x30) + trait fin
  private createActionButton(right: number, top: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const w = 140, h = 30;
    const x = right - w/2;
    const y = top + h/2;
    const bg = this.add.rectangle(x, y, w, h, this.theme.buttonFill, 0.96)
      .setStrokeStyle(1, this.theme.goldDim, 0.75)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, this.txtStyle(15)).setOrigin(0.5);
    const c = this.add.container(0, 0, [bg, txt]);
    bg.on('pointerdown', () => { if (!bg.input || !bg.input.enabled) return; bg.setFillStyle(this.theme.buttonFillActive, 0.96); this.time.delayedCall(100, () => bg.setFillStyle(this.theme.buttonFill, 0.96)); onClick(); });
    bg.on('pointerover', () => { if (bg.input?.enabled) { bg.setFillStyle(this.theme.buttonFillHover, 0.96); c.setScale(1.015); }});
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.96); c.setScale(1.0); });
    return c;
  }

  // Bouton de recrutement: plus compact (200x22) + trait fin
  private createRecruitButton(right: number, top: number, label: string, onClick: () => void, getTooltip?: () => string): Phaser.GameObjects.Container {
    const w = 200, h = 22;
    const x = right - w/2;
    const y = top;
    const bg = this.add.rectangle(x, y, w, h, this.theme.buttonFill, 0.94)
      .setStrokeStyle(1, this.theme.goldDim, 0.75)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const txt = this.add.text(x, y, label, this.txtStyle(13)).setOrigin(0.5).setScrollFactor(0);
    const c = this.add.container(0, 0, [bg, txt]);
    c.setScrollFactor(0);
    bg.on('pointerdown', () => { if (!bg.input || !bg.input.enabled) return; bg.setFillStyle(this.theme.buttonFillActive, 0.94); this.time.delayedCall(80, () => bg.setFillStyle(this.theme.buttonFill, 0.94)); onClick(); });
    bg.on('pointerover', (p: Phaser.Input.Pointer) => { if (bg.input?.enabled) { bg.setFillStyle(this.theme.buttonFillHover, 0.94); c.setScale(1.01); } if (getTooltip) this.showTooltip(getTooltip(), p.worldX, p.worldY); });
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.94); c.setScale(1); this.hideTooltip(); });
    return c;
  }

  // Met à jour le style des boutons selon le type sélectionné
  private updateSelectButtons(): void {
    const style = (btn: Phaser.GameObjects.Container, active: boolean) => {
      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(active ? this.theme.buttonFillHover : this.theme.buttonFill, 0.96);
      bg.setStrokeStyle(1, active ? this.theme.gold : this.theme.goldDim, active ? 0.85 : 0.75);
      const txt = btn.list[1] as Phaser.GameObjects.Text;
      txt.setColor(active ? this.theme.text : this.theme.textDim);
    };
    style(this.btnTower, this.currentKind === 'tower');
    style(this.btnWall,  this.currentKind === 'wall');
    style(this.btnGenerator, this.currentKind === 'generator');
    style(this.btnCampfire, this.currentKind === 'campfire');
    style(this.btnForge, this.currentKind === 'forge');
    style(this.btnStorage, this.currentKind === 'storage');
    style(this.btnBarracks, this.currentKind === 'barracks');
  }

  // Active/désactive le bouton de vague selon l'état
  private setWaveButtonEnabled(enabled: boolean): void {
    const bg = this.waveButton.list[0] as Phaser.GameObjects.Rectangle;
    const txt = this.waveButton.list[1] as Phaser.GameObjects.Text;
    if (enabled) {
      bg.setFillStyle(this.theme.buttonFill, 0.96).setStrokeStyle(1, this.theme.goldDim, 0.75);
      txt.setAlpha(1);
      bg.setInteractive({ useHandCursor: true });
      txt.setText('Lancer Vague');
    } else {
      bg.disableInteractive();
      bg.setFillStyle(0x121212, 0.7).setStrokeStyle(1, this.theme.disabled, 0.7);
      txt.setAlpha(0.6);
      txt.setText('Vague en cours...');
    }
  }

  private updateRecruitUI(): void {
    const shards = (this.registry.get('soulShards') as number) ?? 0;
    const barracks = (this.registry.get('barracksCount') as number) ?? 0;
    const enableKnight = barracks > 0 && shards >= this.knightCost;
    const enableWatcher = barracks > 0 && shards >= this.watcherCost;
    const enableArbalest = barracks > 0 && shards >= this.arbalestCost;
    this.setRecruitEnabled(this.recruitKnight, enableKnight);
    this.setRecruitEnabled(this.recruitWatcher, enableWatcher);
    this.setRecruitEnabled(this.recruitArbalest, enableArbalest);
    if (barracks <= 0) {
      this.showToast('Construisez une Caserne pour recruter', 'info', 800);
    }
  }

  private setRecruitEnabled(btn: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
    const txt = btn.list[1] as Phaser.GameObjects.Text;
    if (enabled) {
      bg.setFillStyle(this.theme.buttonFill, 0.9).setStrokeStyle(1, this.theme.gold);
      txt.setAlpha(1).setColor(this.theme.text);
      bg.setInteractive({ useHandCursor: true });
    } else {
      bg.disableInteractive();
      bg.setFillStyle(0x1b1b1b, 0.7).setStrokeStyle(1, this.theme.disabled);
      txt.setAlpha(0.6).setColor(this.theme.textDim);
    }
  }

  private tryRecruit(kind: 'knight' | 'watcher' | 'arbalest', cost: number): void {
    const shards = (this.registry.get('soulShards') as number) ?? 0;
    const barracks = (this.registry.get('barracksCount') as number) ?? 0;
    if (shards < cost || barracks <= 0) return;
    const game = this.scene.get('GameScene') as GameScene;
    if (game && typeof game.recruitUnit === 'function') {
      game.recruitUnit(kind);
    }
  }

  // Overlay Game Over
  private showGameOverOverlay(): void {
    const cam = this.cameras.main;
    const w = cam.width;
    const h = cam.height;
    const bg = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.6).setScrollFactor(0).setInteractive();
    const title = this.add.text(w/2, h/2 - 40, 'YOU DIED', { ...this.txtStyle(56), color: '#a10000' }).setOrigin(0.5).setScrollFactor(0);

    const btnW = 220, btnH = 48;
    const btnBg = this.add.rectangle(w/2, h/2 + 20, btnW, btnH, this.theme.buttonFill, 0.95)
      .setStrokeStyle(1, this.theme.gold)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const btnTxt = this.add.text(btnBg.x, btnBg.y, 'Recommencer', this.txtStyle(18)).setOrigin(0.5).setScrollFactor(0);
    btnBg.on('pointerdown', () => {
      btnBg.setFillStyle(this.theme.buttonFillActive, 0.95);
      this.time.delayedCall(100, () => btnBg.setFillStyle(this.theme.buttonFill, 0.95));
      this.resetGame();
    });

    this.gameOverContainer = this.add.container(0, 0, [bg, title, btnBg, btnTxt]);
    this.gameOverContainer.setDepth(1000);
  }

  // Réinitialise la partie et redémarre la GameScene
  private resetGame(): void {
    if (this.gameOverContainer) {
      this.gameOverContainer.destroy(true);
      this.gameOverContainer = undefined;
    }
    this.gameOverShown = false;

    // Reset registry
    this.registry.set('soulShards', 100);
    this.registry.set('maxSoulShards', 100);
    this.registry.set('sanctuaryHP', 5);
    this.registry.set('wave', 1);
    this.registry.set('buildKind', 'tower');
    this.registry.set('towerCost', 25);
    this.registry.set('buildCost', 25);
    this.registry.set('generatorCost', 40);
    this.registry.set('campfireCost', 35);
    this.registry.set('forgeCost', 60);
    this.registry.set('storageCost', 45);
    this.registry.set('barracksCost', 70);
    this.registry.set('barracksCount', 0);
    this.registry.set('waveActive', false);
    this.registry.set('waveTotal', 0);
    this.registry.set('waveRemaining', 0);

    // Redémarrer complètement les scènes
    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
  }

  // Définir le type de construction via l’UI
  private selectKind(kind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks'): void {
    if (this.currentKind === kind) return;
    this.currentKind = kind;
    this.updateSelectButtons();
    this.registry.set('buildKind', kind);
  }

  // Tooltip helpers
  private showTooltip(text: string, wx: number, wy: number): void {
    if (!this.tooltipBg || !this.tooltipTxt) {
      this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7).setScrollFactor(0).setDepth(1000);
      this.tooltipBg.setStrokeStyle(1, this.theme.goldDim, 0.7);
      this.tooltipTxt = this.add.text(0, 0, text, this.txtStyle(12)).setScrollFactor(0).setDepth(1001);
    }
    this.tooltipTxt.setText(text);
    const pad = 6;
    const tw = this.tooltipTxt.width + pad * 2;
    const th = this.tooltipTxt.height + pad * 2;
    let x = wx + 12, y = wy - th - 8;
    const camW = this.cameras.main.width;
    if (x + tw / 2 > camW) x = camW - tw / 2 - 4;
    if (y - th / 2 < 0) y = wy + th / 2 + 8;
    this.tooltipBg.setSize(tw, th).setPosition(x, y).setVisible(true);
    this.tooltipTxt.setPosition(x - this.tooltipTxt.width / 2, y - this.tooltipTxt.height / 2).setVisible(true);
  }
  private hideTooltip(): void {
    this.tooltipBg?.setVisible(false);
    this.tooltipTxt?.setVisible(false);
  }
  private tooltipForKind(kind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks'): string {
    const costs: Record<string, number> = {
      tower: (this.registry.get('towerCost') as number) ?? 25,
      wall: (this.registry.get('wallCost') as number) ?? 5,
      generator: (this.registry.get('generatorCost') as number) ?? 40,
      campfire: (this.registry.get('campfireCost') as number) ?? 35,
      forge: (this.registry.get('forgeCost') as number) ?? 60,
      storage: (this.registry.get('storageCost') as number) ?? 45,
      barracks: (this.registry.get('barracksCost') as number) ?? 70,
    };
    const n = costs[kind] ?? 0;
    const names: Record<typeof kind, string> = {
      tower: 'Tour', wall: 'Mur', generator: 'Générateur', campfire: 'Feu', forge: 'Forge', storage: 'Réserve', barracks: 'Caserne'
    } as any;
    return `${names[kind]} — Coût: ${n}`;
  }

  // Toast notifications
  private showToast(msg: string, kind: 'info' | 'error' | 'success' = 'info', duration = 1200): void {
    const w = this.cameras.main.width;
    const y = 8 + this.toasts.length * 22;
    const bgColor = kind === 'error' ? 0x3b1a1a : kind === 'success' ? 0x1d3324 : 0x222222;
    const c = this.add.container(0, 0).setDepth(1200).setScrollFactor(0);
    const txt = this.add.text(w / 2, y + 12, msg, this.txtStyle(14)).setOrigin(0.5).setScrollFactor(0);
    const bg = this.add.rectangle(w / 2, y + 12, txt.width + 20, txt.height + 8, bgColor, 0.9).setScrollFactor(0)
      .setStrokeStyle(1, this.theme.goldDim, 0.6);
    c.add([bg, txt]);
    c.setAlpha(0).setY(0);
    this.toasts.push(c);
    this.tweens.add({ targets: c, alpha: 1, duration: 150, ease: 'Quad.Out' });
    this.time.delayedCall(duration, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 250, ease: 'Quad.In', onComplete: () => {
        c.destroy(true);
        this.toasts = this.toasts.filter(t => t !== c);
      }});
    });
  }

  // Barre de PV plus fine
  private redrawHPBar(hp: number): void {
    const maxHp = 5;
    const x = this.hpBarX, y = this.hpBarY, w = this.hpBarW, h = this.hpBarH;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.5); this.hpBar.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
    this.hpBar.fillStyle(0x2a231c, 1); this.hpBar.fillRoundedRect(x, y, w, h, 2);
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const color = hp <= 1 ? 0x7a1a1a : this.theme.accent;
    this.hpBar.fillStyle(color, 0.95); this.hpBar.fillRoundedRect(x, y, w * ratio, h, 2);
    this.hpBar.lineStyle(1, this.theme.goldDim, 0.6); this.hpBar.strokeRoundedRect(x, y, w, h, 2);
    if (this.hpBarLabel) this.hpBarLabel.setText(`${hp}/${maxHp}`);
  }

  // Barre de vague plus fine
  private drawWaveProgress(done: number, total: number, active: boolean): void {
    const x = this.waveBarX, y = this.waveBarY, w = this.waveBarW, h = this.waveBarH;
    this.waveProgBg.clear(); this.waveProgFill.clear(); if (!active) { if (this.waveProgLabel) this.waveProgLabel.setText('—'); return; }
    this.waveProgBg.fillStyle(0x000000, 0.45).fillRoundedRect(x, y, w, h, 3).lineStyle(1, this.theme.goldDim, 0.6).strokeRoundedRect(x, y, w, h, 3);
    const ratio = total > 0 ? Phaser.Math.Clamp(done / total, 0, 1) : 0;
    this.waveProgFill.fillStyle(this.theme.accent, 0.9).fillRoundedRect(x, y, w * ratio, h, 3);
    if (this.waveProgLabel) this.waveProgLabel.setText(`${Math.max(0, done)}/${Math.max(0, total)}`);
  }

  // Label “Âmes” (au lieu d'Éclats d'Âme) pour un lien DS plus évident
  private formatShardsLabel(): string {
    const cur = (this.registry.get('soulShards') as number) ?? 0;
    const max = (this.registry.get('maxSoulShards') as number) ?? 100;
    return `Âmes: ${cur} / ${max}`;
  }

  // Effet visuel lors de dégâts au Sanctuaire
  private flashDamage(): void {
    this.cameras.main.flash(120, 120, 20, 20);
    this.cameras.main.shake(80, 0.002);
  }

  // Met à jour la barre de progression de vague selon le registry
  private updateWaveProgressBar(): void {
    const total = (this.registry.get('waveTotal') as number) ?? 0;
    const remain = (this.registry.get('waveRemaining') as number) ?? 0;
    const active = !!(this.registry.get('waveActive') as boolean);
    const done = total - remain;
    this.drawWaveProgress(done, total, active);
  }

  // Pause overlay minimaliste
  private togglePause(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const currentlyVisible = !!this.pauseContainer && this.pauseContainer.visible;
    if (currentlyVisible) {
      this.pauseContainer?.destroy(true);
      this.pauseContainer = undefined;
      const game = this.scene.get('GameScene');
      if (game) this.scene.resume('GameScene');
      return;
    }
    const bg = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.55).setScrollFactor(0).setInteractive();
    const title = this.add.text(w/2, h/2 - 10, 'PAUSE', { ...this.txtStyle(42), color: this.theme.text as string }).setOrigin(0.5).setScrollFactor(0);
    const hint = this.add.text(w/2, h/2 + 26, 'Appuyez sur ESC pour reprendre', this.txtStyle(14, true)).setOrigin(0.5).setScrollFactor(0);
    this.pauseContainer = this.add.container(0, 0, [bg, title, hint]).setDepth(999).setScrollFactor(0);
    const game = this.scene.get('GameScene');
    if (game) this.scene.pause('GameScene');
  }
}
