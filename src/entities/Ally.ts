/**
 * Ally: Entité Allié (recrue)
 *
 * Responsabilités:
 * - Patrouiller automatiquement
 * - Combattre les ennemis
 * - Se soigner aux feux de camp
 * - Mourir et respawn à la caserne
 */

export type AllyType = 'knight' | 'watcher' | 'arbalest';

export interface AllyStats {
  hp: number;
  maxHp: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  range: number;
}

export interface AllyConfig {
  type: AllyType;
  x: number;
  y: number;
  barracksId: string; // ID de la caserne d'origine
}

export abstract class Ally {
  public readonly id: string;
  public readonly type: AllyType;
  public readonly barracksId: string;

  // Position
  public x: number;
  public y: number;

  // Stats
  protected hp: number;
  protected maxHp: number;
  protected damage: number;
  protected attackSpeed: number; // Attaques par seconde
  protected moveSpeed: number;
  protected range: number;

  // État
  protected isAlive: boolean = true;
  protected currentTarget?: any; // Ennemi ciblé
  protected lastAttackTime: number = 0;

  // IA
  protected state: 'idle' | 'patrol' | 'chase' | 'attack' | 'retreat' = 'patrol';
  protected patrolPoint: { x: number; y: number };

  // Référence au sprite
  public sprite?: Phaser.GameObjects.GameObject;

  constructor(config: AllyConfig) {
    this.id = `${config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type;
    this.barracksId = config.barracksId;
    this.x = config.x;
    this.y = config.y;

    // Point de patrouille initial
    this.patrolPoint = { x: config.x, y: config.y };

    // Stats seront définies dans les classes enfants
    this.hp = 100;
    this.maxHp = 100;
    this.damage = 10;
    this.attackSpeed = 1;
    this.moveSpeed = 60;
    this.range = 50;
  }

  /**
   * Récupère les stats actuelles
   */
  public getStats(): AllyStats {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      damage: this.damage,
      attackSpeed: this.attackSpeed,
      moveSpeed: this.moveSpeed,
      range: this.range
    };
  }

  /**
   * Inflige des dégâts
   */
  public takeDamage(damage: number): boolean {
    if (!this.isAlive) return true;

    this.hp = Math.max(0, this.hp - damage);

    if (this.hp <= 0) {
      this.die();
      return true;
    }

    return false;
  }

  /**
   * Soigne l'allié
   */
  public heal(amount: number): void {
    if (!this.isAlive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Vérifie si peut attaquer
   */
  public canAttack(currentTime: number): boolean {
    if (!this.isAlive) return false;
    const attackDelay = 1000 / this.attackSpeed;
    return currentTime - this.lastAttackTime >= attackDelay;
  }

  /**
   * Enregistre une attaque
   */
  public attack(currentTime: number): number {
    this.lastAttackTime = currentTime;
    return this.damage;
  }

  /**
   * Définit la cible
   */
  public setTarget(target: any): void {
    this.currentTarget = target;
    this.state = 'chase';
  }

  /**
   * Nettoie la cible
   */
  public clearTarget(): void {
    this.currentTarget = undefined;
    this.state = 'patrol';
  }

  /**
   * Vérifie si l'allié est en vie
   */
  public getIsAlive(): boolean {
    return this.isAlive;
  }

  /**
   * Meurt
   */
  protected die(): void {
    this.isAlive = false;
    this.state = 'idle';
    this.onDeath();
  }

  /**
   * Respawn à la caserne
   */
  public respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.isAlive = true;
    this.state = 'patrol';
    this.clearTarget();
    console.log(`♻️ ${this.getDisplayName()} respawn`);
  }

  /**
   * Définit un point de patrouille
   */
  public setPatrolPoint(x: number, y: number): void {
    this.patrolPoint = { x, y };
  }

  /**
   * Récupère la distance à un point
   */
  public getDistanceTo(x: number, y: number): number {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update de l'IA (à appeler 60x/sec)
   */
  public update(delta: number, enemies: any[]): void {
    if (!this.isAlive) return;

    this.updateAI(delta, enemies);
  }

  /**
   * IA de l'allié
   */
  protected updateAI(delta: number, enemies: any[]): void {
    switch (this.state) {
      case 'patrol':
        this.patrolBehavior(delta);
        // Chercher des ennemis proches
        const nearestEnemy = this.findNearestEnemy(enemies);
        if (nearestEnemy) {
          this.setTarget(nearestEnemy);
        }
        break;

      case 'chase':
        if (!this.currentTarget || !this.currentTarget.active) {
          this.clearTarget();
          break;
        }

        const distance = this.getDistanceTo(this.currentTarget.x, this.currentTarget.y);

        if (distance <= this.range) {
          this.state = 'attack';
        } else if (distance > 300) {
          // Trop loin, retour en patrouille
          this.clearTarget();
        }
        break;

      case 'attack':
        if (!this.currentTarget || !this.currentTarget.active) {
          this.clearTarget();
          break;
        }

        const attackDist = this.getDistanceTo(this.currentTarget.x, this.currentTarget.y);
        if (attackDist > this.range) {
          this.state = 'chase';
        }
        break;

      case 'retreat':
        // Se replier vers la caserne si HP < 30%
        if (this.hp > this.maxHp * 0.5) {
          this.state = 'patrol';
        }
        break;
    }

    // Retraite automatique si faible HP
    if (this.hp < this.maxHp * 0.3 && this.state !== 'retreat') {
      this.state = 'retreat';
      this.clearTarget();
    }
  }

  /**
   * Comportement de patrouille
   */
  protected patrolBehavior(_delta: number): void {
    // Se déplacer vers le point de patrouille
    const distance = this.getDistanceTo(this.patrolPoint.x, this.patrolPoint.y);

    if (distance > 20) {
      // Déplacement simple (sera géré visuellement dans GameScene)
    } else {
      // Arrivé au point, choisir un nouveau point aléatoire
      this.patrolPoint = {
        x: this.x + Phaser.Math.Between(-100, 100),
        y: this.y + Phaser.Math.Between(-100, 100)
      };
    }
  }

  /**
   * Trouve l'ennemi le plus proche
   */
  protected findNearestEnemy(enemies: any[]): any {
    let nearest: any = null;
    let minDistance = 200; // Distance de détection

    enemies.forEach(enemy => {
      if (!enemy.active) return;

      const distance = this.getDistanceTo(enemy.x, enemy.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    });

    return nearest;
  }

  public abstract getDisplayName(): string;
  protected abstract onDeath(): void;
}

/**
 * Knight: Chevalier (tank mêlée)
 */
export class Knight extends Ally {
  constructor(config: AllyConfig) {
    super(config);
    this.maxHp = 150;
    this.hp = 150;
    this.damage = 20;
    this.attackSpeed = 0.8; // Plus lent mais puissant
    this.moveSpeed = 50;
    this.range = 40; // Mêlée
  }

  public getDisplayName(): string {
    return 'Chevalier';
  }

  protected onDeath(): void {
    console.log(`⚔️ Chevalier tombé au combat`);
  }
}

/**
 * Watcher: Veilleur (DPS mêlée rapide)
 */
export class Watcher extends Ally {
  constructor(config: AllyConfig) {
    super(config);
    this.maxHp = 80;
    this.hp = 80;
    this.damage = 12;
    this.attackSpeed = 1.5; // Rapide
    this.moveSpeed = 80; // Très mobile
    this.range = 35;
  }

  public getDisplayName(): string {
    return 'Veilleur';
  }

  protected onDeath(): void {
    console.log(`🗡️ Veilleur éliminé`);
  }
}

/**
 * Arbalest: Arbalétrier (distance)
 */
export class Arbalest extends Ally {
  constructor(config: AllyConfig) {
    super(config);
    this.maxHp = 60;
    this.hp = 60;
    this.damage = 25;
    this.attackSpeed = 0.6; // Lent mais puissant
    this.moveSpeed = 40; // Lent
    this.range = 180; // Longue portée
  }

  public getDisplayName(): string {
    return 'Arbalétrier';
  }

  protected onDeath(): void {
    console.log(`🏹 Arbalétrier abattu`);
  }
}

