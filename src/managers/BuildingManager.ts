import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { PathfindingGrid } from '../scenes/PathfindingGrid';
import type {SavedBuilding} from '../types/SaveData';
import { BuildingFactory } from '../factories/BuildingFactory';

type BuildingKind = 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';
type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class BuildingManager {
    private scene: Phaser.Scene;
    private grid: PathfindingGrid;
    private registry: Phaser.Data.DataManager; // CORRECTION
    private factory: BuildingFactory;
    private enemies: Phaser.GameObjects.Group;

    public towers!: Phaser.Physics.Arcade.StaticGroup;
    public walls!: Phaser.Physics.Arcade.StaticGroup;
    public generators!: Phaser.Physics.Arcade.StaticGroup;
    public campfires!: Phaser.Physics.Arcade.StaticGroup;
    public forges!: Phaser.Physics.Arcade.StaticGroup;
    public storages!: Phaser.Physics.Arcade.StaticGroup;
    public barracks!: Phaser.Physics.Arcade.StaticGroup;

    private towerCost: number = GameConstants.INITIAL_TOWER_COST;
    private wallCost: number = GameConstants.INITIAL_WALL_COST;
    private generatorCost: number = GameConstants.INITIAL_GENERATOR_COST;
    private campfireCost: number = GameConstants.INITIAL_CAMPFIRE_COST;
    private forgeCost: number = GameConstants.INITIAL_FORGE_COST;
    private storageCost: number = GameConstants.INITIAL_STORAGE_COST;
    private barracksCost: number = GameConstants.INITIAL_BARRACKS_COST;

    private currentBuildKind: BuildingKind = 'tower';

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

        this.initializeGroups();
        this.initializeCosts();
        this.initializePreview();
        this.registerInputHandlers();

        // CORRECTION: suppression de 'parent'
        this.registry.events.on('changedata-buildKind', (_parent: any, value: BuildingKind) => {
            this.currentBuildKind = value;
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
        this.towerCost = this.registry.get('towerCost') ?? GameConstants.INITIAL_TOWER_COST;
        this.wallCost = this.registry.get('wallCost') ?? GameConstants.INITIAL_WALL_COST;
        this.generatorCost = this.registry.get('generatorCost') ?? GameConstants.INITIAL_GENERATOR_COST;
        this.campfireCost = this.registry.get('campfireCost') ?? GameConstants.INITIAL_CAMPFIRE_COST;
        this.forgeCost = this.registry.get('forgeCost') ?? GameConstants.INITIAL_FORGE_COST;
        this.storageCost = this.registry.get('storageCost') ?? GameConstants.INITIAL_STORAGE_COST;
        this.barracksCost = this.registry.get('barracksCost') ?? GameConstants.INITIAL_BARRACKS_COST;

        this.registry.set('buildKind', this.currentBuildKind);
        this.registry.set('towerCost', this.towerCost);
        this.registry.set('wallCost', this.wallCost);
        this.registry.set('generatorCost', this.generatorCost);
        this.registry.set('campfireCost', this.campfireCost);
        this.registry.set('forgeCost', this.forgeCost);
        this.registry.set('storageCost', this.storageCost);
        this.registry.set('barracksCost', this.barracksCost);
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

    public update(time: number): void {
        this.updateTowers(time);
    }

    private updateTowers(time: number): void {
        for (const obj of this.towers.getChildren()) {
            const tower = obj as Phaser.GameObjects.Container;
            if (time < ((tower.getData('nextFire') as number) ?? 0)) continue;
            const towerX = tower.x;
            const towerY = tower.y;
            const target = this.findTarget(towerX, towerY, GameConstants.TOWER_RANGE);
            if (!target) continue;
            this.fireFromTower(tower, target);
            tower.setData('nextFire', time + GameConstants.TOWER_FIRE_RATE * ((tower.getData('fireRateMul') as number) ?? 1));
        }
    }

    private findTarget(x: number, y: number, range: number): EnemyGO | null {
        let best: EnemyGO | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const obj of this.enemies.getChildren() as EnemyGO[]) {
            const d = Phaser.Math.Distance.Between(x, y, obj.x, obj.y);
            if (d <= range && d < bestD) { best = obj; bestD = d; }
        }
        return best;
    }

    private fireFromTower(tower: Phaser.GameObjects.Container, target: EnemyGO): void {
        const glow = tower.getData('glow') as Phaser.GameObjects.Graphics | undefined;
        if (glow) this.scene.tweens.add({ targets: glow, alpha: { from: 1.0, to: 0.3 }, duration: 150, ease: 'Quad.Out' });
        this.scene.game.events.emit('fire-bullet', { x: tower.x, y: tower.y, target, type: 'tower' });
    }

    private addShards(delta: number): void {
        const cur = (this.registry.get('soulShards') as number) ?? 0;
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        const next = Phaser.Math.Clamp(cur + delta, 0, max);
        this.registry.set('soulShards', next);
    }

    private getCurrentCost(): number {
        this.currentBuildKind = this.registry.get('buildKind');
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

    private createBuilding(kind: BuildingKind, x: number, y: number): void {
        const buildingContainer = this.factory.createBuilding(kind, x, y, this);
        switch (kind) {
            case 'tower': this.towers.add(buildingContainer); break;
            case 'wall': this.walls.add(buildingContainer); this.recomputeGrid(); this.scene.game.events.emit('grid-updated'); break;
            case 'generator': this.generators.add(buildingContainer); break;
            case 'campfire': this.campfires.add(buildingContainer); break;
            case 'forge': this.forges.add(buildingContainer); this.registry.set('forgeCount', this.forges.getLength() + 1); break;
            case 'storage': this.storages.add(buildingContainer); break;
            case 'barracks': this.barracks.add(buildingContainer); this.registry.set('barracksCount', this.barracks.getLength() + 1); break; // Corrected line
        }
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
            this.previewRangeGfx?.setVisible(false);
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
        this.previewRangeGfx?.clear();
        if (this.registry.get('buildKind') === 'tower') {
            this.previewRangeGfx?.lineStyle(1, valid ? 0x9f8d62 : 0x7a1a1a, 0.85);
            this.previewRangeGfx?.strokeCircle(snappedX, snappedY, GameConstants.TOWER_RANGE);
            this.previewRangeGfx?.setVisible(true);
        } else {
            this.previewRangeGfx?.setVisible(false);
        }
    }

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const gameAreaX = GameConstants.UI_MARGIN_LEFT;
        const gameAreaY = GameConstants.UI_MARGIN_TOP;
        const gameAreaRight = gameAreaX + GameConstants.GAME_AREA_WIDTH;
        const gameAreaBottom = gameAreaY + GameConstants.GAME_AREA_HEIGHT;
        if (worldX < gameAreaX || worldX > gameAreaRight || worldY < gameAreaY || worldY > gameAreaBottom) {
            return;
        }
        const TS = GameConstants.TILE_SIZE;
        const cellX = Math.floor((worldX - gameAreaX) / TS);
        const cellY = Math.floor((worldY - gameAreaY) / TS);
        const snappedX = gameAreaX + cellX * TS + TS / 2;
        const snappedY = gameAreaY + cellY * TS + TS / 2;
        if (!this.canPlaceAt(snappedX, snappedY)) {
            const shards = (this.registry.get('soulShards') as number) ?? 0;
            const cost = this.getCurrentCost();
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
        const cost = this.getCurrentCost();
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        this.registry.set('soulShards', shards - cost);
        this.createBuilding(this.registry.get('buildKind'), snappedX, snappedY);
        if (this.registry.get('buildKind') === 'tower') {
            this.towerCost = Math.ceil(this.towerCost * 1.15);
            this.registry.set('towerCost', this.towerCost);
        }
        this.registry.set('buildCost', this.getCurrentCost());
        this.updatePlacementPreview(pointer);
    }

    private canPlaceAt(x: number, y: number): boolean {
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        if (shards < this.getCurrentCost()) return false;
        if (this.isOccupied(x, y)) return false;
        if (this.isSanctuaryCell(x, y)) return false;
        return true;
    }

    private isOccupied(x: number, y: number): boolean {
        const checkGroup = (group: Phaser.GameObjects.Group | Phaser.Physics.Arcade.StaticGroup) => {
            return (group.getChildren() as any[]).some(building => {
                const container = building as Phaser.GameObjects.Container;
                return Math.abs(container.x - x) < 1 && Math.abs(container.y - y) < 1;
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

    private isSanctuaryCell(x: number, y: number): boolean {
        return Math.abs(x - this.sanctuaryPos.x) < 1 && Math.abs(y - this.sanctuaryPos.y) < 1;
    }

    public showUpgradeMenu(building: Phaser.GameObjects.Container, type: BuildingKind): void {
        this.registry.set('upgradeMenuBuilding', { building, type, x: building.x, y: building.y });
        this.scene.game.events.emit('showUpgradeMenu', building, type);
    }

    public upgradeBuildingLevel(building: Phaser.GameObjects.Container, type: 'tower' | 'generator'): boolean {
        const forgeCount = (this.registry.get('forgeCount') as number) ?? 0;
        if (forgeCount <= 0) {
            this.scene.game.events.emit('notify', 'Construisez une Forge pour débloquer les améliorations', 'error');
            return false;
        }
        const currentLevel = (building.getData('upgradeLevel') as number) ?? 0;
        if (currentLevel >= 3) {
            this.scene.game.events.emit('notify', 'Niveau maximum atteint', 'info');
            return false;
        }
        const upgradeCosts = type === 'tower' ? [30, 60, 120] : [40, 80, 160];
        const cost = upgradeCosts[currentLevel];
        const shards = (this.registry.get('soulShards') as number) ?? 0;
        if (shards < cost) {
            this.scene.game.events.emit('notify', `Pas assez d'Âmes (coût: ${cost})`, 'error');
            return false;
        }
        this.registry.set('soulShards', shards - cost);
        const newLevel = currentLevel + 1;
        building.setData('upgradeLevel', newLevel);
        if (type === 'tower') {
            const fireRateMul = 1 - (newLevel * 0.15);
            const damageMul = 1 + (newLevel * 0.5);
            building.setData('fireRateMul', fireRateMul);
            building.setData('damageMul', damageMul);
            this.scene.game.events.emit('notify', `Tour améliorée au niveau ${newLevel}`, 'success');
        } else {
            const yieldMul = 1 + (newLevel * 0.75);
            building.setData('yieldMul', yieldMul);
            this.scene.game.events.emit('notify', `Générateur amélioré au niveau ${newLevel} (+${(yieldMul * 100).toFixed(0)}% production)`, 'success');
            this.scene.game.events.emit('generator-changed');
        }
        return true;
    }

    public getUpgradeInfo(building: Phaser.GameObjects.Container, type: 'tower' | 'generator'): any {
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

    public sellBuilding(building: Phaser.GameObjects.Container, type: BuildingKind): boolean {
        let baseCost = 0;
        let buildingName = '';
        let group: Phaser.GameObjects.Group | Phaser.Physics.Arcade.StaticGroup | null = null;
        switch (type) {
            case 'tower': baseCost = this.towerCost; buildingName = 'Tour'; group = this.towers; break;
            case 'generator': baseCost = this.generatorCost; buildingName = 'Générateur'; group = this.generators; this.scene.game.events.emit('generator-changed'); break;
            case 'wall': baseCost = this.wallCost; buildingName = 'Mur'; group = this.walls; break;
            case 'campfire': baseCost = this.campfireCost; buildingName = 'Feu de camp'; group = this.campfires; break;
            case 'forge': baseCost = this.forgeCost; buildingName = 'Forge'; group = this.forges; this.registry.set('forgeCount', this.forges.getLength() -1); break;
            case 'storage':
                baseCost = this.storageCost; buildingName = 'Réserve'; group = this.storages;
                const capInc = building.getData('capInc') as number;
                const maxShards = (this.registry.get('maxSoulShards') as number) ?? 100;
                this.registry.set('maxSoulShards', Math.max(100, maxShards - capInc));
                break;
            case 'barracks': baseCost = this.barracksCost; buildingName = 'Caserne'; group = this.barracks; this.registry.set('barracksCount', this.barracks.getLength() - 1); break;
        }
        const refund = Math.floor(baseCost * GameConstants.SELL_REFUND_PERCENTAGE);
        this.addShards(refund);

        if (group) group.remove(building, true, true);

        if (type === 'wall') {
            this.recomputeGrid();
            this.scene.game.events.emit('grid-updated');
        }
        this.scene.game.events.emit('notify', `${buildingName} vendu pour ${refund} âmes`, 'success');
        return true;
    }

    public collectBuildingsData(): SavedBuilding[] {
        const buildings: SavedBuilding[] = [];
        if (!this.towers || !this.walls || !this.generators) return buildings;

        const processGroup = (group: Phaser.GameObjects.Group | Phaser.Physics.Arcade.StaticGroup, type: BuildingKind) => {
            for (const obj of group.getChildren()) {
                const building = obj as Phaser.GameObjects.Container;
                const data: Partial<SavedBuilding> = { type, x: building.x, y: building.y };
                const health = building.getData('health') as any;
                if (health) {
                    data.hp = health.getHp();
                    data.maxHp = health.getMaxHp();
                }
                if (type === 'tower' || type === 'generator') {
                    data.upgradeLevel = building.getData('upgradeLevel');
                    if (type === 'tower') {
                        data.fireRateMul = building.getData('fireRateMul');
                        data.damageMul = building.getData('damageMul');
                    } else {
                        data.yieldMul = building.getData('yieldMul');
                    }
                }
                if (type === 'storage') data.capInc = building.getData('capInc');
                buildings.push(data as SavedBuilding);
            }
        };

        processGroup(this.towers, 'tower');
        processGroup(this.walls, 'wall');
        processGroup(this.generators, 'generator');
        processGroup(this.campfires, 'campfire');
        processGroup(this.forges, 'forge');
        processGroup(this.storages, 'storage');
        processGroup(this.barracks, 'barracks');

        return buildings;
    }

    // ... La méthode restoreBuildings (que nous avons corrigée précédemment) reste inchangée ...
    public restoreBuildings(buildings: SavedBuilding[]): void {
        for (const buildingData of buildings) {
            // 1. Recréation physique et visuelle
            const buildingContainer = this.factory.createBuilding(buildingData.type, buildingData.x, buildingData.y, this);

            // 2. Ajout aux groupes physiques (Important pour les collisions/détections)
            switch (buildingData.type) {
                case 'tower': this.towers.add(buildingContainer); break;
                case 'wall': this.walls.add(buildingContainer); break;
                case 'generator': this.generators.add(buildingContainer); break;
                case 'campfire': this.campfires.add(buildingContainer); break;
                case 'forge': this.forges.add(buildingContainer); break;
                case 'storage': this.storages.add(buildingContainer); break;
                case 'barracks': this.barracks.add(buildingContainer); break;
            }

            // 3. Restauration de la Santé
            const health = buildingContainer.getData('health') as any;
            if (health && buildingData.hp !== undefined) {
                health.setHp(buildingData.hp);
            }

            // 4. Restauration du Niveau et des Stats (C'est ce qu'il manquait !)
            if (buildingData.upgradeLevel !== undefined) {
                buildingContainer.setData('upgradeLevel', buildingData.upgradeLevel);
            }

            // Spécifique aux Tours (Remettre les dégâts et la cadence)
            if (buildingData.type === 'tower') {
                if (buildingData.fireRateMul) buildingContainer.setData('fireRateMul', buildingData.fireRateMul);
                if (buildingData.damageMul) buildingContainer.setData('damageMul', buildingData.damageMul);
                // Initialiser le prochain tir à "maintenant" pour qu'elle tire tout de suite
                buildingContainer.setData('nextFire', this.scene.time.now);
            }

            // Spécifique aux Générateurs (Remettre la production)
            if (buildingData.type === 'generator') {
                if (buildingData.yieldMul) buildingContainer.setData('yieldMul', buildingData.yieldMul);
            }

            // Spécifique aux Réserves (Remettre l'augmentation de capacité)
            if (buildingData.type === 'storage') {
                if (buildingData.capInc) buildingContainer.setData('capInc', buildingData.capInc);
            }
        }

        // 5. Mise à jour globale après la boucle
        // On signale au jeu que les murs sont là (pour le pathfinding)
        if (this.walls.getLength() > 0) {
            this.recomputeGrid();
            this.scene.game.events.emit('grid-updated');
        }

        // On signale au jeu de recalculer la production d'âmes
        this.scene.game.events.emit('generator-changed');

        // On met à jour les compteurs globaux
        this.registry.set('forgeCount', this.forges.getLength());
        this.registry.set('barracksCount', this.barracks.getLength());
    }

    public findBuildingAt(x: number, y: number): Phaser.GameObjects.Container | undefined {
        const allBuildings = [
            ...this.walls.getChildren(), ...this.towers.getChildren(), ...this.generators.getChildren(),
            ...this.campfires.getChildren(), ...this.forges.getChildren(), ...this.storages.getChildren(),
            ...this.barracks.getChildren()
        ];
        for (const obj of allBuildings) {
            const go = obj as Phaser.GameObjects.Container;
            if (Phaser.Math.Distance.Between(x, y, go.x, go.y) <= GameConstants.ATTACK_RANGE) return go; // Return the container itself
        }
        return undefined;
    }

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

    public findPath(start: { cx: number; cy: number }, goal: { cx: number; cy: number }): { cx: number; cy: number }[] | null {
        if (!this.inBounds(start.cx, start.cy) || !this.inBounds(goal.cx, goal.cy)) return null;
        const grid = this.grid.getGrid();
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

    public pickSpawnCell(): { cx: number; cy: number } | null {
        const { rows } = this.grid.getDimensions();
        const cx = 0;
        for (let i = 0; i < 10; i++) {
            const cy = Phaser.Math.Between(0, rows - 1);
            if (!this.grid.isBlocked(cx, cy)) return { cx, cy };
        }
        for (let cy = 0; cy < rows; cy++) {
            if (!this.grid.isBlocked(cx, cy)) return { cx, cy };
        }
        return null;
    }

    private inBounds(cx: number, cy: number): boolean {
        const { cols, rows } = this.grid.getDimensions();
        return cx >= 0 && cy >= 0 && cx < cols && cy < rows;
    }

    public destroy(): void {
        this.registry.events.off('changedata-buildKind');
        this.scene.input.off('pointerdown', this.handlePointerDown, this);
        this.scene.input.off('pointermove', this.updatePlacementPreview, this);
        this.scene.input.off('gameout');
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

        this.towers.destroy(true);
        this.walls.destroy(true);
        this.generators.destroy(true);
        this.campfires.destroy(true);
        this.forges.destroy(true);
        this.storages.destroy(true);
        this.barracks.destroy(true);

        this.previewGhost?.destroy();
        this.previewRangeGfx?.destroy();
    }
}