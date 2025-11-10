/**
 * Système de sauvegarde et de persistance pour Veil of Shadows
 * Point d'entrée principal - orchestre les différents modules de sauvegarde
 */

// Ré-exporter les types pour compatibilité
export type { SavedBuilding, GameSaveData, OfflineProgressResult } from '../types/SaveData';

// Importer les modules
import { SaveManager } from './SaveManager';
import { OfflineProgressCalculator } from './OfflineProgressCalculator';
import { formatTimeElapsed } from './TimeFormatter';
import type { SavedBuilding, GameSaveData, OfflineProgressResult } from '../types/SaveData';

/**
 * Classe principale du système de sauvegarde
 * Agit comme une façade pour les différents modules
 */
export class SaveSystem {
  /**
   * Sauvegarde l'état actuel du jeu
   * @param registry Registre de données Phaser
   * @param buildingsData Liste des bâtiments à sauvegarder
   */
  static save(registry: Phaser.Data.DataManager, buildingsData?: SavedBuilding[]): void {
    SaveManager.save(registry, buildingsData);
  }

  /**
   * Charge la sauvegarde existante
   * @returns Données sauvegardées ou null
   */
  static load(): GameSaveData | null {
    return SaveManager.load();
  }

  /**
   * Calcule les gains hors-ligne depuis la dernière sauvegarde
   * @param saveData Données de la sauvegarde
   * @returns Résultats de la progression hors-ligne
   */
  static calculateOfflineProgress(saveData: GameSaveData): OfflineProgressResult {
    return OfflineProgressCalculator.calculate(saveData);
  }

  /**
   * Formate le temps écoulé en texte lisible
   * @param seconds Nombre de secondes
   * @returns Texte formaté (ex: "2h 30m", "5m 42s")
   */
  static formatTimeElapsed(seconds: number): string {
    return formatTimeElapsed(seconds);
  }

  /**
   * Supprime la sauvegarde
   */
  static deleteSave(): void {
    SaveManager.delete();
  }

  /**
   * Vérifie si une sauvegarde existe
   * @returns true si une sauvegarde existe
   */
  static hasSave(): boolean {
    return SaveManager.exists();
  }

  /**
   * Réinitialise complètement le jeu (supprime la sauvegarde et recharge la page)
   */
  static resetGame(): void {
    console.log('🔄 Réinitialisation complète du jeu...');
    SaveManager.delete();
    window.location.reload();
  }
}

