/**
 * Gestionnaire de sauvegarde localStorage
 * Gère la lecture et l'écriture des données dans le navigateur
 */

import type { GameSaveData, SavedBuilding, SavedAlly } from '../types/SaveData';

export class SaveManager {
  private static readonly SAVE_KEY = 'veilOfShadows_save';
  private static readonly SAVE_VERSION = 1;

  /**
   * Sauvegarde les données du jeu dans localStorage
   * @param registry Registre de données Phaser
   * @param buildingsData Liste des bâtiments à sauvegarder
   * @param alliesData Liste des alliés à sauvegarder
   */
  static save(registry: Phaser.Data.DataManager, buildingsData?: SavedBuilding[], alliesData?: SavedAlly[]): void {
    const autoWaveMode = (registry.get('autoWaveMode') as boolean) ?? false;
    const waveActive = (registry.get('waveActive') as boolean) ?? false;
    const currentWave = (registry.get('wave') as number) ?? 0;

    // Enregistrer le timestamp dès que le mode auto est actif
    // Même si une vague est en cours, on veut calculer la progression hors-ligne
    const timestamp = autoWaveMode ? Date.now() : undefined;

    const saveData: GameSaveData = {
      soulShards: (registry.get('soulShards') as number) ?? 100,
      maxSoulShards: (registry.get('maxSoulShards') as number) ?? 100,
      wave: currentWave,
      sanctuaryHP: (registry.get('sanctuaryHP') as number) ?? 5,
      towerCost: (registry.get('towerCost') as number) ?? 25,
      soulProductionRate: (registry.get('soulProductionRate') as number) ?? 0.5,
      soulProductionMultiplier: (registry.get('soulProductionMultiplier') as number) ?? 1.0,
      forgeCount: (registry.get('forgeCount') as number) ?? 0,
      barracksCount: (registry.get('barracksCount') as number) ?? 0,
      buildings: buildingsData ?? [],
      allies: alliesData ?? [],
      autoWaveMode: autoWaveMode,
      autoRecruitEnabled: (registry.get('autoRecruitEnabled') as boolean) ?? false,
      lastWaveCompletedTimestamp: timestamp,
      lastSaveTimestamp: Date.now(),
      version: this.SAVE_VERSION
    };

    try {
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
      console.log(
        '💾 Jeu sauvegardé !',
        'Âmes:', saveData.soulShards,
        '| Vague:', saveData.wave,
        '| Bâtiments:', saveData.buildings.length,
        '| Alliés:', (saveData.allies ?? []).length,
        '| Auto:', autoWaveMode,
        '| Active:', waveActive,
        '| Timestamp:', timestamp ? '✅' : '❌'
      );
    } catch (error) {
      console.error('❌ Erreur de sauvegarde:', error);
    }
  }

  /**
   * Charge la sauvegarde depuis localStorage
   * @returns Données sauvegardées ou null si aucune sauvegarde
   */
  static load(): GameSaveData | null {
    try {
      const saveString = localStorage.getItem(this.SAVE_KEY);
      if (!saveString) return null;

      const saveData = JSON.parse(saveString) as GameSaveData;

      // Vérifier la version
      if (saveData.version !== this.SAVE_VERSION) {
        console.warn('⚠️ Version de sauvegarde incompatible');
        return null;
      }

      // Initialiser buildings si la propriété n'existe pas (ancienne sauvegarde)
      if (!saveData.buildings) {
        console.warn('⚠️ Ancienne sauvegarde détectée - initialisation buildings: []');
        saveData.buildings = [];
      }
      
      // Initialiser allies si la propriété n'existe pas (ancienne sauvegarde)
      if (!saveData.allies) {
        console.warn('⚠️ Ancienne sauvegarde détectée - initialisation allies: []');
        saveData.allies = [];
      }

      // Initialiser autoRecruitEnabled si la propriété n'existe pas (ancienne sauvegarde)
      if (saveData.autoRecruitEnabled === undefined) {
        saveData.autoRecruitEnabled = false;
      }

      console.log('📂 Sauvegarde chargée ! Bâtiments:', saveData.buildings?.length ?? 0, '| Alliés:', saveData.allies?.length ?? 0);
      return saveData;
    } catch (error) {
      console.error('❌ Erreur de chargement:', error);
      return null;
    }
  }

  /**
   * Supprime la sauvegarde du localStorage
   */
  static delete(): void {
    localStorage.removeItem(this.SAVE_KEY);
    console.log('🗑️ Sauvegarde supprimée');
  }

  /**
   * Vérifie si une sauvegarde existe
   * @returns true si une sauvegarde existe
   */
  static exists(): boolean {
    return localStorage.getItem(this.SAVE_KEY) !== null;
  }

  /**
   * Récupère la clé de sauvegarde (utile pour debug)
   */
  static getSaveKey(): string {
    return this.SAVE_KEY;
  }

  /**
   * Récupère la version de sauvegarde
   */
  static getVersion(): number {
    return this.SAVE_VERSION;
  }
}
