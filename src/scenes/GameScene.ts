import Phaser from 'phaser';
import { createBonfire } from '../entities/Bonfire';
import { createSkeletonEnemy } from '../entities/Enemies';
import { attachHealthBar, updateHealthBar } from '../ui/HealthBar';
import { ensureFlameTexture, ensureSmokeTexture } from '../gfx/CanvasTextures';
import { SaveSystem } from '../utils/SaveSystem';
import { GameConstants } from './GameConstants';
import { PathfindingGrid } from './PathfindingGrid';

type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class GameScene extends Phaser.Scene {
    // Groupes d'objets
    private towers!: Phaser.GameObjects.Group;
    private enemies!: Phaser.Physics.Arcade.Group;  // Groupe physique pour les ennemis
    private bullets!: Phaser.Physics.Arcade.Group;  // Groupe physique pour les projectiles
    private walls!: Phaser.GameObjects.Group;
    // Nouveau: générateurs
    private generators!: Phaser.GameObjects.Group;
    // Utilitaires: feu de camp, forge, réserve
    private campfires!: Phaser.GameObjects.Group;
    private forges!: Phaser.GameObjects.Group;
    private storages!: Phaser.GameObjects.Group;
    // Nouveaux: alliés et casernes
    private allies!: Phaser.GameObjects.Group;
    private barracks!: Phaser.GameObjects.Group;

    // Position du sanctuaire (alignée à la grille)
    private sanctuaryPos!: { x: number; y: number };
    // Timer de spawn ennemi
    private enemyTimer?: Phaser.Time.TimerEvent;

    // Grille de pathfinding
    private pathfindingGrid!: PathfindingGrid;

    // Prévisualisation de placement
    private previewGhost?: Phaser.GameObjects.Rectangle;
    private previewRangeGfx?: Phaser.GameObjects.Graphics;

    // Économie et vagues
    private towerCost: number = GameConstants.INITIAL_TOWER_COST;
    private wallCost: number = GameConstants.INITIAL_WALL_COST;
    private generatorCost: number = GameConstants.INITIAL_GENERATOR_COST;
    private campfireCost: number = GameConstants.INITIAL_CAMPFIRE_COST;
    private forgeCost: number = GameConstants.INITIAL_FORGE_COST;
    private storageCost: number = GameConstants.INITIAL_STORAGE_COST;
    private barracksCost: number = GameConstants.INITIAL_BARRACKS_COST;
    private enemySpeed: number = GameConstants.ENEMY_SPEED;

    // Sélection du type de bâtiment
    private currentBuildKind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks' = 'tower';

    // Recrutement
    private trainingQueue: Array<'knight' | 'watcher' | 'arbalest'> = [];
    private activeTrainings: Phaser.Time.TimerEvent[] = [];

    // Pathfinding (utilise maintenant PathfindingGrid)
    // ... removed old gridCols, gridRows, blocked ...

    // État de vague
    private waveActive: boolean = false;
    private waveSpawnsRemaining: number = 0;
    private waveSpawning: boolean = false; // tant que le timer spawn n'est pas terminé
    private autoWaveMode: boolean = false; // mode automatique (activé après vague 1)
    private nextWaveTimer?: Phaser.Time.TimerEvent; // timer pour lancer la vague suivante automatiquement

    // Système de production passive d'âmes
    private passiveSoulTimer?: Phaser.Time.TimerEvent;
    private soulProductionRate: number = 0.5; // âmes par seconde
    private soulProductionMultiplier: number = 1.0; // multiplicateur global

    // Système de sauvegarde automatique
    private autoSaveTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super('GameScene');
    }

    preload() {
        // Les GIFs sont maintenant chargés directement en tant qu'éléments HTML dans Bonfire.ts
    }

    create() {
        // Toujours reprendre la physique au démarrage (au cas où la scène précédente était en pause)
        if (this.physics && this.physics.world) {
            this.physics.world.resume();
        }

        // Nettoyer les timers existants
        if (this.passiveSoulTimer) {
            this.time.removeEvent(this.passiveSoulTimer);
            this.passiveSoulTimer = undefined;
        }
        if (this.enemyTimer) {
            this.time.removeEvent(this.enemyTimer);
            this.enemyTimer = undefined;
        }
        if (this.nextWaveTimer) {
            this.time.removeEvent(this.nextWaveTimer);
            this.nextWaveTimer = undefined;
        }

        // Note: scene.restart() gère automatiquement le nettoyage des groupes et objets
        // Pas besoin de les détruire manuellement

        // === CRÉER LA ZONE DE JEU AVEC BORDURE ===
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaW = GameConstants.GAME_AREA_WIDTH;
        const gameAreaH = GameConstants.GAME_AREA_HEIGHT;

        // Fond de la zone de jeu
        this.add.rectangle(gameAreaX, gameAreaY, gameAreaW, gameAreaH, 0x1a1612, 1)
            .setOrigin(0, 0)
            .setDepth(-10);

        // Bordure de la zone de jeu
        const border = this.add.graphics();
        border.lineStyle(3, 0xd4af37, 0.6);
        border.strokeRect(gameAreaX, gameAreaY, gameAreaW, gameAreaH);
        border.setDepth(100);

        // Déterminer et aligner la position du sanctuaire sur la grille, au centre de la ZONE DE JEU
        const TS = GameConstants.TILE_SIZE;
        const centerX = gameAreaX + gameAreaW / 2;
        const centerY = gameAreaY + gameAreaH / 2;
        const cellX = Math.floor(centerX / TS);
        const cellY = Math.floor(centerY / TS);
        this.sanctuaryPos = { x: cellX * TS + TS / 2, y: cellY * TS + TS / 2 };

        // Réinitialiser explicitement l'état de vague et du spawner avant d'exposer la registry à l'UI
        this.enemySpeed = GameConstants.ENEMY_SPEED;
        if (this.enemyTimer) { this.time.removeEvent(this.enemyTimer); }
        this.enemyTimer = undefined;
        if (this.nextWaveTimer) { this.time.removeEvent(this.nextWaveTimer); }
        this.nextWaveTimer = undefined;
        this.waveActive = false;
        this.waveSpawning = false;
        this.waveSpawnsRemaining = 0;
        this.autoWaveMode = false; // Commence en mode manuel

        // === CHARGEMENT DE LA SAUVEGARDE ===
        const saveData = SaveSystem.load();
        let offlineProgress = null;

        if (saveData) {
            // Calculer les gains hors-ligne
            offlineProgress = SaveSystem.calculateOfflineProgress(saveData);
            console.log('⏰ Temps écoulé:', SaveSystem.formatTimeElapsed(offlineProgress.timeElapsedSeconds));
            console.log('💰 Âmes gagnées hors-ligne:', offlineProgress.soulsEarned);
            console.log('📊 Âmes avant:', saveData.soulShards, '→ après:', offlineProgress.cappedSouls);

            // Stocker pour afficher dans l'UI plus tard
            this.registry.set('offlineProgress', offlineProgress);
            this.registry.set('hasOfflineProgress', offlineProgress.timeElapsedSeconds > 60); // Au moins 1 minute
        }

        // --- Registry init (AVANT l'UI) ---
        // Utiliser les données sauvegardées si elles existent
        if (saveData && offlineProgress) {
            console.log('🔄 Restauration de la sauvegarde...');
            this.registry.set('soulShards', offlineProgress.cappedSouls);
            this.registry.set('maxSoulShards', saveData.maxSoulShards);
            this.registry.set('sanctuaryHP', saveData.sanctuaryHP);
            // Utiliser le nouveau numéro de vague calculé avec les vagues hors-ligne
            this.registry.set('wave', offlineProgress.newWaveNumber);
            this.registry.set('forgeCount', saveData.forgeCount);
            this.registry.set('barracksCount', saveData.barracksCount);

            // Restaurer le mode auto
            if (saveData.autoWaveMode) {
                this.autoWaveMode = true;
                this.registry.set('autoWaveMode', true);
            }

            // Restaurer les coûts et production (IMPORTANT: mettre dans le registre aussi !)
            this.towerCost = saveData.towerCost;
            this.soulProductionRate = saveData.soulProductionRate;
            this.soulProductionMultiplier = saveData.soulProductionMultiplier;
            this.registry.set('soulProductionRate', saveData.soulProductionRate);
            this.registry.set('soulProductionMultiplier', saveData.soulProductionMultiplier);

            console.log('✅ Sauvegarde restaurée - Âmes:', offlineProgress.cappedSouls, 'Vague:', offlineProgress.newWaveNumber, 'Production:', saveData.soulProductionRate, '×', saveData.soulProductionMultiplier);

            if (offlineProgress.wavesCompleted > 0) {
                console.log('🌊 PROGRESSION HORS-LIGNE:');
                console.log('   - Vagues complétées pendant votre absence:', offlineProgress.wavesCompleted);
                console.log('   - Vague avant:', saveData.wave, '→ Vague maintenant:', offlineProgress.newWaveNumber);
                console.log('   - Mode auto:', this.autoWaveMode ? 'ACTIF ✅' : 'INACTIF ❌');
            }
        } else {
            console.log('🆕 Nouvelle partie - initialisation par défaut');
            // Valeurs par défaut pour une nouvelle partie
            this.registry.set('soulShards', 100);
            this.registry.set('maxSoulShards', 100);
            this.registry.set('sanctuaryHP', 5);
            this.registry.set('wave', 0);
            this.registry.set('forgeCount', 0);
            this.registry.set('barracksCount', 0);
            this.registry.set('soulProductionRate', GameConstants.PASSIVE_SOUL_RATE);
            this.registry.set('soulProductionMultiplier', 1.0);
        }

        // Toujours définir ces valeurs (communes aux deux cas)
        this.registry.set('buildKind', this.currentBuildKind);
        this.registry.set('towerCost', this.towerCost);
        this.registry.set('buildCost', this.getCurrentCost());
        this.registry.set('generatorCost', this.generatorCost);
        this.registry.set('campfireCost', this.campfireCost);
        this.registry.set('forgeCost', this.forgeCost);
        this.registry.set('storageCost', this.storageCost);
        this.registry.set('barracksCost', this.barracksCost);
        this.registry.set('wallCost', this.wallCost);
        // États de vague garantis à OFF avant l'UI
        this.registry.set('waveActive', false);
        this.registry.set('waveTotal', 0);
        this.registry.set('waveRemaining', 0);
        // NE PAS écraser autoWaveMode si déjà restauré depuis la sauvegarde !
        if (!saveData || !saveData.autoWaveMode) {
            this.registry.set('autoWaveMode', false); // Mode manuel seulement pour nouvelle partie
        }
        this.registry.set('nextWaveIn', 0); // Pas de compte à rebours
        // Système de production passive d'âmes (idle)
        // Ces valeurs sont déjà définies lors du chargement de la sauvegarde ou de l'initialisation par défaut
        // On récupère juste les valeurs depuis le registre pour les variables locales
        this.soulProductionRate = (this.registry.get('soulProductionRate') as number) ?? GameConstants.PASSIVE_SOUL_RATE;
        this.soulProductionMultiplier = (this.registry.get('soulProductionMultiplier') as number) ?? 1.0;

        console.log('🎮 Production active - Taux:', this.soulProductionRate, '× Multiplicateur:', this.soulProductionMultiplier, '= Production totale:', (this.soulProductionRate * this.soulProductionMultiplier), 'âmes/s');

        // Lancer l’UI après que la registry soit prête
        this.scene.launch('UIScene');

        // === CRÉER LE SANCTUAIRE DE FEU (BONFIRE) AU CENTRE ===
        createBonfire(this, this.sanctuaryPos.x, this.sanctuaryPos.y);

        // Groupes - les groupes physiques pour bullets et enemies
        this.towers = this.add.group();
        this.bullets = this.physics.add.group();  // Groupe physique pour les projectiles
        this.enemies = this.physics.add.group();  // Groupe physique pour les ennemis
        this.walls = this.add.group();
        this.generators = this.add.group();
        this.campfires = this.add.group();
        this.forges = this.add.group();
        this.storages = this.add.group();
        this.allies = this.add.group();
        this.barracks = this.add.group();

        // Overlap projectiles-ennemis
        this.physics.add.overlap(
            this.bullets,
            this.enemies,
            (bulletObj, enemyObj) => this.onBulletHitEnemy(bulletObj, enemyObj),
            undefined,
            this
        );

        // Démarrer la production passive d'âmes (idle game)
        this.startPassiveSoulProduction();

        // Démarrer la sauvegarde automatique toutes les 30 secondes
        this.autoSaveTimer = this.time.addEvent({
            delay: 30000, // 30 secondes
            loop: true,
            callback: () => {
                const buildingsData = this.collectBuildingsData();
                SaveSystem.save(this.registry, buildingsData);
            },
            callbackScope: this
        });

        // Nettoyage au shutdown (retire le timer s'il existe)
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.registry.events.off('changedata-buildKind');
            if (this.enemyTimer) { this.time.removeEvent(this.enemyTimer); }
            this.enemyTimer = undefined;
            if (this.autoSaveTimer) { this.time.removeEvent(this.autoSaveTimer); }
            this.autoSaveTimer = undefined;
            // Sauvegarder une dernière fois avant de fermer avec les bâtiments
            const buildingsData = this.collectBuildingsData();
            SaveSystem.save(this.registry, buildingsData);
        });

        // Inputs
        this.input.on('pointerdown', this.handlePointerDown, this);
        // Sélection du type de bâtiment: 1=tour, 2=mur, 3=générateur, 4=feu, 5=forge, 6=réserve, 7=caserne
        this.input.keyboard?.on('keydown-ONE', () => this.setBuildKind('tower'));
        this.input.keyboard?.on('keydown-NUMPAD_ONE', () => this.setBuildKind('tower'));
        this.input.keyboard?.on('keydown-TWO', () => this.setBuildKind('wall'));
        this.input.keyboard?.on('keydown-NUMPAD_TWO', () => this.setBuildKind('wall'));
        this.input.keyboard?.on('keydown-THREE', () => this.setBuildKind('generator'));
        this.input.keyboard?.on('keydown-NUMPAD_THREE', () => this.setBuildKind('generator'));
        this.input.keyboard?.on('keydown-FOUR', () => this.setBuildKind('campfire'));
        this.input.keyboard?.on('keydown-NUMPAD_FOUR', () => this.setBuildKind('campfire'));
        this.input.keyboard?.on('keydown-FIVE', () => this.setBuildKind('forge'));
        this.input.keyboard?.on('keydown-NUMPAD_FIVE', () => this.setBuildKind('forge'));
        this.input.keyboard?.on('keydown-SIX', () => this.setBuildKind('storage'));
        this.input.keyboard?.on('keydown-NUMPAD_SIX', () => this.setBuildKind('storage'));
        this.input.keyboard?.on('keydown-SEVEN', () => this.setBuildKind('barracks'));
        this.input.keyboard?.on('keydown-NUMPAD_SEVEN', () => this.setBuildKind('barracks'));

        // Spawner d'ennemis
        this.enemySpeed = GameConstants.ENEMY_SPEED;
        if (this.enemyTimer) { this.time.removeEvent(this.enemyTimer); }
        this.enemyTimer = undefined;
        this.waveActive = false;
        this.waveSpawning = false;
        this.waveSpawnsRemaining = 0;

        // Prévisualisation (fantôme + cercle)
        this.previewGhost = this.add.rectangle(0, 0, 48, 48, 0x9f8d62, 0.28).setDepth(8).setVisible(false);
        this.previewRangeGfx = this.add.graphics().setDepth(7).setVisible(false);
        this.input.on('pointermove', this.updatePlacementPreview, this);
        this.input.on('gameout', () => { this.previewGhost?.setVisible(false); this.previewRangeGfx?.setVisible(false); });


        // Écouter le changement du type de construction via registry (UI)
        this.registry.events.on('changedata-buildKind', (_p: any, value: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks') => {
            this.setBuildKind(value);
        });

        // Nettoyage des écouteurs au shutdown
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.registry.events.off('changedata-buildKind');
        });

        // Init pathfinding grid
        this.pathfindingGrid = new PathfindingGrid(gameAreaX, gameAreaY, gameAreaW, gameAreaH);

        // Restaurer les bâtiments depuis la sauvegarde
        console.log('🔍 Vérification sauvegarde bâtiments:', {
            hasSaveData: !!saveData,
            hasBuildings: saveData?.buildings !== undefined,
            buildingsLength: saveData?.buildings?.length ?? 0,
            buildings: saveData?.buildings
        });

        if (saveData && saveData.buildings && saveData.buildings.length > 0) {
            this.restoreBuildings(saveData.buildings);
        } else {
            console.log('⚠️ Aucun bâtiment à restaurer');
        }

        // Si le mode auto était actif, lancer la prochaine vague automatiquement après 3 secondes
        if (this.autoWaveMode && offlineProgress && offlineProgress.wavesCompleted >= 0) {
            console.log('🔄 Mode auto détecté au chargement - lancement de la vague dans 3 secondes...');
            this.registry.set('nextWaveIn', 3);
            this.nextWaveTimer = this.time.addEvent({
                delay: 3000,
                callback: () => {
                    console.log('🚀 Lancement automatique de la vague', this.registry.get('wave'));
                    this.startNextWave();
                },
                callbackScope: this
            });
        }
    }

    // Crée un ennemi squelette (Image + physique)
    private createSkeletonEnemy(x: number, y: number) {
        return createSkeletonEnemy(this, x, y);
    }

    // Changer le type de bâtiment courant
    private setBuildKind(kind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks'): void {
        if (this.currentBuildKind === kind) return;
        this.currentBuildKind = kind;
        this.registry.set('buildKind', this.currentBuildKind);
        this.registry.set('buildCost', this.getCurrentCost());
        // Mettre à jour la preview (couleurs/cercle)
        const pointer = this.input.activePointer;
        if (pointer) this.updatePlacementPreview(pointer);
    }

    // Coût selon le type courant
    private getCurrentCost(): number {
        switch (this.currentBuildKind) {
            case 'tower': return this.towerCost;
            case 'wall': return this.wallCost;
            case 'generator': return this.generatorCost;
            case 'campfire': return this.campfireCost;
            case 'forge': return this.forgeCost;
            case 'storage': return this.storageCost;
            case 'barracks': return this.barracksCost;
        }
    }

    // Ajoute des éclats en respectant la capacité max
    private addShards(delta: number): void {
        const cur = (this.registry.get('soulShards') as number) ?? 0;
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        const next = Phaser.Math.Clamp(cur + delta, 0, max);
        this.registry.set('soulShards', next);
    }

    // Crée une tour et son cercle de portée au survol
    private createTower(x: number, y: number): void {
        // Container pour tous les éléments visuels de la tour
        const towerContainer = this.add.container(x, y).setDepth(10);

        // === DESIGN DARK SOULS DARK FANTASY ===

        // Ombre au sol (ellipse douce)
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillEllipse(0, 24, 54, 12);
        towerContainer.add(shadow);

        // Base en pierre sombre (fondation)
        const base = this.add.graphics();
        base.fillStyle(0x2a2520, 1);
        base.fillRect(-26, 18, 52, 8);
        base.lineStyle(1, 0x1a1510, 0.8);
        base.strokeRect(-26, 18, 52, 8);
        towerContainer.add(base);

        // Corps principal de la tour (pierre gothique sombre)
        const body = this.add.graphics();
        body.fillStyle(0x3a3530, 1);
        body.fillRect(-20, -18, 40, 36);
        // Texture de pierres
        body.lineStyle(1, 0x2a2520, 0.6);
        body.strokeRect(-20, -6, 40, 1);
        body.strokeRect(-20, 6, 40, 1);
        body.strokeRect(-10, -18, 1, 36);
        body.strokeRect(10, -18, 1, 36);
        // Bordure extérieure
        body.lineStyle(2, 0x1a1510, 0.9);
        body.strokeRect(-20, -18, 40, 36);
        towerContainer.add(body);

        // Fissures (cracks) pour un effet usé
        const cracks = this.add.graphics();
        cracks.lineStyle(1, 0x2a2724, 0.7);
        const drawCrack = (sx: number, sy: number, pts: [number, number][]) => {
            cracks.beginPath(); cracks.moveTo(sx, sy); for (const [dx, dy] of pts) cracks.lineTo(sx + dx, sy + dy); cracks.strokePath();
        };
        drawCrack(-12, -10, [[-2, 4],[3, 6],[0, 10]]);
        drawCrack(8, -2, [[-4, 4],[2, 8]]);
        drawCrack(0, 4, [[-3, 3],[5, 10]]);
        towerContainer.add(cracks);

        // Mousse/lichen à la base
        const moss = this.add.graphics();
        moss.fillStyle(0x3d5a3d, 0.9);
        moss.fillEllipse(-14, 15, 10, 6);
        moss.fillEllipse(0, 16, 16, 7);
        moss.fillEllipse(12, 15, 10, 6);
        moss.lineStyle(1, 0x2c402c, 0.8); moss.strokeEllipse(0, 16, 16, 7);
        towerContainer.add(moss);

        // Créneaux gothiques au sommet
        const battlements = this.add.graphics();
        battlements.fillStyle(0x2a2520, 1);
        // Créneaux pointus (style gothique)
        for (let i = 0; i < 5; i++) {
            const bx = -18 + i * 9;
            if (i % 2 === 0) {
                // Créneau haut (pointe)
                battlements.fillTriangle(bx, -18, bx + 4, -27, bx + 8, -18);
            }
        }
        battlements.lineStyle(1, 0x1a1510, 0.8);
        battlements.strokeRect(-20, -20, 40, 2);
        towerContainer.add(battlements);

        // Fenêtre/meurtrière centrale (fente sombre)
        const window = this.add.graphics();
        window.fillStyle(0x0a0a08, 1);
        window.fillRect(-3, -8, 6, 12);
        window.lineStyle(1, 0x4a4540, 0.7);
        window.strokeRect(-3, -8, 6, 12);
        towerContainer.add(window);

        // Lueur mystique dans la meurtrière (idle)
        const glow = this.add.graphics();
        glow.fillStyle(0x6b8fa5, 0.35);
        glow.fillRect(-2, -6, 4, 8);
        glow.setBlendMode(Phaser.BlendModes.ADD);
        towerContainer.add(glow);
        this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.65 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Torches latérales (flammes + fumée)
        const flameKey = ensureFlameTexture(this);
        const smokeKey = ensureSmokeTexture(this);
        const torchLeft = this.add.particles(0, 0, flameKey, {
            x: -16, y: -10, lifespan: { min: 300, max: 700 }, scale: { start: 0.18, end: 0 }, alpha: { start: 0.9, end: 0 }, speedY: { min: -20, max: -50 }, speedX: { min: -8, max: 8 }, quantity: 1, frequency: 80, blendMode: 'ADD'
        });
        const torchRight = this.add.particles(0, 0, flameKey, {
            x: 16, y: -10, lifespan: { min: 300, max: 700 }, scale: { start: 0.18, end: 0 }, alpha: { start: 0.9, end: 0 }, speedY: { min: -20, max: -50 }, speedX: { min: -8, max: 8 }, quantity: 1, frequency: 80, blendMode: 'ADD'
        });
        const smokeLeft = this.add.particles(0, 0, smokeKey, {
            x: -16, y: -16, lifespan: { min: 600, max: 1200 }, scale: { start: 0.5, end: 1.0 }, alpha: { start: 0.3, end: 0 }, speedY: { min: -8, max: -16 }, speedX: { min: -4, max: 4 }, quantity: 1, frequency: 140
        });
        const smokeRight = this.add.particles(0, 0, smokeKey, {
            x: 16, y: -16, lifespan: { min: 600, max: 1200 }, scale: { start: 0.5, end: 1.0 }, alpha: { start: 0.3, end: 0 }, speedY: { min: -8, max: -16 }, speedX: { min: -4, max: 4 }, quantity: 1, frequency: 140
        });
        towerContainer.add([torchLeft, torchRight, smokeLeft, smokeRight]);

        // Bannière (apparaitra aux upgrades élevés)
        const banner = this.add.graphics();
        banner.setVisible(false);
        towerContainer.addAt(banner, 1); // derrière corps/fenêtre

        // Rectangle invisible pour les interactions (hitbox)
        const tower = this.add.rectangle(0, 0, 48, 48, 0x000000, 0).setDepth(10);
        towerContainer.add(tower);

        // Données de la tour
        tower.setData('nextFire', 0);
        tower.setData('hp', 100);
        tower.setData('maxHp', 100);
        tower.setData('upgradeLevel', 0);
        tower.setData('fireRateMul', 1);
        tower.setData('damageMul', 1);
        tower.setData('container', towerContainer);
        tower.setData('glow', glow);
        tower.setData('banner', banner);
        tower.setData('torches', [torchLeft, torchRight, smokeLeft, smokeRight]);
        // IMPORTANT: Stocker les coordonnées absolues de la tour (du container)
        tower.setData('worldX', x);
        tower.setData('worldY', y);

        this.towers.add(tower);
        attachHealthBar(this, tower);
        tower.setInteractive({ useHandCursor: true });
        const rangeGfx = this.add.graphics().setDepth(9).setVisible(false);
        const drawRange = () => { rangeGfx.clear(); rangeGfx.lineStyle(1, 0x6b8fa5, 0.85); rangeGfx.strokeCircle(x, y, GameConstants.TOWER_RANGE); };
        const showRange = () => { drawRange(); rangeGfx.setVisible(true); };
        const hideRange = () => { rangeGfx.setVisible(false); };
        tower.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, showRange);
        tower.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, hideRange);

        // Clic pour ouvrir le menu d'upgrade
        tower.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) return;
            this.showUpgradeMenu(tower, 'tower');
        });

        tower.once(Phaser.GameObjects.Events.DESTROY, () => {
            rangeGfx.destroy();
            // Laisser le container détruire ses propres enfants pour éviter les doubles-destructions
            const container = tower.getData('container') as Phaser.GameObjects.Container | undefined;
            if (container && container.active) {
                container.destroy();
            }
        });
    }

    // Crée un mur (bloquant pour le pathfinding)
    private createWall(x: number, y: number): void {
        const wall = this.add.rectangle(x, y, 48, 48, 0x2b2a28).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        wall.setData('hp', 200);
        wall.setData('maxHp', 200);
        this.walls.add(wall);
        attachHealthBar(this, wall);
        wall.once(Phaser.GameObjects.Events.DESTROY, () => {
            // Déjà détruit: retirer du groupe sans toucher au display list
            if (this.walls.contains(wall)) this.walls.remove(wall, false, false);
            this.recomputeGrid();
            this.recomputeAllEnemyPaths();
        });
        // Recompute dès placement
        this.recomputeGrid();
        this.recomputeAllEnemyPaths();
    }

    // Générateur d'éclats
    private createGenerator(x: number, y: number): void {
        const gen = this.add.rectangle(x, y, 48, 48, 0x7b6a2e).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        gen.setData('hp', 120);
        gen.setData('maxHp', 120);
        gen.setData('upgradeLevel', 0); // Niveau d'upgrade (0-3)
        gen.setData('yieldMul', 1); // Multiplicateur de production
        this.generators.add(gen);
        attachHealthBar(this, gen);
        gen.setInteractive({ useHandCursor: true });

        const baseYield = GameConstants.GENERATOR_YIELD;
        const timer = this.time.addEvent({ delay: GameConstants.GENERATOR_TICK_MS, loop: true, callback: () => {
            const mul = (gen.getData('yieldMul') as number) ?? 1;
            this.addShards(baseYield * mul);
        }});
        gen.setData('genTimer', timer);

        // Clic pour ouvrir le menu d'upgrade
        gen.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) return;
            this.showUpgradeMenu(gen, 'generator');
        });

        gen.once(Phaser.GameObjects.Events.DESTROY, () => { timer.remove(false); this.generators.remove(gen, false, false); });
    }

    // Feu de camp (aura de soin)
    private createCampfire(x: number, y: number): void {
        const fire = this.add.rectangle(x, y, 48, 48, 0x8d4b2a).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        fire.setData('hp', 100);
        fire.setData('maxHp', 100);
        this.campfires.add(fire);
        attachHealthBar(this, fire);
        // Aura additive, légère pulsation
        const aura = this.add.graphics({ x, y }).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
        const drawAura = (alpha: number, radius: number) => {
            aura.clear();
            aura.fillStyle(0xffa45a, alpha);
            aura.fillCircle(0, 0, radius);
            aura.lineStyle(1, 0xffdd99, Math.min(1, alpha + 0.1));
            aura.strokeCircle(0, 0, radius + 4);
        };
        drawAura(0.18, 22);
        this.tweens.add({ targets: aura, duration: 900, yoyo: true, repeat: -1, onUpdate: (tw) => {
            const v = tw.progress; drawAura(0.12 + 0.08 * (1 - Math.abs(0.5 - v) * 2), 20 + 4 * v);
        }});
        fire.once(Phaser.GameObjects.Events.DESTROY, () => { aura.destroy(); this.campfires.remove(fire, false, false); });

        const timer = this.time.addEvent({ delay: GameConstants.CAMPFIRE_TICK_MS, loop: true, callback: () => {
            const healTargets: Phaser.GameObjects.Rectangle[] = [];
            healTargets.push(
                ...(this.towers.getChildren() as Phaser.GameObjects.Rectangle[]),
                ...(this.walls.getChildren() as Phaser.GameObjects.Rectangle[]),
                ...(this.generators.getChildren() as Phaser.GameObjects.Rectangle[]),
                ...(this.forges.getChildren() as Phaser.GameObjects.Rectangle[]),
                ...(this.storages.getChildren() as Phaser.GameObjects.Rectangle[]),
                ...(this.campfires.getChildren() as Phaser.GameObjects.Rectangle[])
            );
            for (const go of healTargets) {
                const d = Phaser.Math.Distance.Between(x, y, go.x, go.y);
                if (d <= GameConstants.CAMPFIRE_RADIUS) {
                    const hp = (go.getData('hp') as number) ?? 0;
                    const max = (go.getData('maxHp') as number) ?? 0;
                    if (hp > 0 && max > 0 && hp < max) {
                        const nh = Math.min(max, hp + GameConstants.CAMPFIRE_HEAL);
                        go.setData('hp', nh);
                        this.updateHealthBar(go);
                    }
                }
            }
        }});
        fire.setData('tickTimer', timer);
        fire.once(Phaser.GameObjects.Events.DESTROY, () => { timer.remove(false); });
    }

    // Forge (débloque les upgrades de tours et générateurs)
    private createForge(x: number, y: number): void {
        const forge = this.add.rectangle(x, y, 48, 48, 0x3f4457).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        forge.setData('hp', 120);
        forge.setData('maxHp', 120);
        this.forges.add(forge);
        attachHealthBar(this, forge);
        // Notifier l'UI qu'une forge existe maintenant
        this.registry.set('forgeCount', this.forges.getLength());
        forge.once(Phaser.GameObjects.Events.DESTROY, () => {
            this.forges.remove(forge, false, false);
            this.registry.set('forgeCount', this.forges.getLength());
        });
    }

    // Réserve (augmente la capacité max d'éclats)
    private createStorage(x: number, y: number): void {
        const stor = this.add.rectangle(x, y, 48, 48, 0x6a5438).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        stor.setData('hp', 140);
        stor.setData('maxHp', 140);
        this.storages.add(stor);
        attachHealthBar(this, stor);
        // Augmenter la capacité
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        const inc = 50;
        this.registry.set('maxSoulShards', max + inc);
        stor.setData('capInc', inc);
        stor.once(Phaser.GameObjects.Events.DESTROY, () => {
            this.storages.remove(stor, false, false);
            const curMax = (this.registry.get('maxSoulShards') as number) ?? 100;
            const dec = stor.getData('capInc') as number ?? 0;
            const newMax = Math.max(0, curMax - dec);
            this.registry.set('maxSoulShards', newMax);
            const cur = (this.registry.get('soulShards') as number) ?? 0;
            this.registry.set('soulShards', Math.min(cur, newMax));
        });
    }

    // Caserne
    private createBarracks(x: number, y: number): void {
        const br = this.add.rectangle(x, y, 48, 48, 0x4b3323).setDepth(9).setStrokeStyle(1, 0x3e372d, 0.5);
        br.setData('hp', 150);
        br.setData('maxHp', 150);
        this.barracks.add(br);
        attachHealthBar(this, br);
        const count = ((this.registry.get('barracksCount') as number) ?? 0) + 1;
        this.registry.set('barracksCount', count);
        br.once(Phaser.GameObjects.Events.DESTROY, () => {
            this.barracks.remove(br, false, false);
            const c = Math.max(0, ((this.registry.get('barracksCount') as number) ?? 1) - 1);
            this.registry.set('barracksCount', c);
        });
    }

    private spawnEnemy(): void {
        // Choisir une cellule de spawn sur le bord gauche non bloquée
        const startCell = this.pickSpawnCell();
        const sx = startCell ? this.cellToWorld(startCell.cx, startCell.cy).x : -16;
        const sy = startCell ? this.cellToWorld(startCell.cx, startCell.cy).y : Phaser.Math.Between(32, this.game.canvas.height - 32);
        const enemy = this.createSkeletonEnemy(sx, sy);
        this.enemies.add(enemy);

        // Calcul du chemin vers le sanctuaire
        const targetCell = this.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
        let pathPixels: { x: number; y: number; }[] | null = null;
        if (startCell) {
            const path = this.findPath(startCell, targetCell);
            if (path) {
                pathPixels = path.map(p => this.cellToWorld(p.cx, p.cy));
                // enlever premier waypoint si c'est la cellule actuelle
                if (pathPixels.length && Phaser.Math.Distance.Between(pathPixels[0].x, pathPixels[0].y, enemy.x, enemy.y) < 4) {
                    pathPixels.shift();
                }
            }
        }
        enemy.setData('path', pathPixels);
        enemy.setData('pathIndex', 0);
        enemy.setData('target', undefined);

        // Initialiser la vitesse
        this.updateEnemyVelocityAlongPath(enemy);

        // Décompte des spawns restants si vague en cours
        if (this.waveActive) {
            this.waveSpawnsRemaining = Math.max(0, this.waveSpawnsRemaining - 1);
            if (this.waveSpawnsRemaining === 0) {
                this.waveSpawning = false;
            }
        }
    }

    update(): void {
        const hp = (this.registry.get('sanctuaryHP') as number) ?? 0;
        if (hp <= 0) {
            return;
        }

        // Mise à jour du compteur pour la prochaine vague automatique
        if (this.nextWaveTimer && this.autoWaveMode && !this.waveActive) {
            const remaining = Math.ceil(this.nextWaveTimer.getRemaining() / 1000);
            this.registry.set('nextWaveIn', remaining);
        }

        // --- Tours ---
        const now = this.time.now;
        const range = GameConstants.TOWER_RANGE;

        for (const obj of this.towers.getChildren()) {
            const tower = obj as Phaser.GameObjects.Rectangle;
            const nextFire = (tower.getData('nextFire') as number) ?? 0;
            if (now < nextFire) continue;

            // Utiliser les coordonnées absolues du container
            const towerX = (tower.getData('worldX') as number) ?? tower.x;
            const towerY = (tower.getData('worldY') as number) ?? tower.y;

            const target = this.findTarget(towerX, towerY, range);
            if (!target) continue;

            // Log de debug : la tour tire
            if (this.game.loop.frame % 60 === 0) {
                console.log(`🎯 Tour tire ! Position: (${towerX}, ${towerY}) -> Cible: (${target.x}, ${target.y})`);
            }

            this.fireFromTower(tower, target);
            const rateMul = (tower.getData('fireRateMul') as number) ?? 1;
            tower.setData('nextFire', now + GameConstants.TOWER_FIRE_RATE * rateMul);
        }

        // --- Défense sanctuaire (ennemis qui touchent) ---
        const sx = this.sanctuaryPos.x;
        const sy = this.sanctuaryPos.y;
        const threshold = 48; // un peu plus large pour capter les contacts
        const enemies = this.enemies.getChildren().slice();
        for (const obj of enemies) {
            const enemy = obj as EnemyGO;
            const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, sx, sy);
            if (dist <= threshold) {
                enemy.destroy();
                // Retirer du groupe sans redétruire
                this.enemies.remove(enemy as any, true, false);
                this.decWaveRemaining(1);
                const current = (this.registry.get('sanctuaryHP') as number) ?? 0;
                const next = Math.max(0, current - 1);
                this.registry.set('sanctuaryHP', next);
                if (next <= 0) {
                    if (this.enemyTimer) {
                        this.time.removeEvent(this.enemyTimer);
                        this.enemyTimer = undefined;
                    }
                    this.input.off('pointerdown', this.handlePointerDown, this);
                    this.physics.world.pause();
                    this.scene.pause();
                    this.registry.set('waveActive', false);
                }
                continue;
            }
        }

        // Anti-blocage: si un ennemi a quasi 0 vitesse trop longtemps, recalculer son chemin
        const nowMs = this.time.now;
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            const enemy = obj as EnemyGO;
            const body = (enemy as any).body as Phaser.Physics.Arcade.Body | undefined;
            if (!body) continue;
            const speed2 = body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y;
            const stopped = speed2 < 1; // ~0 vitesse
            let stuckSince = (enemy.getData('stuckSince') as number) ?? 0;
            if (stopped) {
                if (!stuckSince) { enemy.setData('stuckSince', nowMs); }
                else if (nowMs - stuckSince > 800) {
                    // Recalculer path
                    const curC = this.worldToCell(enemy.x, enemy.y);
                    const goalC = this.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
                    const cellPath = this.findPath(curC, goalC);
                    const path = cellPath ? cellPath.map(c => this.cellToWorld(c.cx, c.cy)) : null;
                    enemy.setData('path', path);
                    enemy.setData('pathIndex', 0);
                    this.updateEnemyVelocityAlongPath(enemy);
                    enemy.setData('stuckSince', nowMs + 400); // évite recalcul trop fréquent
                }
            } else {
                if (stuckSince) enemy.setData('stuckSince', 0);
            }
        }

        // --- Projectiles hors écran ---
        const w = this.game.canvas.width, h = this.game.canvas.height;
        for (const obj of this.bullets.getChildren().slice()) {
            const b = obj as Phaser.GameObjects.GameObject & { x: number; y: number };
            if (b.x < -32 || b.y < -32 || b.x > w + 32 || b.y > h + 32) {
                // Retirer du groupe, puis destroy
                this.bullets.remove(b as any, true, false);
                (b as any).destroy?.();
            }
        }

        // --- Alliés: IA simple ---
        this.updateAlliesAI();

        // --- Ennemis: pathfollowing + attaques des bâtiments ---
        const dt = this.game.loop.delta / 1000; // secondes
        const eList = this.enemies.getChildren() as EnemyGO[];
        for (const enemy of eList) {
            const body = ((enemy as any).body as Phaser.Physics.Arcade.Body | undefined);
            // Si déjà une cible en cours
            let target = enemy.getData('target') as Phaser.GameObjects.Rectangle | undefined;

            if (!target || !target.active) {
                // Chercher une cible à portée (mur prioritaire, sinon tour puis générateur, etc.)
                target = this.findBuildingAt(enemy.x, enemy.y);
                if (target) {
                    enemy.setData('target', target);
                    if (body) body.setVelocity(0, 0);
                } else {
                    // Suivre le chemin
                    this.followPathStep(enemy);
                }
            }

            if (target && target.active) {
                // Infliger des dégâts
                const hpB = (target.getData('hp') as number) ?? 0;
                const newHp = hpB - GameConstants.ENEMY_DPS * dt;
                target.setData('hp', newHp);
                this.updateHealthBar(target);
                if (newHp <= 0) {
                    // Détruire le bâtiment et reprendre la marche
                    // Retirer des groupes AVANT destroy pour éviter double-destruction
                    if (this.towers.contains(target)) this.towers.remove(target, true, false);
                    if (this.walls.contains(target)) this.walls.remove(target, true, false);
                    if (this.generators.contains(target)) this.generators.remove(target, true, false);
                    if (this.campfires.contains(target)) this.campfires.remove(target, true, false);
                    if (this.forges.contains(target)) this.forges.remove(target, true, false);
                    if (this.storages.contains(target)) this.storages.remove(target, true, false);
                    if (this.barracks.contains(target)) this.barracks.remove(target, true, false);
                    target.destroy();
                    enemy.setData('target', undefined);
                    // Recalculer path car la topologie a changé
                    this.recomputeGrid();
                    this.recomputeAllEnemyPaths();
                    // Reprendre
                    this.updateEnemyVelocityAlongPath(enemy);
                }
            }
        }

        // Fin de vague: si plus de spawn prévu et plus aucun ennemi vivant
        // Debug: afficher l'état toutes les 2 secondes si une vague est active
        if (this.game.loop.frame % 120 === 0 && this.waveActive) {
            console.log(`📊 État vague: waveActive=${this.waveActive}, waveSpawning=${this.waveSpawning}, ennemis=${this.enemies.getLength()}`);
        }

        if (this.waveActive && !this.waveSpawning && this.enemies.getLength() === 0) {
            console.log(`🎉 CONDITIONS DE FIN DE VAGUE REMPLIES !`);
            this.waveActive = false;
            this.registry.set('waveActive', false);
            this.registry.set('waveRemaining', 0);

            // Récupérer le numéro de vague actuel
            const currentWave = (this.registry.get('wave') as number) ?? 0;
            console.log(`✅ Vague ${currentWave} terminée !`);

            // Activer le mode auto après avoir terminé la PREMIÈRE vague lancée (vague 1)
            // Comme on incrémente avant de lancer, la première vague est numéro 1
            if (currentWave >= 1 && !this.autoWaveMode) {
                this.autoWaveMode = true;
                this.registry.set('autoWaveMode', true);
                console.log(`🔄 Mode automatique activé après la vague ${currentWave}!`);
            }

            // 🔥 IMPORTANT: Sauvegarder immédiatement la fin de vague pour le calcul hors-ligne
            if (this.autoWaveMode) {
                const buildingsData = this.collectBuildingsData();
                SaveSystem.save(this.registry, buildingsData);
                console.log(`💾 Sauvegarde immédiate après vague ${currentWave} (mode auto actif)`);
            }

            // Si mode automatique, lancer la vague suivante après 5 secondes
            if (this.autoWaveMode) {
                console.log(`⏱️ Prochaine vague dans 5 secondes...`);
                this.registry.set('nextWaveIn', 5); // Compteur pour l'UI
                this.nextWaveTimer = this.time.addEvent({
                    delay: 5000,
                    callback: () => {
                        this.startNextWave();
                    },
                    callbackScope: this
                });
            }
        }
    }


    private findTarget(x: number, y: number, range: number): EnemyGO | null {
        let best: EnemyGO | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            const enemy = obj as EnemyGO;
            const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (d <= range && d < bestD) { best = enemy; bestD = d; }
        }
        return best;
    }

    private fireFromTower(tower: Phaser.GameObjects.Rectangle, target: EnemyGO): void {
        // Flash de la lueur de la tour lors du tir
        const glow = tower.getData('glow') as Phaser.GameObjects.Graphics | undefined;
        if (glow) {
            this.tweens.add({
                targets: glow,
                alpha: { from: 1.0, to: 0.3 },
                duration: 150,
                ease: 'Quad.Out'
            });
        }

        // Récupérer les coordonnées absolues de la tour
        const towerX = (tower.getData('worldX') as number) ?? tower.x;
        const towerY = (tower.getData('worldY') as number) ?? tower.y;

        // Projectile Arcade simple (rectangle) pour collisions fiables
        const bullet = this.add.rectangle(towerX, towerY, 8, 8, 0x8fa9bf).setDepth(12);

        // Ajouter au groupe physique AVANT d'ajouter la physique
        this.bullets.add(bullet);

        // Ajouter la physique
        this.physics.add.existing(bullet);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);

        const dx = target.x - towerX;
        const dy = target.y - towerY;
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * GameConstants.BULLET_SPEED;
        const vy = (dy / len) * GameConstants.BULLET_SPEED;
        body.setVelocity(vx, vy);

        // Ajout visuel léger: tween d'alpha
        this.tweens.add({ targets: bullet, alpha: { from: 1, to: 0.6 }, duration: 200, yoyo: true, repeat: 3 });
    }

    private fireAllyProjectile(ally: Phaser.GameObjects.Rectangle, target: EnemyGO): void {
        const bullet = this.add.rectangle(ally.x, ally.y, 6, 6, 0xbfa76a).setDepth(12);

        // Ajouter au groupe physique AVANT d'ajouter la physique
        this.bullets.add(bullet);

        this.physics.add.existing(bullet);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        const dx = target.x - ally.x;
        const dy = target.y - ally.y;
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * (GameConstants.BULLET_SPEED * 0.9);
        const vy = (dy / len) * (GameConstants.BULLET_SPEED * 0.9);
        body.setVelocity(vx, vy);
    }

    private onBulletHitEnemy(
        bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
        enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
    ): void {
        console.log(`💥 COLLISION DÉTECTÉE ! Projectile touche ennemi`);
        const bulletGO = this.extractGO(bulletObj) as Phaser.GameObjects.GameObject;
        const enemyGO = this.extractGO(enemyObj) as Phaser.GameObjects.GameObject;
        // Retirer d'abord des groupes (du display list aussi), puis destroy
        if (this.bullets.contains(bulletGO as any)) this.bullets.remove(bulletGO as any, true, false);
        if (this.enemies.contains(enemyGO as any)) this.enemies.remove(enemyGO as any, true, false);
        enemyGO.destroy();
        bulletGO.destroy();
        this.addShards(GameConstants.SHARD_REWARD);
        this.decWaveRemaining(1);
        console.log(`✅ Ennemi tué ! Ennemis restants: ${this.enemies.getLength()}`);
    }

    private extractGO(
        obj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
    ): Phaser.GameObjects.GameObject {
        if ((obj as any).gameObject) return (obj as any).gameObject as Phaser.GameObjects.GameObject;
        if ((obj as any).body && (obj as any).body.gameObject) return (obj as any).body.gameObject as Phaser.GameObjects.GameObject;
        return obj as unknown as Phaser.GameObjects.GameObject;
    }

    // Trouve un bâtiment (mur en priorité, sinon tour puis générateur, etc.) en contact avec l'ennemi
    private findBuildingAt(x: number, y: number): Phaser.GameObjects.Rectangle | undefined {
        for (const obj of this.walls.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.towers.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.generators.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.campfires.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.forges.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.storages.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        for (const obj of this.barracks.getChildren()) {
            const go = obj as Phaser.GameObjects.Rectangle;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go;
        }
        return undefined;
    }

    // Lancement d'une vague (appelé par l'UI ou automatiquement)
    public startNextWave(): void {
        if (this.waveActive) return; // déjà en cours

        // Annuler le timer automatique s'il existe
        if (this.nextWaveTimer) {
            this.nextWaveTimer.remove(false);
            this.nextWaveTimer = undefined;
        }
        this.registry.set('nextWaveIn', 0);

        this.waveActive = true;
        this.registry.set('waveActive', this.waveActive);

        // Incrémente la vague
        const currentWave = ((this.registry.get('wave') as number) ?? 1) + 1;
        this.registry.set('wave', currentWave);
        // Met à jour difficulté
        this.enemySpeed = GameConstants.ENEMY_SPEED + (currentWave - 1) * 10;
        const interval = Math.max(500, 1000 - (currentWave - 1) * 50);
        const count = 10 + (currentWave - 1) * 2;
        this.waveSpawning = true;
        this.waveSpawnsRemaining = count;
        // Progression UI
        this.registry.set('waveTotal', count);
        this.registry.set('waveRemaining', count);
        // Spawn la vague via un TimerEvent répétitif
        const timer = this.time.addEvent({
            delay: interval,
            repeat: count - 1,
            callback: () => this.spawnEnemy(),
            callbackScope: this
        });
        this.enemyTimer = timer;
    }

    // Basculer le mode automatique (appelé par l'UI quand on clique sur le bouton)
    public toggleAutoWave(): void {
        this.autoWaveMode = !this.autoWaveMode;
        this.registry.set('autoWaveMode', this.autoWaveMode);

        // Si on désactive le mode auto, annuler le timer
        if (!this.autoWaveMode && this.nextWaveTimer) {
            this.nextWaveTimer.remove(false);
            this.nextWaveTimer = undefined;
            this.registry.set('nextWaveIn', 0);
        }
    }

    // API publique pour l’UI: recruter une unité
    public recruitUnit(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const def = GameConstants.UNIT_DEFS[kind];
        if (!def) return;
        const barracksCount = (this.registry.get('barracksCount') as number) ?? 0;
        if (barracksCount <= 0) return; // pas de caserne
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        if (shards < def.cost) return;
        this.registry.set('soulShards', shards - def.cost);
        this.enqueueTraining(kind);
    }

    private enqueueTraining(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const barracksCount = (this.registry.get('barracksCount') as number) ?? 0;
        if (this.activeTrainings.length < barracksCount) {
            this.startTraining(kind);
        } else {
            this.trainingQueue.push(kind);
        }
    }

    private startTraining(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const def = GameConstants.UNIT_DEFS[kind];
        const timer = this.time.addEvent({ delay: def.trainMs, callback: () => {
            this.spawnAlly(kind);
            const idx = this.activeTrainings.indexOf(timer);
            if (idx >= 0) this.activeTrainings.splice(idx, 1);
            const next = this.trainingQueue.shift();
            if (next) this.startTraining(next);
        }});
        this.activeTrainings.push(timer);
    }

    private spawnAlly(kind: 'knight' | 'watcher' | 'arbalest'): void {
        let sx = this.sanctuaryPos.x, sy = this.sanctuaryPos.y;
        const b = this.barracks.getChildren() as Phaser.GameObjects.Rectangle[];
        if (b.length > 0) {
            const pick = Phaser.Utils.Array.GetRandom(b);
            sx = pick.x + Phaser.Math.Between(-8, 8);
            sy = pick.y + Phaser.Math.Between(-8, 8);
        }
        const color = kind === 'knight' ? 0x6b7a8a : kind === 'watcher' ? 0x6a8a79 : 0xb79a52;
        const ally = this.add.rectangle(sx, sy, 24, 24, color).setDepth(11).setStrokeStyle(1, 0x3e372d, 0.5);
        this.allies.add(ally);
        this.physics.add.existing(ally);
        const body = ally.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        ally.setData('kind', kind);
        ally.setData('nextAtk', 0);
    }

    private updateAlliesAI(): void {
        const now = this.time.now;
        const allies = this.allies.getChildren() as Phaser.GameObjects.Rectangle[];
        for (const a of allies) {
            const kind = a.getData('kind') as 'knight' | 'watcher' | 'arbalest';
            const def = GameConstants.UNIT_DEFS[kind];
            const vision = kind === 'arbalest' ? def.atkRange : 220;
            const target = this.findTarget(a.x, a.y, vision);
            const body = a.body as Phaser.Physics.Arcade.Body | undefined;

            if (target) {
                const d = Phaser.Math.Distance.Between(a.x, a.y, target.x, target.y);
                if (def.role === 'ranged') {
                    if (d <= def.atkRange) {
                        if (now >= ((a.getData('nextAtk') as number) ?? 0)) {
                            this.fireAllyProjectile(a, target);
                            a.setData('nextAtk', now + def.atkRateMs);
                        }
                        if (body) body.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, a.x, a.y, target.x, target.y, def.speed);
                    }
                } else {
                    if (d <= def.atkRange + 6) {
                        if (now >= ((a.getData('nextAtk') as number) ?? 0)) {
                            // Tuer l'ennemi au corps-à-corps (allié)
                            // Retirer proprement du groupe puis détruire
                            if (this.enemies.contains(target as any)) this.enemies.remove(target as any, true, false);
                            target.destroy();
                            this.addShards(GameConstants.SHARD_REWARD);
                            this.decWaveRemaining(1);
                            a.setData('nextAtk', now + def.atkRateMs);
                        }
                        if (body) body.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, a.x, a.y, target.x, target.y, def.speed);
                    }
                }
            } else {
                const d = Phaser.Math.Distance.Between(a.x, a.y, this.sanctuaryPos.x, this.sanctuaryPos.y);
                if (d > 120) {
                    if (body) this.seek(body, a.x, a.y, this.sanctuaryPos.x, this.sanctuaryPos.y, def.speed * 0.9);
                } else {
                    if (body) body.setVelocity(0, 0);
                }
            }
        }
    }

    private seek(body: Phaser.Physics.Arcade.Body, fromX: number, fromY: number, toX: number, toY: number, speed: number): void {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.hypot(dx, dy) || 1;
        body.setVelocity((dx / len) * speed, (dy / len) * speed);
    }

    private updatePlacementPreview(pointer: Phaser.Input.Pointer): void {
        if (!this.previewGhost || !this.previewRangeGfx) return;

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaRight = gameAreaX + GameConstants.GAME_AREA_WIDTH;
        const gameAreaBottom = gameAreaY + GameConstants.GAME_AREA_HEIGHT;

        // Cacher le preview si hors de la zone de jeu
        if (worldX < gameAreaX || worldX > gameAreaRight || worldY < gameAreaY || worldY > gameAreaBottom) {
            this.previewGhost.setVisible(false);
            this.previewRangeGfx.setVisible(false);
            return;
        }

        const TS = GameConstants.TILE_SIZE;
        const cellX = Math.floor((worldX - gameAreaX) / TS);
        const cellY = Math.floor((worldY - gameAreaY) / TS);
        const snappedX = gameAreaX + cellX * TS + TS / 2;
        const snappedY = gameAreaY + cellY * TS + TS / 2;
        const valid = this.canPlaceAt(cellX, cellY);
        this.previewGhost
            .setPosition(snappedX, snappedY)
            .setFillStyle(valid ? 0x9f8d62 : 0x7a1a1a, 0.28)
            .setVisible(true);
        this.previewRangeGfx.clear();
        if (this.currentBuildKind === 'tower') {
            this.previewRangeGfx.lineStyle(1, valid ? 0x9f8d62 : 0x7a1a1a, 0.85);
            this.previewRangeGfx.strokeCircle(snappedX, snappedY, GameConstants.TOWER_RANGE);
            this.previewRangeGfx.setVisible(true);
        } else {
            this.previewRangeGfx.setVisible(false);
        }
    }

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;

        // Vérifier si le clic est dans la zone de jeu
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaRight = gameAreaX + GameConstants.GAME_AREA_WIDTH;
        const gameAreaBottom = gameAreaY + GameConstants.GAME_AREA_HEIGHT;

        if (worldX < gameAreaX || worldX > gameAreaRight || worldY < gameAreaY || worldY > gameAreaBottom) {
            return; // Clic hors de la zone de jeu
        }

        const TS = GameConstants.TILE_SIZE;
        const cellX = Math.floor((worldX - gameAreaX) / TS);
        const cellY = Math.floor((worldY - gameAreaY) / TS);
        const cols = Math.floor(GameConstants.GAME_AREA_WIDTH / TS);
        const rows = Math.floor(GameConstants.GAME_AREA_HEIGHT / TS);
        if (cellX < 0 || cellY < 0 || cellX >= cols || cellY >= rows) return;
        const snappedX = gameAreaX + cellX * TS + TS / 2;
        const snappedY = gameAreaY + cellY * TS + TS / 2;

        const cost = this.getCurrentCost();
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        if (shards < cost) {
            this.game.events.emit('notify', `Pas assez d'Âmes (coût: ${cost})`, 'error');
            return;
        }
        if (this.isSanctuaryCell(cellX, cellY)) {
            this.game.events.emit('notify', 'Vous ne pouvez pas bâtir sur le Feu-lien', 'info');
            return;
        }
        if (this.isOccupiedCell(cellX, cellY)) {
            this.game.events.emit('notify', 'Case déjà occupée', 'info');
            return;
        }
        if (!this.canPlaceAt(cellX, cellY)) {
            this.game.events.emit('notify', `Emplacement invalide`, 'info');
            return;
        }

        this.registry.set('soulShards', shards - cost);
        this.createBuilding(this.currentBuildKind, snappedX, snappedY);
        if (this.currentBuildKind === 'tower') {
            this.towerCost = Math.ceil(this.towerCost * 1.15);
            this.registry.set('towerCost', this.towerCost);
        }
        this.registry.set('buildCost', this.getCurrentCost());
        this.updatePlacementPreview(pointer);
    }

    private createBuilding(kind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks', x: number, y: number): void {
        if (kind === 'tower') this.createTower(x, y);
        else if (kind === 'wall') this.createWall(x, y);
        else if (kind === 'generator') this.createGenerator(x, y);
        else if (kind === 'campfire') this.createCampfire(x, y);
        else if (kind === 'forge') this.createForge(x, y);
        else if (kind === 'storage') this.createStorage(x, y);
        else if (kind === 'barracks') this.createBarracks(x, y);
    }

    // Version sans vérifications pour la restauration depuis sauvegarde
    private createBuildingDirect(kind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks', x: number, y: number): void {
        console.log(`    🔨 Création directe de ${kind} à (${x}, ${y})`);
        this.createBuilding(kind, x, y);
        console.log(`    ✅ ${kind} créé, groupes:`, {
            towers: this.towers?.getLength(),
            walls: this.walls?.getLength(),
            generators: this.generators?.getLength(),
            campfires: this.campfires?.getLength(),
            forges: this.forges?.getLength(),
            storages: this.storages?.getLength(),
            barracks: this.barracks?.getLength()
        });
    }


    private updateHealthBar(go: Phaser.GameObjects.Rectangle): void {
        updateHealthBar(go);
    }

    private canPlaceAt(cellX: number, cellY: number): boolean {
        const TS = GameConstants.TILE_SIZE;
        const cols = Math.floor(GameConstants.GAME_AREA_WIDTH / TS);
        const rows = Math.floor(GameConstants.GAME_AREA_HEIGHT / TS);
        if (cellX < 0 || cellY < 0 || cellX >= cols || cellY >= rows) return false;
        const snappedX = GameConstants.UI_MARGIN_LEFT + cellX * TS + TS / 2;
        const snappedY = GameConstants.UI_MARGIN_TOP + cellY * TS + TS / 2;
        if (Math.abs(snappedX - this.sanctuaryPos.x) < 1 && Math.abs(snappedY - this.sanctuaryPos.y) < 1) return false;
        const occupied = (
            this.towers.getChildren() as Phaser.GameObjects.Rectangle[]
        ).concat(
            this.walls.getChildren() as Phaser.GameObjects.Rectangle[],
            this.generators.getChildren() as Phaser.GameObjects.Rectangle[],
            this.campfires.getChildren() as Phaser.GameObjects.Rectangle[],
            this.forges.getChildren() as Phaser.GameObjects.Rectangle[],
            this.storages.getChildren() as Phaser.GameObjects.Rectangle[],
            this.barracks.getChildren() as Phaser.GameObjects.Rectangle[]
        ).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1);
        if (occupied) return false;
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        return shards >= this.getCurrentCost();
    }

    private isOccupiedCell(cellX: number, cellY: number): boolean {
        const TS = GameConstants.TILE_SIZE;
        const snappedX = GameConstants.UI_MARGIN_LEFT + cellX * TS + TS / 2;
        const snappedY = GameConstants.UI_MARGIN_TOP + cellY * TS + TS / 2;
        return (
            (this.towers.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.walls.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.generators.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.campfires.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.forges.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.storages.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1) ||
            (this.barracks.getChildren() as Phaser.GameObjects.Rectangle[]).some(go => Math.abs(go.x - snappedX) < 1 && Math.abs(go.y - snappedY) < 1)
        );
    }

    private isSanctuaryCell(cellX: number, cellY: number): boolean {
        const s = this.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
        return s.cx === cellX && s.cy === cellY;
    }

    // Init pathfinding grid
    private recomputeGrid(): void {
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        this.pathfindingGrid.recomputeFromWalls(this.walls, gameAreaX, gameAreaY);
    }

    private inBounds(cx: number, cy: number): boolean {
        const { cols, rows } = this.pathfindingGrid.getDimensions();
        return cx >= 0 && cy >= 0 && cx < cols && cy < rows;
    }

    private worldToCell(x: number, y: number): { cx: number; cy: number } {
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const { col, row } = this.pathfindingGrid.pixelToGrid(x, y, gameAreaX, gameAreaY);
        return { cx: col, cy: row };
    }

    private cellToWorld(cx: number, cy: number): { x: number; y: number } {
        const TS = GameConstants.TILE_SIZE;
        return {
            x: GameConstants.UI_MARGIN_LEFT + cx * TS + TS / 2,
            y: GameConstants.UI_MARGIN_TOP + cy * TS + TS / 2
        };
    }

    private findPath(start: { cx: number; cy: number }, goal: { cx: number; cy: number }): { cx: number; cy: number }[] | null {
        if (!this.inBounds(start.cx, start.cy) || !this.inBounds(goal.cx, goal.cy)) return null;
        const grid = this.pathfindingGrid.getGrid();
        const q: { cx: number; cy: number }[] = [];
        const seen = new Set<string>();
        const parent = new Map<string, string>();
        const key = (c: { cx: number; cy: number }) => `${c.cx},${c.cy}`;
        q.push(start);
        seen.add(key(start));
        const dirs = [ [1,0], [-1,0], [0,1], [0,-1] ];
        while (q.length) {
            const cur = q.shift()!;
            if (cur.cx === goal.cx && cur.cy === goal.cy) {
                const out: { cx: number; cy: number }[] = [];
                let k = key(cur);
                while (true) {
                    const [sx, sy] = k.split(',').map(Number);
                    out.push({ cx: sx, cy: sy });
                    const pk = parent.get(k);
                    if (!pk) break;
                    k = pk;
                }
                out.reverse();
                return out;
            }
            for (const [dx, dy] of dirs) {
                const nx = cur.cx + dx, ny = cur.cy + dy;
                if (!this.inBounds(nx, ny)) continue;
                if (grid[ny][nx]) continue;
                const nk = `${nx},${ny}`;
                if (seen.has(nk)) continue;
                seen.add(nk);
                parent.set(nk, key(cur));
                q.push({ cx: nx, cy: ny });
            }
        }
        return null;
    }

    private pickSpawnCell(): { cx: number; cy: number } | null {
        const { rows } = this.pathfindingGrid.getDimensions();
        const cx = 0; // Bord gauche de la grille (zone de jeu)
        for (let i = 0; i < 10; i++) {
            const cy = Phaser.Math.Between(0, rows - 1);
            if (!this.pathfindingGrid.isBlocked(cx, cy)) return { cx, cy };
        }
        for (let cy = 0; cy < rows; cy++) {
            if (!this.pathfindingGrid.isBlocked(cx, cy)) return { cx, cy };
        }
        return null;
    }

    private updateEnemyVelocityAlongPath(enemy: EnemyGO): void {
        const body = (enemy as any).body as Phaser.Physics.Arcade.Body | undefined;
        if (!body) return;
        const path = enemy.getData('path') as { x: number; y: number }[] | null;
        const idx = (enemy.getData('pathIndex') as number) ?? 0;
        if (!path || path.length === 0 || idx >= path.length) {
            this.seek(body, enemy.x, enemy.y, this.sanctuaryPos.x, this.sanctuaryPos.y, this.enemySpeed);
            return;
        }
        const wp = path[idx];
        this.seek(body, enemy.x, enemy.y, wp.x, wp.y, this.enemySpeed);
    }

    private followPathStep(enemy: EnemyGO): void {
        let path = enemy.getData('path') as { x: number; y: number }[] | null;
        let idx = (enemy.getData('pathIndex') as number) ?? 0;
        if (!path || path.length === 0) {
            const curC = this.worldToCell(enemy.x, enemy.y);
            const goalC = this.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
            const cellPath = this.findPath(curC, goalC);
            path = cellPath ? cellPath.map(c => this.cellToWorld(c.cx, c.cy)) : null;
            enemy.setData('path', path);
            enemy.setData('pathIndex', 0);
            idx = 0;
        }
        if (!path || path.length === 0) {
            this.updateEnemyVelocityAlongPath(enemy);
            return;
        }
        const wp = path[idx];
        const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, wp.x, wp.y);
        if (d <= 8) {
            idx++;
            enemy.setData('pathIndex', idx);
        }
        this.updateEnemyVelocityAlongPath(enemy);
    }

    private recomputeAllEnemyPaths(): void {
        const targetCell = this.worldToCell(this.sanctuaryPos.x, this.sanctuaryPos.y);
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            const enemy = obj as EnemyGO;
            const curCell = this.worldToCell(enemy.x, enemy.y);
            const p = this.findPath(curCell, targetCell);
            const px = p ? p.map(c => this.cellToWorld(c.cx, c.cy)) : null;
            enemy.setData('path', px);
            enemy.setData('pathIndex', 0);
            this.updateEnemyVelocityAlongPath(enemy);
        }
    }


    // Décrémente le compteur UI de vague restante (si active)
    // NOTE: Ce n'est qu'un compteur pour l'UI, il ne termine PAS la vague
    // La vague se termine uniquement dans update() quand tous les ennemis sont morts
    private decWaveRemaining(delta: number): void {
        const active = !!(this.registry.get('waveActive') as boolean);
        if (!active) return;
        const rem = (this.registry.get('waveRemaining') as number) ?? 0;
        const next = Math.max(0, rem - delta);
        this.registry.set('waveRemaining', next);
        // Ne plus mettre waveActive à false ici !
    }

    // Système de production passive d'âmes (idle game)
    private startPassiveSoulProduction(): void {
        // Production toutes les secondes
        this.passiveSoulTimer = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const rate = this.soulProductionRate;
                const multiplier = this.soulProductionMultiplier;
                const production = rate * multiplier;
                this.addShards(production);
            },
            callbackScope: this
        });

        // Nettoyer le timer au shutdown
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.passiveSoulTimer) {
                this.passiveSoulTimer.remove(false);
                this.passiveSoulTimer = undefined;
            }
        });
    }

    // Méthode publique pour améliorer le taux de production (idle game upgrade)
    public upgradeSoulProduction(multiplier: number): void {
        this.soulProductionMultiplier = multiplier;
        this.registry.set('soulProductionMultiplier', multiplier);
    }

    // Méthode publique pour augmenter le taux de base
    public increaseSoulProductionRate(delta: number): void {
        this.soulProductionRate += delta;
        this.registry.set('soulProductionRate', this.soulProductionRate);
    }

    // Afficher le menu d'upgrade pour une tour ou un générateur
    private showUpgradeMenu(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator'): void {
        // Notifier l'UI pour afficher le menu d'upgrade
        this.registry.set('upgradeMenuBuilding', { building, type, x: building.x, y: building.y });
        this.game.events.emit('showUpgradeMenu', building, type);
    }

    // Méthode publique pour upgrader un bâtiment
    public upgradeBuildingLevel(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator'): boolean {
        const forgeCount = (this.registry.get('forgeCount') as number) ?? 0;
        if (forgeCount <= 0) {
            this.game.events.emit('notify', 'Construisez une Forge pour débloquer les améliorations', 'error');
            return false;
        }

        const currentLevel = (building.getData('upgradeLevel') as number) ?? 0;
        if (currentLevel >= 3) {
            this.game.events.emit('notify', 'Niveau maximum atteint', 'info');
            return false;
        }

        // Coûts d'upgrade par niveau (exponentiel pour idle game)
        const upgradeCosts = type === 'tower'
            ? [30, 60, 120]  // Tour: niveaux 1, 2, 3
            : [40, 80, 160]; // Générateur: niveaux 1, 2, 3

        const cost = upgradeCosts[currentLevel];
        const shards = (this.registry.get('soulShards') as number) ?? 0;

        if (shards < cost) {
            this.game.events.emit('notify', `Pas assez d'Âmes (coût: ${cost})`, 'error');
            return false;
        }

        // Déduire le coût
        this.registry.set('soulShards', shards - cost);

        // Appliquer l'upgrade
        const newLevel = currentLevel + 1;
        building.setData('upgradeLevel', newLevel);

        if (type === 'tower') {
            // Tour: améliore cadence de tir et dégâts
            const fireRateMul = 1 - (newLevel * 0.15); // -15% par niveau (plus rapide)
            const damageMul = 1 + (newLevel * 0.5); // +50% dégâts par niveau
            building.setData('fireRateMul', fireRateMul);
            building.setData('damageMul', damageMul);

            // Changer la couleur de la lueur mystique pour indiquer le niveau
            const glow = building.getData('glow') as Phaser.GameObjects.Graphics | undefined;
            if (glow) {
                glow.clear();
                // Couleurs de plus en plus intenses et magiques
                const glowColors = [
                    0x6b8fa5, // Niveau 0: Bleu clair
                    0x5a9fbf, // Niveau 1: Bleu plus vif
                    0x7aafd0, // Niveau 2: Bleu cyan
                    0x9fd5ff  // Niveau 3: Cyan brillant
                ];
                glow.fillStyle(glowColors[newLevel], 0.5 + newLevel * 0.1);
                glow.fillRect(-2, -6, 4, 8);
            }

            // Bannière à partir du niveau 2
            const container = building.getData('container') as Phaser.GameObjects.Container | undefined;
            const banner = building.getData('banner') as Phaser.GameObjects.Graphics | undefined;
            if (container && banner) {
                if (newLevel >= 2) {
                    const col = newLevel === 3 ? 0x8c6b2e /* doré sale */ : 0x3a3f5a /* bleu nuit */;
                    banner.setVisible(true);
                    banner.clear();
                    banner.fillStyle(col, 1);
                    banner.fillRect(-6, -18, 12, 18);
                    banner.fillTriangle(-6, 0, 0, 6, 6, 0);
                    banner.lineStyle(1, 0x1a1510, 0.8).strokeRect(-6, -18, 12, 18);
                } else {
                    banner.setVisible(false);
                }
            }

            this.game.events.emit('notify', `Tour améliorée au niveau ${newLevel}`, 'success');
        } else {
            // Générateur: améliore production
            const yieldMul = 1 + (newLevel * 0.75); // +75% par niveau
            building.setData('yieldMul', yieldMul);

            // Changer la couleur selon le niveau
            const colors = [0x7b6a2e, 0x8f7d3a, 0xa39046, 0xbaa552];
            building.setFillStyle(colors[newLevel]);

            this.game.events.emit('notify', `Générateur amélioré au niveau ${newLevel}`, 'success');
        }

        return true;
    }

    // Obtenir les informations d'upgrade pour l'UI
    public getUpgradeInfo(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator'): {
        level: number;
        maxLevel: number;
        nextCost: number;
        currentStats: string;
        nextStats: string;
    } {
        const level = (building.getData('upgradeLevel') as number) ?? 0;
        const maxLevel = 3;
        const upgradeCosts = type === 'tower' ? [30, 60, 120] : [40, 80, 160];
        const nextCost = level < maxLevel ? upgradeCosts[level] : 0;

        let currentStats = '';
        let nextStats = '';

        if (type === 'tower') {
            const fireRate = (building.getData('fireRateMul') as number) ?? 1;
            const damage = (building.getData('damageMul') as number) ?? 1;
            currentStats = `Cadence: ${(fireRate * 100).toFixed(0)}%, Dégâts: x${damage.toFixed(1)}`;

            if (level < maxLevel) {
                const nextFireRate = 1 - ((level + 1) * 0.15);
                const nextDamage = 1 + ((level + 1) * 0.5);
                nextStats = `Cadence: ${(nextFireRate * 100).toFixed(0)}%, Dégâts: x${nextDamage.toFixed(1)}`;
            }
        } else {
            const yieldMul = (building.getData('yieldMul') as number) ?? 1;
            currentStats = `Production: x${yieldMul.toFixed(2)} (${(GameConstants.GENERATOR_YIELD * yieldMul).toFixed(1)} âmes/2s)`;

            if (level < maxLevel) {
                const nextYield = 1 + ((level + 1) * 0.75);
                nextStats = `Production: x${nextYield.toFixed(2)} (${(GameConstants.GENERATOR_YIELD * nextYield).toFixed(1)} âmes/2s)`;
            }
        }

        return { level, maxLevel, nextCost, currentStats, nextStats };
    }

    // === MÉTHODES DE SAUVEGARDE DES BÂTIMENTS ===

    /**
     * Collecte les données de tous les bâtiments pour la sauvegarde
     */
    public collectBuildingsData(): import('../utils/SaveSystem').SavedBuilding[] {
        const buildings: import('../utils/SaveSystem').SavedBuilding[] = [];

        // Tours (IMPORTANT: utiliser worldX/worldY car le Rectangle est dans un Container)
        for (const obj of this.towers.getChildren()) {
            const tower = obj as Phaser.GameObjects.Rectangle;
            const worldX = (tower.getData('worldX') as number) ?? tower.x;
            const worldY = (tower.getData('worldY') as number) ?? tower.y;

            buildings.push({
                type: 'tower',
                x: worldX,
                y: worldY,
                hp: tower.getData('hp') as number,
                maxHp: tower.getData('maxHp') as number,
                upgradeLevel: (tower.getData('upgradeLevel') as number) ?? 0,
                fireRateMul: (tower.getData('fireRateMul') as number) ?? 1,
                damageMul: (tower.getData('damageMul') as number) ?? 1
            });
        }

        // Murs
        for (const obj of this.walls.getChildren()) {
            const wall = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'wall',
                x: wall.x,
                y: wall.y,
                hp: wall.getData('hp') as number,
                maxHp: wall.getData('maxHp') as number
            });
        }

        // Générateurs
        for (const obj of this.generators.getChildren()) {
            const gen = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'generator',
                x: gen.x,
                y: gen.y,
                hp: gen.getData('hp') as number,
                maxHp: gen.getData('maxHp') as number,
                upgradeLevel: (gen.getData('upgradeLevel') as number) ?? 0,
                yieldMul: (gen.getData('yieldMul') as number) ?? 1
            });
        }

        // Feux de camp
        for (const obj of this.campfires.getChildren()) {
            const fire = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'campfire',
                x: fire.x,
                y: fire.y,
                hp: fire.getData('hp') as number,
                maxHp: fire.getData('maxHp') as number
            });
        }

        // Forges
        for (const obj of this.forges.getChildren()) {
            const forge = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'forge',
                x: forge.x,
                y: forge.y,
                hp: forge.getData('hp') as number,
                maxHp: forge.getData('maxHp') as number
            });
        }

        // Réserves
        for (const obj of this.storages.getChildren()) {
            const storage = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'storage',
                x: storage.x,
                y: storage.y,
                hp: storage.getData('hp') as number,
                maxHp: storage.getData('maxHp') as number,
                capInc: storage.getData('capInc') as number
            });
        }

        // Casernes
        for (const obj of this.barracks.getChildren()) {
            const barrack = obj as Phaser.GameObjects.Rectangle;
            buildings.push({
                type: 'barracks',
                x: barrack.x,
                y: barrack.y,
                hp: barrack.getData('hp') as number,
                maxHp: barrack.getData('maxHp') as number
            });
        }

        const counts = buildings.reduce((acc, b) => {
            acc[b.type] = (acc[b.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('📦 Collecte de', buildings.length, 'bâtiments pour la sauvegarde:', counts);
        console.log('   Détails tours:', buildings.filter(b => b.type === 'tower').map(b => `(${b.x}, ${b.y})`));
        return buildings;
    }

    /**
     * Restaure les bâtiments depuis la sauvegarde
     */
    public restoreBuildings(buildings: import('../utils/SaveSystem').SavedBuilding[]): void {
        console.log('🏗️ Restauration de', buildings.length, 'bâtiments...');

        for (const building of buildings) {
            console.log(`  📍 Restauration ${building.type} à (${building.x}, ${building.y})`);

            // Créer le bâtiment selon son type (sans vérifications de coût)
            this.createBuildingDirect(building.type, building.x, building.y);

            // Récupérer le bâtiment qui vient d'être créé
            let builtObject: Phaser.GameObjects.Rectangle | undefined;

            switch (building.type) {
                case 'tower':
                    builtObject = this.towers.getChildren()[this.towers.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'wall':
                    builtObject = this.walls.getChildren()[this.walls.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'generator':
                    builtObject = this.generators.getChildren()[this.generators.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'campfire':
                    builtObject = this.campfires.getChildren()[this.campfires.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'forge':
                    builtObject = this.forges.getChildren()[this.forges.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'storage':
                    builtObject = this.storages.getChildren()[this.storages.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
                case 'barracks':
                    builtObject = this.barracks.getChildren()[this.barracks.getLength() - 1] as Phaser.GameObjects.Rectangle;
                    break;
            }

            if (!builtObject) continue;

            // Restaurer les propriétés sauvegardées
            if (building.hp !== undefined) builtObject.setData('hp', building.hp);
            if (building.maxHp !== undefined) builtObject.setData('maxHp', building.maxHp);
            if (building.upgradeLevel !== undefined) builtObject.setData('upgradeLevel', building.upgradeLevel);

            // Propriétés spécifiques aux tours
            if (building.type === 'tower') {
                if (building.fireRateMul !== undefined) builtObject.setData('fireRateMul', building.fireRateMul);
                if (building.damageMul !== undefined) builtObject.setData('damageMul', building.damageMul);

                // Mettre à jour l'apparence de la tour selon le niveau
                const level = building.upgradeLevel ?? 0;
                if (level > 0) {
                    const glow = builtObject.getData('glow') as Phaser.GameObjects.Graphics | undefined;
                    if (glow) {
                        glow.clear();
                        const glowColors = [0x6b8fa5, 0x5a9fbf, 0x7aafd0, 0x9fd5ff];
                        glow.fillStyle(glowColors[level], 0.5 + level * 0.1);
                        glow.fillRect(-2, -6, 4, 8);
                    }

                    // Bannière à partir du niveau 2
                    const banner = builtObject.getData('banner') as Phaser.GameObjects.Graphics | undefined;
                    if (banner && level >= 2) {
                        const col = level === 3 ? 0x8c6b2e : 0x3a3f5a;
                        banner.setVisible(true);
                        banner.clear();
                        banner.fillStyle(col, 1);
                        banner.fillRect(-6, -18, 12, 18);
                        banner.fillTriangle(-6, 0, 0, 6, 6, 0);
                        banner.lineStyle(1, 0x1a1510, 0.8).strokeRect(-6, -18, 12, 18);
                    }
                }
            }

            // Propriétés spécifiques aux générateurs
            if (building.type === 'generator') {
                if (building.yieldMul !== undefined) builtObject.setData('yieldMul', building.yieldMul);

                // Mettre à jour la couleur selon le niveau
                const level = building.upgradeLevel ?? 0;
                if (level > 0) {
                    const colors = [0x7b6a2e, 0x8f7d3a, 0xa39046, 0xbaa552];
                    builtObject.setFillStyle(colors[level]);
                }
            }

            // Propriétés spécifiques aux réserves
            if (building.type === 'storage' && building.capInc !== undefined) {
                builtObject.setData('capInc', building.capInc);
            }

            // Mettre à jour la barre de vie
            this.updateHealthBar(builtObject);
        }

        console.log('✅ Restauration des bâtiments terminée !');
    }
}
