
import Phaser from 'phaser';

export class HUDManager {
    private scene: Phaser.Scene;
    private registry: Phaser.Registry.RegistryPlugin;

    private shardsText!: Phaser.GameObjects.Text;
    private productionText!: Phaser.GameObjects.Text;
    private hpText!: Phaser.GameObjects.Text;
    private hpBar!: Phaser.GameObjects.Graphics;
    private hpBarLabel!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private waveProgBg!: Phaser.GameObjects.Graphics;
    private waveProgFill!: Phaser.GameObjects.Graphics;
    private waveProgLabel!: Phaser.GameObjects.Text;
    
    private theme = {
        panelFill: 0x1a1816,
        soulColor: 0x66ccff,
        hpColor: 0xff6b6b,
        productionColor: 0x7bed9f,
        gold: 0xd4af37,
        accent: 0x8b6f47,
        text: '#f4e8d0',
    } as const;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.registry = scene.registry;

        this.createSoulPanel();
        this.createHPPanel();
        this.createWavePanel();
        this.registerListeners();
    }

    private createSoulPanel(): void {
        const soulPanelX = 10;
        const soulPanelY = 20;
        const soulPanelW = 220;
        const soulPanelH = 70;

        this.scene.add.rectangle(soulPanelX, soulPanelY, soulPanelW, soulPanelH, this.theme.panelFill, 0.9)
            .setOrigin(0, 0).setStrokeStyle(2, this.theme.soulColor, 0.8).setScrollFactor(0);

        this.drawDiamond(soulPanelX + 18, soulPanelY + 25, 10, this.theme.soulColor).setScrollFactor(0).setDepth(1);

        this.shardsText = this.scene.add.text(soulPanelX + 35, soulPanelY + 12, this.formatShardsLabel(), {
            ...this.txtStyle(20), color: '#66ccff', fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(1);

        const initialProduction = (this.registry.get('totalSoulProduction') as number) ?? 0.5;
        const initialGenCount = (this.registry.get('generatorCount') as number) ?? 0;
        this.productionText = this.scene.add.text(soulPanelX + 35, soulPanelY + 40, this.getProductionText(initialProduction, initialGenCount), {
            ...this.txtStyle(14), color: '#7bed9f', fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(1);
    }

    private createHPPanel(): void {
        const hpPanelX = 26;
        const hpPanelY = 105;
        const hpPanelW = 220;
        const hpPanelH = 65;

        this.scene.add.rectangle(hpPanelX, hpPanelY, hpPanelW, hpPanelH, this.theme.panelFill, 0.9)
            .setOrigin(0, 0).setStrokeStyle(2, this.theme.hpColor, 0.8).setScrollFactor(0);

        this.drawHeart(hpPanelX + 18, hpPanelY + 20, 10, this.theme.hpColor).setScrollFactor(0).setDepth(1);

        this.hpText = this.scene.add.text(hpPanelX + 35, hpPanelY + 10, 'Feu-lien', {
            ...this.txtStyle(16), color: '#ff6b6b', fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(1);

        const hpBarX = hpPanelX + 10;
        const hpBarY = hpPanelY + 35;
        const hpBarW = 160;
        const hpBarH = 12;
        this.hpBar = this.scene.add.graphics().setScrollFactor(0).setDepth(1);
        const initialHP = (this.registry.get('sanctuaryHP') as number) ?? 5;
        this.hpBarLabel = this.scene.add.text(hpBarX + hpBarW + 8, hpBarY + hpBarH / 2, `${initialHP}/5`, {
            ...this.txtStyle(14), color: '#ff6b6b', fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2);
        this.redrawHPBar(initialHP);
    }

    private createWavePanel(): void {
        const rightPanelX = 1060;
        const waveHeaderY = 20;

        this.scene.add.rectangle(rightPanelX, waveHeaderY, 130, 110, this.theme.panelFill, 0.9)
            .setOrigin(0, 0).setStrokeStyle(2, this.theme.gold, 0.8).setScrollFactor(0);

        this.waveText = this.scene.add.text(rightPanelX + 10, waveHeaderY + 10, `Vague: ${Math.max(1, (this.registry.get('wave') as number) ?? 1)}`, {
            ...this.txtStyle(14), color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(1);

        const waveBarW = 110;
        const waveBarH = 6;
        const waveBarX = rightPanelX + 10;
        const waveBarY = waveHeaderY + 85;
        this.waveProgBg = this.scene.add.graphics().setScrollFactor(0).setDepth(1);
        this.waveProgFill = this.scene.add.graphics().setScrollFactor(0).setDepth(2);
        this.drawWaveProgress(0, 1, false);
        this.waveProgLabel = this.scene.add.text(waveBarX + waveBarW / 2, waveBarY + waveBarH / 2, '—', this.txtStyle(12, true)).setOrigin(0.5).setScrollFactor(0).setDepth(3);
    }

    private registerListeners(): void {
        this.registry.events.on('changedata-soulShards', () => this.shardsText.setText(this.formatShardsLabel()));
        this.registry.events.on('changedata-maxSoulShards', () => this.shardsText.setText(this.formatShardsLabel()));
        this.registry.events.on('changedata-totalSoulProduction', this.updateProductionText, this);
        this.registry.events.on('changedata-generatorCount', this.updateProductionText, this);
        this.registry.events.on('changedata-sanctuaryHP', (_p: any, value: number) => this.redrawHPBar(value));
        this.registry.events.on('changedata-wave', (_p: any, value: number) => this.waveText.setText(`Vague: ${Math.max(1, value)}`));
        this.registry.events.on('changedata-waveRemaining', this.updateWaveProgressBar, this);
        this.registry.events.on('changedata-waveTotal', this.updateWaveProgressBar, this);
        this.registry.events.on('changedata-waveActive', this.updateWaveProgressBar, this);
    }

    private formatShardsLabel(): string {
        const cur = (this.registry.get('soulShards') as number) ?? 0;
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        return `${Math.floor(cur)} / ${max}`;
    }

    private getProductionText(prod: number, gens: number): string {
        const perSec = prod;
        const gensPart = gens > 0 ? ` (${gens} générateur${gens > 1 ? 's' : ''})` : '';
        return `+${perSec.toFixed(2)} âmes/s${gensPart}`;
    }

    private updateProductionText = (): void => {
        const prod = (this.registry.get('totalSoulProduction') as number) ?? 0;
        const gens = (this.registry.get('generatorCount') as number) ?? 0;
        if (this.productionText) {
            this.productionText.setText(this.getProductionText(prod, gens));
        }
    };

    private redrawHPBar(hp: number): void {
        const maxHp = 5;
        const w = 160, h = 12;
        const x = 36, y = 140;
        this.hpBar.clear();
        this.hpBar.fillStyle(0x000000, 0.7).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
        this.hpBar.fillStyle(0x2a2520, 1).fillRoundedRect(x, y, w, h, 3);
        const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
        let color = (hp <= 1) ? 0xe74c3c : (hp <= 2) ? 0xff6b6b : 0x2ecc71;
        this.hpBar.fillStyle(color, 1).fillRoundedRect(x, y, w * ratio, h, 3);
        this.hpBar.lineStyle(2, this.theme.hpColor, 0.8).strokeRoundedRect(x, y, w, h, 3);
        if (this.hpBarLabel) this.hpBarLabel.setText(`${hp}/${maxHp}`);
    }

    private updateWaveProgressBar(): void {
        const total = (this.registry.get('waveTotal') as number) ?? 0;
        const remain = (this.registry.get('waveRemaining') as number) ?? 0;
        const active = !!(this.registry.get('waveActive') as boolean);
        this.drawWaveProgress(total - remain, total, active);
    }

    private drawWaveProgress(done: number, total: number, active: boolean): void {
        const x = 1070, y = 105, w = 110, h = 6;
        this.waveProgBg.clear(); this.waveProgFill.clear(); if (!active) { if (this.waveProgLabel) this.waveProgLabel.setText('—'); return; }
        this.waveProgBg.fillStyle(0x000000, 0.45).fillRoundedRect(x, y, w, h, 3).lineStyle(1, this.theme.gold, 0.6).strokeRoundedRect(x, y, w, h, 3);
        const ratio = total > 0 ? Phaser.Math.Clamp(done / total, 0, 1) : 0;
        this.waveProgFill.fillStyle(this.theme.accent, 0.9).fillRoundedRect(x, y, w * ratio, h, 3);
        if (this.waveProgLabel) this.waveProgLabel.setText(`${Math.max(0, done)}/${Math.max(0, total)}`);
    }

    private txtStyle(size: number, semi?: boolean): Phaser.Types.GameObjects.Text.TextStyle {
        return {
            fontFamily: 'Cinzel, serif',
            fontSize: `${size}px`,
            color: semi ? '#b8a88f' : this.theme.text,
            stroke: '#000',
            strokeThickness: 0.5,
            shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 1, fill: true }
        };
    }

    private drawDiamond(x: number, y: number, s: number, color: number): Phaser.GameObjects.Polygon {
        const pts = [{ x: 0, y: -s }, { x: s, y: 0 }, { x: 0, y: s }, { x: -s, y: 0 }];
        return this.scene.add.polygon(x, y, pts, color, 1).setStrokeStyle(1, 0x000000, 0.6);
    }

    private drawHeart(x: number, y: number, s: number, color: number): Phaser.GameObjects.Graphics {
        const g = this.scene.add.graphics();
        g.fillStyle(color, 1);
        const r = s * 0.55;
        g.fillCircle(x - s * 0.4, y - s * 0.2, r);
        g.fillCircle(x + s * 0.4, y - s * 0.2, r);
        g.fillTriangle(x - s, y, x + s, y, x, y + s);
        return g;
    }
}
