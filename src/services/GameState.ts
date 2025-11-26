/**
 * GameState: État global du jeu (Single Source of Truth)
 *
 * Responsabilités:
 * - Stockage centralisé des données de jeu
 * - Émission d'événements lors des changements
 * - Validation des modifications d'état
 *
 * Principe: Sépare DONNÉES (ici) du RENDU (Phaser) et de la LOGIQUE (Managers)
 */

export type GameStateData = {
  // Économie
  soulShards: number;
  maxSoulShards: number;
  totalSoulProduction: number;

  // Sanctuaire
  sanctuaryHP: number;
  maxSanctuaryHP: number;

  // Vagues
  wave: number;
  waveActive: boolean;
  waveTotal: number;
  waveRemaining: number;
  autoWaveMode: boolean;

  // Bâtiments - Compteurs
  generatorCount: number;
  campfireCount: number;
  forgeCount: number;
  storageCount: number;
  barracksCount: number;

  // Bâtiments - Coûts dynamiques
  towerCost: number;
  wallCost: number;
  generatorCost: number;
  campfireCost: number;
  forgeCost: number;
  storageCost: number;
  barracksCost: number;
  buildCost: number; // Coût du bâtiment actuellement sélectionné

  // UI State
  buildKind: 'tower' | 'wall' | 'generator' | 'campfire' | 'forge' | 'storage' | 'barracks';
};

export type GameStateEventMap = {
  'souls:changed': { current: number; max: number };
  'production:changed': { rate: number; generatorCount: number };
  'hp:changed': { current: number; max: number };
  'wave:changed': { wave: number };
  'wave:started': { wave: number };
  'wave:completed': { wave: number };
  'wave:progress': { remaining: number; total: number };
  'cost:changed': { kind: string; cost: number };
  'building:selected': { kind: GameStateData['buildKind'] };
};

export class GameState {
  private static instance: GameState;
  private state: GameStateData;
  private listeners: Map<keyof GameStateEventMap, Set<Function>> = new Map();

  private constructor() {
    // État initial par défaut
    this.state = {
      soulShards: 100,
      maxSoulShards: 100,
      totalSoulProduction: 0.5,

      sanctuaryHP: 5,
      maxSanctuaryHP: 5,

      wave: 0,
      waveActive: false,
      waveTotal: 0,
      waveRemaining: 0,
      autoWaveMode: false,

      generatorCount: 0,
      campfireCount: 0,
      forgeCount: 0,
      storageCount: 0,
      barracksCount: 0,

      towerCost: 20,
      wallCost: 10,
      generatorCost: 30,
      campfireCost: 35,
      forgeCost: 60,
      storageCost: 45,
      barracksCost: 70,
      buildCost: 25,

      buildKind: 'tower',
    };
  }

  /**
   * Singleton: Une seule instance de l'état global
   */
  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  /**
   * Récupère l'état complet (lecture seule)
   */
  public getState(): Readonly<GameStateData> {
    return { ...this.state };
  }

  /**
   * Récupère une valeur spécifique
   */
  public get<K extends keyof GameStateData>(key: K): GameStateData[K] {
    return this.state[key];
  }

  /**
   * Modifie l'état et émet les événements correspondants
   */
  public set<K extends keyof GameStateData>(key: K, value: GameStateData[K]): void {
    const oldValue = this.state[key];
    if (oldValue === value) return; // Pas de changement

    this.state[key] = value;

    // Émettre des événements spécifiques selon la clé modifiée
    this.emitRelatedEvents(key, value, oldValue);
  }

  /**
   * Modifie plusieurs valeurs en une seule fois
   */
  public setMany(updates: Partial<GameStateData>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key as keyof GameStateData, value as any);
    }
  }

  /**
   * Écoute un événement
   */
  public on<K extends keyof GameStateEventMap>(
    event: K,
    callback: (data: GameStateEventMap[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Retire un écouteur
   */
  public off<K extends keyof GameStateEventMap>(
    event: K,
    callback: (data: GameStateEventMap[K]) => void
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Émet un événement
   */
  public emit<K extends keyof GameStateEventMap>(event: K, data: GameStateEventMap[K]): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  /**
   * Réinitialise l'état (pour restart)
   */
  public reset(): void {
    this.state = {
      soulShards: 100,
      maxSoulShards: 100,
      totalSoulProduction: 0.5,
      sanctuaryHP: 5,
      maxSanctuaryHP: 5,
      wave: 0,
      waveActive: false,
      waveTotal: 0,
      waveRemaining: 0,
      autoWaveMode: false,
      generatorCount: 0,
      campfireCount: 0,
      forgeCount: 0,
      storageCount: 0,
      barracksCount: 0,
      towerCost: 25,
      wallCost: 5,
      generatorCost: 40,
      campfireCost: 35,
      forgeCost: 60,
      storageCost: 45,
      barracksCost: 70,
      buildCost: 25,
      buildKind: 'tower',
    };

    // Notifier le reset
    this.emit('souls:changed', { current: this.state.soulShards, max: this.state.maxSoulShards });
    this.emit('hp:changed', { current: this.state.sanctuaryHP, max: this.state.maxSanctuaryHP });
  }

  /**
   * Émet les événements appropriés selon la clé modifiée
   */
  private emitRelatedEvents<K extends keyof GameStateData>(
    key: K,
    newValue: GameStateData[K],
    oldValue: GameStateData[K]
  ): void {
    switch (key) {
      case 'soulShards':
      case 'maxSoulShards':
        this.emit('souls:changed', {
          current: this.state.soulShards,
          max: this.state.maxSoulShards,
        });
        break;

      case 'totalSoulProduction':
      case 'generatorCount':
        this.emit('production:changed', {
          rate: this.state.totalSoulProduction,
          generatorCount: this.state.generatorCount,
        });
        break;

      case 'sanctuaryHP':
        this.emit('hp:changed', {
          current: this.state.sanctuaryHP,
          max: this.state.maxSanctuaryHP,
        });
        break;

      case 'wave':
        this.emit('wave:changed', { wave: this.state.wave });
        break;

      case 'waveActive':
        if (newValue && !oldValue) {
          this.emit('wave:started', { wave: this.state.wave });
        } else if (!newValue && oldValue) {
          this.emit('wave:completed', { wave: this.state.wave });
        }
        break;

      case 'waveRemaining':
      case 'waveTotal':
        this.emit('wave:progress', {
          remaining: this.state.waveRemaining,
          total: this.state.waveTotal,
        });
        break;

      case 'buildKind':
        this.emit('building:selected', { kind: newValue as GameStateData['buildKind'] });
        // Mettre à jour buildCost selon le nouveau kind
        const costKey = `${newValue}Cost` as keyof GameStateData;
        this.state.buildCost = (this.state[costKey] as number) ?? 25;
        this.emit('cost:changed', { kind: newValue as string, cost: this.state.buildCost });
        break;

      case 'towerCost':
      case 'wallCost':
      case 'generatorCost':
      case 'campfireCost':
      case 'forgeCost':
      case 'storageCost':
      case 'barracksCost':
        // Émettre changement de coût
        const buildingType = key.replace('Cost', '');
        this.emit('cost:changed', { kind: buildingType, cost: newValue as number });
        // Si c'est le bâtiment actuel, update buildCost
        if (this.state.buildKind === buildingType) {
          this.state.buildCost = newValue as number;
        }
        break;
    }
  }
}

