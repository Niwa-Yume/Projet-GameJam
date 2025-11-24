import Phaser from 'phaser';
import { createBonfire } from '../entities/Bonfire';
import { createSkeletonEnemy, createBossSkeletonEnemy } from '../entities/Enemies';
import { createAllySprite, allyAttackEffect } from '../entities/Allies';
import { attachHealthBar, updateHealthBar } from '../ui/HealthBar';
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


    // État de vague
    private waveActive: boolean = false;
    private waveSpawnsRemaining: number = 0;
    private waveSpawning: boolean = false; // tant que le timer spawn n'est pas terminé
    private autoWaveMode: boolean = false; // mode automatique (activé après vague 1)
    private nextWaveTimer?: Phaser.Time.TimerEvent; // timer pour lancer la vague suivante automatiquement

    // Système d'auto-recrutement (IDLE GAME)
    private autoRecruitEnabled: boolean = false;
    private lastAutoRecruitTime: number = 0;
    private autoRecruitInterval: number = 1000; // 1 secondes

    // Système d'auto-upgrade des alliés (IDLE GAME)
    private autoUpgradeEnabled: boolean = false;
    private lastAutoUpgradeCheck: number = 0;
    private autoUpgradeInterval: number = 5000; // Vérifie toutes les 5 secondes

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

            // Stocker dans le format attendu par UIScene
            if (offlineProgress.timeElapsedSeconds > 60 && offlineProgress.soulsEarned > 0) {
                this.registry.set('offlineProgressData', {
                    formattedTime: SaveSystem.formatTimeElapsed(offlineProgress.timeElapsedSeconds),
                    soulsEarned: offlineProgress.soulsEarned
                });
            }
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
            this.registry.set('generatorCount', 0);
            this.registry.set('totalSoulProduction', GameConstants.PASSIVE_SOUL_RATE);
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
        this.walls = this.physics.add.staticGroup();
        this.physics.add.collider(this.enemies, this.walls);
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

        // Initialiser l'affichage de production
        this.updateSoulProductionDisplay();

        // Démarrer la sauvegarde automatique toutes les 30 secondes
        this.autoSaveTimer = this.time.addEvent({
            delay: 30000, // 30 secondes
            loop: true,
            callback: () => {
                const buildingsData = this.collectBuildingsData();
                const alliesData = this.collectAlliesData();
                SaveSystem.save(this.registry, buildingsData, alliesData);
            },
            callbackScope: this
        });

        // Nettoyage au shutdown (retire les timers et événements)
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            console.log('🔄 SHUTDOWN - Nettoyage en cours...');

            // Nettoyer les événements et timers
            this.registry.events.off('changedata-buildKind');
            if (this.enemyTimer) { this.time.removeEvent(this.enemyTimer); }
            this.enemyTimer = undefined;
            if (this.autoSaveTimer) { this.time.removeEvent(this.autoSaveTimer); }
            this.autoSaveTimer = undefined;
            if (this.passiveSoulTimer) { this.time.removeEvent(this.passiveSoulTimer); }
            this.passiveSoulTimer = undefined;
            if (this.nextWaveTimer) { this.time.removeEvent(this.nextWaveTimer); }
            this.nextWaveTimer = undefined;

            // NE PLUS SAUVEGARDER ICI - la sauvegarde périodique suffit
            // Cela évite les erreurs de groupes détruits lors du shutdown
            console.log('✅ Nettoyage terminé (pas de sauvegarde au shutdown)');
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


        // Init pathfinding grid
        this.pathfindingGrid = new PathfindingGrid(gameAreaW, gameAreaH);

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

        // Restaurer les alliés depuis la sauvegarde
        if (saveData && saveData.allies && saveData.allies.length > 0) {
            this.restoreAllies(saveData.allies);
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

    // TOUR DE DÉFENSE DARK SOULS - Tour en pierre avec brasero de feu d'âme
    private createTower(x: number, y: number): void {
        // Container pour tous les éléments visuels de la tour
        const towerContainer = this.add.container(x, y).setDepth(10);

        // === OMBRES ===
        const shadow = this.add.graphics();
        shadow.fillStyle(0x0a0a08, 0.7);
        shadow.fillEllipse(0, 26, 52, 14);
        towerContainer.add(shadow);

        // === BASE EN PIERRE LARGE ===
        const base = this.add.graphics();
        base.fillStyle(0x2a2520, 1);
        base.fillRect(-24, 16, 48, 8);
        base.lineStyle(2, 0x1a1510, 1);
        base.strokeRect(-24, 16, 48, 8);
        // Relief de pierre
        base.fillStyle(0x1a1510, 0.4);
        base.fillRect(-24, 16, 48, 2);
        towerContainer.add(base);

        // === TOUR CYLINDRIQUE EN PIERRE ===
        const towerBody = this.add.graphics();
        // Corps principal (cylindre)
        towerBody.fillStyle(0x3a3530, 1);
        towerBody.fillEllipse(0, -8, 28, 12);
        towerBody.fillRect(-14, -8, 28, 24);
        towerBody.fillEllipse(0, 16, 28, 12);

        // Bordures
        towerBody.lineStyle(2, 0x2a2520, 1);
        towerBody.strokeEllipse(0, -8, 28, 12);
        towerBody.strokeRect(-14, -8, 28, 24);

        // Texture de pierres (blocs)
        towerBody.lineStyle(1, 0x2a2520, 0.6);
        towerBody.lineBetween(-14, 0, 14, 0);
        towerBody.lineBetween(-14, 8, 14, 8);

        // Fissures sur la tour
        towerBody.lineStyle(1, 0x1a1510, 0.5);
        towerBody.lineBetween(-8, -4, -6, 2);
        towerBody.lineBetween(6, 4, 8, 10);
        towerContainer.add(towerBody);

        // === CRÉNEAUX GOTHIQUES AU SOMMET ===
        const battlements = this.add.graphics();
        battlements.fillStyle(0x3a3530, 1);

        // 5 créneaux pointus style Dark Souls
        for (let i = 0; i < 5; i++) {
            const bx = -12 + i * 6;
            battlements.fillTriangle(bx, -8, bx + 3, -16, bx + 6, -8);
            battlements.lineStyle(1, 0x2a2520, 1);
            battlements.strokeTriangle(bx, -8, bx + 3, -16, bx + 6, -8);
        }
        towerContainer.add(battlements);

        // === MEURTRIÈRE (OUVERTURE DE TIR) ===
        const embrasure = this.add.graphics();
        embrasure.fillStyle(0x0a0a08, 1);
        embrasure.fillRect(-3, -2, 6, 10);
        embrasure.lineStyle(1.5, 0x2a2520, 1);
        embrasure.strokeRect(-3, -2, 6, 10);
        towerContainer.add(embrasure);

        // === BRASERO DE FEU D'ÂME AU SOMMET ===
        const brazier = this.add.graphics();

        // Coupe en métal
        brazier.fillStyle(0x4a4a3a, 1);
        brazier.fillEllipse(0, -18, 12, 6);
        brazier.fillRect(-6, -18, 12, 4);
        brazier.fillEllipse(0, -14, 12, 6);

        // Bordures métalliques
        brazier.lineStyle(1.5, 0x3a3a2a, 1);
        brazier.strokeEllipse(0, -18, 12, 6);
        brazier.strokeEllipse(0, -14, 12, 6);

        // Pieds du brasero
        brazier.lineStyle(2, 0x3a3a2a, 1);
        brazier.lineBetween(-4, -14, -5, -8);
        brazier.lineBetween(4, -14, 5, -8);
        towerContainer.add(brazier);

        // === FEU D'ÂME (FLAMMES BLEUES/ORANGES MYSTIQUES) ===
        const soulFlame = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

        const drawSoulFlame = (time: number) => {
            soulFlame.clear();

            const wave = Math.sin(time * 3) * 1.5;
            const height = 8 + Math.sin(time * 2.5) * 2;

            // Flamme extérieure orange
            soulFlame.fillStyle(0xff6633, 0.6);
            soulFlame.fillTriangle(
                -4 + wave, -16,
                0, -16 - height,
                4 + wave, -16
            );

            // Flamme intérieure orange vif
            soulFlame.fillStyle(0xff8844, 0.7);
            soulFlame.fillTriangle(
                -2 + wave * 0.5, -16,
                0, -16 - height + 2,
                2 + wave * 0.5, -16
            );

            // Centre blanc/jaune
            soulFlame.fillStyle(0xffcc66, 0.8);
            soulFlame.fillCircle(wave * 0.3, -16, 2);
        };

        towerContainer.add(soulFlame);

        // === LUEUR DU FEU D'ÂME ===
        const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const drawGlow = (intensity: number) => {
            glow.clear();
            glow.fillStyle(0xff6633, 0.3 + intensity * 0.2);
            glow.fillCircle(0, -16, 14);
            glow.fillStyle(0xff8844, 0.2 + intensity * 0.15);
            glow.fillCircle(0, -16, 18);
        };
        towerContainer.add(glow);

        // Animation du feu d'âme
        const fireTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!towerContainer.scene) return;
                const time = Date.now() * 0.001;
                drawSoulFlame(time);
                const intensity = Math.sin(time * 2) * 0.5 + 0.5;
                drawGlow(intensity);
            }
        });

        // === CRÂNES DÉCORATIFS (Dark Souls style) ===
        const skulls = this.add.graphics();
        skulls.fillStyle(0x8a8a7a, 0.9);

        // Crâne gauche
        skulls.fillEllipse(-12, 2, 4, 3.5);
        skulls.fillStyle(0x0a0a08, 1);
        skulls.fillCircle(-13, 1.5, 0.6);
        skulls.fillCircle(-11, 1.5, 0.6);

        // Crâne droite
        skulls.fillStyle(0x8a8a7a, 0.9);
        skulls.fillEllipse(12, 2, 4, 3.5);
        skulls.fillStyle(0x0a0a08, 1);
        skulls.fillCircle(11, 1.5, 0.6);
        skulls.fillCircle(13, 1.5, 0.6);
        towerContainer.add(skulls);

        // Bannière (apparaitra aux upgrades élevés)
        const banner = this.add.graphics();
        banner.setVisible(false);
        towerContainer.add(banner);

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
        tower.setData('fireTimer', fireTimer);
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
            const fTimer = tower.getData('fireTimer') as Phaser.Time.TimerEvent | undefined;
            if (fTimer) fTimer.remove(false);
            // Laisser le container détruire ses propres enfants pour éviter les doubles-destructions
            const container = tower.getData('container') as Phaser.GameObjects.Container | undefined;
            if (container && container.active) {
                container.destroy();
            }
        });
    }

    // Crée un mur (bloquant pour le pathfinding)
    private createWall(x: number, y: number): void {
        // Container principal pour le mur
        const wallContainer = this.add.container(x, y).setDepth(9);

        // Mur de base en pierre (rectangle invisible pour les collisions)
        const wall = this.add.rectangle(0, 0, 48, 48, 0x2b2a28, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === FOND ET STRUCTURE ===
        const wallBase = this.add.graphics();

        // Fond principal - pierre grise foncée avec dégradé
        wallBase.fillStyle(0x3a3530, 1);
        wallBase.fillRect(-24, -24, 48, 48);

        // Ombre intérieure pour la profondeur
        wallBase.fillStyle(0x1a1510, 0.3);
        wallBase.fillRect(-24, -24, 48, 4); // Haut
        wallBase.fillRect(-24, -24, 4, 48); // Gauche

        // Lumière sur les bords droits
        wallBase.fillStyle(0x5a5550, 0.2);
        wallBase.fillRect(20, -24, 4, 48); // Droite
        wallBase.fillRect(-24, 20, 48, 4); // Bas

        // Bordure extérieure épaisse et sombre
        wallBase.lineStyle(2, 0x1a1510, 1);
        wallBase.strokeRect(-24, -24, 48, 48);

        // === TEXTURE DE PIERRES DÉTAILLÉE ===
        const stones = this.add.graphics();

        // Lignes principales pour les blocs de pierre
        stones.lineStyle(1.5, 0x2a2520, 0.9);

        // Rangées horizontales de pierres
        stones.lineBetween(-24, -8, 24, -8);
        stones.lineBetween(-24, 8, 24, 8);

        // Colonnes verticales alternées (effet briques)
        stones.lineBetween(-8, -24, -8, -8);
        stones.lineBetween(8, -8, 8, 8);
        stones.lineBetween(-8, 8, -8, 24);

        // Blocs de pierre individuels avec bordures
        stones.lineStyle(1, 0x4a4540, 0.5);
        stones.strokeRect(-22, -22, 14, 14);
        stones.strokeRect(8, -22, 14, 14);
        stones.strokeRect(-22, -6, 14, 14);
        stones.strokeRect(8, -6, 14, 14);
        stones.strokeRect(-22, 10, 14, 14);
        stones.strokeRect(8, 10, 14, 14);

        // === FISSURES ET DÉTAILS ===
        const cracks = this.add.graphics();
        cracks.lineStyle(1, 0x1a1510, 0.6);

        // Fissures diagonales
        cracks.lineBetween(-18, -15, -12, -10);
        cracks.lineBetween(-12, -10, -10, -6);
        cracks.lineBetween(12, 5, 16, 10);
        cracks.lineBetween(16, 10, 18, 14);
        cracks.lineBetween(-15, 12, -10, 16);

        // Petits impacts
        cracks.fillStyle(0x0a0a08, 0.8);
        cracks.fillCircle(-5, -14, 1.5);
        cracks.fillCircle(10, 2, 1);
        cracks.fillCircle(-12, 18, 1.2);
        cracks.fillCircle(15, -8, 1);

        // === CRÉNEAUX GOTHIQUES ===
        const battlements = this.add.graphics();

        // Base des créneaux
        battlements.fillStyle(0x4a4540, 1);
        battlements.fillRect(-24, -26, 48, 2);

        // Créneaux carrés avec ombres
        const crenelWidth = 9;
        const spacing = 12;
        for (let i = 0; i < 4; i++) {
            const cx = -19 + i * spacing;
            if (i % 2 === 0) {
                // Créneau haut
                battlements.fillStyle(0x4a4540, 1);
                battlements.fillRect(cx, -28, crenelWidth, 4);

                // Ombre du créneau
                battlements.fillStyle(0x1a1510, 0.6);
                battlements.fillRect(cx, -28, 2, 4);

                // Lumière sur le créneau
                battlements.fillStyle(0x6a6560, 0.4);
                battlements.fillRect(cx + crenelWidth - 2, -28, 2, 4);
            }
        }

        // Meurtrières (fentes verticales étroites)
        const slits = this.add.graphics();
        slits.fillStyle(0x0a0a08, 1);
        slits.fillRect(-2, -12, 4, 16); // Fente centrale

        // Bordure de la meurtrière
        slits.lineStyle(1, 0x2a2520, 0.8);
        slits.strokeRect(-2, -12, 4, 16);

        // Ombrage intérieur de la meurtrière
        slits.fillStyle(0x1a1510, 0.5);
        slits.fillRect(-1, -12, 1, 16);

        // === EFFET DE PROFONDEUR ===
        const depth = this.add.graphics();

        // Ombre portée sous les créneaux
        depth.fillStyle(0x0a0a08, 0.4);
        depth.fillRect(-24, -24, 48, 2);

        // Relief sur les bords des pierres
        depth.lineStyle(1, 0x6a6560, 0.3);
        depth.lineBetween(-23, -7, 23, -7);
        depth.lineBetween(-23, 9, 23, 9);

        // === MOUSSES ET VIEILLISSEMENT ===
        const aging = this.add.graphics();

        // Taches de mousse/altération
        aging.fillStyle(0x2a3520, 0.3);
        aging.fillCircle(-16, -18, 3);
        aging.fillCircle(14, 16, 2.5);
        aging.fillCircle(-10, 12, 2);

        // Traces d'usure
        aging.fillStyle(0x4a4540, 0.2);
        aging.fillRect(-20, 0, 8, 2);
        aging.fillRect(12, -16, 6, 2);

        // === SYMBOLE DE PROTECTION (BOUCLIER) ===
        const shieldSymbol = this.add.graphics();

        // Bouclier médiéval au centre du mur
        shieldSymbol.fillStyle(0x5a6a7a, 0.9);
        shieldSymbol.fillRect(-8, -10, 16, 14);
        shieldSymbol.fillTriangle(-8, 4, 0, 10, 8, 4);

        // Bordure du bouclier
        shieldSymbol.lineStyle(2, 0x8a9aaa, 0.9);
        shieldSymbol.strokeRect(-8, -10, 16, 14);
        shieldSymbol.strokeTriangle(-8, 4, 0, 10, 8, 4);

        // Croix sur le bouclier (symbole de défense)
        shieldSymbol.lineStyle(2.5, 0xffa544, 0.8);
        shieldSymbol.lineBetween(0, -8, 0, 6);
        shieldSymbol.lineBetween(-6, -2, 6, -2);

        // Boulons décoratifs
        shieldSymbol.fillStyle(0x6a7a8a, 1);
        shieldSymbol.fillCircle(-5, -7, 1.5);
        shieldSymbol.fillCircle(5, -7, 1.5);
        shieldSymbol.fillCircle(-5, 1, 1.5);
        shieldSymbol.fillCircle(5, 1, 1.5);

        // Ajouter tous les éléments au container dans le bon ordre
        wallContainer.add([wallBase, stones, cracks, depth, battlements, slits, aging, shieldSymbol, wall]);

        wall.setData('hp', 200);
        wall.setData('maxHp', 200);
        wall.setData('container', wallContainer);

        this.walls.add(wallContainer);
        attachHealthBar(this, wall);

        // Interaction clic droit pour vendre
        wall.setInteractive({ useHandCursor: true });
        wall.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.showUpgradeMenu(wall, 'wall');
            }
        });


        // Recompute dès placement
        this.recomputeGrid();
        this.recomputeAllEnemyPaths();
    }

    // FAILLE D'ÂMES - Fissure dans le sol libérant des âmes spectrales
    private createGenerator(x: number, y: number): void {
        // Container principal
        const genContainer = this.add.container(x, y).setDepth(9);

        // Rectangle invisible pour les collisions
        const gen = this.add.rectangle(0, 0, 48, 48, 0x7b6a2e, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === OMBRES ===
        const shadows = this.add.graphics();
        shadows.fillStyle(0x0a0a08, 0.7);
        shadows.fillEllipse(0, 26, 50, 12);

        // === SOL CRAQUELÉ AUTOUR DE LA FAILLE ===
        const ground = this.add.graphics();
        ground.fillStyle(0x2a2520, 1);
        ground.fillEllipse(0, 18, 46, 14);

        // Fissures rayonnantes depuis le centre
        ground.lineStyle(2, 0x1a1510, 1);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startDist = 8;
            const endDist = 22;
            const sx = Math.cos(angle) * startDist;
            const sy = Math.sin(angle) * startDist + 18;
            const ex = Math.cos(angle) * endDist;
            const ey = Math.sin(angle) * endDist + 18;
            ground.lineBetween(sx, sy, ex, ey);
        }

        // Petites fissures secondaires
        ground.lineStyle(1, 0x1a1510, 0.7);
        ground.lineBetween(-12, 14, -8, 10);
        ground.lineBetween(10, 16, 14, 12);
        ground.lineBetween(-6, 22, -2, 24);
        ground.lineBetween(8, 20, 12, 22);

        // === FAILLE CENTRALE (GOUFFRE) ===
        const rift = this.add.graphics();

        // Forme irrégulière de la faille (trou dans le sol)
        rift.fillStyle(0x0a0a18, 1);
        rift.beginPath();
        rift.moveTo(0, -4);
        rift.lineTo(-10, 2);
        rift.lineTo(-8, 10);
        rift.lineTo(0, 14);
        rift.lineTo(8, 10);
        rift.lineTo(10, 2);
        rift.closePath();
        rift.fillPath();

        // Bordure de la faille (pierre brisée)
        rift.lineStyle(2, 0x1a1510, 1);
        rift.strokePath();

        // Profondeur (dégradé vers le noir)
        rift.fillStyle(0x1a1a28, 0.8);
        rift.beginPath();
        rift.moveTo(0, 0);
        rift.lineTo(-6, 4);
        rift.lineTo(-4, 8);
        rift.lineTo(0, 10);
        rift.lineTo(4, 8);
        rift.lineTo(6, 4);
        rift.closePath();
        rift.fillPath();

        // === LUEUR DE LA FAILLE (BLEU MYSTIQUE - PORTAIL D'ÂMES) ===
        const riftGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const drawRiftGlow = (intensity: number) => {
            riftGlow.clear();

            // Lueur bleu mystique sortant du gouffre (portail d'âmes)
            riftGlow.fillStyle(0x4466ff, 0.3 + intensity * 0.25);
            riftGlow.beginPath();
            riftGlow.moveTo(0, -4);
            riftGlow.lineTo(-10, 2);
            riftGlow.lineTo(-8, 10);
            riftGlow.lineTo(0, 14);
            riftGlow.lineTo(8, 10);
            riftGlow.lineTo(10, 2);
            riftGlow.closePath();
            riftGlow.fillPath();

            // Halo extérieur bleu cyan (couleur des âmes)
            riftGlow.fillStyle(0x66ccff, 0.15 + intensity * 0.15);
            riftGlow.fillEllipse(0, 5, 20, 18);
        };

        // === ÂMES SPECTRALES S'ÉCHAPPANT ===
        const souls = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const soulParticles: Array<{x: number, y: number, vy: number, vx: number, life: number, size: number, phase: number}> = [];

        // Initialiser des âmes
        for (let i = 0; i < 10; i++) {
            soulParticles.push({
                x: (Math.random() - 0.5) * 12,
                y: 5 + Math.random() * 8,
                vy: -0.4 - Math.random() * 0.5,
                vx: (Math.random() - 0.5) * 0.3,
                life: Math.random(),
                size: 2 + Math.random() * 3,
                phase: Math.random() * Math.PI * 2
            });
        }

        const drawSouls = (time: number) => {
            souls.clear();

            soulParticles.forEach((soul) => {
                soul.y += soul.vy;
                soul.x += soul.vx + Math.sin(time * 2 + soul.phase) * 0.2;
                soul.life -= 0.004;

                if (soul.life <= 0 || soul.y < -30) {
                    soul.x = (Math.random() - 0.5) * 12;
                    soul.y = 5 + Math.random() * 8;
                    soul.life = 1;
                    soul.phase = Math.random() * Math.PI * 2;
                }

                const alpha = soul.life * 0.9;
                const flicker = Math.sin(time * 5 + soul.phase) * 0.2 + 0.8;

                // Forme fantomatique d'âme (bleu cyan spectral - COULEUR DES ÂMES)
                souls.fillStyle(0x66ccff, alpha * flicker * 0.8);
                souls.fillCircle(soul.x, soul.y, soul.size);

                // Traînée spectrale (bleu pâle)
                souls.fillStyle(0x4488cc, alpha * flicker * 0.5);
                souls.fillCircle(soul.x, soul.y + 2, soul.size * 0.7);

                // Point central lumineux (bleu clair éclatant)
                souls.fillStyle(0xaaddff, alpha * flicker * 0.9);
                souls.fillCircle(soul.x, soul.y, soul.size * 0.4);
            });
        };

        gen.setData('soulTime', 0);


        // === PIERRES FLOTTANTES (GRAVITÉ INVERSÉE) ===
        const floatingStones = this.add.graphics();
        const stones: Array<{x: number, y: number, size: number, vy: number, amplitude: number, phase: number}> = [];

        for (let i = 0; i < 5; i++) {
            stones.push({
                x: (Math.random() - 0.5) * 20,
                y: 10 + Math.random() * 10,
                size: 2 + Math.random() * 3,
                vy: -0.1 - Math.random() * 0.15,
                amplitude: 1 + Math.random() * 2,
                phase: Math.random() * Math.PI * 2
            });
        }

        const drawStones = (time: number) => {
            floatingStones.clear();

            stones.forEach((stone) => {
                stone.y += stone.vy;
                const wobbleX = Math.sin(time + stone.phase) * stone.amplitude;

                if (stone.y < -20) {
                    stone.y = 20;
                    stone.x = (Math.random() - 0.5) * 20;
                }

                // Pierre sombre flottante
                floatingStones.fillStyle(0x3a3530, 0.9);
                floatingStones.fillCircle(stone.x + wobbleX, stone.y, stone.size);

                floatingStones.lineStyle(0.5, 0x2a2520, 1);
                floatingStones.strokeCircle(stone.x + wobbleX, stone.y, stone.size);
            });
        };

        // === ANIMATION CONTINUE ===
        const riftTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!gen.scene) return;

                const time = gen.getData('soulTime') as number || 0;
                gen.setData('soulTime', time + 0.016);

                const intensity = Math.sin(time * 1.5) * 0.5 + 0.5;

                drawRiftGlow(intensity);
                drawSouls(time);
                drawStones(time);
            }
        });

        // === COMPOSITION FINALE ===
        genContainer.add([shadows, ground, rift, riftGlow, souls, floatingStones, gen]);

        gen.setData('hp', 120);
        gen.setData('maxHp', 120);
        gen.setData('upgradeLevel', 0);
        gen.setData('yieldMul', 1);
        gen.setData('container', genContainer);
        gen.setData('riftTimer', riftTimer);

        this.generators.add(gen);
        attachHealthBar(this, gen);
        gen.setInteractive({ useHandCursor: true });

        // ⭐ LABEL "GEN" VISIBLE pour distinguer du tour
        const genLabel = this.add.text(x, y - 35, 'GEN', {
            fontSize: '14px',
            color: '#66ccff',
            fontFamily: 'Arial Black',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(11);

        // Stocker le label pour le détruire avec le générateur
        gen.setData('label', genLabel);

        // Mettre à jour l'affichage de production
        this.updateSoulProductionDisplay();

        const baseYield = GameConstants.GENERATOR_YIELD;
        const genTimer = this.time.addEvent({
            delay: GameConstants.GENERATOR_TICK_MS,
            loop: true,
            callback: () => {
                const mul = (gen.getData('yieldMul') as number) ?? 1;
                this.addShards(baseYield * mul);

                // Effet visuel lors de la génération d'âmes (flash de la lueur)
                if (riftGlow && riftGlow.scene) {
                    this.tweens.add({
                        targets: {},
                        duration: 300,
                        ease: 'Quad.easeOut',
                        onUpdate: (tween) => {
                            const flash = 1 - tween.progress;
                            drawRiftGlow(0.5 + flash * 0.5);
                        }
                    });
                }
            }
        });
        gen.setData('genTimer', genTimer);

        // Clic pour ouvrir le menu d'upgrade
        gen.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) return;
            this.showUpgradeMenu(gen, 'generator');
        });

        gen.once(Phaser.GameObjects.Events.DESTROY, () => {
            genTimer.remove(false);
            riftTimer.remove(false);

            // Détruire le label GEN
            const label = gen.getData('label') as Phaser.GameObjects.Text | undefined;
            if (label && label.scene) {
                label.destroy();
            }

            if (genContainer && genContainer.scene) {
                genContainer.destroy();
            }
            this.generators.remove(gen, false, false);

            // Mettre à jour l'affichage de production
            this.updateSoulProductionDisplay();
        });
    }

    // Feu de camp (aura de soin) - Style Bonfire Dark Souls
    private createCampfire(x: number, y: number): void {
        // Container principal
        const fireContainer = this.add.container(x, y).setDepth(9);

        // Rectangle invisible pour les collisions
        const fire = this.add.rectangle(0, 0, 48, 48, 0x8d4b2a, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === CERCLE DE CENDRES LARGE ===
        const ashCircle = this.add.graphics();

        // Cercle de cendres étendu
        ashCircle.fillStyle(0x1a1510, 1);
        ashCircle.fillEllipse(0, 22, 42, 14);

        // Cendres plus claires au centre
        ashCircle.fillStyle(0x2a2520, 0.8);
        ashCircle.fillEllipse(0, 22, 34, 11);

        // Tas de cendres irrégulier
        ashCircle.fillStyle(0x3a3530, 0.6);
        ashCircle.fillEllipse(-4, 20, 28, 10);
        ashCircle.fillEllipse(6, 21, 24, 8);

        // === BRAISES ROUGEOYANTES ===
        const embers = this.add.graphics();

        // Braises dispersées dans les cendres
        embers.fillStyle(0xff4422, 0.8);
        embers.fillCircle(-10, 19, 2);
        embers.fillCircle(8, 20, 1.8);
        embers.fillCircle(-2, 21, 2.2);
        embers.fillCircle(14, 19, 1.5);
        embers.fillCircle(-16, 21, 1.3);

        // Lueur orange autour des braises
        embers.fillStyle(0xff8844, 0.5);
        embers.fillCircle(-10, 19, 3);
        embers.fillCircle(8, 20, 2.8);
        embers.fillCircle(-2, 21, 3.5);

        // Braises plus petites
        embers.fillStyle(0xff6633, 0.6);
        embers.fillCircle(4, 22, 1);
        embers.fillCircle(-6, 20, 0.8);
        embers.fillCircle(11, 21, 0.9);

        // === BOIS CARBONISÉ ===
        const wood = this.add.graphics();

        // Bûches noircies éparpillées
        wood.fillStyle(0x1a1510, 1);

        // Bûche horizontale gauche
        wood.fillRect(-18, 12, 16, 5);
        wood.lineStyle(1, 0x0a0a08, 1);
        wood.strokeRect(-18, 12, 16, 5);

        // Bûche horizontale droite
        wood.fillRect(4, 10, 14, 5);
        wood.strokeRect(4, 10, 14, 5);

        // Bûche en diagonale
        wood.save();
        wood.translateCanvas(0, 8);
        wood.rotateCanvas(0.3);
        wood.fillRect(-8, 0, 16, 4);
        wood.strokeRect(-8, 0, 16, 4);
        wood.restore();

        // Texture du bois brûlé (fissures)
        wood.lineStyle(1, 0x2a1a0a, 0.4);
        wood.lineBetween(-16, 13, -12, 15);
        wood.lineBetween(6, 11, 10, 13);
        wood.lineBetween(-14, 14, -10, 16);

        // === ÉPÉE SPIRALE EMBLÉMATIQUE (style Dark Souls) ===
        const sword = this.add.graphics();

        // Lame de l'épée (longue et élancée)
        sword.fillStyle(0x5a6a7a, 1);

        // Lame principale (forme effilée)
        sword.beginPath();
        sword.moveTo(0, -36); // Pointe
        sword.lineTo(-2.5, -28);
        sword.lineTo(-2, 2);
        sword.lineTo(2, 2);
        sword.lineTo(2.5, -28);
        sword.closePath();
        sword.fillPath();

        // Reflets métalliques sur la lame
        sword.fillStyle(0x8a9aaa, 0.6);
        sword.fillRect(-1.5, -34, 1, 32);
        sword.fillRect(0.5, -32, 0.8, 28);

        // Entailles et dégâts sur la lame
        sword.fillStyle(0x3a4a5a, 0.7);
        sword.fillRect(-2, -24, 4, 1);
        sword.fillRect(-1.5, -18, 3, 0.8);
        sword.fillRect(-2, -12, 4, 1);

        // Bordure sombre de la lame
        sword.lineStyle(1.5, 0x3a4a5a, 1);
        sword.strokePath();

        // Garde de l'épée (croix gothique)
        sword.fillStyle(0x4a4a3a, 1);
        sword.fillRect(-10, 0, 20, 4);
        sword.fillRect(-2, -4, 4, 8);

        // Ornements sur la garde
        sword.fillStyle(0x6a6a5a, 0.8);
        sword.fillCircle(-8, 2, 1.5);
        sword.fillCircle(8, 2, 1.5);

        // Bordure de la garde
        sword.lineStyle(1, 0x2a2a1a, 1);
        sword.strokeRect(-10, 0, 20, 4);

        // Poignée enroulée
        sword.fillStyle(0x2a1a0a, 1);
        sword.fillRect(-2.5, 4, 5, 10);

        // Bandages sur la poignée
        sword.fillStyle(0x4a3a2a, 0.6);
        for (let i = 0; i < 4; i++) {
            sword.fillRect(-2.5, 5 + i * 2.5, 5, 1);
        }

        // Pommeau rond
        sword.fillStyle(0x5a4a3a, 1);
        sword.fillCircle(0, 15, 3.5);

        // Détail du pommeau
        sword.fillStyle(0x3a2a1a, 0.8);
        sword.fillCircle(0, 15, 2);
        sword.lineStyle(1.5, 0x2a1a0a, 1);
        sword.strokeCircle(0, 15, 3.5);

        // === FLAMMES MAJESTUEUSES (style Dark Souls) ===
        const flames = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

        const drawFlames = (time: number) => {
            flames.clear();

            // Flamme centrale massive qui enveloppe l'épée
            const centerWave = Math.sin(time * 2) * 3;
            const centerHeight = 28 + Math.sin(time * 1.5) * 6;
            const wave1 = Math.sin(time * 2.5) * 2;
            const wave2 = Math.sin(time * 3) * 1.5;

            // Flamme extérieure rouge-orange (très large) - forme organique
            flames.fillStyle(0xff4422, 0.5);
            flames.fillTriangle(
                -16 + centerWave, 8,
                -6 + wave1, -centerHeight,
                0, -centerHeight - 4
            );
            flames.fillTriangle(
                0, -centerHeight - 4,
                6 - wave1, -centerHeight,
                16 - centerWave, 8
            );
            flames.fillTriangle(
                -16 + centerWave, 8,
                -10 + wave2, -centerHeight * 0.6,
                0, 8
            );
            flames.fillTriangle(
                0, 8,
                10 - wave2, -centerHeight * 0.6,
                16 - centerWave, 8
            );

            // Flamme intermédiaire orange vif
            flames.fillStyle(0xff7733, 0.6);
            flames.fillTriangle(
                -12 + centerWave, 8,
                -4 + wave1, -centerHeight + 4,
                0, -centerHeight + 2
            );
            flames.fillTriangle(
                0, -centerHeight + 2,
                4 - wave1, -centerHeight + 4,
                12 - centerWave, 8
            );
            flames.fillTriangle(
                -12 + centerWave, 8,
                -6 + wave2, -centerHeight * 0.7,
                0, 8
            );
            flames.fillTriangle(
                0, 8,
                6 - wave2, -centerHeight * 0.7,
                12 - centerWave, 8
            );

            // Flamme interne jaune-orangé
            flames.fillStyle(0xffaa44, 0.7);
            flames.fillTriangle(
                -8 + centerWave * 0.5, 8,
                -3 + wave1, -centerHeight + 8,
                0, -centerHeight + 6
            );
            flames.fillTriangle(
                0, -centerHeight + 6,
                3 - wave1, -centerHeight + 8,
                8 - centerWave * 0.5, 8
            );
            flames.fillTriangle(
                -8 + centerWave * 0.5, 8,
                -4 + wave2, -centerHeight * 0.75,
                0, 6
            );
            flames.fillTriangle(
                0, 6,
                4 - wave2, -centerHeight * 0.75,
                8 - centerWave * 0.5, 8
            );

            // Coeur jaune brillant
            flames.fillStyle(0xffdd66, 0.8);
            flames.fillTriangle(
                -5 + centerWave * 0.3, 8,
                -2 + wave1 * 0.5, -centerHeight + 12,
                0, -centerHeight + 10
            );
            flames.fillTriangle(
                0, -centerHeight + 10,
                2 - wave1 * 0.5, -centerHeight + 12,
                5 - centerWave * 0.3, 8
            );

            // Centre blanc incandescent
            flames.fillStyle(0xffffff, 0.6);
            flames.fillCircle(centerWave * 0.3, 4, 4 + Math.sin(time * 3));
            flames.fillCircle(centerWave * 0.3, 0, 3 + Math.sin(time * 4) * 0.5);
            flames.fillCircle(centerWave * 0.3, -4, 2);

            // Petites flammes secondaires qui dansent autour
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + time;
                const dist = 14 + Math.sin(time * 2 + i) * 4;
                const fx = Math.cos(angle) * dist;
                const fy = Math.sin(angle) * dist - 4;
                const fHeight = 10 + Math.sin(time * 3 + i) * 4;
                const fWave = Math.sin(time * 2 + i * 0.5) * 2;

                // Petite flamme orange
                flames.fillStyle(0xff7733, 0.6);
                flames.fillTriangle(
                    fx - 3 + fWave, fy + 4,
                    fx + fWave * 0.5, fy - fHeight,
                    fx + 3 + fWave, fy + 4
                );

                // Centre jaune
                flames.fillStyle(0xffcc66, 0.7);
                flames.fillTriangle(
                    fx - 2 + fWave, fy + 4,
                    fx + fWave * 0.5, fy - fHeight + 4,
                    fx + 2 + fWave, fy + 4
                );

                // Coeur blanc
                flames.fillStyle(0xffffff, 0.5);
                flames.fillTriangle(
                    fx - 1 + fWave, fy + 4,
                    fx + fWave * 0.5, fy - fHeight + 6,
                    fx + 1 + fWave, fy + 4
                );
            }
        };

        fire.setData('flameTime', 0);
        const flameTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!fire.scene) return;
                const time = fire.getData('flameTime') as number;
                fire.setData('flameTime', time + 0.016);
                drawFlames(time);
            }
        });

        // === AURA DE CHALEUR INTENSE ===
        const aura = this.add.graphics({ x, y }).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
        const drawAura = (alpha: number, radius: number) => {
            aura.clear();

            // Aura rouge-orange profonde (chaleur intense)
            aura.fillStyle(0xff6633, alpha * 0.6);
            aura.fillCircle(0, 4, radius + 8);

            // Aura orange chaleureuse
            aura.fillStyle(0xff8844, alpha * 0.7);
            aura.fillCircle(0, 4, radius);

            // Cercle intérieur jaune lumineux
            aura.fillStyle(0xffaa55, alpha * 0.8);
            aura.fillCircle(0, 4, radius * 0.7);

            // Centre très lumineux
            aura.fillStyle(0xffcc77, alpha * 0.9);
            aura.fillCircle(0, 4, radius * 0.4);

            // Contours ondulants
            aura.lineStyle(1.5, 0xffdd99, Math.min(1, alpha + 0.15));
            aura.strokeCircle(0, 4, radius + 4);
            aura.strokeCircle(0, 4, radius * 0.6);
        };

        drawAura(0.2, 26);
        this.tweens.add({
            targets: aura,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: (tw) => {
                const v = tw.progress;
                const pulse = Math.sin(v * Math.PI);
                drawAura(0.15 + 0.1 * pulse, 24 + 6 * pulse);
            }
        });

        // === PARTICULES DE BRAISES MONTANTES (plus nombreuses) ===
        const embersGraphics = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const emberData: Array<{x: number, y: number, vx: number, vy: number, life: number, size: number, rotation: number}> = [];

        // Initialiser beaucoup de braises
        for (let i = 0; i < 24; i++) {
            emberData.push({
                x: (Math.random() - 0.5) * 24,
                y: 8 + Math.random() * 12,
                vx: (Math.random() - 0.5) * 0.6,
                vy: -0.4 - Math.random() * 0.8,
                life: Math.random(),
                size: 0.6 + Math.random() * 1.8,
                rotation: Math.random() * Math.PI * 2
            });
        }

        const updateEmbers = () => {
            if (!fire.scene) return;

            embersGraphics.clear();

            emberData.forEach((ember) => {
                // Mouvement ascendant avec turbulence
                ember.x += ember.vx;
                ember.y += ember.vy;
                ember.vx += (Math.random() - 0.5) * 0.1; // Turbulence
                ember.vy -= 0.01; // Accélération vers le haut
                ember.life -= 0.003;
                ember.rotation += 0.05;

                // Réinitialiser si mort
                if (ember.life <= 0 || ember.y < -36) {
                    ember.x = (Math.random() - 0.5) * 24;
                    ember.y = 8 + Math.random() * 8;
                    ember.vx = (Math.random() - 0.5) * 0.6;
                    ember.vy = -0.4 - Math.random() * 0.8;
                    ember.life = 1;
                    ember.size = 0.6 + Math.random() * 1.8;
                }

                // Dessiner la braise avec variation de couleur
                const alpha = ember.life * 0.9;
                const colorVariation = Math.sin(ember.rotation) * 0.5 + 0.5;

                // Braise rouge-orange
                if (colorVariation > 0.3) {
                    embersGraphics.fillStyle(0xff4422, alpha);
                } else {
                    embersGraphics.fillStyle(0xff8844, alpha);
                }
                embersGraphics.fillCircle(ember.x, ember.y, ember.size);

                // Halo jaune autour
                embersGraphics.fillStyle(0xffaa55, alpha * 0.6);
                embersGraphics.fillCircle(ember.x, ember.y, ember.size + 0.8);

                // Point blanc brillant au centre
                if (ember.size > 1.2) {
                    embersGraphics.fillStyle(0xffffff, alpha * 0.7);
                    embersGraphics.fillCircle(ember.x, ember.y, ember.size * 0.4);
                }
            });
        };

        const emberTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: updateEmbers
        });

        // === LUEUR INTENSE AU SOL ===
        const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        glow.fillStyle(0xff6633, 0.4);
        glow.fillEllipse(0, 24, 48, 14);
        glow.fillStyle(0xff8844, 0.3);
        glow.fillEllipse(0, 24, 40, 11);
        glow.fillStyle(0xffaa55, 0.2);
        glow.fillEllipse(0, 24, 32, 8);

        // Animation de la lueur au sol
        this.tweens.add({
            targets: glow,
            alpha: 0.7,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // === OMBRES PORTÉES ===
        const shadows = this.add.graphics();
        shadows.fillStyle(0x0a0a08, 0.6);
        shadows.fillEllipse(0, 26, 44, 12);

        // === SYMBOLE DE SOIN (CROIX MÉDICALE) ===
        const healSymbol = this.add.graphics();

        // Croix de soin au-dessus du feu
        healSymbol.fillStyle(0x55ff77, 0.9);
        healSymbol.fillRect(-2, -42, 4, 12);
        healSymbol.fillRect(-6, -38, 12, 4);

        // Bordure de la croix
        healSymbol.lineStyle(2, 0x88ffaa, 1);
        healSymbol.strokeRect(-2, -42, 4, 12);
        healSymbol.strokeRect(-6, -38, 12, 4);

        // Cercle autour de la croix
        healSymbol.strokeCircle(0, -36, 10);

        // Lueur de soin pulsante
        healSymbol.fillStyle(0x55ff77, 0.3);
        healSymbol.fillCircle(0, -36, 12);

        // Animation de pulsation du symbole de soin
        this.tweens.add({
            targets: healSymbol,
            alpha: { from: 0.6, to: 1 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Ajouter tous les éléments au container
        fireContainer.add([shadows, ashCircle, embers, wood, glow, flames, embersGraphics, sword, healSymbol, fire]);

        fire.setData('hp', 100);
        fire.setData('maxHp', 100);
        fire.setData('container', fireContainer);
        fire.setData('flameTimer', flameTimer);
        fire.setData('emberTimer', emberTimer);

        this.campfires.add(fire);
        attachHealthBar(this, fire);

        // Interaction clic droit pour vendre
        fire.setInteractive({ useHandCursor: true });
        fire.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.showUpgradeMenu(fire, 'campfire');
            }
        });

        fire.once(Phaser.GameObjects.Events.DESTROY, () => {
            aura.destroy();
            embersGraphics.destroy();
            flameTimer.remove(false);
            emberTimer.remove(false);
            if (fireContainer && fireContainer.scene) {
                fireContainer.destroy();
            }
            this.campfires.remove(fire, false, false);
        });

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

    // FORGE AVEC ENCLUME ET MARTEAU ANIMÉ - Dark Fantasy
    private createForge(x: number, y: number): void {
        // Container principal
        const forgeContainer = this.add.container(x, y).setDepth(9);

        // Rectangle invisible pour les collisions
        const forge = this.add.rectangle(0, 0, 48, 48, 0x3f4457, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === OMBRES ===
        const shadows = this.add.graphics();
        shadows.fillStyle(0x0a0a08, 0.7);
        shadows.fillEllipse(0, 26, 46, 10);

        // === SOCLE / BASE EN PIERRE ===
        const base = this.add.graphics();
        base.fillStyle(0x2a2520, 1);
        base.fillRect(-20, 16, 40, 8);
        base.lineStyle(2, 0x1a1510, 1);
        base.strokeRect(-20, 16, 40, 8);

        // Pierre usée
        base.fillStyle(0x1a1510, 0.4);
        base.fillRect(-20, 16, 40, 2);


        // === ENCLUME CENTRALE MASSIVE ===
        const anvil = this.add.graphics();

        // Pied/Socle de l'enclume (large et stable)
        anvil.fillStyle(0x3a3a3a, 1);
        anvil.fillRect(-10, 8, 20, 8);
        anvil.lineStyle(2, 0x2a2a2a, 1);
        anvil.strokeRect(-10, 8, 20, 8);

        // Corps principal de l'enclume (large et imposant)
        anvil.fillStyle(0x5a6a7a, 1);
        anvil.fillRect(-12, -4, 24, 12);

        // Surface plate supérieure (où on frappe)
        anvil.fillStyle(0x6a7a8a, 1);
        anvil.fillRect(-12, -8, 24, 4);

        // Corne de l'enclume (partie pointue à droite)
        anvil.fillStyle(0x5a6a7a, 1);
        anvil.fillTriangle(12, -8, 18, -6, 12, -4);

        // Reflets métalliques sur la surface
        anvil.fillStyle(0x9aabbb, 0.5);
        anvil.fillRect(-10, -7, 4, 2);
        anvil.fillRect(-2, -7, 6, 2);

        // Bordures de l'enclume
        anvil.lineStyle(2, 0x3a4a5a, 1);
        anvil.strokeRect(-12, -8, 24, 4);
        anvil.strokeRect(-12, -4, 24, 12);
        anvil.strokeTriangle(12, -8, 18, -6, 12, -4);

        // Marques de coups sur l'enclume (usure)
        anvil.lineStyle(1, 0x2a2a2a, 0.6);
        anvil.lineBetween(-8, -6, -6, -7);
        anvil.lineBetween(2, -6, 4, -7);
        anvil.lineBetween(-4, -7, -2, -6);

        // === FER CHAUFFÉ SUR L'ENCLUME ===
        const hotIron = this.add.graphics();
        const drawHotIron = (intensity: number) => {
            hotIron.clear();

            // Barre de métal incandescente sur l'enclume
            hotIron.fillStyle(0xff6633, 0.8);
            hotIron.fillRect(-6, -6, 12, 3);

            // Lueur orange/jaune intense
            hotIron.fillStyle(0xff8844, 0.6 + intensity * 0.3);
            hotIron.fillRect(-5, -5.5, 10, 2);

            hotIron.fillStyle(0xffcc66, 0.4 + intensity * 0.4);
            hotIron.fillRect(-4, -5, 8, 1.5);
        };
        hotIron.setBlendMode(Phaser.BlendModes.ADD);

        // === MARTEAU ANIMÉ QUI FRAPPE ===
        const hammer = this.add.graphics();
        const drawHammer = (impact: boolean) => {
            hammer.clear();

            // Position du marteau (animation de frappe)
            const hammerY = impact ? -8 : -20;
            const hammerAngle = impact ? 0.1 : -0.3;

            // Pivot pour rotation
            hammer.save();
            hammer.translateCanvas(10, hammerY);
            hammer.rotateCanvas(hammerAngle);

            // Manche en bois
            hammer.fillStyle(0x4a3a2a, 1);
            hammer.fillRect(-2, 0, 4, 16);
            hammer.lineStyle(1, 0x3a2a1a, 1);
            hammer.strokeRect(-2, 0, 4, 16);

            // Texture du bois
            hammer.lineStyle(0.5, 0x3a2a1a, 0.5);
            hammer.lineBetween(-1, 2, -1, 14);
            hammer.lineBetween(1, 2, 1, 14);

            // Tête du marteau (massive)
            hammer.fillStyle(0x6a7a8a, 1);
            hammer.fillRect(-6, -6, 12, 6);

            // Reflets métalliques
            hammer.fillStyle(0x9aabbb, 0.6);
            hammer.fillRect(-5, -5, 3, 2);
            hammer.fillRect(2, -5, 2, 2);

            // Bordure de la tête
            hammer.lineStyle(1.5, 0x4a5a6a, 1);
            hammer.strokeRect(-6, -6, 12, 6);

            hammer.restore();
        };
        forge.setData('hammerTime', 0);
        forge.setData('hammerPhase', 0);

        // === LUEUR DE FER CHAUFFÉ ===
        const ironGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const drawIronGlow = (intensity: number) => {
            ironGlow.clear();
            ironGlow.fillStyle(0xff6633, 0.3 + intensity * 0.2);
            ironGlow.fillCircle(0, -4, 18);
            ironGlow.fillStyle(0xff8844, 0.2 + intensity * 0.15);
            ironGlow.fillCircle(0, -4, 26);
        };

        this.tweens.add({
            targets: {},
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: (t) => {
                const intensity = Math.sin(t.progress * Math.PI);
                drawIronGlow(intensity);
                drawHotIron(intensity);
            }
        });

        // === ÉTINCELLES D'IMPACT ===
        const impactSparks = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const sparkData: Array<{x: number, y: number, vx: number, vy: number, life: number}> = [];

        const createImpactBurst = () => {
            // Créer une explosion d'étincelles à l'impact
            for (let i = 0; i < 12; i++) {
                const angle = (Math.random() - 0.5) * Math.PI;
                const speed = 1 + Math.random() * 2;
                sparkData.push({
                    x: 0,
                    y: -6,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1,
                    life: 1
                });
            }
        };

        // === ANIMATION DU MARTEAU ===
        const forgeTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!forge.scene) return;

                const time = forge.getData('hammerTime') as number || 0;
                const phase = forge.getData('hammerPhase') as number || 0;

                forge.setData('hammerTime', time + 0.016);

                // Cycle de frappe : monter (0.5s) -> descendre rapide (0.2s) -> pause (0.3s)
                const cycleTime = time % 1.0;

                if (cycleTime < 0.5) {
                    // Phase 1: Lever le marteau
                    drawHammer(false);
                } else if (cycleTime < 0.7) {
                    // Phase 2: Frappe rapide
                    drawHammer(true);

                    // Créer impact au moment précis
                    if (phase === 0 && cycleTime >= 0.5) {
                        createImpactBurst();
                        forge.setData('hammerPhase', 1);
                    }
                } else {
                    // Phase 3: Pause avec marteau en bas
                    drawHammer(true);
                    if (cycleTime >= 0.99) {
                        forge.setData('hammerPhase', 0);
                    }
                }

                // Dessiner les étincelles
                impactSparks.clear();
                sparkData.forEach((spark, idx) => {
                    spark.x += spark.vx;
                    spark.y += spark.vy;
                    spark.vy += 0.08; // Gravité
                    spark.life -= 0.02;

                    if (spark.life > 0) {
                        const alpha = spark.life * 0.9;
                        impactSparks.fillStyle(0xffcc66, alpha);
                        impactSparks.fillCircle(spark.x, spark.y, 1.5);
                        impactSparks.fillStyle(0xff8844, alpha * 0.6);
                        impactSparks.fillCircle(spark.x, spark.y, 2);
                    } else {
                        sparkData.splice(idx, 1);
                    }
                });
            }
        });


        // === COMPOSITION FINALE ===
        forgeContainer.add([shadows, base, anvil, hotIron, ironGlow, hammer, impactSparks, forge]);

        forge.setData('hp', 120);
        forge.setData('maxHp', 120);
        forge.setData('container', forgeContainer);
        forge.setData('forgeTimer', forgeTimer);

        this.forges.add(forge);
        attachHealthBar(this, forge);

        // Interaction clic droit pour vendre
        forge.setInteractive({ useHandCursor: true });
        forge.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.showUpgradeMenu(forge, 'forge');
            }
        });

        // Notifier l'UI qu'une forge existe maintenant
        this.registry.set('forgeCount', this.forges.getLength());

        forge.once(Phaser.GameObjects.Events.DESTROY, () => {
            forgeTimer.remove(false);
            if (forgeContainer && forgeContainer.scene) {
                forgeContainer.destroy();
            }
            this.forges.remove(forge, false, false);
            this.registry.set('forgeCount', this.forges.getLength());
        });
    }

    // Réserve d'âmes - COFFRE MIMIC VIVANT (Dark Fantasy)
    private createStorage(x: number, y: number): void {
        // Container principal
        const storageContainer = this.add.container(x, y).setDepth(9);

        // Rectangle invisible pour les collisions
        const stor = this.add.rectangle(0, 0, 48, 48, 0x6a5438, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === OMBRES PORTÉES ===
        const shadows = this.add.graphics();
        shadows.fillStyle(0x0a0a08, 0.7);
        shadows.fillEllipse(0, 24, 48, 12);

        // === CORPS DU MIMIC (COFFRE VIVANT) ===
        const mimicBody = this.add.graphics();

        // Base du coffre (partie inférieure - mâchoire)
        mimicBody.fillStyle(0x3a2a1a, 1);
        mimicBody.fillRect(-18, 2, 36, 18);

        // Bordure métallique usée
        mimicBody.lineStyle(2.5, 0x5a5a4a, 1);
        mimicBody.strokeRect(-18, 2, 36, 18);

        // Bandes de renfort (côtes du monstre)
        mimicBody.fillStyle(0x4a4a3a, 1);
        mimicBody.fillRect(-18, 6, 36, 2);
        mimicBody.fillRect(-18, 12, 36, 2);

        // Couvercle du coffre (partie supérieure - mâchoire supérieure)
        mimicBody.fillStyle(0x2a1a0a, 1);
        mimicBody.fillRect(-18, -14, 36, 16);

        // Bordure du couvercle
        mimicBody.lineStyle(2.5, 0x4a4a3a, 1);
        mimicBody.strokeRect(-18, -14, 36, 16);

        // Charnières du coffre (organiques, comme des articulations)
        mimicBody.fillStyle(0x5a3a2a, 1);
        mimicBody.fillCircle(-16, 0, 3);
        mimicBody.fillCircle(16, 0, 3);
        mimicBody.lineStyle(1.5, 0x3a2a1a, 1);
        mimicBody.strokeCircle(-16, 0, 3);
        mimicBody.strokeCircle(16, 0, 3);

        // === DENTS ACÉRÉES (MÂCHOIRE SUPÉRIEURE) ===
        const teethTop = this.add.graphics();
        teethTop.fillStyle(0xd0d0c0, 1);

        // Rangée de dents pointues
        for (let i = 0; i < 7; i++) {
            const tx = -14 + i * 5;
            teethTop.fillTriangle(tx, 2, tx + 2, -2, tx + 4, 2);
        }

        // Contours des dents
        teethTop.lineStyle(1, 0x9a9a8a, 1);
        for (let i = 0; i < 7; i++) {
            const tx = -14 + i * 5;
            teethTop.strokeTriangle(tx, 2, tx + 2, -2, tx + 4, 2);
        }

        // === DENTS ACÉRÉES (MÂCHOIRE INFÉRIEURE) ===
        const teethBottom = this.add.graphics();
        teethBottom.fillStyle(0xc0c0b0, 1);

        // Rangée de dents pointues
        for (let i = 0; i < 7; i++) {
            const tx = -12 + i * 5;
            teethBottom.fillTriangle(tx, 2, tx + 2, 6, tx + 4, 2);
        }

        // Contours des dents
        teethBottom.lineStyle(1, 0x8a8a7a, 1);
        for (let i = 0; i < 7; i++) {
            const tx = -12 + i * 5;
            teethBottom.strokeTriangle(tx, 2, tx + 2, 6, tx + 4, 2);
        }

        // === LANGUE VISQUEUSE ===
        const tongue = this.add.graphics();
        const drawTongue = (time: number) => {
            tongue.clear();

            const wiggle = Math.sin(time * 3) * 2;

            // Langue rouge/rose
            tongue.fillStyle(0xaa4455, 1);
            tongue.fillEllipse(wiggle, 4, 12, 6);

            // Reflets humides
            tongue.fillStyle(0xcc6677, 0.6);
            tongue.fillEllipse(wiggle - 2, 3, 6, 3);

            // Contour
            tongue.lineStyle(1.5, 0x882233, 1);
            tongue.strokeEllipse(wiggle, 4, 12, 6);
        };
        stor.setData('tongueTime', 0);

        // === OEIL MONSTRUEUX ===
        const eye = this.add.graphics();
        const drawEye = (time: number) => {
            eye.clear();

            const blink = Math.abs(Math.sin(time * 0.5));
            const eyeHeight = 6 * blink;

            if (blink > 0.1) {
                // Blanc de l'œil
                eye.fillStyle(0xeeeecc, 1);
                eye.fillEllipse(-8, -8, 8, eyeHeight);

                // Iris (rouge/jaune malsain)
                eye.fillStyle(0xccaa33, 1);
                eye.fillCircle(-8, -8, 2.5 * blink);

                // Pupille
                eye.fillStyle(0x0a0a08, 1);
                eye.fillCircle(-8, -8, 1.5 * blink);

                // Contour
                eye.lineStyle(1.5, 0x6a5a4a, 1);
                eye.strokeEllipse(-8, -8, 8, eyeHeight);

                // Vaisseaux sanguins
                eye.lineStyle(0.5, 0xaa3333, 0.6);
                eye.lineBetween(-12, -8, -10, -8);
                eye.lineBetween(-8, -10, -8, -9);
            }
        };
        stor.setData('eyeTime', 0);

        // === TENTACULES / CHAÎNES ORGANIQUES ===
        const tentacles = this.add.graphics();
        const drawTentacles = (time: number) => {
            tentacles.clear();

            tentacles.lineStyle(3, 0x4a3a2a, 1);

            // Tentacule gauche (ondulant)
            for (let i = 0; i < 5; i++) {
                const y = -18 + i * 4;
                const wave = Math.sin(time * 2 + i * 0.5) * 2;
                tentacles.lineBetween(-18 + wave, y, -18 + wave, y + 4);
            }

            // Tentacule droite
            for (let i = 0; i < 5; i++) {
                const y = -18 + i * 4;
                const wave = Math.sin(time * 2 + i * 0.5 + Math.PI) * 2;
                tentacles.lineBetween(18 + wave, y, 18 + wave, y + 4);
            }

            // Ventouses sur les tentacules
            tentacles.fillStyle(0x5a4a3a, 1);
            for (let i = 0; i < 4; i++) {
                const y = -16 + i * 5;
                const wave1 = Math.sin(time * 2 + i * 0.5) * 2;
                const wave2 = Math.sin(time * 2 + i * 0.5 + Math.PI) * 2;
                tentacles.fillCircle(-18 + wave1, y, 1.5);
                tentacles.fillCircle(18 + wave2, y, 1.5);
            }
        };
        stor.setData('tentacleTime', 0);

        // === BAVE / MUCUS ===
        const slime = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const slimeParticles: Array<{x: number, y: number, vy: number, life: number}> = [];
        for (let i = 0; i < 6; i++) {
            slimeParticles.push({
                x: (Math.random() - 0.5) * 20,
                y: 0,
                vy: 0.15 + Math.random() * 0.2,
                life: Math.random()
            });
        }

        const drawSlime = () => {
            slime.clear();
            slimeParticles.forEach((p) => {
                p.y += p.vy;
                p.life -= 0.003;

                if (p.life <= 0 || p.y > 20) {
                    p.x = (Math.random() - 0.5) * 20;
                    p.y = 0;
                    p.life = 1;
                }

                const alpha = p.life * 0.6;
                slime.fillStyle(0x88cc88, alpha);
                slime.fillCircle(p.x, p.y, 1.5);
            });
        };

        // Animation de respiration du Mimic
        this.tweens.add({
            targets: mimicBody,
            scaleY: { from: 1, to: 1.05 },
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        // Animation continue du Mimic
        const mimicTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!stor.scene) return;

                const tongueT = stor.getData('tongueTime') as number || 0;
                const eyeT = stor.getData('eyeTime') as number || 0;
                const tentacleT = stor.getData('tentacleTime') as number || 0;

                stor.setData('tongueTime', tongueT + 0.016);
                stor.setData('eyeTime', eyeT + 0.016);
                stor.setData('tentacleTime', tentacleT + 0.016);

                drawTongue(tongueT);
                drawEye(eyeT);
                drawTentacles(tentacleT);
                drawSlime();
            }
        });

        // === COMPOSITION FINALE ===
        storageContainer.add([shadows, mimicBody, teethBottom, tongue, teethTop, eye, tentacles, slime, stor]);

        stor.setData('hp', 140);
        stor.setData('maxHp', 140);
        stor.setData('container', storageContainer);
        stor.setData('mimicTimer', mimicTimer);

        this.storages.add(stor);
        attachHealthBar(this, stor);

        // Interaction clic droit pour vendre
        stor.setInteractive({ useHandCursor: true });
        stor.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.showUpgradeMenu(stor, 'storage');
            }
        });

        // Augmenter la capacité
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        const inc = 50;
        this.registry.set('maxSoulShards', max + inc);
        stor.setData('capInc', inc);

        stor.once(Phaser.GameObjects.Events.DESTROY, () => {
            mimicTimer.remove(false);
            if (storageContainer && storageContainer.scene) {
                storageContainer.destroy();
            }
            this.storages.remove(stor, false, false);
            const curMax = (this.registry.get('maxSoulShards') as number) ?? 100;
            const dec = stor.getData('capInc') as number ?? 0;
            const newMax = Math.max(0, curMax - dec);
            this.registry.set('maxSoulShards', newMax);
            const cur = (this.registry.get('soulShards') as number) ?? 0;
            this.registry.set('soulShards', Math.min(cur, newMax));
        });
    }

    // TAVERNE DE RECRUTEMENT - Dark Fantasy (mercenaires, alcool, combat)
    private createBarracks(x: number, y: number): void {
        // Container principal
        const barracksContainer = this.add.container(x, y).setDepth(9);

        // Rectangle invisible pour les collisions
        const br = this.add.rectangle(0, 0, 48, 48, 0x4b3323, 0)
            .setStrokeStyle(0, 0x000000, 0);

        // === OMBRES ===
        const shadows = this.add.graphics();
        shadows.fillStyle(0x0a0a08, 0.7);
        shadows.fillEllipse(0, 26, 50, 12);

        // === BÂTIMENT DE LA TAVERNE (BOIS) ===
        const building = this.add.graphics();

        // Murs en bois sombre
        building.fillStyle(0x3a2a1a, 1);
        building.fillRect(-18, -8, 36, 24);

        // Planches horizontales visibles
        building.lineStyle(1, 0x2a1a0a, 0.7);
        for (let i = 0; i < 6; i++) {
            building.lineBetween(-18, -8 + i * 5, 18, -8 + i * 5);
        }

        // Bordures du bâtiment
        building.lineStyle(2.5, 0x2a1a0a, 1);
        building.strokeRect(-18, -8, 36, 24);

        // Toit en bois (forme triangulaire)
        building.fillStyle(0x4a3a2a, 1);
        building.fillTriangle(-20, -8, 0, -20, 20, -8);
        building.lineStyle(2, 0x3a2a1a, 1);
        building.strokeTriangle(-20, -8, 0, -20, 20, -8);

        // Tuiles/planches du toit
        building.lineStyle(1, 0x3a2a1a, 0.6);
        for (let i = 0; i < 4; i++) {
            const y = -18 + i * 3;
            building.lineBetween(-18 + i * 5, y, 18 - i * 5, y);
        }

        // === PORTE EN BOIS MASSIVE ===
        const door = this.add.graphics();
        door.fillStyle(0x2a1a0a, 1);
        door.fillRect(-8, 4, 16, 12);

        // Bordure de la porte
        door.lineStyle(2, 0x1a0a00, 1);
        door.strokeRect(-8, 4, 16, 12);

        // Planches verticales
        door.lineStyle(1, 0x1a0a00, 0.8);
        door.lineBetween(-4, 4, -4, 16);
        door.lineBetween(0, 4, 0, 16);
        door.lineBetween(4, 4, 4, 16);

        // Poignée en fer
        door.fillStyle(0x4a4a4a, 1);
        door.fillCircle(5, 10, 1.5);

        // === FENÊTRES AVEC LUEUR CHAUDE ===
        const windows = this.add.graphics();

        // Fenêtre gauche
        windows.fillStyle(0xffaa44, 0.6);
        windows.fillRect(-14, -2, 6, 6);
        windows.lineStyle(1.5, 0x2a1a0a, 1);
        windows.strokeRect(-14, -2, 6, 6);
        windows.lineBetween(-11, -2, -11, 4);
        windows.lineBetween(-14, 1, -8, 1);

        // Fenêtre droite
        windows.fillStyle(0xffaa44, 0.6);
        windows.fillRect(8, -2, 6, 6);
        windows.lineStyle(1.5, 0x2a1a0a, 1);
        windows.strokeRect(8, -2, 6, 6);
        windows.lineBetween(11, -2, 11, 4);
        windows.lineBetween(8, 1, 14, 1);

        // === ENSEIGNE DE LA TAVERNE ===
        const sign = this.add.graphics();

        // Support en bois
        sign.fillStyle(0x3a2a1a, 1);
        sign.fillRect(-2, -22, 4, 6);

        // Panneau de l'enseigne
        sign.fillStyle(0x4a3a2a, 1);
        sign.fillRect(-12, -24, 24, 10);
        sign.lineStyle(2, 0x2a1a0a, 1);
        sign.strokeRect(-12, -24, 24, 10);

        // Épée et chope croisées (symbole taverne mercenaires)
        sign.fillStyle(0x8a7a4a, 1);
        // Épée
        sign.fillRect(-1, -22, 2, 6);
        sign.fillTriangle(-2, -22, 1, -24, 0, -22);
        // Chope
        sign.fillRect(2, -22, 4, 5);
        sign.fillRect(3, -23, 2, 1);
        sign.fillStyle(0xffaa44, 0.7);
        sign.fillRect(2.5, -21, 3, 3);

        // === TONNEAUX D'ALCOOL ===
        const barrels = this.add.graphics();

        // Tonneau gauche
        barrels.fillStyle(0x4a3a2a, 1);
        barrels.fillEllipse(-18, 14, 6, 4);
        barrels.fillRect(-21, 12, 6, 4);
        barrels.fillEllipse(-18, 12, 6, 4);
        barrels.lineStyle(1.5, 0x3a2a1a, 1);
        barrels.strokeRect(-21, 12, 6, 4);
        barrels.strokeEllipse(-18, 12, 6, 4);
        barrels.strokeEllipse(-18, 14, 6, 4);

        // Tonneau droite (empilé)
        barrels.fillStyle(0x4a3a2a, 1);
        barrels.fillEllipse(18, 16, 5, 3);
        barrels.fillRect(16, 14, 4, 4);
        barrels.fillEllipse(18, 14, 5, 3);
        barrels.lineStyle(1.5, 0x3a2a1a, 1);
        barrels.strokeRect(16, 14, 4, 4);
        barrels.strokeEllipse(18, 14, 5, 3);
        barrels.strokeEllipse(18, 16, 5, 3);

        // === MERCENAIRES / SILHOUETTES ===
        const mercs = this.add.graphics();

        // Mercenaire 1 (gauche - guerrier)
        mercs.fillStyle(0x5a4a3a, 0.9);
        mercs.fillCircle(-16, 0, 3);
        mercs.fillRect(-18, 3, 4, 6);
        // Épée à la ceinture
        mercs.fillStyle(0x6a7a8a, 1);
        mercs.fillRect(-17, 7, 1.5, 4);

        // Mercenaire 2 (droite - archer)
        mercs.fillStyle(0x4a5a4a, 0.9);
        mercs.fillCircle(16, 0, 3);
        mercs.fillRect(14, 3, 4, 6);
        // Arc sur le dos
        mercs.lineStyle(1.5, 0x5a4a3a, 0.8);
        mercs.strokeCircle(16, 4, 2);

        // === CHEMINÉE ET FUMÉE ===
        const chimney = this.add.graphics();
        chimney.fillStyle(0x3a2a1a, 1);
        chimney.fillRect(8, -20, 4, 6);
        chimney.lineStyle(1.5, 0x2a1a0a, 1);
        chimney.strokeRect(8, -20, 4, 6);

        const tavernSmoke = this.add.graphics().setBlendMode(Phaser.BlendModes.MULTIPLY);
        const smokeParticles: Array<{x: number, y: number, vy: number, life: number, size: number}> = [];
        for (let i = 0; i < 5; i++) {
            smokeParticles.push({
                x: 10 + (Math.random() - 0.5) * 2,
                y: -20,
                vy: -0.3 - Math.random() * 0.2,
                life: Math.random(),
                size: 1 + Math.random()
            });
        }

        const drawTavernSmoke = () => {
            tavernSmoke.clear();
            smokeParticles.forEach((p) => {
                p.y += p.vy;
                p.x += Math.sin(p.y * 0.1) * 0.2;
                p.life -= 0.004;
                p.size += 0.01;

                if (p.life <= 0 || p.y < -35) {
                    p.x = 10 + (Math.random() - 0.5) * 2;
                    p.y = -20;
                    p.life = 1;
                    p.size = 1 + Math.random();
                }

                const alpha = p.life * 0.4;
                tavernSmoke.fillStyle(0x5a5a5a, alpha);
                tavernSmoke.fillCircle(p.x, p.y, p.size);
            });
        };

        // === LUEUR DES FENÊTRES (pulsation douce) ===
        const windowGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        const drawWindowGlow = (intensity: number) => {
            windowGlow.clear();
            windowGlow.fillStyle(0xffaa44, 0.3 + intensity * 0.2);
            windowGlow.fillCircle(-11, 1, 6);
            windowGlow.fillCircle(11, 1, 6);
        };
        drawWindowGlow(0);

        // Timer d'animation
        const barrackTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!br.scene) return;

                const glowT = br.getData('glowTime') as number || 0;
                br.setData('glowTime', glowT + 0.016);

                const intensity = Math.sin(glowT * 2) * 0.5 + 0.5;
                drawWindowGlow(intensity);
                drawTavernSmoke();
            }
        });

        // === COMPOSITION FINALE ===
        barracksContainer.add([
            shadows, building, door, windows, windowGlow, sign, barrels,
            mercs, chimney, tavernSmoke, br
        ]);

        br.setData('hp', 150);
        br.setData('maxHp', 150);
        br.setData('container', barracksContainer);
        br.setData('barrackTimer', barrackTimer);

        this.barracks.add(br);
        attachHealthBar(this, br);

        // Interaction clic droit pour vendre
        br.setInteractive({ useHandCursor: true });
        br.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.showUpgradeMenu(br, 'barracks');
            }
        });

        const count = ((this.registry.get('barracksCount') as number) ?? 0) + 1;
        this.registry.set('barracksCount', count);

        br.once(Phaser.GameObjects.Events.DESTROY, () => {
            barrackTimer.remove(false);
            if (barracksContainer && barracksContainer.scene) {
                barracksContainer.destroy();
            }
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

        // Vérifier si c'est une vague boss (toutes les 5 vagues)
        const currentWave = (this.registry.get('wave') as number) ?? 1;
        const isBossWave = currentWave % GameConstants.BOSS_WAVE_INTERVAL === 0;

        let enemy: Phaser.GameObjects.Image;

        // Sur les vagues boss, spawn un mini-boss au lieu d'un ennemi normal toutes les 5 spawns
        if (isBossWave && this.waveSpawnsRemaining % 5 === 0) {
            enemy = createBossSkeletonEnemy(this, sx, sy, GameConstants.BOSS_SIZE_MULTIPLIER);

            // Marquer comme boss avec HP et caractéristiques augmentées
            enemy.setData('isBoss', true);
            enemy.setData('maxHp', GameConstants.BOSS_HP_MULTIPLIER); // Ratio de HP
            enemy.setData('currentHp', GameConstants.BOSS_HP_MULTIPLIER);
            enemy.setData('dpsMultiplier', GameConstants.BOSS_DPS_MULTIPLIER);
            enemy.setData('speedMultiplier', GameConstants.BOSS_SPEED_MULTIPLIER);

            console.log(`💀 MINI-BOSS SPAWNÉ ! Vague ${currentWave}, HP x${GameConstants.BOSS_HP_MULTIPLIER}, Vitesse x${GameConstants.BOSS_SPEED_MULTIPLIER}`);

            // Notification visuelle
            this.game.events.emit('notify', `💀 MINI-BOSS APPARU ! 💀`, 'error');
        } else {
            enemy = this.createSkeletonEnemy(sx, sy);
            enemy.setData('isBoss', false);
            enemy.setData('maxHp', 1);
            enemy.setData('currentHp', 1);
            enemy.setData('dpsMultiplier', 1);
            enemy.setData('speedMultiplier', 1);
        }

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

        // Initialiser la vitesse (avec multiplicateur pour les boss)
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

        // --- Mettre à jour les positions des étoiles et auras (Vétérans) ---
        const allies = this.allies.getChildren() as any[];
        for (const ally of allies) {
            // Mettre à jour les étoiles
            const stars = ally.getData('stars');
            if (stars && stars.length > 0) {
                stars.forEach((star: any, i: number) => {
                    if (star && star.active) {
                        star.setPosition(ally.x - 10 + (i * 8), ally.y - 30);
                    }
                });
            }

            // Mettre à jour l'aura
            const aura = ally.getData('aura');
            if (aura && aura.active) {
                aura.setPosition(ally.x, ally.y);
            }
        }

        // --- Auto-recrutement (IDLE GAME) ---
        if (this.autoRecruitEnabled) {
            const now = this.time.now;
            if (now - this.lastAutoRecruitTime >= this.autoRecruitInterval) {
                this.processAutoRecruit();
                this.lastAutoRecruitTime = now;
            }
        }

        // --- Auto-upgrade (IDLE GAME) ---
        if (this.autoUpgradeEnabled) {
            const now = this.time.now;
            if (now - this.lastAutoUpgradeCheck >= this.autoUpgradeInterval) {
                this.processAutoUpgrade();
                this.lastAutoUpgradeCheck = now;
            }
        }

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
                // Infliger des dégâts (avec multiplicateur pour les boss)
                const dpsMultiplier = (enemy.getData('dpsMultiplier') as number) ?? 1;
                const finalDps = GameConstants.ENEMY_DPS * dpsMultiplier;

                const hpB = (target.getData('hp') as number) ?? 0;
                const newHp = hpB - finalDps * dt;
                target.setData('hp', newHp);
                this.updateHealthBar(target);
                if (newHp <= 0) {
                    // Détruire le bâtiment et reprendre la marche
                    const container = target.getData('container') as Phaser.GameObjects.Container | undefined;
                    if (container && container.scene) {
                        container.destroy();
                    } else {
                        target.destroy(); // Sécurité si un bâtiment n'a pas de conteneur
                    }
                    enemy.setData('target', undefined);

                    // Recalculer le pathfinding maintenant que le mur est détruit
                    this.recomputeGrid();
                    this.recomputeAllEnemyPaths();

                    // Reprendre la marche
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
                const alliesData = this.collectAlliesData();
                SaveSystem.save(this.registry, buildingsData, alliesData);
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

        // === BOULE DE FEU D'ÂME (PROJECTILE DARK SOULS) ===
        // Rectangle invisible pour la physique
        const bullet = this.add.rectangle(towerX, towerY, 10, 10, 0x000000, 0).setDepth(12);

        // Visuel de la boule de feu
        const fireball = this.add.graphics({ x: towerX, y: towerY }).setDepth(12);
        fireball.setBlendMode(Phaser.BlendModes.ADD);

        const drawFireball = () => {
            fireball.clear();
            const time = Date.now() * 0.01;
            const flicker = Math.sin(time) * 0.2 + 0.8;

            // Noyau orange vif
            fireball.fillStyle(0xff6633, 0.9 * flicker);
            fireball.fillCircle(0, 0, 5);

            // Couronne orange
            fireball.fillStyle(0xff8844, 0.7 * flicker);
            fireball.fillCircle(0, 0, 7);

            // Halo jaune
            fireball.fillStyle(0xffaa44, 0.5 * flicker);
            fireball.fillCircle(0, 0, 9);

            // Particules de feu tournantes
            for (let i = 0; i < 4; i++) {
                const angle = time * 0.5 + (i * Math.PI / 2);
                const dist = 6 + Math.sin(time + i) * 2;
                const px = Math.cos(angle) * dist;
                const py = Math.sin(angle) * dist;
                fireball.fillStyle(0xffcc66, 0.6 * flicker);
                fireball.fillCircle(px, py, 2);
            }
        };

        // Animation continue de la boule de feu
        const fireTimer = this.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                if (!fireball.scene) return;
                drawFireball();
                fireball.setPosition(bullet.x, bullet.y);
            }
        });

        // Stocker le timer et le graphics pour nettoyage
        bullet.setData('fireballGraphics', fireball);
        bullet.setData('fireTimer', fireTimer);

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

        // Rotation de la boule de feu
        this.tweens.add({
            targets: fireball,
            angle: 360,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });

        // Nettoyage à la destruction
        bullet.once(Phaser.GameObjects.Events.DESTROY, () => {
            if (fireTimer) fireTimer.remove(false);
            if (fireball && fireball.scene) fireball.destroy();
        });
    }

    private fireAllyProjectile(ally: Phaser.GameObjects.GameObject, target: EnemyGO): void {
        const allyObj = ally as any; // Cast pour accéder à x, y
        const bullet = this.add.rectangle(allyObj.x, allyObj.y, 6, 6, 0xbfa76a).setDepth(12);

        // Ajouter au groupe physique AVANT d'ajouter la physique
        this.bullets.add(bullet);

        this.physics.add.existing(bullet);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        const dx = target.x - allyObj.x;
        const dy = target.y - allyObj.y;
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * (GameConstants.BULLET_SPEED * 0.9);
        const vy = (dy / len) * (GameConstants.BULLET_SPEED * 0.9);
        body.setVelocity(vx, vy);
    }

    private onBulletHitEnemy(
        bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
        enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
    ): void {
        const bulletGO = this.extractGO(bulletObj) as Phaser.GameObjects.GameObject;
        const enemyGO = this.extractGO(enemyObj) as Phaser.GameObjects.GameObject;

        // Détruire le projectile
        if (this.bullets.contains(bulletGO as any)) this.bullets.remove(bulletGO as any, true, false);
        bulletGO.destroy();

        // Vérifier si c'est un boss
        const isBoss = enemyGO.getData('isBoss') as boolean;
        const currentHp = (enemyGO.getData('currentHp') as number) ?? 1;
        const maxHp = (enemyGO.getData('maxHp') as number) ?? 1;

        if (isBoss) {
            // Le boss perd 1 HP
            const newHp = currentHp - 1;
            enemyGO.setData('currentHp', newHp);

            // Flash rouge pour indiquer le hit
            const enemy = enemyGO as Phaser.GameObjects.Image;
            this.tweens.add({
                targets: enemy,
                tint: 0xff0000,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    enemy.clearTint();
                }
            });

            console.log(`💥 BOSS TOUCHÉ ! HP: ${newHp}/${maxHp}`);

            // Si le boss a encore des HP, ne pas le détruire
            if (newHp > 0) {
                return;
            }

            // Boss mort - récompense multipliée
            console.log(`💀 MINI-BOSS VAINCU ! 💀`);
            this.game.events.emit('notify', `💀 MINI-BOSS VAINCU ! 💀`, 'success');
        }

        // Détruire l'ennemi (normal ou boss à 0 HP)
        if (this.enemies.contains(enemyGO as any)) this.enemies.remove(enemyGO as any, true, false);
        enemyGO.destroy();

        // Récompense dynamique basée sur la vague
        const currentWave = (this.registry.get('wave') as number) ?? 1;
        let reward = this.calculateEnemyReward(currentWave);

        // Multiplier la récompense pour les boss
        if (isBoss) {
            reward *= GameConstants.BOSS_REWARD_MULTIPLIER;
            console.log(`✅ Récompense BOSS: ${reward} âmes (x${GameConstants.BOSS_REWARD_MULTIPLIER})`);
        }

        this.addShards(reward);

        this.decWaveRemaining(1);
        console.log(`✅ Ennemi tué ! Récompense: ${reward} âmes, Ennemis restants: ${this.enemies.getLength()}`);
    }

    // Calcule la récompense en âmes pour un ennemi en fonction de la vague
    private calculateEnemyReward(wave: number): number {
        // Récompense de base
        let reward = GameConstants.SHARD_REWARD;

        // Augmentation progressive par vague
        reward += Math.floor((wave - 1) * 1.5);

        // Bonus toutes les 5 vagues
        const bonusMultiplier = Math.floor(wave / 5);
        if (bonusMultiplier > 0) {
            reward += bonusMultiplier * 5;
        }

        return reward;
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

        // === CALCUL DE LA DIFFICULTÉ ===
        // Augmentation de base par vague
        const baseSpeedIncrease = (currentWave - 1) * 10;

        // Bonus de vitesse toutes les 5 vagues (augmentation significative)
        const waveGroup = Math.floor((currentWave - 1) / 5);
        const speedBonus = waveGroup * 25; // +25 vitesse tous les 5 niveaux

        // Vitesse finale des ennemis
        this.enemySpeed = GameConstants.ENEMY_SPEED + baseSpeedIncrease + speedBonus;

        // Intervalle de spawn (plus rapide = plus d'ennemis)
        const baseInterval = Math.max(300, 1000 - (currentWave - 1) * 40);
        const intervalBonus = waveGroup > 0 ? Math.max(0, 150 * waveGroup) : 0;
        const interval = Math.max(200, baseInterval - intervalBonus);

        // Nombre d'ennemis par vague
        const baseCount = 10 + (currentWave - 1) * 2;
        const countBonus = waveGroup * 5; // +5 ennemis tous les 5 niveaux
        const count = baseCount + countBonus;

        // Log pour debug
        console.log(`🌊 Vague ${currentWave} - Vitesse: ${this.enemySpeed}, Intervalle: ${interval}ms, Ennemis: ${count}, Groupe: ${waveGroup + 1}`);

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

    // Toggle l'auto-recrutement (IDLE GAME)
    public toggleAutoRecruit(): void {
        this.autoRecruitEnabled = !this.autoRecruitEnabled;
        console.log(`🤖 Auto-recrutement: ${this.autoRecruitEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);

        if (this.autoRecruitEnabled) {
            this.game.events.emit('notify', 'Auto-recrutement activé', 'success');
        } else {
            this.game.events.emit('notify', 'Auto-recrutement désactivé', 'info');
        }
    }

    // Traite l'auto-recrutement (IDLE GAME)
    private processAutoRecruit(): void {
        const barracksCount = (this.registry.get('barracksCount') as number) ?? 0;
        if (barracksCount <= 0) return;

        const shards = (this.registry.get('soulShards') as number) ?? 0;

        // PLUS DE LIMITE ! Recrutement illimité tant qu'il y a des âmes et des casernes

        // Choisir un type aléatoire
        const types: Array<'knight' | 'watcher' | 'arbalest'> = ['knight', 'watcher', 'arbalest'];
        const randomType = Phaser.Utils.Array.GetRandom(types);
        const def = GameConstants.UNIT_DEFS[randomType];

        // Vérifier si on a assez d'âmes
        if (shards >= def.cost) {
            this.recruitUnit(randomType);
            const currentAllies = this.allies.getLength();
            console.log(`🤖 Auto-recrutement: ${randomType} recruté (Total: ${currentAllies})`);
        } else {
            console.log(`💰 Auto-recrutement: Pas assez d'âmes (${shards}/${def.cost})`);
        }
    }

    // Toggle l'auto-upgrade des alliés (IDLE GAME)
    public toggleAutoUpgrade(): void {
        this.autoUpgradeEnabled = !this.autoUpgradeEnabled;
        console.log(`🌟 Auto-upgrade: ${this.autoUpgradeEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);

        if (this.autoUpgradeEnabled) {
            this.game.events.emit('notify', 'Auto-upgrade activé', 'success');
        } else {
            this.game.events.emit('notify', 'Auto-upgrade désactivé', 'info');
        }
    }

    // Traite l'auto-upgrade des alliés (IDLE GAME)
    private processAutoUpgrade(): void {
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        const allies = this.allies.getChildren() as any[];

        for (const ally of allies) {
            const kills = ally.getData('kills') || 0;
            const level = ally.getData('level') || 1;

            // Définir les seuils de montée de niveau
            const levelUpThresholds = {
                2: { kills: 10, cost: 10 },
                3: { kills: 30, cost: 25 },
                4: { kills: 60, cost: 50 },
                5: { kills: 100, cost: 100 }
            };

            // Vérifier si l'allié peut monter de niveau
            if (level < 5) {
                const nextLevel = (level + 1) as 2 | 3 | 4 | 5;
                const threshold = levelUpThresholds[nextLevel];

                if (kills >= threshold.kills && shards >= threshold.cost) {
                    // Level up !
                    ally.setData('level', nextLevel);
                    this.registry.set('soulShards', shards - threshold.cost);

                    // Appliquer les bonus de stats
                    const kind = ally.getData('kind');
                    this.applyVeteranBonus(ally, kind, nextLevel);

                    // Effet visuel
                    this.showLevelUpEffect(ally, nextLevel);

                    console.log(`🌟 Auto-upgrade: Allié level ${level} → ${nextLevel} (${threshold.cost} âmes)`);

                    // Une seule upgrade par cycle
                    return;
                }
            }
        }
    }

    // Applique les bonus de vétéran
    private applyVeteranBonus(ally: any, kind: string, level: number): void {
        const def = GameConstants.UNIT_DEFS[kind as 'knight' | 'watcher' | 'arbalest'];
        if (!def) return;

        // Multiplicateurs de stats par niveau
        const hpMultipliers = { 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.7, 5: 2.0 };
        const dmgMultipliers = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.5, 5: 2.0 };

        // Calculer les nouvelles stats
        const newMaxHP = def.hp * hpMultipliers[level as keyof typeof hpMultipliers];
        const newDamage = def.damage * dmgMultipliers[level as keyof typeof dmgMultipliers];

        // Appliquer (stockées dans getData)
        ally.setData('maxHp', newMaxHP);
        ally.setData('damage', newDamage);
        ally.setData('hp', newMaxHP); // Soigne complètement au level up
    }

    // Affiche un effet visuel de level up
    private showLevelUpEffect(ally: any, level: number): void {
        // Particules dorées
        const particles = this.add.particles(ally.x, ally.y - 20, 'ash', {
            lifespan: 1000,
            speed: { min: 20, max: 50 },
            scale: { start: 1, end: 0 },
            tint: 0xffd700,
            quantity: 10,
            blendMode: 'ADD'
        });

        // Détruire après 1 seconde
        this.time.delayedCall(1000, () => {
            particles.destroy();
        });

        // Afficher les étoiles de niveau au-dessus de l'allié
        this.updateAllyStars(ally, level);
    }

    // Met à jour l'affichage des étoiles au-dessus d'un allié
    private updateAllyStars(ally: any, level: number): void {
        // Supprimer les anciennes étoiles
        const oldStars = ally.getData('stars');
        if (oldStars) {
            oldStars.forEach((star: any) => star.destroy());
        }

        // Créer les nouvelles étoiles
        const stars: Phaser.GameObjects.Text[] = [];
        const starText = '⭐';

        for (let i = 0; i < level - 1; i++) {
            const star = this.add.text(ally.x - 10 + (i * 8), ally.y - 30, starText, {
                fontSize: '12px',
                color: '#ffd700'
            }).setOrigin(0.5).setDepth(20);
            stars.push(star);
        }

        ally.setData('stars', stars);

        // Si niveau 5, ajouter une aura dorée
        if (level === 5) {
            const aura = this.add.circle(ally.x, ally.y, 20, 0xffd700, 0.2)
                .setStrokeStyle(2, 0xffd700, 0.5)
                .setDepth(9);

            ally.setData('aura', aura);

            // Animation pulsante
            this.tweens.add({
                targets: aura,
                scaleX: 1.2,
                scaleY: 1.2,
                alpha: 0.4,
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
        }
    }

    // API publique pour l'UI: recruter une unité
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

            // La caserne est dans un container, récupérer sa vraie position
            const container = pick.getData('container') as Phaser.GameObjects.Container | undefined;
            const barracksX = container ? container.x : pick.x;
            const barracksY = container ? container.y : pick.y;

            sx = barracksX + Phaser.Math.Between(-8, 8);
            sy = barracksY + Phaser.Math.Between(-8, 8);
        }

        // UTILISER LES VRAIS SPRITES AU LIEU DES CUBES
        const allySprite = createAllySprite(this, kind, sx, sy);

        this.allies.add(allySprite);

        // La physique est déjà ajoutée dans createAllySprite,
        // mais on récupère le body pour être sûr
        const body = allySprite.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setAllowGravity(false);
        }

        allySprite.setData('kind', kind);
        allySprite.setData('nextAtk', 0);

        // Système de Vétérans (IDLE GAME)
        allySprite.setData('kills', 0);
        allySprite.setData('level', 1);
        const def = GameConstants.UNIT_DEFS[kind];
        allySprite.setData('maxHp', def.hp);
        allySprite.setData('hp', def.hp);
        allySprite.setData('damage', def.damage);

        // Notification visuelle
        console.log(`⚔️ ${kind === 'knight' ? 'Chevalier' : kind === 'watcher' ? 'Veilleur' : 'Arbalétrier'} recruté à (${sx.toFixed(0)}, ${sy.toFixed(0)}) !`);
    }

    private updateAlliesAI(): void {
        const now = this.time.now;
        // Les alliés sont maintenant des Images, pas des Rectangles
        const allies = this.allies.getChildren() as Phaser.GameObjects.GameObject[];
        for (const a of allies) {
            // Cast en tant que GameObject pour accéder à x, y, body
            const ally = a as any; // GameObject avec physics
            const kind = ally.getData('kind') as 'knight' | 'watcher' | 'arbalest';
            const def = GameConstants.UNIT_DEFS[kind];
            const vision = kind === 'arbalest' ? def.atkRange : 220;
            const target = this.findTarget(ally.x, ally.y, vision);
            const body = ally.body as Phaser.Physics.Arcade.Body | undefined;

            if (target) {
                const d = Phaser.Math.Distance.Between(ally.x, ally.y, target.x, target.y);
                if (def.role === 'ranged') {
                    if (d <= def.atkRange) {
                        if (now >= ((ally.getData('nextAtk') as number) ?? 0)) {
                            this.fireAllyProjectile(ally, target);
                            ally.setData('nextAtk', now + def.atkRateMs);

                            // Effet visuel d'attaque
                            allyAttackEffect(this, ally);
                        }
                        if (body) body.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, ally.x, ally.y, target.x, target.y, def.speed);
                    }
                } else {
                    if (d <= def.atkRange + 6) {
                        if (now >= ((ally.getData('nextAtk') as number) ?? 0)) {
                            // Tuer l'ennemi au corps-à-corps (allié)
                            // Retirer proprement du groupe puis détruire
                            if (this.enemies.contains(target as any)) this.enemies.remove(target as any, true, false);
                            target.destroy();

                            // Récompense dynamique basée sur la vague
                            const currentWave = (this.registry.get('wave') as number) ?? 1;
                            const reward = this.calculateEnemyReward(currentWave);
                            this.addShards(reward);

                            this.decWaveRemaining(1);
                            ally.setData('nextAtk', now + def.atkRateMs);

                            // Système de Vétérans : Incrémenter les kills
                            const kills = (ally.getData('kills') || 0) + 1;
                            ally.setData('kills', kills);

                            // Effet visuel d'attaque mêlée
                            allyAttackEffect(this, ally);
                        }
                        if (body) body.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, ally.x, ally.y, target.x, target.y, def.speed);
                    }
                }
            } else {
                const d = Phaser.Math.Distance.Between(ally.x, ally.y, this.sanctuaryPos.x, this.sanctuaryPos.y);
                if (d > 120) {
                    if (body) this.seek(body, ally.x, ally.y, this.sanctuaryPos.x, this.sanctuaryPos.y, def.speed * 0.9);
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

        // Fonction helper pour obtenir la vraie position d'un bâtiment
        const getRealPosition = (building: any) => {
            const container = building.getData('container') as Phaser.GameObjects.Container | undefined;
            return {
                x: container ? container.x : building.x,
                y: container ? container.y : building.y
            };
        };

        // Vérifier tous les bâtiments
        const allBuildings = [
            ...this.towers.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.walls.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.generators.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.campfires.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.forges.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.storages.getChildren() as Phaser.GameObjects.Rectangle[],
            ...this.barracks.getChildren() as Phaser.GameObjects.Rectangle[]
        ];

        const occupied = allBuildings.some(building => {
            const pos = getRealPosition(building);
            return Math.abs(pos.x - snappedX) < 1 && Math.abs(pos.y - snappedY) < 1;
        });

        if (occupied) return false;
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        return shards >= this.getCurrentCost();
    }

    private isOccupiedCell(cellX: number, cellY: number): boolean {
        const TS = GameConstants.TILE_SIZE;
        const snappedX = GameConstants.UI_MARGIN_LEFT + cellX * TS + TS / 2;
        const snappedY = GameConstants.UI_MARGIN_TOP + cellY * TS + TS / 2;

        // Fonction helper pour obtenir la vraie position
        const getRealPosition = (building: any) => {
            const container = building.getData('container') as Phaser.GameObjects.Container | undefined;
            return {
                x: container ? container.x : building.x,
                y: container ? container.y : building.y
            };
        };

        // Vérifier tous les types de bâtiments
        const checkGroup = (group: Phaser.GameObjects.Group) => {
            return (group.getChildren() as any[]).some(building => {
                const pos = getRealPosition(building);
                return Math.abs(pos.x - snappedX) < 1 && Math.abs(pos.y - snappedY) < 1;
            });
        };

        return checkGroup(this.towers) ||
               checkGroup(this.walls) ||
               checkGroup(this.generators) ||
               checkGroup(this.campfires) ||
               checkGroup(this.forges) ||
               checkGroup(this.storages) ||
               checkGroup(this.barracks);
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

        // Appliquer le multiplicateur de vitesse pour les boss
        const speedMultiplier = (enemy.getData('speedMultiplier') as number) ?? 1;
        const finalSpeed = this.enemySpeed * speedMultiplier;

        if (!path || path.length === 0 || idx >= path.length) {
            this.seek(body, enemy.x, enemy.y, this.sanctuaryPos.x, this.sanctuaryPos.y, finalSpeed);
            return;
        }
        const wp = path[idx];
        this.seek(body, enemy.x, enemy.y, wp.x, wp.y, finalSpeed);
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
        // Ne pas mettre waveActive à false ici !
    }

    // Système de production passive d'âmes (idle game)
    private startPassiveSoulProduction(): void {
        // Production toutes les secondes
        this.passiveSoulTimer = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const production = this.calculateTotalSoulProduction();
                this.addShards(production);

                // Mettre à jour l'affichage
                this.updateSoulProductionDisplay();
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

    // Calcule la production totale d'âmes par seconde basée sur les générateurs
    private calculateTotalSoulProduction(): number {
        const generatorCount = this.generators.getLength();

        if (generatorCount === 0) {
            // Pas de générateur = production de base uniquement
            return this.soulProductionRate * this.soulProductionMultiplier;
        }

        // Chaque générateur contribue à la production
        let totalProduction = 0;

        for (const obj of this.generators.getChildren()) {
            const gen = obj as Phaser.GameObjects.Rectangle;
            const yieldMul = (gen.getData('yieldMul') as number) ?? 1;

            // Production par générateur = taux de base × multiplicateur du générateur × multiplicateur global
            const genProduction = this.soulProductionRate * yieldMul * this.soulProductionMultiplier;
            totalProduction += genProduction;
        }

        return totalProduction;
    }

    // Met à jour l'affichage de la production dans le registre pour l'UI
    private updateSoulProductionDisplay(): void {
        const generatorCount = this.generators.getLength();
        const totalProduction = this.calculateTotalSoulProduction();

        this.registry.set('generatorCount', generatorCount);
        this.registry.set('totalSoulProduction', totalProduction);
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
    private showUpgradeMenu(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks'): void {
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

            // Récupérer les éléments graphiques du générateur
            const soulsGraphics = building.getData('soulsGraphics') as Phaser.GameObjects.Graphics | undefined;
            const eyeGlowGraphics = building.getData('eyeGlowGraphics') as Phaser.GameObjects.Graphics | undefined;
            const auraGraphics = building.getData('auraGraphics') as Phaser.GameObjects.Graphics | undefined;

            // Couleurs des âmes selon le niveau
            const soulColors = [
                { main: 0x7a9fbf, glow: 0x9fbfdf }, // Niveau 0: Bleu spectral standard
                { main: 0x8aafcf, glow: 0xafcfef }, // Niveau 1: Bleu plus vif
                { main: 0x9fbfdf, glow: 0xbfdfff }, // Niveau 2: Cyan brillant
                { main: 0xbfa56a, glow: 0xdfc58f }  // Niveau 3: Doré (âmes anciennes)
            ];

            // Couleurs de lueur des yeux
            const eyeColors = [
                { main: 0x7aafd0, halo: 0x5a8fb0 }, // Niveau 0
                { main: 0x8fbfe0, halo: 0x6f9fc0 }, // Niveau 1
                { main: 0xafd5ff, halo: 0x8fb5df }, // Niveau 2
                { main: 0xffd58f, halo: 0xdfb56f }  // Niveau 3: Doré
            ];

            const soulCol = soulColors[newLevel];
            const eyeCol = eyeColors[newLevel];

            // Redessiner les âmes spectrales avec la nouvelle couleur
            if (soulsGraphics) {
                soulsGraphics.clear();
                soulsGraphics.fillStyle(soulCol.main, 0.6);

                // Âme gauche (forme de flamme/spectre)
                soulsGraphics.beginPath();
                soulsGraphics.arc(-8, -16, 4, Math.PI, 0, false);
                soulsGraphics.lineTo(-6, -20);
                soulsGraphics.lineTo(-8, -24);
                soulsGraphics.lineTo(-10, -20);
                soulsGraphics.closePath();
                soulsGraphics.fillPath();

                // Âme centrale (plus grande)
                soulsGraphics.beginPath();
                soulsGraphics.arc(0, -18, 5, Math.PI, 0, false);
                soulsGraphics.lineTo(3, -23);
                soulsGraphics.lineTo(0, -28);
                soulsGraphics.lineTo(-3, -23);
                soulsGraphics.closePath();
                soulsGraphics.fillPath();

                // Âme droite
                soulsGraphics.beginPath();
                soulsGraphics.arc(8, -16, 4, Math.PI, 0, false);
                soulsGraphics.lineTo(10, -20);
                soulsGraphics.lineTo(8, -24);
                soulsGraphics.lineTo(6, -20);
                soulsGraphics.closePath();
                soulsGraphics.fillPath();

                soulsGraphics.lineStyle(1, soulCol.glow, 0.5 + newLevel * 0.15);
                soulsGraphics.strokePath();

                // Ajouter des petites âmes supplémentaires pour les niveaux élevés
                if (newLevel >= 2) {
                    soulsGraphics.fillStyle(soulCol.glow, 0.5);
                    soulsGraphics.fillCircle(-12, -12, 2);
                    soulsGraphics.fillCircle(12, -12, 2);
                }

                // Ajouter des rayons d'âmes pour le niveau max
                if (newLevel === 3) {
                    soulsGraphics.lineStyle(2, soulCol.glow, 0.6);
                    soulsGraphics.lineBetween(0, -28, 0, -34);
                    soulsGraphics.lineBetween(-8, -24, -12, -26);
                    soulsGraphics.lineBetween(8, -24, 12, -26);
                }
            }

            // Redessiner la lueur des yeux avec la nouvelle couleur
            if (eyeGlowGraphics) {
                eyeGlowGraphics.clear();
                eyeGlowGraphics.fillStyle(eyeCol.main, 0.8 + newLevel * 0.05);
                eyeGlowGraphics.fillCircle(-4, -10, 2 + newLevel * 0.3);
                eyeGlowGraphics.fillCircle(4, -10, 2 + newLevel * 0.3);

                eyeGlowGraphics.fillStyle(eyeCol.halo, 0.4 + newLevel * 0.1);
                eyeGlowGraphics.fillCircle(-4, -10, 3 + newLevel * 0.5);
                eyeGlowGraphics.fillCircle(4, -10, 3 + newLevel * 0.5);
            }

            // Modifier l'aura pour qu'elle soit plus intense
            if (auraGraphics) {
                const auraColors = [
                    0x5a7a9a, // Niveau 0: Bleu sombre
                    0x6a8aaa, // Niveau 1: Bleu plus vif
                    0x7a9aba, // Niveau 2: Bleu clair
                    0xbfa56a  // Niveau 3: Doré fantomatique
                ];

                building.setData('auraColor', auraColors[newLevel]);
                building.setData('auraIntensity', 1 + newLevel * 0.3);
            }

            this.game.events.emit('notify', `Générateur amélioré au niveau ${newLevel} (+${(yieldMul * 100).toFixed(0)}% production)`, 'success');

            // Mettre à jour l'affichage de production
            this.updateSoulProductionDisplay();
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

    /**
     * Vend un bâtiment et rembourse une partie du coût
     * @param building Le bâtiment à vendre
     * @param type Le type de bâtiment
     * @returns true si la vente a réussi
     */
    public sellBuilding(building: Phaser.GameObjects.Rectangle, type: 'tower' | 'generator' | 'wall' | 'campfire' | 'forge' | 'storage' | 'barracks'): boolean {
        // Calculer le remboursement
        let baseCost = 0;
        let buildingName = '';
        let group: Phaser.GameObjects.Group | null = null;

        switch (type) {
            case 'tower':
                baseCost = this.towerCost;
                buildingName = 'Tour';
                group = this.towers;
                break;
            case 'generator':
                baseCost = this.generatorCost;
                buildingName = 'Générateur';
                group = this.generators;
                // Décrémenter le compteur de générateurs
                const genCount = (this.registry.get('generatorCount') as number) ?? 0;
                this.registry.set('generatorCount', Math.max(0, genCount - 1));
                this.updateSoulProductionDisplay();
                break;
            case 'wall':
                baseCost = this.wallCost;
                buildingName = 'Mur';
                group = this.walls;
                break;
            case 'campfire':
                baseCost = this.campfireCost;
                buildingName = 'Feu de camp';
                group = this.campfires;
                break;
            case 'forge':
                baseCost = this.forgeCost;
                buildingName = 'Forge';
                group = this.forges;
                // Décrémenter le compteur de forges
                const forgeCount = (this.registry.get('forgeCount') as number) ?? 0;
                this.registry.set('forgeCount', Math.max(0, forgeCount - 1));
                break;
            case 'storage':
                baseCost = this.storageCost;
                buildingName = 'Réserve';
                group = this.storages;
                // Réduire la capacité max
                const capInc = building.getData('capInc') as number;
                const maxShards = (this.registry.get('maxSoulShards') as number) ?? 100;
                this.registry.set('maxSoulShards', Math.max(100, maxShards - capInc));
                break;
            case 'barracks':
                baseCost = this.barracksCost;
                buildingName = 'Caserne';
                group = this.barracks;
                // Décrémenter le compteur de casernes
                const barracksCount = (this.registry.get('barracksCount') as number) ?? 0;
                this.registry.set('barracksCount', Math.max(0, barracksCount - 1));
                break;
        }

        // Calculer le remboursement (75% du coût de base)
        const refund = Math.floor(baseCost * GameConstants.SELL_REFUND_PERCENTAGE);

        // Rembourser les âmes
        const currentShards = (this.registry.get('soulShards') as number) ?? 0;
        this.registry.set('soulShards', currentShards + refund);

        // === DÉTRUIRE TOUS LES ÉLÉMENTS GRAPHIQUES ===

        // 1. Détruire le container s'il existe
        const container = building.getData('container') as Phaser.GameObjects.Container | undefined;
        if (container && container.scene) {
            container.destroy(true);
        }

        // 2. Détruire le label s'il existe (générateurs)
        const label = building.getData('label') as Phaser.GameObjects.Text | undefined;
        if (label && label.scene) {
            label.destroy();
        }

        // 3. Nettoyer les timers
        const riftTimer = building.getData('riftTimer') as Phaser.Time.TimerEvent | undefined;
        if (riftTimer) {
            riftTimer.remove(false);
        }

        const genTimer = building.getData('genTimer') as Phaser.Time.TimerEvent | undefined;
        if (genTimer) {
            genTimer.remove(false);
        }

        const fireTimer = building.getData('fireTimer') as Phaser.Time.TimerEvent | undefined;
        if (fireTimer) {
            fireTimer.remove(false);
        }

        const forgeTimer = building.getData('forgeTimer') as Phaser.Time.TimerEvent | undefined;
        if (forgeTimer) {
            forgeTimer.remove(false);
        }

        const mimicTimer = building.getData('mimicTimer') as Phaser.Time.TimerEvent | undefined;
        if (mimicTimer) {
            mimicTimer.remove(false);
        }

        const bannerTimer = building.getData('bannerTimer') as Phaser.Time.TimerEvent | undefined;
        if (bannerTimer) {
            bannerTimer.remove(false);
        }

        // 4. Détruire la barre de santé associée
        const healthBarBg = building.getData('healthBarBg') as Phaser.GameObjects.Graphics | undefined;
        const healthBarFill = building.getData('healthBarFill') as Phaser.GameObjects.Graphics | undefined;
        if (healthBarBg && healthBarBg.scene) healthBarBg.destroy();
        if (healthBarFill && healthBarFill.scene) healthBarFill.destroy();

        // 5. Supprimer le bâtiment du groupe
        if (group) {
            group.remove(building, true, false); // Ne pas détruire encore
        }

        // 6. Détruire le bâtiment lui-même
        if (building.scene) {
            building.destroy();
        }

        // Recalculer la grille et les chemins ennemis
        this.recomputeGrid();
        this.recomputeAllEnemyPaths();

        // Notification
        this.game.events.emit('notify', `${buildingName} vendu pour ${refund} âmes`, 'success');
        console.log(`💰 ${buildingName} vendu - Remboursement: ${refund} âmes (${(GameConstants.SELL_REFUND_PERCENTAGE * 100)}% de ${baseCost})`);

        return true;
    }

    // === MÉTHODES DE SAUVEGARDE DES BÂTIMENTS ===


    /**
     * Collecte les données de tous les bâtiments pour la sauvegarde
     */
    public collectBuildingsData(): import('../utils/SaveSystem').SavedBuilding[] {
        const buildings: import('../utils/SaveSystem').SavedBuilding[] = [];

        // Vérification précoce : si les groupes ne sont pas initialisés, retourner un tableau vide
        if (!this.towers || !this.walls || !this.generators) {
            console.warn('⚠️ collectBuildingsData: groupes non initialisés, retour vide');
            return buildings;
        }

        // Vérifier que les groupes existent avant d'accéder à leurs enfants
        // Cela évite les erreurs lors du shutdown de la scène

        // Tours (IMPORTANT: utiliser worldX/worldY car le Rectangle est dans un Container)
        if (this.towers && this.towers.getChildren) {
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
        }

        // Murs
        if (this.walls && this.walls.getChildren) {
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
        }

        // Générateurs
        if (this.generators && this.generators.getChildren) {
            for (const obj of this.generators.getChildren()) {
                const gen = obj as Phaser.GameObjects.Rectangle;
                // Le générateur est dans un container, récupérer la position du container
                const container = gen.getData('container') as Phaser.GameObjects.Container | undefined;
                const realX = container ? container.x : gen.x;
                const realY = container ? container.y : gen.y;

                buildings.push({
                    type: 'generator',
                    x: realX,
                    y: realY,
                    hp: gen.getData('hp') as number,
                    maxHp: gen.getData('maxHp') as number,
                    upgradeLevel: (gen.getData('upgradeLevel') as number) ?? 0,
                    yieldMul: (gen.getData('yieldMul') as number) ?? 1
                });
            }
        }

        // Feux de camp
        if (this.campfires && this.campfires.getChildren) {
            for (const obj of this.campfires.getChildren()) {
                const fire = obj as Phaser.GameObjects.Rectangle;
                // Le feu est dans un container
                const container = fire.getData('container') as Phaser.GameObjects.Container | undefined;
                const realX = container ? container.x : fire.x;
                const realY = container ? container.y : fire.y;

                buildings.push({
                    type: 'campfire',
                    x: realX,
                    y: realY,
                    hp: fire.getData('hp') as number,
                    maxHp: fire.getData('maxHp') as number
                });
            }
        }

        // Forges
        if (this.forges && this.forges.getChildren) {
            for (const obj of this.forges.getChildren()) {
                const forge = obj as Phaser.GameObjects.Rectangle;
                // La forge est dans un container
                const container = forge.getData('container') as Phaser.GameObjects.Container | undefined;
                const realX = container ? container.x : forge.x;
                const realY = container ? container.y : forge.y;

                buildings.push({
                    type: 'forge',
                    x: realX,
                    y: realY,
                    hp: forge.getData('hp') as number,
                    maxHp: forge.getData('maxHp') as number
                });
            }
        }

        // Réserves
        if (this.storages && this.storages.getChildren) {
            for (const obj of this.storages.getChildren()) {
                const storage = obj as Phaser.GameObjects.Rectangle;
                // Le storage est dans un container
                const container = storage.getData('container') as Phaser.GameObjects.Container | undefined;
                const realX = container ? container.x : storage.x;
                const realY = container ? container.y : storage.y;

                buildings.push({
                    type: 'storage',
                    x: realX,
                    y: realY,
                    hp: storage.getData('hp') as number,
                    maxHp: storage.getData('maxHp') as number,
                    capInc: storage.getData('capInc') as number
                });
            }
        }

        // Casernes
        if (this.barracks && this.barracks.getChildren) {
            for (const obj of this.barracks.getChildren()) {
                const barrack = obj as Phaser.GameObjects.Rectangle;
                // La caserne est dans un container
                const container = barrack.getData('container') as Phaser.GameObjects.Container | undefined;
                const realX = container ? container.x : barrack.x;
                const realY = container ? container.y : barrack.y;

                buildings.push({
                    type: 'barracks',
                    x: realX,
                    y: realY,
                    hp: barrack.getData('hp') as number,
                    maxHp: barrack.getData('maxHp') as number
                });
            }
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
     * Collecte les données de tous les alliés pour la sauvegarde
     */
    public collectAlliesData(): import('../utils/SaveSystem').SavedAlly[] {
        const alliesData: import('../utils/SaveSystem').SavedAlly[] = [];
        if (!this.allies || !this.allies.getChildren) {
            return alliesData;
        }

        for (const obj of this.allies.getChildren()) {
            const ally = obj as Phaser.GameObjects.Image; // Les alliés sont des Images
            alliesData.push({
                kind: ally.getData('kind'),
                x: ally.x,
                y: ally.y,
                level: ally.getData('level') || 1,
                kills: ally.getData('kills') || 0,
                hp: ally.getData('hp')
            });
        }
        console.log('🛡️ Collecte de', alliesData.length, 'alliés pour la sauvegarde.');
        return alliesData;
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

                // Mettre à jour l'apparence selon le niveau
                const level = building.upgradeLevel ?? 0;
                if (level > 0) {
                    const soulsGraphics = builtObject.getData('soulsGraphics') as Phaser.GameObjects.Graphics | undefined;
                    const eyeGlowGraphics = builtObject.getData('eyeGlowGraphics') as Phaser.GameObjects.Graphics | undefined;
                    const auraGraphics = builtObject.getData('auraGraphics') as Phaser.GameObjects.Graphics | undefined;

                    // Couleurs des âmes selon le niveau
                    const soulColors = [
                        { main: 0x7a9fbf, glow: 0x9fbfdf },
                        { main: 0x8aafcf, glow: 0xafcfef },
                        { main: 0x9fbfdf, glow: 0xbfdfff },
                        { main: 0xbfa56a, glow: 0xdfc58f }
                    ];

                    const eyeColors = [
                        { main: 0x7aafd0, halo: 0x5a8fb0 },
                        { main: 0x8fbfe0, halo: 0x6f9fc0 },
                        { main: 0xafd5ff, halo: 0x8fb5df },
                        { main: 0xffd58f, halo: 0xdfb56f }
                    ];

                    const soulCol = soulColors[level];
                    const eyeCol = eyeColors[level];

                    // Redessiner les âmes
                    if (soulsGraphics) {
                        soulsGraphics.clear();
                        soulsGraphics.fillStyle(soulCol.main, 0.6);

                        soulsGraphics.beginPath();
                        soulsGraphics.arc(-8, -16, 4, Math.PI, 0, false);
                        soulsGraphics.lineTo(-6, -20);
                        soulsGraphics.lineTo(-8, -24);
                        soulsGraphics.lineTo(-10, -20);
                        soulsGraphics.closePath();
                        soulsGraphics.fillPath();

                        soulsGraphics.beginPath();
                        soulsGraphics.arc(0, -18, 5, Math.PI, 0, false);
                        soulsGraphics.lineTo(3, -23);
                        soulsGraphics.lineTo(0, -28);
                        soulsGraphics.lineTo(-3, -23);
                        soulsGraphics.closePath();
                        soulsGraphics.fillPath();

                        soulsGraphics.beginPath();
                        soulsGraphics.arc(8, -16, 4, Math.PI, 0, false);
                        soulsGraphics.lineTo(10, -20);
                        soulsGraphics.lineTo(8, -24);
                        soulsGraphics.lineTo(6, -20);
                        soulsGraphics.closePath();
                        soulsGraphics.fillPath();

                        soulsGraphics.lineStyle(1, soulCol.glow, 0.5 + level * 0.15);
                        soulsGraphics.strokePath();

                        if (level >= 2) {
                            soulsGraphics.fillStyle(soulCol.glow, 0.5);
                            soulsGraphics.fillCircle(-12, -12, 2);
                            soulsGraphics.fillCircle(12, -12, 2);
                        }

                        if (level === 3) {
                            soulsGraphics.lineStyle(2, soulCol.glow, 0.6);
                            soulsGraphics.lineBetween(0, -28, 0, -34);
                            soulsGraphics.lineBetween(-8, -24, -12, -26);
                            soulsGraphics.lineBetween(8, -24, 12, -26);
                        }
                    }

                    // Redessiner la lueur des yeux
                    if (eyeGlowGraphics) {
                        eyeGlowGraphics.clear();
                        eyeGlowGraphics.fillStyle(eyeCol.main, 0.8 + level * 0.05);
                        eyeGlowGraphics.fillCircle(-4, -10, 2 + level * 0.3);
                        eyeGlowGraphics.fillCircle(4, -10, 2 + level * 0.3);

                        eyeGlowGraphics.fillStyle(eyeCol.halo, 0.4 + level * 0.1);
                        eyeGlowGraphics.fillCircle(-4, -10, 3 + level * 0.5);
                        eyeGlowGraphics.fillCircle(4, -10, 3 + level * 0.5);
                    }

                    // Modifier l'aura
                    if (auraGraphics) {
                        const auraColors = [0x5a7a9a, 0x6a8aaa, 0x7a9aba, 0xbfa56a];
                        builtObject.setData('auraColor', auraColors[level]);
                        builtObject.setData('auraIntensity', 1 + level * 0.3);
                    }
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

    /**
     * Restaure les alliés depuis la sauvegarde
     */
    public restoreAllies(allies: import('../utils/SaveSystem').SavedAlly[]): void {
        console.log('🏗️ Restauration de', allies.length, 'alliés...');

        for (const allyData of allies) {
            // 1. Recrée l'allié de base
            this.spawnAlly(allyData.kind);

            // 2. Récupère l'objet qui vient d'être créé (c'est le dernier du groupe)
            const newAlly = this.allies.getChildren()[this.allies.getLength() - 1] as Phaser.GameObjects.Image;

            // 3. Restaure ses propriétés spécifiques
            newAlly.setPosition(allyData.x, allyData.y);
            newAlly.setData('level', allyData.level);
            newAlly.setData('kills', allyData.kills);
            newAlly.setData('hp', allyData.hp);

            // 4. Met à jour son apparence (étoiles de vétéran, etc.)
            this.updateAllyStars(newAlly, allyData.level);
        }
        console.log('✅ Restauration des alliés terminée !');
    }
}
