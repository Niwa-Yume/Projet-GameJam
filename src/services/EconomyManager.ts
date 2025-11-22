/**
 * EconomyManager: Gestion de l'économie du jeu
 */

import { GameState } from './GameState';

export class EconomyManager {
  private static instance: EconomyManager;
  private gameState: GameState;

  private constructor() {
    this.gameState = GameState.getInstance();
  }

  public static getInstance(): EconomyManager {
    if (!EconomyManager.instance) {
      EconomyManager.instance = new EconomyManager();
    }
    return EconomyManager.instance;
  }

  public addSouls(amount: number): boolean {
    const current = this.gameState.get('soulShards');
    const max = this.gameState.get('maxSoulShards');
    if (current >= max) return false;
    this.gameState.set('soulShards', Math.min(current + amount, max));
    return true;
  }

  public spendSouls(amount: number): boolean {
    const current = this.gameState.get('soulShards');
    if (current < amount) return false;
    this.gameState.set('soulShards', current - amount);
    return true;
  }

  public canAfford(cost: number): boolean {
    return this.gameState.get('soulShards') >= cost;
  }

  public getBuildingCost(kind: string): number {
    const costKey = `${kind}Cost` as any;
    return (this.gameState.get(costKey) as number) || 25;
  }

  public purchaseBuilding(kind: string): boolean {
    const cost = this.getBuildingCost(kind);
    if (!this.canAfford(cost)) return false;
    if (!this.spendSouls(cost)) return false;

    const costKey = `${kind}Cost` as any;
    const currentCost = this.gameState.get(costKey) as number;
    const newCost = Math.floor(currentCost * 1.15);
    this.gameState.set(costKey, newCost);

    return true;
  }

  public tickProduction(deltaSeconds: number = 1): void {
    const production = this.gameState.get('totalSoulProduction');
    this.addSouls(production * deltaSeconds);
  }

  public reset(): void {
    console.log('EconomyManager reset');
  }
}

