
import Phaser from 'phaser';

export class NotificationManager {
    private scene: Phaser.Scene;
    private toasts: Phaser.GameObjects.Container[] = [];
    private tooltipBg?: Phaser.GameObjects.Rectangle;
    private tooltipTxt?: Phaser.GameObjects.Text;

    private theme = {
        goldDim: 0xa88932,
        text: '#f4e8d0',
    } as const;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.scene.game.events.on('notify', this.showToast, this);
    }

    public showToast(msg: string, kind: 'info' | 'error' | 'success' = 'info', duration = 1200): void {
        const w = this.scene.cameras.main.width;
        const y = 8 + this.toasts.length * 22;
        const bgColor = kind === 'error' ? 0x3b1a1a : kind === 'success' ? 0x1d3324 : 0x222222;
        const c = this.scene.add.container(0, 0).setDepth(1200).setScrollFactor(0);
        const txt = this.scene.add.text(w / 2, y + 12, msg, this.txtStyle(14)).setOrigin(0.5).setScrollFactor(0);
        const bg = this.scene.add.rectangle(w / 2, y + 12, txt.width + 20, txt.height + 8, bgColor, 0.9).setScrollFactor(0).setStrokeStyle(1, this.theme.goldDim, 0.6);
        c.add([bg, txt]);
        c.setAlpha(0).setY(0);
        this.toasts.push(c);
        this.scene.tweens.add({ targets: c, alpha: 1, duration: 150, ease: 'Quad.Out' });
        this.scene.time.delayedCall(duration, () => {
            this.scene.tweens.add({ targets: c, alpha: 0, duration: 250, ease: 'Quad.In', onComplete: () => {
                c.destroy(true);
                this.toasts = this.toasts.filter(t => t !== c);
            }});
        });
    }

    public showTooltip(text: string, wx: number, wy: number): void {
        if (!this.tooltipBg || !this.tooltipTxt) {
            this.tooltipBg = this.scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.7).setScrollFactor(0).setDepth(1000).setStrokeStyle(1, this.theme.goldDim, 0.7);
            this.tooltipTxt = this.scene.add.text(0, 0, text, this.txtStyle(12)).setScrollFactor(0).setDepth(1001);
        }
        this.tooltipTxt.setText(text);
        const pad = 6, tw = this.tooltipTxt.width + pad * 2, th = this.tooltipTxt.height + pad * 2;
        let x = wx + 12, y = wy - th - 8;
        if (x + tw / 2 > this.scene.cameras.main.width) x = this.scene.cameras.main.width - tw / 2 - 4;
        if (y - th / 2 < 0) y = wy + th / 2 + 8;
        this.tooltipBg.setSize(tw, th).setPosition(x, y).setVisible(true);
        this.tooltipTxt.setPosition(x - this.tooltipTxt.width / 2, y - this.tooltipTxt.height / 2).setVisible(true);
    }

    public hideTooltip(): void {
        this.tooltipBg?.setVisible(false);
        this.tooltipTxt?.setVisible(false);
    }

    private txtStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
        return {
            fontFamily: 'Cinzel, serif',
            fontSize: `${size}px`,
            color: this.theme.text,
            stroke: '#000',
            strokeThickness: 0.5,
            shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 1, fill: true }
        };
    }

    public destroy(): void {
        this.scene.game.events.off('notify', this.showToast, this);
        this.tooltipBg?.destroy();
        this.tooltipTxt?.destroy();
        this.toasts.forEach(t => t.destroy());
    }
}
