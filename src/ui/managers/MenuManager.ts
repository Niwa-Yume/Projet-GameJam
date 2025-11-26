
import Phaser from 'phaser';
import { GameConstants } from '../../scenes/GameConstants';
import { Button } from '../components/Button';

type BuildingKind = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';

export class MenuManager {
    private scene: Phaser.Scene;
    private registry: Phaser.Data.DataManager;

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
    private tutoButton!: Button;

    private upgradeMenuContainer?: Phaser.GameObjects.Container;
    private videoPopup?: Phaser.GameObjects.Container;
    private videoElement?: Phaser.GameObjects.DOMElement;

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

        // Create Tuto Button right after Barracks button, and it's always enabled
        this.tutoButton = new Button(this.scene, M + 110, by + BTN_H/2, 200, BTN_H, 'Tutoriel', {}, () => {
            this.showVideoPopup();
        });

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

    private showVideoPopup(): void {
        if (this.videoPopup) return;

        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        this.videoPopup = this.scene.add.container(centerX, centerY).setDepth(1000).setScrollFactor(0);

        const overlay = this.scene.add.rectangle(0, 0, this.scene.cameras.main.width * 2, this.scene.cameras.main.height * 2, 0x000000, 0.8)
            .setInteractive()
            .on('pointerdown', () => this.closeVideoPopup());
        
        const popupBg = this.scene.add.rectangle(0, 0, 680, 440, 0x1a1816, 0.98)
            .setStrokeStyle(3, 0xd4af37, 1);

        const title = this.scene.add.text(0, -195, 'TUTORIEL', {
            fontFamily: 'Cinzel, serif',
            fontSize: '22px',
            color: '#d4af37',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const videoHtml = `
            <video id="tuto-video" width="640" height="360" controls style="border-radius: 4px; background: #000;">
                <source src="tuto.mp4" type="video/mp4">
                Votre navigateur ne supporte pas la vidéo.
            </video>
        `;
        
        this.videoElement = this.scene.add.dom(0, 20).createFromHTML(videoHtml).setScrollFactor(0);

        const closeBtn = new Button(this.scene, 0, 200, 120, 32, 'Fermer', {}, () => this.closeVideoPopup());
        closeBtn.setScrollFactor(0);

        this.videoPopup.add([overlay, popupBg, title, this.videoElement, closeBtn]);
    }

    private closeVideoPopup(): void {
        if (!this.videoPopup) return;

        const video = document.getElementById('tuto-video') as HTMLVideoElement;
        if (video) {
            video.pause();
            video.currentTime = 0;
        }

        this.videoPopup.destroy();
        this.videoPopup = undefined;
        this.videoElement = undefined;
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

        const canRecruitKnight = barracks > 0 && shards >= this.knightCost;
        const canRecruitWatcher = barracks > 0 && shards >= this.watcherCost;
        const canRecruitArbalest = barracks > 0 && shards >= this.arbalestCost;

        this.recruitKnight.setEnabled(canRecruitKnight);
        this.recruitWatcher.setEnabled(canRecruitWatcher);
        this.recruitArbalest.setEnabled(canRecruitArbalest);
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

    private showUpgradeMenuForBuilding(_building: Phaser.GameObjects.Container, _type: BuildingKind): void {
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
        this.tutoButton?.destroy();

        // Destroy upgrade menu container if it exists
        this.upgradeMenuContainer?.destroy();
        
        // Close video popup if open
        this.closeVideoPopup();
    }
}
