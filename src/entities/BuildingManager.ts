/**
 * BuildingManager: Gestionnaire de bâtiments simplifié
 */

import { Building } from './Building';

export class BuildingManager {
  private static instance: BuildingManager;
  private buildings: Map<string, Building> = new Map();

  private constructor() {}

  public static getInstance(): BuildingManager {
    if (!BuildingManager.instance) {
      BuildingManager.instance = new BuildingManager();
    }
    return BuildingManager.instance;
  }

  public getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  public getBuildingsByType<T extends Building>(type: string): T[] {
    return this.getAllBuildings().filter(b => b.type === type) as T[];
  }

  public getActiveBuildings(): Building[] {
    return this.getAllBuildings().filter(b => b.getIsActive());
  }

  public getStats(): any {
    return {
      total: this.buildings.size,
      active: this.getActiveBuildings().length,
      byType: {
        tower: 0,
        wall: 0,
        generator: 0,
        campfire: 0,
        forge: 0,
        storage: 0,
        barracks: 0
      }
    };
  }

  public update(delta: number): void {
    this.buildings.forEach(b => {
      if (b.getIsActive()) {
        b.update(delta);
      }
    });
  }

  public reset(): void {
    this.buildings.clear();
  }
}

