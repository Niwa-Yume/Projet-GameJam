
import Phaser from 'phaser';
import { GameConstants } from '../../scenes/GameConstants';
import { Button } from '../components/Button';

type BuildingKind = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';

export class MenuManager {
    private scene: Phaser.Scene;
    private registry: Phaser.Registry.RegistryPlugin;

    private btnTower!: Button;
    private btnWall!: Button;
    private btnGenerator!: Button;
    private btnCampfire!: Button;
    private btnForge!: Button;
    private btnStorage!: Button;
    private btnBarracks!: Button;
    private currentKind: BuildingKind = 'tower';

    private recruitKnight!: Button;
    private recruitWatcher!: Button;
    private recruitArbalest!: Button;
    private knightCost = GameConstants.UNIT_DEFS.knight.cost;
    private watcherCost = GameConstants.UNIT_DEFS.watcher.cost;
    private arbalestCost = GameConstants.UNIT_DEFS.arbalest.cost;

    private waveButton!: Button;

    private upgradeMenuContainer?: Phaser.GameObjects.Container;
    private currentUpgradeBuilding?: Phaser.GameObjects.Rectangle;
    private currentUpgradeType?: BuildingKind;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.registry = scene.registry;

        this.createBuildMenu();
        this.createRecruitMenu();
        this.createWaveButton();
        this.registerListeners();
    }

    private createBuildMenu(): void {
        const M = 16;
        const BTN_H = 30, BTN_SP = 10;
        const costPanelY = 185;
        const selStartY = costPanelY + 50;

        this.scene.add.rectangle(M + 10, selStartY - 5, 220, 28, 0x1a1816, 0.85).setOrigin(0, 0).setStrokeStyle(1, 0xd4af37, 0.6).setScrollFactor(0);
        this.scene.add.text(M + 20, selStartY, 'CONSTRUCTION', { fontFamily: 'Cinzel, serif', fontSize: '15px', color: '#ffffff', fontStyle: 'bold' }).setScrollFactor(0).setDepth(1);
        
        let by = selStartY + 35;
        const makeBtn = (label: string, kind: BuildingKind) => {
            const btn = new Button(this.scene, M + 110, by + BTN_H/2, 200, BTN_H, label, {}, () => this.selectKind(kind));
            by += BTN_H + BTN_SP;
            return btn;
        };
        this.btnTower = makeBtn('1 Tour', 'tower');
        this.btnWall = makeBtn('2 Mur', 'wall');
        this.btnGenerator = makeBtn('3 Générateur', 'generator');
        this.btnCampfire = makeBtn('4 Feu', 'campfire');
        this.btnForge = makeBtn('5 Forge', 'forge');
        this.btnStorage = makeBtn('6 Réserve', 'storage');
        this.btnBarracks = makeBtn('7 Caserne', 'barracks');

        const initialKind = (this.registry.get('buildKind') as BuildingKind) ?? 'tower';
        this.selectKind(initialKind, true); // Initial selection without emitting event
    }

    private createRecruitMenu(): void {
        const rightPanelX = 1060;
        const waveHeaderY = 20;
        const recTop = waveHeaderY + 130;

        this.scene.add.rectangle(rightPanelX, recTop, 130, 110, 0x1a1816, 0.9).setOrigin(0, 0).setStrokeStyle(2, 0x8b6f47, 0.8).setScrollFactor(0);
        this.scene.add.text(rightPanelX + 10, recTop + 5, 'RECRUTEMENT', { fontFamily: 'Cinzel, serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0).setScrollFactor(0).setDepth(1);
        
        const recruitBtnX = rightPanelX + 65;
        this.recruitKnight = new Button(this.scene, recruitBtnX, recTop + 30, 110, 18, `Chevalier (${this.knightCost})`, {}, () => this.tryRecruit('knight'));
        this.recruitWatcher = new Button(this.scene, recruitBtnX, recTop + 52, 110, 18, `Veilleur (${this.watcherCost})`, {}, () => this.tryRecruit('watcher'));
        this.recruitArbalest = new Button(this.scene, recruitBtnX, recTop + 74, 110, 18, `Arbalétrier (${this.arbalestCost})`, {}, () => this.tryRecruit('arbalest'));
        
        this.updateRecruitUI();
    }

    private createWaveButton(): void {
        const rightPanelX = 1060;
        const waveHeaderY = 20;
        this.waveButton = new Button(this.scene, rightPanelX + 65, waveHeaderY + 60, 110, 28, 'Lancer Vague', {}, () => {
            this.scene.game.events.emit('start-wave');
        });
    }

    private registerListeners(): void {
        this.registry.events.on('changedata-buildKind', (_p: any, value: BuildingKind) => this.selectKind(value, true));
        this.registry.events.on('changedata-soulShards', this.updateRecruitUI, this);
        this.registry.events.on('changedata-barracksCount', this.updateRecruitUI, this);
        this.registry.events.on('changedata-waveActive', this.updateWaveButton, this);
        this.registry.events.on('changedata-nextWaveIn', this.updateWaveButton, this);
        this.scene.game.events.on('showUpgradeMenu', this.showUpgradeMenuForBuilding, this);
    }

    private selectKind(kind: BuildingKind, fromRegistry: boolean = false): void {
        this.currentKind = kind;
        if (!fromRegistry) {
            this.registry.set('buildKind', kind);
        }
        this.updateSelectButtons();
    }

    private updateSelectButtons(): void {
        if (!this.btnTower) return;
        const buttons: Record<BuildingKind, Button> = {
            tower: this.btnTower, wall: this.btnWall, generator: this.btnGenerator,
            campfire: this.btnCampfire, forge: this.btnForge, storage: this.btnStorage, barracks: this.btnBarracks,
        };
        for (const k in buttons) {
            buttons[k as BuildingKind].setSelected(this.currentKind === k);
        }
    }

    private updateRecruitUI(): void {
        if (!this.recruitKnight) return;
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        const barracks = (this.registry.get('barracksCount') as number) ?? 0;

        console.log(`MenuManager: updateRecruitUI - Shards: ${shards}, Barracks Count: ${barracks}`);

        const canRecruitKnight = barracks > 0 && shards >= this.knightCost;
        const canRecruitWatcher = barracks > 0 && shards >= this.watcherCost;
        const canRecruitArbalest = barracks > 0 && shards >= this.arbalestCost;

        this.recruitKnight.setEnabled(canRecruitKnight);
        this.recruitWatcher.setEnabled(canRecruitWatcher);
        this.recruitArbalest.setEnabled(canRecruitArbalest);

        console.log(`MenuManager: Knight enabled: ${canRecruitKnight} (Cost: ${this.knightCost})`);
        console.log(`MenuManager: Watcher enabled: ${canRecruitWatcher} (Cost: ${this.watcherCost})`);
        console.log(`MenuManager: Arbalest enabled: ${canRecruitArbalest} (Cost: ${this.arbalestCost})`);
    }

    private updateWaveButton(): void {
        if (!this.waveButton) return;
        const waveActive = this.registry.get('waveActive') as boolean;
        const autoMode = this.registry.get('autoWaveMode') as boolean;
        const nextWaveIn = this.registry.get('nextWaveIn') as number;

        this.waveButton.setEnabled(!waveActive);
        if (waveActive) {
            this.waveButton.setText('Vague en cours...');
        } else if (autoMode && nextWaveIn > 0) {
            this.waveButton.setText(`Auto (${nextWaveIn}s)`);
        } else if (autoMode) {
            this.waveButton.setText('Stopper Auto');
        } else {
            this.waveButton.setText('Lancer Vague');
        }
    }

    private tryRecruit(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const game = this.scene.scene.get('GameScene') as any;
        if (game?.allyManager) game.allyManager.recruitUnit(kind);
    }

    private showUpgradeMenuForBuilding(building: Phaser.GameObjects.Container, type: BuildingKind): void {
        // ... (implementation unchanged)
    }

    public destroy(): void {
        // Remove all registry listeners
        this.registry.events.off('changedata-buildKind', this.selectKind, this);
        this.registry.events.off('changedata-soulShards', this.updateRecruitUI, this);
        this.registry.events.off('changedata-barracksCount', this.updateRecruitUI, this);
        this.registry.events.off('changedata-waveActive', this.updateWaveButton, this);
        this.registry.events.off('changedata-nextWaveIn', this.updateWaveButton, this);
        this.scene.game.events.off('showUpgradeMenu', this.showUpgradeMenuForBuilding, this);

        // Destroy all buttons
        this.btnTower?.destroy();
        this.btnWall?.destroy();
        this.btnGenerator?.destroy();
        this.btnCampfire?.destroy();
        this.btnForge?.destroy();
        this.btnStorage?.destroy();
        this.btnBarracks?.destroy();
        this.recruitKnight?.destroy();
        this.recruitWatcher?.destroy();
        this.recruitArbalest?.destroy();
        this.waveButton?.destroy();

        // Destroy upgrade menu container if it exists
        this.upgradeMenuContainer?.destroy();
    }
}
