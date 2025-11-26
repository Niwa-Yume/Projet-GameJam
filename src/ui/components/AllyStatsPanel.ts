
import Phaser from 'phaser';

export class AllyStatsPanel extends Phaser.GameObjects.Container {
    private statsText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        const panelW = 130;
        const panelH = 165;
        const panelFill = 0x1a1816;
        const accentColor = 0x7bed9f;

        const bg = scene.add.rectangle(0, 0, panelW, panelH, panelFill, 0.9).setOrigin(0, 0).setStrokeStyle(2, accentColor, 0.8);
        const title = scene.add.text(10, 5, 'ÉTAT RECRUES', { fontFamily: 'Cinzel, serif', fontSize: '13px', color: '#7bed9f', fontStyle: 'bold' }).setOrigin(0, 0);
        this.statsText = scene.add.text(10, 25, '', { fontFamily: 'Cinzel, serif', fontSize: '11px', color: '#ffffff' }).setOrigin(0, 0);

        this.add([bg, title, this.statsText]);
        scene.add.existing(this);
    }

    public update(): void {
        const game = this.scene.scene.get('GameScene') as any;
        if (!game || !game.allyManager) {
            this.statsText.setText('Aucune donnée');
            return;
        }

        const alliesArray = game.allies.getChildren() as any[];
        const totalAllies = alliesArray.length;
        const knights = alliesArray.filter((a: any) => a.getData('kind') === 'knight').length;
        const watchers = alliesArray.filter((a: any) => a.getData('kind') === 'watcher').length;
        const arbalests = alliesArray.filter((a: any) => a.getData('kind') === 'arbalest').length;
        let totalKills = 0, maxLevel = 0, veteransCount = 0;
        alliesArray.forEach((a: any) => {
            totalKills += a.getData('kills') || 0;
            const level = a.getData('level') || 1;
            if (level > maxLevel) maxLevel = level;
            if (level >= 3) veteransCount++;
        });
        const barracksCount = (this.scene.registry.get('barracksCount') as number) ?? 0;
        
        this.statsText.setText(
            `Total: ${totalAllies} ${veteransCount > 0 ? `(⭐${veteransCount})` : ''}\n` +
            `🛡️ ${knights} 🗡️ ${watchers} 🏹 ${arbalests}\n` +
            `💀 Kills: ${totalKills}\n` +
            `⭐ Max lvl: ${maxLevel}\n` +
            `🏰 Casernes: ${barracksCount}`
        );
    }
}
