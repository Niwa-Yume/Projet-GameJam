
import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { BuildingManager } from './BuildingManager';

export class EconomyManager {
    private scene: Phaser.Scene;
    private registry: Phaser.Registry.RegistryPlugin;
    private buildingManager: BuildingManager;

    private soulProductionRate: number = 0.5;
    private soulProductionMultiplier: number = 1.0;
    private passiveSoulTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, buildingManager: BuildingManager) {
        this.scene = scene;
        this.registry = scene.registry;
        this.buildingManager = buildingManager;

        this.soulProductionRate = this.registry.get('soulProductionRate') ?? GameConstants.PASSIVE_SOUL_RATE;
        this.soulProductionMultiplier = this.registry.get('soulProductionMultiplier') ?? 1.0;

        this.startPassiveSoulProduction();
        
        this.scene.game.events.on('enemy-killed', this.onEnemyKilled, this);
        this.scene.game.events.on('generator-changed', this.updateSoulProductionDisplay, this);
        
        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scene.game.events.off('enemy-killed', this.onEnemyKilled, this);
            this.scene.game.events.off('generator-changed', this.updateSoulProductionDisplay, this);
            if (this.passiveSoulTimer) this.passiveSoulTimer.remove(false);
        });
    }

    private onEnemyKilled(isBoss: boolean): void {
        const currentWave = this.registry.get('wave');
        let reward = GameConstants.SHARD_REWARD + Math.floor((currentWave - 1) * 1.5) + Math.floor(currentWave / 5) * 5;
        if (isBoss) reward *= GameConstants.BOSS_REWARD_MULTIPLIER;
        this.addShards(reward);
    }

    public addShards(delta: number): void {
        const cur = (this.registry.get('soulShards') as number) ?? 0;
        const max = (this.registry.get('maxSoulShards') as number) ?? 100;
        this.registry.set('soulShards', Phaser.Math.Clamp(cur + delta, 0, max));
    }

    private startPassiveSoulProduction(): void {
        this.passiveSoulTimer = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.addShards(this.calculateTotalSoulProduction());
                this.updateSoulProductionDisplay();
            },
        });
    }

    private calculateTotalSoulProduction(): number {
        const generatorCount = this.buildingManager.generators.getLength();
        if (generatorCount === 0) {
            return this.soulProductionRate * this.soulProductionMultiplier;
        }
        let totalProduction = 0;
        for (const obj of this.buildingManager.generators.getChildren()) {
            const gen = obj as Phaser.GameObjects.Rectangle;
            totalProduction += this.soulProductionRate * ((gen.getData('yieldMul') as number) ?? 1) * this.soulProductionMultiplier;
        }
        return totalProduction;
    }

    private updateSoulProductionDisplay(): void {
        this.registry.set('generatorCount', this.buildingManager.generators.getLength());
        this.registry.set('totalSoulProduction', this.calculateTotalSoulProduction());
    }
    
    public upgradeSoulProduction(multiplier: number): void {
        this.soulProductionMultiplier = multiplier;
        this.registry.set('soulProductionMultiplier', multiplier);
    }

    public increaseSoulProductionRate(delta: number): void {
        this.soulProductionRate += delta;
        this.registry.set('soulProductionRate', this.soulProductionRate);
    }
}
