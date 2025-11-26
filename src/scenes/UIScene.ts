import Phaser from 'phaser';
import { SaveSystem } from '../utils/SaveSystem';
import { HUDManager } from '../ui/managers/HUDManager';
import { MenuManager } from '../ui/managers/MenuManager';
import { NotificationManager } from '../ui/managers/NotificationManager';
import { OverlayManager } from '../ui/managers/OverlayManager';
import { AllyStatsPanel } from '../ui/components/AllyStatsPanel';

export class UIScene extends Phaser.Scene {
  private theme = {
    panelFill: 0x1a1816,
    gold: 0xd4af37,
    text: '#f4e8d0',
    textDim: '#b8a88f',
  } as const;

  private autoRecruitStatusText?: Phaser.GameObjects.Text;
  private autoUpgradeStatusText?: Phaser.GameObjects.Text;

  private hudManager!: HUDManager;
  private menuManager!: MenuManager;
  private notificationManager!: NotificationManager;
  private overlayManager!: OverlayManager;
  private allyStatsPanel!: AllyStatsPanel;

  constructor() {
    super('UIScene');
  }

  preload(): void {}

  create(): void {
    this.addVignetteEdges();
    this.addAshParticles();

    this.hudManager = new HUDManager(this);
    this.menuManager = new MenuManager(this);
    this.notificationManager = new NotificationManager(this);
    this.overlayManager = new OverlayManager(this);

    const rightPanelX = 1060;
    const recTop = 150;
    const allyStatsTop = recTop + 120;
    this.allyStatsPanel = new AllyStatsPanel(this, rightPanelX, allyStatsTop);

    const offlineData = this.registry.get('offlineProgressData') as any;
    if (offlineData && offlineData.soulsEarned > 0) {
      this.time.delayedCall(500, () => this.overlayManager.showOfflineProgressPopup(offlineData));
      this.registry.set('offlineProgressData', null);
    }

    const toggleBtnY = allyStatsTop + 105;
    const toggleBtnW = 110;
    const toggleBtnH = 24;
    const toggleBtnX = rightPanelX + 10;
    const toggleBg = this.add.rectangle(toggleBtnX, toggleBtnY, toggleBtnW, toggleBtnH, 0x2a2520, 0.9).setOrigin(0, 0).setStrokeStyle(1, this.theme.gold, 0.8).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(1);
    this.autoRecruitStatusText = this.add.text(toggleBtnX + toggleBtnW / 2, toggleBtnY + toggleBtnH / 2, 'Auto: OFF', { ...this.txtStyle(11), color: '#ff6b6b' }).setOrigin(0.5).setScrollFactor(0).setDepth(2);
    toggleBg.on('pointerdown', () => {
      const game = this.scene.get('GameScene') as any;
      if (game && typeof game.allyManager.toggleAutoRecruit === 'function') {
        game.allyManager.toggleAutoRecruit();
      }
    });
    toggleBg.on('pointerover', () => toggleBg.setFillStyle(0x3a3228, 0.95));
    toggleBg.on('pointerout', () => toggleBg.setFillStyle(0x2a2520, 0.9));
    const toggleUpgradeBtnY = allyStatsTop + 132;
    const toggleUpgradeBg = this.add.rectangle(toggleBtnX, toggleUpgradeBtnY, toggleBtnW, toggleBtnH, 0x2a2520, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x9f8d62, 0.8).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(1);
    this.autoUpgradeStatusText = this.add.text(toggleBtnX + toggleBtnW / 2, toggleUpgradeBtnY + toggleBtnH / 2, 'Upgrade: OFF', { ...this.txtStyle(10), color: '#ff6b6b' }).setOrigin(0.5).setScrollFactor(0).setDepth(2);
    toggleUpgradeBg.on('pointerdown', () => {
      const game = this.scene.get('GameScene') as any;
      if (game && typeof game.allyManager.toggleAutoUpgrade === 'function') {
        game.allyManager.toggleAutoUpgrade();
      }
    });
    toggleUpgradeBg.on('pointerover', () => toggleUpgradeBg.setFillStyle(0x3a3228, 0.95));
    toggleUpgradeBg.on('pointerout', () => toggleUpgradeBg.setFillStyle(0x2a2520, 0.9));

    this.registry.events.on('changedata-sanctuaryHP', (_p: any, value: number) => { if (value <= 0) this.overlayManager.showGameOverOverlay(); });
    this.input.keyboard?.on('keydown-R', (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        if (confirm('⚠️ Ctrl+Shift+R: Supprimer la sauvegarde et redémarrer ?')) {
          SaveSystem.resetGame();
        }
      }
    });

    // Clean up managers when the scene shuts down
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hudManager.destroy(); // Assuming HUDManager also needs a destroy method
      this.menuManager.destroy();
      this.notificationManager.destroy(); // Assuming NotificationManager also needs a destroy method
      this.overlayManager.destroy(); // Assuming OverlayManager also needs a destroy method
      this.allyStatsPanel.destroy(); // Assuming AllyStatsPanel also needs a destroy method
    });
  }

  private addVignetteEdges(thickness = 48, alpha = 0.18): void {
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const edges: Phaser.GameObjects.Rectangle[] = [];
    edges.push(this.add.rectangle(w/2, thickness/2, w, thickness, 0x000000, alpha));
    edges.push(this.add.rectangle(w/2, h - thickness/2, w, thickness, 0x000000, alpha + 0.05));
    edges.push(this.add.rectangle(thickness/2, h/2, thickness, h, 0x000000, alpha));
    edges.push(this.add.rectangle(w - thickness/2, h/2, thickness, h, 0x000000, alpha));
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

  update(): void {
    this.allyStatsPanel.update();
    if (this.autoRecruitStatusText) {
      const game = this.scene.get('GameScene') as any;
      if (game && game.allyManager) {
        const autoEnabled = game.registry.get('autoRecruitEnabled') || false;
        this.autoRecruitStatusText.setText(autoEnabled ? 'Auto: ON' : 'Auto: OFF');
        this.autoRecruitStatusText.setColor(autoEnabled ? '#7bed9f' : '#ff6b6b');
      }
    }
    if (this.autoUpgradeStatusText) {
      const game = this.scene.get('GameScene') as any;
      if (game && game.allyManager) {
        const autoUpgradeEnabled = game.allyManager.autoUpgradeEnabled || false;
        this.autoUpgradeStatusText.setText(autoUpgradeEnabled ? 'Upgrade: ON' : 'Upgrade: OFF');
        this.autoUpgradeStatusText.setColor(autoUpgradeEnabled ? '#ffd700' : '#ff6b6b');
      }
    }
  }
}
