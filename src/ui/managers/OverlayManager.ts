
import Phaser from 'phaser';
import { SaveSystem } from '../../utils/SaveSystem';

export class OverlayManager {
    private scene: Phaser.Scene;
    private gameOverContainer?: Phaser.GameObjects.Container;
    private pauseContainer?: Phaser.GameObjects.Container;
    private offlineProgressContainer?: Phaser.GameObjects.Container;

    private theme = {
        panelFill: 0x1a1816,
        gold: 0xd4af37,
        text: '#f4e8d0',
        textDim: '#b8a88f',
    } as const;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.scene.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    }

    public showGameOverOverlay(): void {
        const cam = this.scene.cameras.main;
        const w = cam.width, h = cam.height;
        const bg = this.scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.6).setScrollFactor(0).setInteractive();
        const title = this.scene.add.text(w/2, h/2 - 40, 'YOU DIED', { ...this.txtStyle(56), color: '#a10000' }).setOrigin(0.5).setScrollFactor(0);
        const btnW = 220, btnH = 48;
        const btnBg = this.scene.add.rectangle(w/2, h/2 + 20, btnW, btnH, 0x2a2520, 0.95).setStrokeStyle(1, this.theme.gold).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        const btnTxt = this.scene.add.text(btnBg.x, btnBg.y, 'Recommencer', this.txtStyle(18)).setOrigin(0.5).setScrollFactor(0);
        btnBg.on('pointerdown', () => {
            btnBg.setFillStyle(0x4a4030, 0.95);
            this.scene.time.delayedCall(100, () => this.resetGame());
        });
        this.gameOverContainer = this.scene.add.container(0, 0, [bg, title, btnBg, btnTxt]);
        this.gameOverContainer.setDepth(1000);
    }

    public showOfflineProgressPopup(data: { formattedTime: string; soulsEarned: number }): void {
        const cam = this.scene.cameras.main;
        const w = cam.width, h = cam.height;
        const bg = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7).setScrollFactor(0).setInteractive();
        const panelW = 400, panelH = 250;
        const panel = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, this.theme.panelFill, 0.95).setScrollFactor(0).setStrokeStyle(3, this.theme.gold);
        const title = this.scene.add.text(w / 2, h / 2 - 80, 'BIENVENUE !', { ...this.txtStyle(32), color: this.theme.text, fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        const subtitle = this.scene.add.text(w / 2, h / 2 - 40, `Vous étiez absent pendant:`, { ...this.txtStyle(18), color: this.theme.textDim }).setOrigin(0.5).setScrollFactor(0);
        const timeText = this.scene.add.text(w / 2, h / 2 - 10, data.formattedTime, { ...this.txtStyle(24), color: '#66ccff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        const diamond = this.scene.add.polygon(w / 2 - 80, h / 2 + 30, [{ x: 0, y: -12 }, { x: 12, y: 0 }, { x: 0, y: 12 }, { x: -12, y: 0 }], 0x66ccff, 1).setStrokeStyle(1, 0, 0.6).setScrollFactor(0);
        const soulsText = this.scene.add.text(w / 2 - 50, h / 2 + 30, `+${data.soulsEarned} âmes gagnées !`, { ...this.txtStyle(22), color: '#7bed9f', fontStyle: 'bold' }).setOrigin(0, 0.5).setScrollFactor(0);
        const btnW = 180, btnH = 48;
        const btnBg = this.scene.add.rectangle(w / 2, h / 2 + 85, btnW, btnH, 0x2a2520, 0.95).setStrokeStyle(2, this.theme.gold).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        const btnTxt = this.scene.add.text(w / 2, h / 2 + 85, 'Continuer', this.txtStyle(18)).setOrigin(0.5).setScrollFactor(0);
        const container = this.scene.add.container(0, 0, [bg, panel, title, subtitle, timeText, diamond, soulsText, btnBg, btnTxt]);
        container.setDepth(2000);
        this.offlineProgressContainer = container;
        btnBg.on('pointerdown', () => {
            btnBg.setFillStyle(0x4a4030, 0.95);
            this.scene.time.delayedCall(100, () => {
                if (container && container.scene) container.destroy(true);
                this.offlineProgressContainer = undefined;
            });
        });
    }

    private togglePause(): void {
        const currentlyVisible = !!this.pauseContainer && this.pauseContainer.visible;
        if (currentlyVisible) {
            this.pauseContainer?.destroy(true);
            this.pauseContainer = undefined;
            this.scene.scene.resume('GameScene');
            return;
        }
        const cam = this.scene.cameras.main, w = cam.width, h = cam.height;
        const bg = this.scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.55).setScrollFactor(0).setInteractive();
        const title = this.scene.add.text(w/2, h/2 - 10, 'PAUSE', { ...this.txtStyle(42), color: this.theme.text as string }).setOrigin(0.5).setScrollFactor(0);
        const hint = this.scene.add.text(w/2, h/2 + 26, 'Appuyez sur ESC pour reprendre', this.txtStyle(14, true)).setOrigin(0.5).setScrollFactor(0);
        this.pauseContainer = this.scene.add.container(0, 0, [bg, title, hint]).setDepth(999).setScrollFactor(0);
        this.scene.scene.pause('GameScene');
    }

    private resetGame(): void {
        SaveSystem.deleteSave();
        if (this.gameOverContainer?.scene) this.gameOverContainer.removeAll(true).setVisible(false);
        this.gameOverContainer = undefined;
        if (this.pauseContainer?.scene) this.pauseContainer.removeAll(true).setVisible(false);
        this.pauseContainer = undefined;
        this.scene.scene.get('GameScene').scene.restart();
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
}
