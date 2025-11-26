import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { BuildingManager } from './BuildingManager';
import { AllyFactory } from '../factories/AllyFactory';
import { allyAttackEffect } from '../entities/Allies';
import { HealthComponent } from '../components/HealthComponent';

type EnemyGO = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class AllyManager {
    private scene: Phaser.Scene;
    private buildingManager: BuildingManager;
    private allies: Phaser.GameObjects.Group;
    private enemies: Phaser.GameObjects.Group;
    private sanctuaryPos: { x: number; y: number };
    private factory: AllyFactory;

    private trainingQueue: Array<'knight' | 'watcher' | 'arbalest'> = [];
    private activeTrainings: Phaser.Time.TimerEvent[] = [];

    public autoRecruitEnabled: boolean = false;
    private lastAutoRecruitTime: number = 0;
    private autoRecruitInterval: number = 1000;

    public autoUpgradeEnabled: boolean = false;
    private lastAutoUpgradeCheck: number = 0;
    private autoUpgradeInterval: number = 5000;

    constructor(scene: Phaser.Scene, buildingManager: BuildingManager, alliesGroup: Phaser.GameObjects.Group, enemiesGroup: Phaser.GameObjects.Group, sanctuaryPos: { x: number; y: number }) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this.allies = alliesGroup;
        this.enemies = enemiesGroup;
        this.sanctuaryPos = sanctuaryPos;
        this.factory = new AllyFactory(scene);

        this.autoRecruitEnabled = this.scene.registry.get('autoRecruitEnabled') ?? false;
        this.autoUpgradeEnabled = this.scene.registry.get('autoUpgradeEnabled') ?? false;

        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }

    public update(time: number): void {
        this.updateAlliesAI(time);
        this.updateIdleSystems(time);
        this.updateAllyVisuals();
    }

    private updateAllyVisuals(): void {
        for (const ally of this.allies.getChildren() as any[]) {
            const stars = ally.getData('stars');
            if (stars) stars.forEach((star: any, i: number) => star.setPosition(ally.x - 10 + (i * 8), ally.y - 30));
            const aura = ally.getData('aura');
            if (aura) aura.setPosition(ally.x, ally.y);
        }
    }

    public recruitUnit(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const def = GameConstants.UNIT_DEFS[kind];
        const barracksCount = (this.scene.registry.get('barracksCount') as number) ?? 0;
        const soulShards = (this.scene.registry.get('soulShards') as number) ?? 0;

        console.log(`AllyManager: recruitUnit called for ${kind}. Barracks: ${barracksCount}, Shards: ${soulShards}, Cost: ${def.cost}`);

        if (!def || barracksCount <= 0 || soulShards < def.cost) {
            console.log(`AllyManager: Cannot recruit ${kind}. Conditions not met.`);
            return;
        }
        this.scene.registry.set('soulShards', soulShards - def.cost);
        this.enqueueTraining(kind);
        this.scene.game.events.emit('notify', `Recrutement de ${kind} lancé !`, 'info');
    }

    private enqueueTraining(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const barracksCount = (this.scene.registry.get('barracksCount') as number) ?? 0;
        if (this.activeTrainings.length < barracksCount) {
            this.startTraining(kind);
        } else {
            this.trainingQueue.push(kind);
            console.log(`AllyManager: ${kind} enqueued. Queue length: ${this.trainingQueue.length}`);
        }
    }

    private startTraining(kind: 'knight' | 'watcher' | 'arbalest'): void {
        const def = GameConstants.UNIT_DEFS[kind];
        console.log(`AllyManager: Starting training for ${kind}. Duration: ${def.trainMs}ms`);
        const timer = this.scene.time.addEvent({ delay: def.trainMs, callback: () => {
                this.spawnAlly(kind);
                const idx = this.activeTrainings.indexOf(timer);
                if (idx >= 0) this.activeTrainings.splice(idx, 1);
                const next = this.trainingQueue.shift();
                if (next) this.startTraining(next);
                console.log(`AllyManager: Finished training for ${kind}. Queue length: ${this.trainingQueue.length}`);
            }});
        this.activeTrainings.push(timer);
    }

    private spawnAlly(kind: 'knight' | 'watcher' | 'arbalest'): void {
        let sx = this.sanctuaryPos.x, sy = this.sanctuaryPos.y;
        const b = this.buildingManager.barracks.getChildren() as Phaser.GameObjects.Rectangle[];
        if (b.length > 0) {
            const pick = Phaser.Utils.Array.GetRandom(b);
            const container = pick.getData('container') as Phaser.GameObjects.Container | undefined;
            sx = (container ? container.x : pick.x) + Phaser.Math.Between(-8, 8);
            sy = (container ? container.y : pick.y) + Phaser.Math.Between(-8, 8);
        }
        const allySprite = this.factory.createAlly(kind, sx, sy);
        this.allies.add(allySprite);
        const def = GameConstants.UNIT_DEFS[kind];
        allySprite.setData({ kind, nextAtk: 0, kills: 0, level: 1, damage: def.damage });
        new HealthComponent(allySprite, def.hp);
        console.log(`AllyManager: Spawned ${kind} at (${sx}, ${sy}). Total allies: ${this.allies.getLength()}`);
    }

    private updateAlliesAI(time: number): void {
        for (const a of this.allies.getChildren()) {
            const ally = a as any;
            // CORRECTION: Cast explicite pour la clé
            const kind = ally.getData('kind') as keyof typeof GameConstants.UNIT_DEFS;
            const def = GameConstants.UNIT_DEFS[kind];
            const target = this.findTarget(ally.x, ally.y, def.role === 'ranged' ? def.atkRange : 220);
            const body = ally.body as Phaser.Physics.Arcade.Body | undefined;
            if (target) {
                const d = Phaser.Math.Distance.Between(ally.x, ally.y, target.x, target.y);
                if (def.role === 'ranged') {
                    if (d <= def.atkRange) {
                        if (time >= (ally.getData('nextAtk') ?? 0)) {
                            this.scene.game.events.emit('fire-bullet', { x: ally.x, y: ally.y, target, type: 'ally' });
                            ally.setData('nextAtk', time + def.atkRateMs);
                            allyAttackEffect(this.scene, ally);
                        }
                        body?.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, ally.x, ally.y, target.x, target.y, def.speed);
                    }
                } else { // Melee
                    if (d <= def.atkRange + 6) {
                        if (time >= (ally.getData('nextAtk') ?? 0)) {
                            const enemyHealth = target.getData('health') as HealthComponent;
                            if (enemyHealth) {
                                enemyHealth.takeDamage(ally.getData('damage'));
                                // CORRECTION: suppression .id
                                console.log(`AllyManager: Melee ally ${ally.getData('kind')} attacked enemy. Damage: ${ally.getData('damage')}`);
                            }

                            ally.setData('nextAtk', time + def.atkRateMs);
                            ally.setData('kills', (ally.getData('kills') || 0) + 1);
                            allyAttackEffect(this.scene, ally);
                        }
                        body?.setVelocity(0, 0);
                    } else {
                        if (body) this.seek(body, ally.x, ally.y, target.x, target.y, def.speed);
                    }
                }
            } else { // No target
                if (Phaser.Math.Distance.Between(ally.x, ally.y, this.sanctuaryPos.x, this.sanctuaryPos.y) > 120) {
                    if (body) this.seek(body, ally.x, ally.y, this.sanctuaryPos.x, this.sanctuaryPos.y, def.speed * 0.9);
                } else {
                    body?.setVelocity(0, 0);
                }
            }
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

    private seek(body: Phaser.Physics.Arcade.Body, fromX: number, fromY: number, toX: number, toY: number, speed: number): void {
        const len = Math.hypot(toX - fromX, toY - fromY) || 1;
        body.setVelocity((toX - fromX) / len * speed, (toY - fromY) / len * speed);
    }

    private updateIdleSystems(time: number): void {
        if (this.autoRecruitEnabled && (time - this.lastAutoRecruitTime >= this.autoRecruitInterval)) {
            this.processAutoRecruit();
            this.lastAutoRecruitTime = time;
        }
        if (this.autoUpgradeEnabled && (time - this.lastAutoUpgradeCheck >= this.autoUpgradeInterval)) {
            this.processAutoUpgrade();
            this.lastAutoUpgradeCheck = time;
        }
    }

    public toggleAutoRecruit(): void {
        this.autoRecruitEnabled = !this.autoRecruitEnabled;
        this.scene.registry.set('autoRecruitEnabled', this.autoRecruitEnabled);
        this.scene.game.events.emit('notify', `Auto-recrutement ${this.autoRecruitEnabled ? 'activé' : 'désactivé'}`, this.autoRecruitEnabled ? 'success' : 'info');
        console.log(`AllyManager: Auto-recruit toggled to ${this.autoRecruitEnabled}`);
    }

    private processAutoRecruit(): void {
        const barracksCount = (this.scene.registry.get('barracksCount') as number) ?? 0;
        if (barracksCount <= 0) {
            return;
        }
        const randomType = Phaser.Utils.Array.GetRandom(['knight', 'watcher', 'arbalest']);
        const def = GameConstants.UNIT_DEFS[randomType as 'knight' | 'watcher' | 'arbalest'];
        const soulShards = (this.scene.registry.get('soulShards') as number) ?? 0;

        if (soulShards >= def.cost) {
            this.recruitUnit(randomType as 'knight' | 'watcher' | 'arbalest');
            console.log(`AllyManager: Auto-recruited ${randomType}.`);
        }
    }

    public toggleAutoUpgrade(): void {
        this.autoUpgradeEnabled = !this.autoUpgradeEnabled;
        this.scene.registry.set('autoUpgradeEnabled', this.autoUpgradeEnabled);
        this.scene.game.events.emit('notify', `Auto-upgrade ${this.autoUpgradeEnabled ? 'activé' : 'désactivé'}`, this.autoUpgradeEnabled ? 'success' : 'info');
        console.log(`AllyManager: Auto-upgrade toggled to ${this.autoUpgradeEnabled}`);
    }

    private processAutoUpgrade(): void {
        const shards = this.scene.registry.get('soulShards');
        for (const ally of this.allies.getChildren() as any[]) {
            const level = ally.getData('level') || 1;
            if (level < 5) {
                const nextLevel = (level + 1) as 2 | 3 | 4 | 5;
                const threshold = { 2: { kills: 10, cost: 10 }, 3: { kills: 30, cost: 25 }, 4: { kills: 60, cost: 50 }, 5: { kills: 100, cost: 100 } }[nextLevel];
                if ((ally.getData('kills') || 0) >= threshold.kills && shards >= threshold.cost) {
                    ally.setData('level', nextLevel);
                    this.scene.registry.set('soulShards', shards - threshold.cost);
                    this.applyVeteranBonus(ally, ally.getData('kind'), nextLevel);
                    this.showLevelUpEffect(ally, nextLevel);
                    console.log(`AllyManager: Auto-upgraded ${ally.getData('kind')} to level ${nextLevel}`);
                    return;
                }
            }
        }
    }

    private applyVeteranBonus(ally: any, kind: string, level: number): void {
        const def = GameConstants.UNIT_DEFS[kind as 'knight' | 'watcher' | 'arbalest'];
        if (!def) return;
        const hpMultipliers = { 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.7, 5: 2.0 };
        const dmgMultipliers = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.5, 5: 2.0 };

        const healthComponent = ally.getData('health') as HealthComponent;
        if (healthComponent) {
            const newMaxHP = def.hp * hpMultipliers[level as keyof typeof hpMultipliers];
            healthComponent.setMaxHp(newMaxHP);
            healthComponent.heal(newMaxHP); // Full heal on level up
        }

        ally.setData('damage', def.damage * dmgMultipliers[level as keyof typeof dmgMultipliers]);
    }

    private showLevelUpEffect(ally: any, level: number): void {
        const particles = this.scene.add.particles(ally.x, ally.y - 20, 'ash', { lifespan: 1000, speed: { min: 20, max: 50 }, scale: { start: 1, end: 0 }, tint: 0xffd700, quantity: 10, blendMode: 'ADD' });
        this.scene.time.delayedCall(1000, () => particles.destroy());
        this.updateAllyStars(ally, level);
    }

    private updateAllyStars(ally: any, level: number): void {
        (ally.getData('stars') || []).forEach((star: any) => star.destroy());
        const stars: Phaser.GameObjects.Text[] = [];
        for (let i = 0; i < level - 1; i++) {
            stars.push(this.scene.add.text(ally.x - 10 + (i * 8), ally.y - 30, '⭐', { fontSize: '12px', color: '#ffd700' }).setOrigin(0.5).setDepth(20));
        }
        ally.setData('stars', stars);
        if (level === 5) {
            const aura = this.scene.add.circle(ally.x, ally.y, 20, 0xffd700, 0.2).setStrokeStyle(2, 0xffd700, 0.5).setDepth(9);
            ally.setData('aura', aura);
            this.scene.tweens.add({ targets: aura, scaleX: 1.2, scaleY: 1.2, alpha: 0.4, duration: 1000, yoyo: true, repeat: -1 });
        }
    }

    public collectAlliesData(): any[] {
        const alliesData: any[] = [];
        if (!this.allies?.getChildren) return alliesData;
        for (const obj of this.allies.getChildren()) {
            const ally = obj as Phaser.GameObjects.Image;
            const healthComponent = ally.getData('health') as HealthComponent;
            alliesData.push({
                kind: ally.getData('kind'), x: ally.x, y: ally.y,
                level: ally.getData('level') || 1, kills: ally.getData('kills') || 0,
                hp: healthComponent ? healthComponent.getHp() : ally.getData('hp')
            });
        }
        return alliesData;
    }

    public restoreAllies(allies: any[]): void {
        for (const allyData of allies) {
            this.spawnAlly(allyData.kind);
            const newAlly = this.allies.getChildren()[this.allies.getLength() - 1] as Phaser.GameObjects.Image;
            newAlly.setPosition(allyData.x, allyData.y);
            newAlly.setData({ level: allyData.level, kills: allyData.kills });

            const healthComponent = newAlly.getData('health') as HealthComponent;
            if (healthComponent && typeof healthComponent.setMaxHp === 'function') {
                const def = GameConstants.UNIT_DEFS[allyData.kind as 'knight' | 'watcher' | 'arbalest'];
                if (def) {
                    const hpMultipliers = { 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.7, 5: 2.0 };
                    const maxHP = def.hp * hpMultipliers[allyData.level as keyof typeof hpMultipliers];
                    healthComponent.setMaxHp(maxHP);

                    if (allyData.hp !== undefined) {
                        healthComponent.setHp(allyData.hp);
                    }
                }
            }

            this.updateAllyStars(newAlly, allyData.level);
        }
    }

    public destroy(): void {
        console.log("AllyManager: Destroying...");
        this.activeTrainings.forEach(timer => timer.remove(false));
        this.activeTrainings = [];
        this.trainingQueue = [];
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        console.log("AllyManager: Destroyed.");
    }
}