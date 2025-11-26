
import Phaser from 'phaser';

interface ButtonStyle {
    fill: number;
    fillHover: number;
    fillActive: number;
    stroke: number;
    strokeHover: number;
    text: string;
    fontFamily: string;
    fontSize: string;
}

export class Button extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Rectangle;
    private txt: Phaser.GameObjects.Text;
    private style: ButtonStyle;
    private selected: boolean = false;
    private isEnabled: boolean = true;
    private isHovered: boolean = false; // Internal state for hover

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, text: string, style: Partial<ButtonStyle> = {}, onClick: () => void) {
        super(scene, x, y);

        this.style = {
            fill: style.fill ?? 0x2a2520,
            fillHover: style.fillHover ?? 0x3a3228,
            fillActive: style.fillActive ?? 0x4a4030,
            stroke: style.stroke ?? 0xd4af37,
            strokeHover: style.strokeHover ?? 0xffe79a,
            text: style.text ?? '#f4e8d0',
            fontFamily: style.fontFamily ?? 'Cinzel, serif',
            fontSize: style.fontSize ?? '14px',
        };

        this.bg = scene.add.rectangle(0, 0, width, height, this.style.fill, 0.95)
            .setStrokeStyle(1, this.style.stroke, 0.85)
            .setInteractive({ useHandCursor: true });

        this.txt = scene.add.text(0, 0, text, {
            fontFamily: this.style.fontFamily,
            fontSize: this.style.fontSize,
            color: this.style.text,
            align: 'center'
        }).setOrigin(0.5);

        this.add([this.bg, this.txt]);
        scene.add.existing(this);

        this.bg.on('pointerdown', () => {
            if (!this.isEnabled || !this.active || !this.bg.scene) return;
            this.bg.setFillStyle(this.style.fillActive);
            onClick();
        });

        this.bg.on('pointerup', () => {
            if (!this.isEnabled || !this.active || !this.bg.scene) return;
            this.updateState();
        });

        this.bg.on('pointerover', () => {
            if (!this.isEnabled || !this.active || !this.bg.scene) return;
            this.isHovered = true;
            this.updateState();
        });

        this.bg.on('pointerout', () => {
            if (!this.active || !this.bg.scene) return;
            this.isHovered = false;
            this.updateState();
        });
    }

    private updateState(): void {
        if (!this.active || !this.bg.scene) return;

        if (!this.isEnabled) {
            this.bg.setFillStyle(0x1b1b1b, 0.7).setStrokeStyle(1, 0x444, 0.7);
            this.txt.setAlpha(0.6);
            return;
        }

        this.txt.setAlpha(1.0);
        if (this.selected) {
            this.bg.setFillStyle(this.style.fillHover).setStrokeStyle(1, this.style.strokeHover);
            this.txt.setColor('#ffffff');
        } else {
            this.bg.setFillStyle(this.isHovered ? this.style.fillHover : this.style.fill).setStrokeStyle(1, this.isHovered ? this.style.strokeHover : this.style.stroke);
            this.txt.setColor(this.style.text);
        }
    }

    public setText(text: string): void {
        if (!this.active || !this.txt.scene) return;
        this.txt.setText(text);
    }

    public setEnabled(enabled: boolean): void {
        if (!this.active) return;
        this.isEnabled = enabled;
        this.updateState();
    }

    public setSelected(selected: boolean): void {
        if (!this.active) return;
        this.selected = selected;
        this.updateState();
    }
}
