/**
 * Restaurateur de bâtiments depuis une sauvegarde
 * Recrée les bâtiments sauvegardés avec leurs propriétés
 */

import type { SavedBuilding } from '../types/SaveData';

export class BuildingRestorer {
  /**
   * Restaure tous les bâtiments depuis une liste sauvegardée
   * Appelle les callbacks de création appropriés pour chaque type
   */
  static restore(
    buildings: SavedBuilding[],
    callbacks: {
      createTower: (x: number, y: number, hp?: number, fireRateMul?: number, damageMul?: number) => void;
      createWall: (x: number, y: number, hp?: number) => void;
      createGenerator: (x: number, y: number, hp?: number, yieldMul?: number) => void;
      createCampfire: (x: number, y: number, hp?: number) => void;
      createForge: (x: number, y: number, hp?: number) => void;
      createStorage: (x: number, y: number, hp?: number, capInc?: number) => void;
      createBarracks: (x: number, y: number, hp?: number) => void;
    }
  ): void {
    console.log(`🏗️ Restauration de ${buildings.length} bâtiments...`);

    buildings.forEach((buildingData) => {
      const { type, x, y, hp, fireRateMul, damageMul, yieldMul, capInc } = buildingData;

      switch (type) {
        case 'tower':
          callbacks.createTower(x, y, hp, fireRateMul, damageMul);
          break;
        case 'wall':
          callbacks.createWall(x, y, hp);
          break;
        case 'generator':
          callbacks.createGenerator(x, y, hp, yieldMul);
          break;
        case 'campfire':
          callbacks.createCampfire(x, y, hp);
          break;
        case 'forge':
          callbacks.createForge(x, y, hp);
          break;
        case 'storage':
          callbacks.createStorage(x, y, hp, capInc);
          break;
        case 'barracks':
          callbacks.createBarracks(x, y, hp);
          break;
        default:
          console.warn(`⚠️ Type de bâtiment inconnu: ${type}`);
      }
    });

    console.log('✅ Restauration des bâtiments terminée !');
  }

  /**
   * Collecte tous les bâtiments actuels pour sauvegarde
   */
  static collect(groups: {
    towers: Phaser.GameObjects.Group;
    walls: Phaser.GameObjects.Group;
    generators: Phaser.GameObjects.Group;
    campfires: Phaser.GameObjects.Group;
    forges: Phaser.GameObjects.Group;
    storages: Phaser.GameObjects.Group;
    barracks: Phaser.GameObjects.Group;
  }): SavedBuilding[] {
    const buildings: SavedBuilding[] = [];

    // Tours
    groups.towers.getChildren().forEach((obj) => {
      const tower = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'tower',
        x: tower.x,
        y: tower.y,
        hp: tower.getData('hp'),
        maxHp: tower.getData('maxHp'),
        fireRateMul: tower.getData('fireRateMul'),
        damageMul: tower.getData('damageMul')
      });
    });

    // Murs
    groups.walls.getChildren().forEach((obj) => {
      const wall = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'wall',
        x: wall.x,
        y: wall.y,
        hp: wall.getData('hp'),
        maxHp: wall.getData('maxHp')
      });
    });

    // Générateurs
    groups.generators.getChildren().forEach((obj) => {
      const gen = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'generator',
        x: gen.x,
        y: gen.y,
        hp: gen.getData('hp'),
        maxHp: gen.getData('maxHp'),
        yieldMul: gen.getData('yieldMul')
      });
    });

    // Campfires
    groups.campfires.getChildren().forEach((obj) => {
      const campfire = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'campfire',
        x: campfire.x,
        y: campfire.y,
        hp: campfire.getData('hp'),
        maxHp: campfire.getData('maxHp')
      });
    });

    // Forges
    groups.forges.getChildren().forEach((obj) => {
      const forge = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'forge',
        x: forge.x,
        y: forge.y,
        hp: forge.getData('hp'),
        maxHp: forge.getData('maxHp')
      });
    });

    // Storages
    groups.storages.getChildren().forEach((obj) => {
      const storage = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'storage',
        x: storage.x,
        y: storage.y,
        hp: storage.getData('hp'),
        maxHp: storage.getData('maxHp'),
        capInc: storage.getData('capInc')
      });
    });

    // Barracks
    groups.barracks.getChildren().forEach((obj) => {
      const barrack = obj as Phaser.GameObjects.Rectangle;
      buildings.push({
        type: 'barracks',
        x: barrack.x,
        y: barrack.y,
        hp: barrack.getData('hp'),
        maxHp: barrack.getData('maxHp')
      });
    });

    return buildings;
  }
}

