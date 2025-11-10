/**
 * Gestionnaire de grille pour le pathfinding
 * Gère la grille de blocage pour les murs et la navigation
 */

import { GameConstants } from './GameConstants';

export class PathfindingGrid {
  private gridCols: number;
  private gridRows: number;
  private blocked: boolean[][];

  constructor(
    gameAreaX: number,
    gameAreaY: number,
    gameAreaW: number,
    gameAreaH: number
  ) {
    this.gridCols = Math.floor(gameAreaW / GameConstants.TILE_SIZE);
    this.gridRows = Math.floor(gameAreaH / GameConstants.TILE_SIZE);
    this.blocked = [];

    // Initialiser la grille
    for (let r = 0; r < this.gridRows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < this.gridCols; c++) {
        row.push(false);
      }
      this.blocked.push(row);
    }
  }

  /**
   * Vérifie si une cellule est bloquée
   */
  isBlocked(col: number, row: number): boolean {
    if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) {
      return true; // Hors limites = bloqué
    }
    return this.blocked[row][col];
  }

  /**
   * Bloque une cellule
   */
  block(col: number, row: number): void {
    if (row >= 0 && row < this.gridRows && col >= 0 && col < this.gridCols) {
      this.blocked[row][col] = true;
    }
  }

  /**
   * Débloque une cellule
   */
  unblock(col: number, row: number): void {
    if (row >= 0 && row < this.gridRows && col >= 0 && col < this.gridCols) {
      this.blocked[row][col] = false;
    }
  }

  /**
   * Convertit des coordonnées pixel en coordonnées grille
   */
  pixelToGrid(x: number, y: number, gameAreaX: number, gameAreaY: number): { col: number; row: number } {
    const localX = x - gameAreaX;
    const localY = y - gameAreaY;
    return {
      col: Math.floor(localX / GameConstants.TILE_SIZE),
      row: Math.floor(localY / GameConstants.TILE_SIZE)
    };
  }

  /**
   * Recalcule toute la grille à partir d'un groupe de murs
   */
  recomputeFromWalls(walls: Phaser.GameObjects.Group, gameAreaX: number, gameAreaY: number): void {
    // Réinitialiser
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        this.blocked[r][c] = false;
      }
    }

    // Marquer les murs
    walls.getChildren().forEach((wallObj) => {
      const wall = wallObj as Phaser.GameObjects.Rectangle;
      const { col, row } = this.pixelToGrid(wall.x, wall.y, gameAreaX, gameAreaY);
      this.block(col, row);
    });
  }

  /**
   * Récupère les dimensions de la grille
   */
  getDimensions(): { cols: number; rows: number } {
    return { cols: this.gridCols, rows: this.gridRows };
  }

  /**
   * Récupère la grille complète (pour debug ou pathfinding avancé)
   */
  getGrid(): boolean[][] {
    return this.blocked;
  }
}

