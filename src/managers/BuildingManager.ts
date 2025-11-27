import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { PathfindingGrid } from '../scenes/PathfindingGrid';
import {BuildingFactory} from "../factories/BuildingFactory";
import { Building } from '../entities/Building';
import {Tower} from "../entities/Tower";
import type { SavedBuilding } from '../types/SaveData';

type BuildingKind = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';
type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class BuildingManager {
    private scene: Phaser.Scene;
    private grid: PathfindingGrid;
    private registry: Phaser.Data.DataManager;
    private factory: BuildingFactory;
    private enemies: Phaser.GameObjects.Group;

    // --- LISTE LOGIQUE (Pour les stats/upgrades) ---
    private buildings: Building[] = [];

    // --- GROUPES PHYSIQUES (Pour les collisions/rendu) ---
    public towers!: Phaser.Physics.Arcade.StaticGroup;
    public walls!: Phaser.Physics.Arcade.StaticGroup;
    public generators!: Phaser.Physics.Arcade.StaticGroup;
    public campfires!: Phaser.Physics.Arcade.StaticGroup;
    public forges!: Phaser.Physics.Arcade.StaticGroup;
    public storages!: Phaser.Physics.Arcade.StaticGroup;
    public barracks!: Phaser.Physics.Arcade.StaticGroup;

    // --- COÛTS ---
    private costs: Record<BuildingKind, number>;
    private currentBuildKind: BuildingKind = 'tower';

    // --- PLACEMENT / PREVIEW ---
    private previewGhost?: Phaser.GameObjects.Rectangle;
    private previewRangeGfx?: Phaser.GameObjects.Graphics;
    private sanctuaryPos!: { x: number; y: number };

    constructor(scene: Phaser.Scene, grid: PathfindingGrid, sanctuaryPos: {x: number, y: number}, enemies: Phaser.GameObjects.Group) {
        this.scene = scene;
        this.grid = grid;
        this.registry = scene.registry;
        this.sanctuaryPos = sanctuaryPos;
        this.factory = new BuildingFactory(scene);
        this.enemies = enemies;

        // Initialisation des coûts par défaut
        this.costs = {
            tower: GameConstants.INITIAL_TOWER_COST,
            wall: GameConstants.INITIAL_WALL_COST,
            generator: GameConstants.INITIAL_GENERATOR_COST,
            campfire: GameConstants.INITIAL_CAMPFIRE_COST,
            forge: GameConstants.INITIAL_FORGE_COST,
            storage: GameConstants.INITIAL_STORAGE_COST,
            barracks: GameConstants.INITIAL_BARRACKS_COST
        };

        this.initializeGroups();
        this.initializeCosts();
        this.initializePreview();
        this.registerInputHandlers();

        // Écouteur pour changer le type de bâtiment
        this.registry.events.on('changedata-buildKind', (_parent: any, value: BuildingKind) => {
            this.currentBuildKind = value;
            this.updateRegistryCosts(); // Mettre à jour le coût affiché
        });

        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    private initializeGroups(): void {
        this.towers = this.scene.physics.add.staticGroup();
        this.walls = this.scene.physics.add.staticGroup();
        this.generators = this.scene.physics.add.staticGroup();
        this.campfires = this.scene.physics.add.staticGroup();
        this.forges = this.scene.physics.add.staticGroup();
        this.storages = this.scene.physics.add.staticGroup();
        this.barracks = this.scene.physics.add.staticGroup();
    }

    private initializeCosts(): void {
        this.costs.tower = this.registry.get('towerCost') ?? GameConstants.INITIAL_TOWER_COST;
        this.costs.wall = this.registry.get('wallCost') ?? GameConstants.INITIAL_WALL_COST;
        this.costs.generator = this.registry.get('generatorCost') ?? GameConstants.INITIAL_GENERATOR_COST;
        this.costs.campfire = this.registry.get('campfireCost') ?? GameConstants.INITIAL_CAMPFIRE_COST;
        this.costs.forge = this.registry.get('forgeCost') ?? GameConstants.INITIAL_FORGE_COST;
        this.costs.storage = this.registry.get('storageCost') ?? GameConstants.INITIAL_STORAGE_COST;
        this.costs.barracks = this.registry.get('barracksCost') ?? GameConstants.INITIAL_BARRACKS_COST;

        this.registry.set('buildKind', this.currentBuildKind);
        this.updateRegistryCosts();
    }

    private updateRegistryCosts(): void {
        this.registry.set('towerCost', this.costs.tower);
        this.registry.set('buildCost', this.getCurrentCost());
    }

    private initializePreview(): void {
        this.previewGhost = this.scene.add.rectangle(0, 0, 48, 48, 0x9f8d62, 0.28).setDepth(8).setVisible(false);
        this.previewRangeGfx = this.scene.add.graphics().setDepth(7).setVisible(false);
    }

    private registerInputHandlers(): void {
        this.scene.input.on('pointerdown', this.handlePointerDown, this);
        this.scene.input.on('pointermove', this.updatePlacementPreview, this);
        this.scene.input.on('gameout', () => {
            this.previewGhost?.setVisible(false);
            this.previewRangeGfx?.setVisible(false);
        });
    }

    // --- BOUCLE DE JEU (UPDATE) ---

    public update(time: number): void {
        // 1. Mise à jour de la logique interne des bâtiments (production, cooldowns)
        // On utilise un delta fixe de 16ms pour la logique
        this.buildings.forEach(b => {
            if (b.getIsActive()) {
                b.update(16);
            }
        });

        // 2. Gestion spécifique des Tours (Tir)
        // On vérifie si les tours logiques sont prêtes à tirer
        this.buildings.forEach(b => {
            if (b.type === 'tower' && b.getIsActive()) {
                const towerLogic = b as Tower;
                // Si la tour est prête (selon sa propre logique interne)
                if (towerLogic.canFire(time)) {
                    const target = this.findTarget(b.x, b.y, towerLogic.getRange());
                    if (target) {
                        towerLogic.fire(time); // Reset le cooldown de la tour
                        this.fireVisualBullet(b.sprite as Phaser.GameObjects.Container, target);
                    }
                }
            }
        });
    }

    private findTarget(x: number, y: number, range: number): EnemyGO | null {
        let best: EnemyGO | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        // Optimisation : on parcourt les ennemis actifs
        const enemies = this.enemies.getChildren() as EnemyGO[];
        for (const obj of enemies) {
            if (!obj.active) continue;
            const d = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
            if (d <= range && d < bestD) {
                best = obj;
                bestD = d;
            }
        }
        return best;
    }

    private fireVisualBullet(towerContainer: Phaser.GameObjects.Container, target: EnemyGO): void {
        if (!towerContainer) return;

        // Effet visuel sur la tour (lueur)
        const glow = towerContainer.getData('glow') as Phaser.GameObjects.Graphics | undefined;
        if (glow) {
            this.scene.tweens.add({ targets: glow, alpha: { from: 1.0, to: 0.3 }, duration: 150, ease: 'Quad.Out' });
        }

        // Émission de l'événement pour que la GameScene crée le projectile physique
        this.scene.game.events.emit('fire-bullet', { x: towerContainer.x, y: towerContainer.y, target, type: 'tower' });
    }

    // --- GESTION DES COÛTS ET RESSOURCES ---

    private addShards(delta: number): void {
        const cur = (this.registry.get('soulShards') as number) ?? 0;
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        const next = Phaser.Math.Clamp(cur + delta, 0, max);
        this.registry.set('soulShards', next);
    }

    private getCurrentCost(): number {
        return this.costs[this.currentBuildKind];
    }

    // --- CRÉATION DE BÂTIMENT ---

    private createBuilding(kind: BuildingKind, x: number, y: number): void {
        // 1. La Factory crée le Visuel ET la Logique (stockée dans data 'buildingInstance')
        const container = this.factory.createBuilding(kind, x, y, this);

        // 2. On récupère la logique pour la stocker dans notre liste buildings
        const logic = container.getData('buildingInstance') as Building;
        if (logic) {
            this.buildings.push(logic);
        } else {
            console.warn(`[BuildingManager] Attention: Instance logique manquante pour ${kind}`);
        }

        // 3. Ajout aux groupes physiques Phaser (pour les collisions)
        switch (kind) {
            case 'tower':
                this.towers.add(container);
                break;
            case 'wall':
                this.walls.add(container);
                this.recomputeGrid();
                this.scene.game.events.emit('grid-updated');
                break;
            case 'generator':
                this.generators.add(container);
                break;
            case 'campfire':
                this.campfires.add(container);
                break;
            case 'forge':
                this.forges.add(container);
                this.registry.set('forgeCount', this.forges.getLength());
                break;
            case 'storage':
                this.storages.add(container);
                break;
            case 'barracks':
                this.barracks.add(container);
                this.registry.set('barracksCount', this.barracks.getLength());
                break;
        }

        console.log(`Bâtiment construit: ${kind} à (${x},${y})`);
    }

    // --- INPUT & PLACEMENT (Ta logique d'avant) ---

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;

        // Ignorer si hors zone de jeu
        if (worldX < gameAreaX || worldY < gameAreaY) return;

        const TS = GameConstants.TILE_SIZE;
        const cellX = Math.floor((worldX - gameAreaX) / TS);
        const cellY = Math.floor((worldY - gameAreaY) / TS);
        const snappedX = gameAreaX + cellX * TS + TS / 2;
        const snappedY = gameAreaY + cellY * TS + TS / 2;

        if (!this.canPlaceAt(snappedX, snappedY)) {
            const cost = this.getCurrentCost();
            const shards = (this.registry.get('soulShards') as number) ?? 0;

            if (shards < cost) {
                this.scene.game.events.emit('notify', `Pas assez d'Âmes (coût: ${cost})`, 'error');
            } else if (this.isSanctuaryCell(snappedX, snappedY)) {
                this.scene.game.events.emit('notify', 'Vous ne pouvez pas bâtir sur le Feu-lien', 'info');
            } else if (this.isOccupied(snappedX, snappedY)) {
                this.scene.game.events.emit('notify', 'Case déjà occupée', 'info');
            } else {
                this.scene.game.events.emit('notify', `Emplacement invalide`, 'info');
            }
            return;
        }

        // Paiement
        const cost = this.getCurrentCost();
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        this.registry.set('soulShards', shards - cost);

        // Construction effective
        this.createBuilding(this.registry.get('buildKind'), snappedX, snappedY);

        // Augmentation prix tour (mécanique spécifique)
        if (this.registry.get('buildKind') === 'tower') {
            this.costs.tower = Math.ceil(this.costs.tower * 1.15);
            this.updateRegistryCosts();
        }

        this.updatePlacementPreview(pointer);
    }

    private updatePlacementPreview(pointer: Phaser.Input.Pointer): void {
        if (!this.previewGhost || !this.previewRangeGfx) return;

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaRight = gameAreaX + GameConstants.GAME_AREA_WIDTH;
        const gameAreaBottom = gameAreaY + GameConstants.GAME_AREA_HEIGHT;

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

        const valid = this.canPlaceAt(snappedX, snappedY);

        this.previewGhost
            .setPosition(snappedX, snappedY)
            .setFillStyle(valid ? 0x9f8d62 : 0x7a1a1a, 0.28)
            .setVisible(true);

        this.previewRangeGfx.clear();
        if (this.registry.get('buildKind') === 'tower') {
            this.previewRangeGfx.lineStyle(1, valid ? 0x9f8d62 : 0x7a1a1a, 0.85);
            this.previewRangeGfx.strokeCircle(snappedX, snappedY, GameConstants.TOWER_RANGE);
            this.previewRangeGfx.setVisible(true);
        } else {
            this.previewRangeGfx.setVisible(false);
        }
    }

    private canPlaceAt(x: number, y: number): boolean {
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        if (shards < this.getCurrentCost()) return false;
        if (this.isOccupied(x, y)) return false;
        if (this.isSanctuaryCell(x, y)) return false;
        return true;
    }

    private isOccupied(x: number, y: number): boolean {
        // On vérifie tous les bâtiments actifs
        return this.buildings.some(b =>
            b.getIsActive() &&
            Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1
        );
    }

    private isSanctuaryCell(x: number, y: number): boolean {
        return Math.abs(x - this.sanctuaryPos.x) < 1 && Math.abs(y - this.sanctuaryPos.y) < 1;
    }

    // --- LOGIQUE UPGRADE / VENTE (Nouveau système via Classes) ---

    public showUpgradeMenu(container: Phaser.GameObjects.Container, type: BuildingKind): void {
        // On récupère l'objet Logique qu'on a attaché dans la Factory
        const logic = container.getData('buildingInstance') as Building;

        if (logic) {
            this.registry.set('upgradeMenuBuilding', { building: container, type, x: container.x, y: container.y });
            // On passe aussi la logique pour que l'UI puisse lire les stats
            this.scene.game.events.emit('showUpgradeMenu', container, type, logic);
        } else {
            console.error("[BuildingManager] Pas de logique associée à ce bâtiment !");
        }
    }

    public upgradeBuildingLevel(container: Phaser.GameObjects.Container, type: 'tower' | 'generator'): boolean {
        const logic = container.getData('buildingInstance') as Building;
        if (!logic) return false;

        const forgeCount = (this.registry.get('forgeCount') as number) ?? 0;
        if (forgeCount <= 0) {
            this.scene.game.events.emit('notify', 'Construisez une Forge pour débloquer les améliorations', 'error');
            return false;
        }

        const cost = logic.getUpgradeCost();
        const shards = (this.registry.get('soulShards') as number) ?? 0;

        if (shards < cost) {
            this.scene.game.events.emit('notify', `Pas assez d'Âmes (coût: ${cost})`, 'error');
            return false;
        }

        // Appel à la méthode upgrade() de la classe Building
        if (logic.upgrade()) {
            this.registry.set('soulShards', shards - cost);

            // Mise à jour des datas du container (pour rétrocompatibilité si besoin)
            container.setData('upgradeLevel', logic.getStats().level);

            this.scene.game.events.emit('notify', `${logic.getDisplayName()} amélioré !`, 'success');

            if (type === 'generator') {
                this.scene.game.events.emit('generator-changed');
            }
            return true;
        } else {
            this.scene.game.events.emit('notify', 'Niveau maximum atteint', 'info');
            return false;
        }
    }

    public sellBuilding(container: Phaser.GameObjects.Container, type: BuildingKind): boolean {
        const logic = container.getData('buildingInstance') as Building;
        if (!logic) return false;

        const refund = logic.getSellPrice();
        this.addShards(refund);

        // Suppression logique
        const idx = this.buildings.indexOf(logic);
        if (idx > -1) this.buildings.splice(idx, 1);
        logic.destroy();

        // Suppression physique
        let group: Phaser.Physics.Arcade.StaticGroup | null = null;
        switch (type) {
            case 'tower': group = this.towers; break;
            case 'wall': group = this.walls; break;
            case 'generator': group = this.generators; break;
            case 'campfire': group = this.campfires; break;
            case 'forge': group = this.forges; break;
            case 'storage': group = this.storages; break;
            case 'barracks': group = this.barracks; break;
        }

        if (group) group.remove(container, true, true);

        // Mises à jour globales
        if (type === 'wall') {
            this.recomputeGrid();
            this.scene.game.events.emit('grid-updated');
        }
        if (type === 'forge') this.registry.set('forgeCount', this.forges.getLength());
        if (type === 'barracks') this.registry.set('barracksCount', this.barracks.getLength());
        if (type === 'generator') this.scene.game.events.emit('generator-changed');
        if (type === 'storage') {
            // Logique spécifique stockage (ex: capInc récupéré depuis logic ou data)
            const capInc = container.getData('capInc') as number || 50;
            const maxShards = (this.registry.get('maxSoulShards') as number) ?? 100;
            this.registry.set('maxSoulShards', Math.max(100, maxShards - capInc));
        }

        this.scene.game.events.emit('notify', `Vendu pour ${refund} âmes`, 'success');
        return true;
    }

    public getUpgradeInfo(container: Phaser.GameObjects.Container, _type?: 'tower' | 'generator'): any {
        const logic = container.getData('buildingInstance') as Building;
        if (!logic) return null;

        const stats = logic.getStats();
        return {
            level: stats.level,
            maxLevel: stats.maxLevel,
            nextCost: logic.getUpgradeCost(),
            currentStats: logic.getDetailedStats(),
            nextStats: "Amélioration disponible"
        };
    }

    // --- UTILITAIRES (GRID & SAVE) ---

    public recomputeGrid(): void {
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        this.grid.recomputeFromWalls(this.walls, gameAreaX, gameAreaY);
    }

    public worldToCell(x: number, y: number): { cx: number; cy: number } {
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const { col, row } = this.grid.pixelToGrid(x, y, gameAreaX, gameAreaY);
        return { cx: col, cy: row };
    }

    public cellToWorld(cx: number, cy: number): { x: number; y: number } {
        const TS = GameConstants.TILE_SIZE;
        return {
            x: GameConstants.UI_MARGIN_LEFT + cx * TS + TS / 2,
            y: GameConstants.UI_MARGIN_TOP + cy * TS + TS / 2
        };
    }

    public collectBuildingsData(): SavedBuilding[] {
        // On utilise la liste logique qui contient tout ce qu'il faut
        return this.buildings.map(b => {
            const stats = b.getStats();
            const data: any = {
                type: b.type,
                x: b.x,
                y: b.y,
                hp: stats.hp,
                maxHp: stats.maxHp,
                upgradeLevel: stats.level
            };

            // Sauvegarde de propriétés spécifiques via data container si besoin
            if (b.type === 'storage' && b.sprite) {
                data.capInc = b.sprite.getData('capInc');
            }

            return data;
        });
    }

    public restoreBuildings(buildingsData: SavedBuilding[]): void {
        for (const data of buildingsData) {
            // Création standard qui met tout en place (Physique + Logique)
            this.createBuilding(data.type, data.x, data.y);

            // Récupération de l'instance qu'on vient de créer (c'est la dernière ajoutée)
            const logic = this.buildings[this.buildings.length - 1];
            const container = logic.sprite as Phaser.GameObjects.Container;

            // Restauration des stats
            if (logic) {
                // On force le niveau
                while (logic.getStats().level < (data.upgradeLevel || 1)) {
                    logic.upgrade(); // Simule les upgrades pour avoir les bonnes stats
                }
                // On force les HP
                if (data.hp !== undefined) {
                    logic.takeDamage(logic.getStats().hp - data.hp); // Ajustement basique
                }
            }

            // Spécifique Storage
            if (data.type === 'storage' && data.capInc && container) {
                container.setData('capInc', data.capInc);
            }
        }

        // Mises à jour finales
        if (this.walls.getLength() > 0) {
            this.recomputeGrid();
            this.scene.game.events.emit('grid-updated');
        }
        this.registry.set('forgeCount', this.forges.getLength());
        this.registry.set('barracksCount', this.barracks.getLength());
    }

    public destroy(): void {
        this.registry.events.off('changedata-buildKind');
        this.scene.input.off('pointerdown', this.handlePointerDown, this);
        this.scene.input.off('pointermove', this.updatePlacementPreview, this);
        this.scene.input.off('gameout');
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

        this.towers.clear(true, true);
        this.walls.clear(true, true);
        this.generators.clear(true, true);
        this.campfires.clear(true, true);
        this.forges.clear(true, true);
        this.storages.clear(true, true);
        this.barracks.clear(true, true);

        this.buildings = [];

        this.previewGhost?.destroy();
        this.previewRangeGfx?.destroy();
    }
}