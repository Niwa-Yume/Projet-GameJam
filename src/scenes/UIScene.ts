import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { SaveSystem } from '../utils/SaveSystem';
import { GameConstants } from './GameConstants';

/**
 * UIScene: scène dédiée à l'interface utilisateur (overlay)
 */
export class UIScene extends Phaser.Scene {
  // Thème Dark Souls-like (palette améliorée pour la lisibilité)
  private theme = {
    panelFill: 0x1a1816,
    panelAlpha: 0.92,
    panelStroke: 0x5a4d3a,
    gold: 0xd4af37,      // doré plus vif
    goldDim: 0xa88932,   // doré atténué mais visible
    accent: 0x8b6f47,    // laiton/brun pour barres
    text: '#f4e8d0',     // ivoire très clair
    textDim: '#b8a88f',  // ivoire atténué mais lisible
    disabled: 0x4b463e,
    buttonFill: 0x2a2520,
    buttonFillHover: 0x3a3228,
    buttonFillActive: 0x4a4030,
    // Nouveaux pour améliorer la lisibilité
    soulColor: 0x66ccff, // bleu cyan pour les âmes
    hpColor: 0xff6b6b,   // rouge pour la vie
    productionColor: 0x7bed9f // vert pour la production
  } as const;

  private shardsText!: Phaser.GameObjects.Text;
  private productionText!: Phaser.GameObjects.Text;
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

  // Menu d'upgrade
  private upgradeMenuContainer?: Phaser.GameObjects.Container;
  private currentUpgradeBuilding?: Phaser.GameObjects.Rectangle;
  private currentUpgradeType?: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks';

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


  create(): void {

    // Constantes layout
    const M = 16;
    const BTN_W = 160, BTN_H = 30, BTN_SP = 10;
    void [BTN_W, BTN_SP]; // Supprime les avertissements pour BTN_W et BTN_SP inutilisés

    // === DÉFINIR LES ZONES UI (HORS ZONE DE JEU) ===
    // Zone de jeu: 250px (gauche) à 1050px (droite), 50px (haut) à 650px (bas)
    const UI_LEFT_MARGIN = 250;
    const UI_TOP_MARGIN = 50;
    const GAME_AREA_WIDTH = 800;
    const GAME_AREA_HEIGHT = 600;
    void [UI_TOP_MARGIN, GAME_AREA_HEIGHT]; // Supprime les avertissements pour les variables inutilisées

    // HUD dans la marge gauche
    this.addVignetteEdges();
    this.addAshParticles();

    // Vérifier s'il y a des gains hors-ligne à afficher
    const offlineData = this.registry.get('offlineProgressData') as any;
    if (offlineData && offlineData.soulsEarned > 0) {
      // Afficher le popup de gains hors ligne
      this.time.delayedCall(500, () => {
        this.showOfflineProgressPopup(offlineData);
      });
      // Nettoyer pour ne pas réafficher
      this.registry.set('offlineProgressData', null);
    }

    // === PANNEAU ÂMES (marge gauche) ===
    const soulPanelX = 10;
    const soulPanelY = 20;
    const soulPanelW = 220;
    const soulPanelH = 70;

    // Fond du panneau âmes avec bordure
    this.add.rectangle(soulPanelX, soulPanelY, soulPanelW, soulPanelH, this.theme.panelFill, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, this.theme.soulColor, 0.8)
      .setScrollFactor(0)
      .setDepth(0);

    // Icône âme (diamant cyan)
    this.drawDiamond(soulPanelX + 18, soulPanelY + 25, 10, this.theme.soulColor).setScrollFactor(0).setDepth(1);

    // Texte âmes (plus gros et plus visible)
    this.shardsText = this.add.text(soulPanelX + 35, soulPanelY + 12, this.formatShardsLabel(), {
      ...this.txtStyle(20),
      color: '#66ccff',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(1);

    // Affichage du taux de production passive (en dessous, vert) - DYNAMIQUE
    const initialProduction = (this.registry.get('totalSoulProduction') as number) ?? 0.5;
    const initialGenCount = (this.registry.get('generatorCount') as number) ?? 0;

    this.productionText = this.add.text(soulPanelX + 35, soulPanelY + 40, this.getProductionText(initialProduction, initialGenCount), {
      ...this.txtStyle(14),
      color: '#7bed9f',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(1);

    // Écouter les changements de production
    this.registry.events.on('changedata-totalSoulProduction', this.updateProductionText, this);
    this.registry.events.on('changedata-generatorCount', this.updateProductionText, this);

    // === PANNEAU VAGUE (marge droite, au-dessus de la zone de jeu) ===
    const rightPanelX = UI_LEFT_MARGIN + GAME_AREA_WIDTH + 10;
    const waveHeaderY = 20;

    // Fond du panneau vague
    this.add.rectangle(rightPanelX, waveHeaderY, 130, 110, this.theme.panelFill, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, this.theme.gold, 0.8)
      .setScrollFactor(0)
      .setDepth(0);

    this.waveText = this.add.text(rightPanelX + 10, waveHeaderY + 10, `Vague: ${Math.max(1, (this.registry.get('wave') as number) ?? 1)}`, {
      ...this.txtStyle(14),
      color: '#ffffff', // Blanc pour meilleure lisibilité
      fontStyle: 'bold'
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(1);

    // Bouton Vague sous l'entête (centré dans le panneau de 130px)
    // createActionButton utilise right-w/2 pour centrer, donc on donne rightPanelX + 130
    this.waveButton = this.createActionButton(rightPanelX + 130, waveHeaderY + 35, 'Lancer Vague', () => {
      const game = this.scene.get('GameScene') as GameScene;
      if (!game) return;

      // Vérifier si on est en mode automatique
      const autoMode = this.registry.get('autoWaveMode') as boolean ?? false;
      const waveActive = this.registry.get('waveActive') as boolean ?? false;

      if (autoMode && !waveActive) {
        // En mode auto, le bouton bascule entre auto/manuel
        if (typeof game.toggleAutoWave === 'function') game.toggleAutoWave();
      } else if (!waveActive) {
        // Sinon, lancer la vague suivante manuellement
        if (typeof game.startNextWave === 'function') game.startNextWave();
      }
    });
    this.waveButton.setScrollFactor(0);

    // Barre de progression de vague sous le bouton
    this.waveBarW = 110;
    this.waveBarH = 6;
    this.waveBarX = rightPanelX + 10;
    this.waveBarY = waveHeaderY + 85;
    this.waveProgBg = this.add.graphics().setScrollFactor(0).setDepth(1);
    this.waveProgFill = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.drawWaveProgress(0, 1, false);
    this.waveProgLabel = this.add.text(this.waveBarX + this.waveBarW/2, this.waveBarY + this.waveBarH/2, '—', this.txtStyle(12, true)).setOrigin(0.5).setScrollFactor(0).setDepth(3);

    // === PANNEAU FEU-LIEN (sous le panneau âmes, bien espacé) ===
    const hpPanelX = M + 10;
    const hpPanelY = soulPanelY + soulPanelH + 15; // 15px d'espace
    const hpPanelW = 220;
    const hpPanelH = 65;

    // Fond du panneau HP avec bordure rouge
    this.add.rectangle(hpPanelX, hpPanelY, hpPanelW, hpPanelH, this.theme.panelFill, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, this.theme.hpColor, 0.8)
      .setScrollFactor(0)
      .setDepth(0);

    // Icône coeur (rouge)
    this.drawHeart(hpPanelX + 18, hpPanelY + 20, 10, this.theme.hpColor).setScrollFactor(0).setDepth(1);

    // Titre Feu-lien
    this.hpText = this.add.text(hpPanelX + 35, hpPanelY + 10, 'Feu-lien', {
      ...this.txtStyle(16),
      color: '#ff6b6b',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(1);

    // Barre de PV sous le titre (plus visible)
    this.hpBarX = hpPanelX + 10;
    this.hpBarY = hpPanelY + 35;
    this.hpBarW = 160;
    this.hpBarH = 12;
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(1);
    const initialHP = (this.registry.get('sanctuaryHP') as number) ?? 5;
    this.hpBarLabel = this.add.text(this.hpBarX + this.hpBarW + 8, this.hpBarY + this.hpBarH/2, `${initialHP}/5`, {
      ...this.txtStyle(14),
      color: '#ff6b6b',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2);
    this.redrawHPBar(initialHP);

    // === PANNEAU COÛT (sous le panneau HP) ===
    const costPanelY = hpPanelY + hpPanelH + 15;
    const initialBuildCost = (this.registry.get('buildCost') as number) ?? (this.registry.get('towerCost') as number) ?? 25;

    // Fond du coût
    this.add.rectangle(M + 10, costPanelY, 220, 35, this.theme.panelFill, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, this.theme.gold, 0.6)
      .setScrollFactor(0)
      .setDepth(0);

    this.costText = this.add.text(M + 20, costPanelY + 8, `💰 Coût: ${initialBuildCost} âmes`, {
      ...this.txtStyle(14),
      color: '#ffffff', // Blanc pour meilleure lisibilité
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(1);

    // === SÉLECTEURS CONSTRUCTION ===
    const selStartY = costPanelY + 50; // Bien espacé du panneau coût

    // Titre avec fond
    this.add.rectangle(M + 10, selStartY - 5, 220, 28, this.theme.panelFill, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, this.theme.gold, 0.6)
      .setScrollFactor(0)
      .setDepth(0);

    this.add.text(M + 20, selStartY, 'CONSTRUCTION', {
      ...this.txtStyle(15),
      color: '#ffffff', // Blanc pour meilleure lisibilité
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(1);
    let by = selStartY + 35;
    const makeBtn = (label: string, kind: typeof this.currentKind) => {
      const btn = this.createSelectButton(M + 10, by, label, () => this.selectKind(kind), () => this.tooltipForKind(kind), 200, BTN_H);
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

    // === PANNEAU RECRUTEMENT (sous le panneau vague) ===
    const recTop = waveHeaderY + 130;

    this.add.rectangle(rightPanelX, recTop, 130, 110, this.theme.panelFill, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, this.theme.accent, 0.8)
      .setScrollFactor(0)
      .setDepth(0);

    this.add.text(rightPanelX + 10, recTop + 5, 'RECRUTEMENT', {
      ...this.txtStyle(13),
      color: '#ffffff', // Blanc pour meilleure lisibilité
      fontStyle: 'bold'
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(1);

    // Boutons centrés: panneau commence à rightPanelX, largeur 130px, centre = +65px
    // Mais createRecruitButton attend le bord droit, donc center + w/2 = rightPanelX + 65 + 55 = rightPanelX + 120
    const recruitBtnRight = rightPanelX + 120; // Centre du panneau + demi-largeur bouton (110/2=55)
    this.recruitKnight   = this.createRecruitButton(recruitBtnRight, recTop + 30,  `Chevalier (${this.knightCost})`,     () => this.tryRecruit('knight', this.knightCost),   () => 'Chevalier — mêlée, robuste');
    this.recruitWatcher  = this.createRecruitButton(recruitBtnRight, recTop + 52,  `Veilleur (${this.watcherCost})`,    () => this.tryRecruit('watcher', this.watcherCost), () => 'Veilleur — mêlée, rapide');
    this.recruitArbalest = this.createRecruitButton(recruitBtnRight, recTop + 74,  `Arbalétrier (${this.arbalestCost})`, () => this.tryRecruit('arbalest', this.arbalestCost), () => 'Arbalétrier — distance');

    // État initial bouton vague
    const initialWaveActive = !!(this.registry.get('waveActive') as boolean);
    this.setWaveButtonEnabled(!initialWaveActive);

    // Écouteurs registry
    this.onShardsChanged = () => { this.shardsText.setText(this.formatShardsLabel()); this.updateRecruitUI(); };
    this.registry.events.on('changedata-soulShards', this.onShardsChanged);

    this.onMaxShardsChanged = () => { this.shardsText.setText(this.formatShardsLabel()); };
    this.registry.events.on('changedata-maxSoulShards', this.onMaxShardsChanged);

    this.onHPChanged = (_p: Phaser.Data.DataManager, value: number, previousValue: number) => {
      this.hpText.setText('Feu-lien');
      this.redrawHPBar(value);
      if (typeof previousValue === 'number' && value < previousValue) this.flashDamage();
      if (value <= 0 && !this.gameOverShown) { this.gameOverShown = true; this.showGameOverOverlay(); }
    };
    this.registry.events.on('changedata-sanctuaryHP', this.onHPChanged);

    this.onCostChanged = (_p: Phaser.Data.DataManager, value: number) => { this.costText.setText(`💰 Coût: ${value} âmes`); };
    this.registry.events.on('changedata-buildCost', this.onCostChanged);

    this.onWaveChanged = (_p: Phaser.Data.DataManager, value: number) => { this.waveText.setText(`Vague: ${Math.max(1, value)}`); };
    this.registry.events.on('changedata-wave', this.onWaveChanged);

    this.registry.events.on('changedata-buildKind', (_p: Phaser.Data.DataManager, value: typeof this.currentKind) => { this.currentKind = value; this.updateSelectButtons(); });
    this.onWaveActiveChanged = (_p: Phaser.Data.DataManager, value: boolean) => { this.setWaveButtonEnabled(!value); };
    this.registry.events.on('changedata-waveActive', this.onWaveActiveChanged);

    this.registry.events.on('changedata-waveRemaining', () => this.updateWaveProgressBar());
    this.registry.events.on('changedata-waveTotal', () => this.updateWaveProgressBar());

    // Écouteurs pour le mode automatique des vagues
    this.registry.events.on('changedata-autoWaveMode', () => this.updateWaveButton());
    this.registry.events.on('changedata-nextWaveIn', () => this.updateWaveButton());

    this.registry.events.on('changedata-barracksCount', () => this.updateRecruitUI());

    // Toasts
    this.game.events.on('notify', (msg: string, kind: 'info' | 'error' | 'success' = 'info') => this.showToast(msg, kind));

    // Menu d'upgrade (clics sur tous les bâtiments)
    this.game.events.on('showUpgradeMenu', (building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks') => {
      this.showUpgradeMenuForBuilding(building, type);
    });

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
      this.game.events.off('showUpgradeMenu');
    });

    // États init
    this.updateRecruitUI();
    this.updateWaveProgressBar();

    // === BOUTON DEBUG: RESET SAUVEGARDE (bas droite) ===
    const debugBtnW = 120;
    const debugBtnH = 28;
    const debugX = this.cameras.main.width - debugBtnW - 10;
    const debugY = this.cameras.main.height - debugBtnH - 10;

    const debugBg = this.add.rectangle(debugX, debugY, debugBtnW, debugBtnH, 0x7a1a1a, 0.8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xa12020, 0.9)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(1500);

    const debugTxt = this.add.text(debugX + debugBtnW/2, debugY + debugBtnH/2, '🗑️ Reset Save', this.txtStyle(11))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1501);

    debugBg.on('pointerdown', () => {
      debugBg.setFillStyle(0xa12020, 0.95);
      this.time.delayedCall(100, () => {
        if (confirm('⚠️ Voulez-vous vraiment supprimer la sauvegarde et redémarrer le jeu ?')) {
          SaveSystem.resetGame();
        } else {
          debugBg.setFillStyle(0x7a1a1a, 0.8);
        }
      });
    });

    debugBg.on('pointerover', () => {
      debugBg.setFillStyle(0xa12020, 0.9);
      debugTxt.setScale(1.05);
    });

    debugBg.on('pointerout', () => {
      debugBg.setFillStyle(0x7a1a1a, 0.8);
      debugTxt.setScale(1.0);
    });

    // ESC pour Pause
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());

    // Ctrl/Cmd + Shift + R pour réinitialiser la sauvegarde (debug)
    this.input.keyboard?.on('keydown-R', (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        console.log('🔧 Raccourci détecté: Reset sauvegarde');
        if (confirm('⚠️ Ctrl+Shift+R: Supprimer la sauvegarde et redémarrer ?')) {
          SaveSystem.resetGame();
        }
      }
    });
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

  // Dessine un losange rempli avec un contour
  private drawDiamond(x: number, y: number, s: number, color: number): Phaser.GameObjects.Polygon {
    const pts = [ {x:0, y:-s}, {x:s, y:0}, {x:0, y:s}, {x:-s, y:0} ];
    return this.add.polygon(x, y, pts, color, 1).setStrokeStyle(1, 0x000000, 0.6);
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
    const txt = this.add.text(bg.x, bg.y, label, {
      ...this.txtStyle(14),
      color: '#ffffff' // Blanc pour meilleure lisibilité
    }).setOrigin(0.5).setScrollFactor(0);
    txt.setShadow(0, 1, '#000', 2, true, true); // Ombre plus prononcée
    const c = this.add.container(0, 0, [bg, txt]).setScrollFactor(0);
    bg.on('pointerdown', () => { bg.setFillStyle(this.theme.buttonFillActive, 0.96); this.time.delayedCall(100, () => bg.setFillStyle(this.theme.buttonFill, 0.96)); onClick(); });
    bg.on('pointerover', (p: Phaser.Input.Pointer) => { bg.setFillStyle(this.theme.buttonFillHover, 0.96).setStrokeStyle(1, this.theme.gold, 0.85); c.setScale(1.02); if (getTooltip) this.showTooltip(getTooltip(), p.worldX, p.worldY); });
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.96).setStrokeStyle(1, this.theme.goldDim, 0.75); c.setScale(1.0); this.hideTooltip(); });
    return c;
  }

  // Bouton d’action: plus compact (140x30) + trait fin
  private createActionButton(right: number, top: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const w = 110, h = 28; // Réduits pour rentrer dans le panneau de 130px
    const x = right - w/2;
    const y = top + h/2;
    const bg = this.add.rectangle(x, y, w, h, this.theme.buttonFill, 0.96)
      .setStrokeStyle(1, this.theme.goldDim, 0.75)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, this.txtStyle(12)).setOrigin(0.5); // Police plus petite
    const c = this.add.container(0, 0, [bg, txt]);
    bg.on('pointerdown', () => { if (!bg.input || !bg.input.enabled) return; bg.setFillStyle(this.theme.buttonFillActive, 0.96); this.time.delayedCall(100, () => bg.setFillStyle(this.theme.buttonFill, 0.96)); onClick(); });
    bg.on('pointerover', () => { if (bg.input?.enabled) { bg.setFillStyle(this.theme.buttonFillHover, 0.96); c.setScale(1.015); }});
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.96); c.setScale(1.0); });
    return c;
  }

  // Bouton de recrutement: plus compact (110x18) + trait fin
  private createRecruitButton(right: number, top: number, label: string, onClick: () => void, getTooltip?: () => string): Phaser.GameObjects.Container {
    const w = 110, h = 18;
    const x = right - w/2;
    const y = top;
    const bg = this.add.rectangle(x, y, w, h, this.theme.buttonFill, 0.94)
      .setStrokeStyle(1, this.theme.goldDim, 0.75)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const txt = this.add.text(x, y, label, this.txtStyle(10)).setOrigin(0.5).setScrollFactor(0);
    const c = this.add.container(0, 0, [bg, txt]);
    c.setScrollFactor(0);
    bg.on('pointerdown', () => { if (!bg.input || !bg.input.enabled) return; bg.setFillStyle(this.theme.buttonFillActive, 0.94); this.time.delayedCall(80, () => bg.setFillStyle(this.theme.buttonFill, 0.94)); onClick(); });
    bg.on('pointerover', (p: Phaser.Input.Pointer) => { if (bg.input?.enabled) { bg.setFillStyle(this.theme.buttonFillHover, 0.94); c.setScale(1.01); } if (getTooltip) this.showTooltip(getTooltip(), p.worldX, p.worldY); });
    bg.on('pointerout', () => { bg.setFillStyle(this.theme.buttonFill, 0.94); c.setScale(1); this.hideTooltip(); });
    return c;
  }

  // Met à jour le style des boutons selon le type sélectionné
  private updateSelectButtons(): void {
    // Vérifier que les boutons existent avant d'y accéder
    if (!this.btnTower || !this.btnWall || !this.btnGenerator || !this.btnCampfire ||
        !this.btnForge || !this.btnStorage || !this.btnBarracks) {
      console.warn('⚠️ updateSelectButtons: boutons de sélection pas encore créés');
      return;
    }

    const style = (btn: Phaser.GameObjects.Container, active: boolean) => {
      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(active ? this.theme.buttonFillHover : this.theme.buttonFill, 0.96);
      bg.setStrokeStyle(1, active ? this.theme.gold : this.theme.goldDim, active ? 0.85 : 0.75);
      const txt = btn.list[1] as Phaser.GameObjects.Text;
      txt.setColor(active ? '#ffffff' : '#cccccc'); // Blanc vif si actif, gris clair sinon
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
    // Vérifier que le bouton existe avant d'y accéder
    if (!this.waveButton || !this.waveButton.list || !this.waveButton.list[0] || !this.waveButton.list[1]) {
      console.warn('⚠️ setWaveButtonEnabled: waveButton pas encore créé');
      return;
    }

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

  // Met à jour le bouton de vague selon le mode automatique
  private updateWaveButton(): void {
    // Vérifier que le bouton existe avant d'y accéder
    if (!this.waveButton || !this.waveButton.list || !this.waveButton.list[1]) {
      console.warn('⚠️ updateWaveButton: waveButton pas encore créé');
      return;
    }

    const autoMode = this.registry.get('autoWaveMode') as boolean ?? false;
    const waveActive = this.registry.get('waveActive') as boolean ?? false;
    const nextWaveIn = this.registry.get('nextWaveIn') as number ?? 0;
    const txt = this.waveButton.list[1] as Phaser.GameObjects.Text;

    console.log(`🔧 updateWaveButton: autoMode=${autoMode}, waveActive=${waveActive}, nextWaveIn=${nextWaveIn}`);

    if (waveActive) {
      // Vague en cours - bouton désactivé
      return; // setWaveButtonEnabled gère déjà ce cas
    } else if (autoMode && nextWaveIn > 0) {
      // Mode auto avec compteur
      console.log(`📝 Texte bouton: Auto (${nextWaveIn}s)`);
      txt.setText(`Auto (${nextWaveIn}s)`);
    } else if (autoMode) {
      // Mode auto sans compteur (entre deux vagues)
      console.log(`📝 Texte bouton: Stopper Auto`);
      txt.setText('Stopper Auto');
    } else {
      // Mode manuel
      console.log(`📝 Texte bouton: Lancer Vague`);
      txt.setText('Lancer Vague');
    }
  }

  private updateRecruitUI(): void {
    // Vérifier que les boutons existent avant d'y accéder
    if (!this.recruitKnight || !this.recruitWatcher || !this.recruitArbalest) {
      console.warn('⚠️ updateRecruitUI: boutons de recrutement pas encore créés');
      return;
    }

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

  // Affiche un popup avec les gains hors ligne
  private showOfflineProgressPopup(data: { formattedTime: string; soulsEarned: number }): void {
    const cam = this.cameras.main;
    const w = cam.width;
    const h = cam.height;

    // Fond sombre
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
      .setScrollFactor(0)
      .setInteractive();

    // Panneau principal
    const panelW = 400;
    const panelH = 250;
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, this.theme.panelFill, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(3, this.theme.gold);

    // Titre
    const title = this.add.text(w / 2, h / 2 - 80, 'BIENVENUE !', {
      ...this.txtStyle(32),
      color: this.theme.text,
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);

    // Sous-titre
    const subtitle = this.add.text(w / 2, h / 2 - 40, `Vous étiez absent pendant:`, {
      ...this.txtStyle(18),
      color: this.theme.textDim
    }).setOrigin(0.5).setScrollFactor(0);

    // Temps d'absence
    const timeText = this.add.text(w / 2, h / 2 - 10, data.formattedTime, {
      ...this.txtStyle(24),
      color: '#66ccff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0);

    // Icône âme
    this.drawDiamond(w / 2 - 80, h / 2 + 30, 12, this.theme.soulColor).setScrollFactor(0);

    // Âmes gagnées
    const soulsText = this.add.text(w / 2 - 50, h / 2 + 30, `+${data.soulsEarned} âmes gagnées !`, {
      ...this.txtStyle(22),
      color: '#7bed9f',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setScrollFactor(0);

    // Bouton Continuer
    const btnW = 180;
    const btnH = 48;
    const btnBg = this.add.rectangle(w / 2, h / 2 + 85, btnW, btnH, this.theme.buttonFill, 0.95)
      .setStrokeStyle(2, this.theme.gold)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);

    const btnTxt = this.add.text(w / 2, h / 2 + 85, 'Continuer', this.txtStyle(18))
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Clic pour fermer
    const container = this.add.container(0, 0, [bg, panel, title, subtitle, timeText, soulsText, btnBg, btnTxt]);
    container.setDepth(2000);

    btnBg.on('pointerdown', () => {
      btnBg.setFillStyle(this.theme.buttonFillActive, 0.95);
      this.time.delayedCall(100, () => {
        container.destroy(true);
      });
    });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(this.theme.buttonFillHover, 0.95);
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(this.theme.buttonFill, 0.95);
    });
  }

  // Réinitialise la partie et redémarre la GameScene
  private resetGame(): void {
    // IMPORTANT: Supprimer la sauvegarde pour éviter de recharger l'ancien état
    SaveSystem.deleteSave();
    console.log('🗑️ Sauvegarde supprimée - Redémarrage à zéro');

    // Reset registry AVANT de détruire quoi que ce soit
    this.registry.set('soulShards', 100);
    this.registry.set('maxSoulShards', 100);
    this.registry.set('sanctuaryHP', 5);
    this.registry.set('wave', 0);
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

    // Nettoyer le flag AVANT de redémarrer
    this.gameOverShown = false;

    // Ne PAS détruire manuellement le container, laisser Phaser le faire
    // lors du restart de la scène
    this.gameOverContainer = undefined;

    // Redémarrer GameScene (qui relancera UIScene dans son create())
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      // Redémarrer GameScene d'abord (qui stop UIScene automatiquement)
      gameScene.scene.restart();
      // UIScene sera relancée automatiquement par GameScene.create()
    }
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

  // Barre de PV plus visible avec gradient
  private redrawHPBar(hp: number): void {
    const maxHp = 5;
    const x = this.hpBarX, y = this.hpBarY, w = this.hpBarW, h = this.hpBarH;
    this.hpBar.clear();

    // Fond noir avec bordure
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);

    // Fond gris foncé
    this.hpBar.fillStyle(0x2a2520, 1);
    this.hpBar.fillRoundedRect(x, y, w, h, 3);

    // Barre de vie avec couleur selon le HP
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    let color: number;
    if (hp <= 1) color = 0xe74c3c; // Rouge vif si critique
    else if (hp <= 2) color = 0xff6b6b; // Rouge si bas
    else color = 0x2ecc71; // Vert si bon

    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(x, y, w * ratio, h, 3);

    // Bordure dorée
    this.hpBar.lineStyle(2, this.theme.hpColor, 0.8);
    this.hpBar.strokeRoundedRect(x, y, w, h, 3);

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

  // Label "Âmes" (au lieu d'Éclats d'Âme) pour un lien DS plus évident
  private formatShardsLabel(): string {
    const cur = (this.registry.get('soulShards') as number) ?? 0;
    const max = (this.registry.get('maxSoulShards') as number) ?? 100;
    return `${Math.floor(cur)} / ${max}`;
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

  // Afficher le menu d'upgrade pour un bâtiment
  private showUpgradeMenuForBuilding(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks'): void {
    // Fermer le menu existant s'il y en a un
    if (this.upgradeMenuContainer) {
      this.upgradeMenuContainer.destroy(true);
      this.upgradeMenuContainer = undefined;
    }

    this.currentUpgradeBuilding = building;
    this.currentUpgradeType = type;

    const game = this.scene.get('GameScene') as GameScene;
    if (!game) return;

    // Vérifier si ce bâtiment peut être amélioré
    const canUpgrade = (type === 'tower' || type === 'generator') && !!game.getUpgradeInfo;
    const info = canUpgrade ? game.getUpgradeInfo(building, type as 'tower' | 'generator') : null;

    // Position du menu (centré sur la caméra)
    const camW = this.cameras.main.width;
    const camH = this.cameras.main.height;
    const menuW = 320;
    const menuH = 200;
    const menuX = camW / 2;
    const menuY = camH / 2;

    // Fond semi-transparent
    const overlay = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0x000000, 0.4)
      .setScrollFactor(0)
      .setInteractive()
      .setDepth(500);

    // Panel principal
    const panelBg = this.add.rectangle(menuX, menuY, menuW, menuH, this.theme.panelFill, 0.95)
      .setScrollFactor(0)
      .setStrokeStyle(2, this.theme.gold, 0.8)
      .setDepth(501);

    // Bouton fermer (croix en haut à droite)
    const closeSize = 18;
    const closeBg = this.add.rectangle(menuX + menuW/2 - 14, menuY - menuH/2 + 14, closeSize, closeSize, 0x3a2f22, 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, this.theme.gold, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(503);
    const closeTxt = this.add.text(closeBg.x, closeBg.y, '×', this.txtStyle(16)).setOrigin(0.5).setScrollFactor(0).setDepth(504);
    closeBg.on('pointerdown', () => {
      if (this.upgradeMenuContainer) {
        this.upgradeMenuContainer.destroy(true);
        this.upgradeMenuContainer = undefined;
        this.currentUpgradeBuilding = undefined;
        this.currentUpgradeType = undefined;
      }
    });

    // Titre
    const buildingNames: Record<string, string> = {
      tower: 'Tour',
      generator: 'Générateur',
      wall: 'Mur',
      campfire: 'Feu de Camp',
      forge: 'Forge',
      storage: 'Réserve',
      barracks: 'Caserne'
    };
    const title = canUpgrade ? `Amélioration de ${buildingNames[type]}` : buildingNames[type];
    const titleTxt = this.add.text(menuX, menuY - menuH/2 + 20, title, this.txtStyle(18))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(502);

    // Niveau actuel (seulement pour les bâtiments upgradables)
    let levelTxt: Phaser.GameObjects.Text | undefined;
    if (info) {
      levelTxt = this.add.text(menuX, menuY - menuH/2 + 50, `Niveau: ${info.level}/${info.maxLevel}`, this.txtStyle(14, true))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(502);
    }

    // Stats actuelles
    const currentStats = info?.currentStats || this.getBuildingStats(building, type);
    const currentStatsTxt = this.add.text(menuX, menuY - 20, currentStats, this.txtStyle(12, true))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(502);

    // Flèche + bloc upgrade uniquement si upgradable
    let upgradeBtn: Phaser.GameObjects.Container | undefined;
    let nextStatsTxt: Phaser.GameObjects.Text | undefined;
    let arrowTxt: Phaser.GameObjects.Text | undefined;
    let cantUpgradeTxt: Phaser.GameObjects.Text | undefined;

    if (canUpgrade && info) {
      const forgeCount = (this.registry.get('forgeCount') as number) ?? 0;
      if (forgeCount <= 0) {
        // Pas de forge = pas d'upgrade possible
        cantUpgradeTxt = this.add.text(menuX, menuY + 20, '⚠️ Construisez une Forge pour\ndébloquer les améliorations', { ...this.txtStyle(13, true), align: 'center' })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(502);
      } else if (info.level >= info.maxLevel) {
        // Niveau max atteint
        cantUpgradeTxt = this.add.text(menuX, menuY + 20, '✓ Niveau Maximum Atteint', this.txtStyle(14, true))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(502);
      } else {
        // Upgrade possible
        arrowTxt = this.add.text(menuX, menuY + 5, '↓', this.txtStyle(20))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(502);

        nextStatsTxt = this.add.text(menuX, menuY + 30, info.nextStats, { ...this.txtStyle(12), color: '#7bed9f' })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(502);

        // Bouton améliorer
        const btnW = 180, btnH = 36;
        const btnY = menuY + menuH/2 - 40;
        const btnBg = this.add.rectangle(menuX, btnY, btnW, btnH, this.theme.buttonFill, 0.95)
          .setStrokeStyle(1, this.theme.gold, 0.85)
          .setInteractive({ useHandCursor: true })
          .setScrollFactor(0)
          .setDepth(501);
        const btnTxt = this.add.text(menuX, btnY, `Améliorer (${info.nextCost} âmes)`, this.txtStyle(14))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(502);

        btnBg.on('pointerdown', () => {
          btnBg.setFillStyle(this.theme.buttonFillActive, 0.95);
          this.time.delayedCall(100, () => {
            btnBg.setFillStyle(this.theme.buttonFill, 0.95);
            this.tryUpgradeBuilding();
          });
        });
        btnBg.on('pointerover', () => { btnBg.setFillStyle(this.theme.buttonFillHover, 0.95); });
        btnBg.on('pointerout', () => { btnBg.setFillStyle(this.theme.buttonFill, 0.95); });

        upgradeBtn = this.add.container(0, 0, [btnBg, btnTxt]).setScrollFactor(0).setDepth(501);
      }
    }

    // Bouton "Vendre" en bas du menu
    const sellBtnW = 160, sellBtnH = 32;
    const sellBtnY = menuY + menuH/2 - (upgradeBtn ? 80 : 45);

    const baseCost = this.getBaseCostForType(type);
    const sellPrice = Math.floor(baseCost * GameConstants.SELL_REFUND_PERCENTAGE);

    const sellBg = this.add.rectangle(menuX, sellBtnY, sellBtnW, sellBtnH, 0x7a3a1a, 0.9)
      .setStrokeStyle(1, 0xd4af37, 0.7)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(501);
    const sellTxt = this.add.text(menuX, sellBtnY, `🔥 Vendre (${sellPrice} âmes)`, this.txtStyle(13))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(502);

    sellBg.on('pointerdown', () => {
      sellBg.setFillStyle(0x9a4a2a, 0.95);
      this.time.delayedCall(100, () => { this.trySellBuilding(); });
    });
    sellBg.on('pointerover', () => sellBg.setFillStyle(0x8a4a2a, 0.95));
    sellBg.on('pointerout',  () => sellBg.setFillStyle(0x7a3a1a, 0.9));

    const sellBtn = this.add.container(0, 0, [sellBg, sellTxt]).setScrollFactor(0).setDepth(501);

    // Container pour tout le menu
    const elements: any[] = [overlay, panelBg, titleTxt, currentStatsTxt, closeBg, closeTxt, sellBtn];
    if (levelTxt) elements.push(levelTxt);
    if (arrowTxt) elements.push(arrowTxt);
    if (nextStatsTxt) elements.push(nextStatsTxt);
    if (upgradeBtn) elements.push(upgradeBtn);
    if (cantUpgradeTxt) elements.push(cantUpgradeTxt);

    this.upgradeMenuContainer = this.add.container(0, 0, elements);
    this.upgradeMenuContainer.setDepth(500);
  }

  // Tenter d'upgrader le bâtiment sélectionné
  private tryUpgradeBuilding(): void {
    if (!this.currentUpgradeBuilding || !this.currentUpgradeType) return;

    const type = this.currentUpgradeType;
    if (type !== 'tower' && type !== 'generator') {
      // Non-améliorable
      return;
    }

    const game = this.scene.get('GameScene') as GameScene;
    if (!game || !game.upgradeBuildingLevel) return;

    const success = game.upgradeBuildingLevel(this.currentUpgradeBuilding, type);

    if (success) {
      // Fermer le menu et le rouvrir avec les nouvelles stats
      const building = this.currentUpgradeBuilding;

      if (this.upgradeMenuContainer) {
        this.upgradeMenuContainer.destroy(true);
        this.upgradeMenuContainer = undefined;
      }

      // Petit délai avant de rouvrir
      this.time.delayedCall(200, () => {
        this.showUpgradeMenuForBuilding(building, type);
      });
    }
  }

  // Tenter de vendre le bâtiment sélectionné
  private trySellBuilding(): void {
    if (!this.currentUpgradeBuilding || !this.currentUpgradeType) return;
    const game = this.scene.get('GameScene') as GameScene;
    if (!game || typeof (game as any).sellBuilding !== 'function') return;

    // Vente directe
    const success = (game as any).sellBuilding(this.currentUpgradeBuilding, this.currentUpgradeType);
    if (success) {
      if (this.upgradeMenuContainer) {
        this.upgradeMenuContainer.destroy(true);
        this.upgradeMenuContainer = undefined;
        this.currentUpgradeBuilding = undefined;
        this.currentUpgradeType = undefined;
      }
    }
  }

  // Donne une chaîne de stats pour les bâtiments non-améliorables
  private getBuildingStats(building: Phaser.GameObjects.Rectangle, type: 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks' | 'tower' | 'generator'): string {
    const hp = (building.getData('hp') as number) ?? 0;
    const maxHp = (building.getData('maxHp') as number) ?? hp;
    switch (type) {
      case 'wall':
        return `Durabilité: ${Math.floor(hp)}/${Math.floor(maxHp)} PV`;
      case 'campfire':
        return `Soin: +${GameConstants.CAMPFIRE_HEAL} PV/tick • Rayon: ${GameConstants.CAMPFIRE_RADIUS}`;
      case 'forge':
        return `Permet d'améliorer Tours et Générateurs`;
      case 'storage': {
        const capInc = (building.getData('capInc') as number) ?? 0;
        return `Capacité +${capInc} • PV: ${Math.floor(hp)}/${Math.floor(maxHp)}`;
      }
      case 'barracks':
        return `Permet de recruter des unités • PV: ${Math.floor(hp)}/${Math.floor(maxHp)}`;
      case 'tower': {
        const fireRateMul = (building.getData('fireRateMul') as number) ?? 1;
        const damageMul = (building.getData('damageMul') as number) ?? 1;
        return `Cadence: ${(fireRateMul * 100).toFixed(0)}% • Dégâts: x${damageMul.toFixed(1)}`;
      }
      case 'generator': {
        const yieldMul = (building.getData('yieldMul') as number) ?? 1;
        return `Production: x${yieldMul.toFixed(2)} (${(GameConstants.GENERATOR_YIELD * yieldMul).toFixed(1)} âmes/2s)`;
      }
    }
  }

  // Récupère le coût de base par type depuis le registry
  private getBaseCostForType(type: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks'): number {
    const map: Record<typeof type, number> = {
      tower: (this.registry.get('towerCost') as number) ?? GameConstants.INITIAL_TOWER_COST,
      wall: (this.registry.get('wallCost') as number) ?? GameConstants.INITIAL_WALL_COST,
      generator: (this.registry.get('generatorCost') as number) ?? GameConstants.INITIAL_GENERATOR_COST,
      campfire: (this.registry.get('campfireCost') as number) ?? GameConstants.INITIAL_CAMPFIRE_COST,
      forge: (this.registry.get('forgeCost') as number) ?? GameConstants.INITIAL_FORGE_COST,
      storage: (this.registry.get('storageCost') as number) ?? GameConstants.INITIAL_STORAGE_COST,
      barracks: (this.registry.get('barracksCost') as number) ?? GameConstants.INITIAL_BARRACKS_COST,
    } as any;
    return map[type] ?? 0;
  }


  // Met à jour le texte de production passive
  private updateProductionText = (): void => {
    const prod = (this.registry.get('totalSoulProduction') as number) ?? 0;
    const gens = (this.registry.get('generatorCount') as number) ?? 0;
    if (this.productionText) {
      this.productionText.setText(this.getProductionText(prod, gens));
    }
  };

  // Formatteur du texte de production
  private getProductionText(prod: number, gens: number): string {
    const perSec = prod;
    const gensPart = gens > 0 ? ` (${gens} générateur${gens > 1 ? 's' : ''})` : '';
    return `+${perSec.toFixed(2)} âmes/s${gensPart}`;
  }

  /**
   * Nettoie proprement les containers avant le shutdown de la scène
   * Évite l'erreur "Cannot read properties of undefined (reading 'sys')"
   */
  shutdown(): void {
    // Lâcher les références aux containers sans les détruire
    // Phaser s'en occupera automatiquement
    this.gameOverContainer = undefined;
    this.pauseContainer = undefined;
    this.upgradeMenuContainer = undefined;

    // Nettoyer les listeners d'événements pour éviter les fuites mémoire
    this.registry.events.off('changedata');
  }
}
