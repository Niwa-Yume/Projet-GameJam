import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { EnemyManager } from './EnemyManager';

export class WaveManager {
    private scene: Phaser.Scene;
    private enemyManager: EnemyManager;
    private registry: Phaser.Data.DataManager; // CORRECTION

    private waveActive: boolean = false;
    private waveSpawning: boolean = false;
    private waveSpawnsRemaining: number = 0;
    private autoWaveMode: boolean = false;
    private nextWaveTimer?: Phaser.Time.TimerEvent;
    private enemyTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, enemyManager: EnemyManager) {
        this.scene = scene;
        this.enemyManager = enemyManager;
        this.registry = scene.registry;

        this.autoWaveMode = this.registry.get('autoWaveMode') ?? false;

        this.scene.game.events.on('start-wave', this.startNextWave, this);
        this.scene.game.events.on('toggle-autowave', this.toggleAutoWave, this);

        // CORRECTION: suppression de 'parent'
        this.registry.events.on('changedata-autoWaveMode', (_parent: any, value: boolean) => {
            this.autoWaveMode = value;
            console.log(`WaveManager: AutoWaveMode updated from registry to ${value}`);
            this.checkAutoStart();
        });

        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

        this.checkAutoStart();
    }

    private checkAutoStart(): void {
        const isWaveActive = this.registry.get('waveActive') ?? false;
        if (this.autoWaveMode && !isWaveActive && !this.nextWaveTimer) {
            console.log("WaveManager: Restoring auto-wave timer after load.");
            this.registry.set('nextWaveIn', 5);
            this.nextWaveTimer = this.scene.time.addEvent({
                delay: 5000,
                callback: this.startNextWave,
                callbackScope: this
            });
        }
    }

    public update(): void {
        if (this.nextWaveTimer && this.autoWaveMode && !this.waveActive) {
            this.registry.set('nextWaveIn', Math.ceil(this.nextWaveTimer.getRemaining() / 1000));
        }

        if (this.waveActive && !this.waveSpawning && this.enemyManager.getEnemyCount() === 0) {
            console.log("WaveManager: Conditions met to call endWave.");
            this.endWave();
        }
    }

    public startNextWave(): void {
        if (this.waveActive) return;
        if (this.nextWaveTimer) this.nextWaveTimer.remove(false);

        this.registry.set('nextWaveIn', 0);
        this.waveActive = true;
        this.registry.set('waveActive', true);

        const currentWave = (this.registry.get('wave') ?? 0) + 1;
        this.registry.set('wave', currentWave);

        const waveGroup = Math.floor((currentWave - 1) / 5);
        const speed = GameConstants.ENEMY_SPEED + (currentWave - 1) * 10 + waveGroup * 25;
        this.enemyManager.setSpeed(speed);

        const interval = Math.max(200, Math.max(300, 1000 - (currentWave - 1) * 40) - (waveGroup > 0 ? Math.max(0, 150 * waveGroup) : 0));
        const count = 10 + (currentWave - 1) * 2 + waveGroup * 5;

        this.waveSpawning = true;
        this.waveSpawnsRemaining = count;
        this.registry.set({ waveTotal: count, waveRemaining: count });

        this.enemyTimer = this.scene.time.addEvent({
            delay: interval,
            repeat: count - 1,
            callback: () => {
                this.enemyManager.spawnEnemy(currentWave, this.waveSpawnsRemaining--);
                if (this.waveSpawnsRemaining <= 0) this.waveSpawning = false;
            }
        });
    }

    private endWave(): void {
        console.log("WaveManager: endWave called.");
        this.waveActive = false;
        this.registry.set('waveActive', false);
        this.registry.set('waveRemaining', 0);

        const currentWave = this.registry.get('wave');
        let autoModeFromRegistry = this.registry.get('autoWaveMode') ?? false;
        console.log(`WaveManager: endWave: currentWave = ${currentWave}, autoModeFromRegistry = ${autoModeFromRegistry}`);

        if (currentWave >= 1 && !autoModeFromRegistry) {
            this.autoWaveMode = true;
            this.registry.set('autoWaveMode', true);
            autoModeFromRegistry = true;
            console.log("WaveManager: endWave: autoWaveMode forced to true after first wave.");
        }

        console.log(`WaveManager: endWave: autoWaveMode after check = ${autoModeFromRegistry}`);

        if (autoModeFromRegistry) {
            this.scene.game.events.emit('wave-ended-autowave');
            this.registry.set('nextWaveIn', 5);
            this.nextWaveTimer = this.scene.time.addEvent({ delay: 5000, callback: this.startNextWave, callbackScope: this });
            console.log("WaveManager: endWave: nextWaveTimer set for 5 seconds.");
        } else {
            console.log("WaveManager: endWave: autoWaveMode is false, not setting nextWaveTimer.");
        }
    }

    public toggleAutoWave(): void {
        this.autoWaveMode = !this.autoWaveMode;
        this.registry.set('autoWaveMode', this.autoWaveMode);
        if (!this.autoWaveMode && this.nextWaveTimer) {
            this.nextWaveTimer.remove(false);
            this.registry.set('nextWaveIn', 0);
        }
        console.log(`WaveManager: toggleAutoWave: autoWaveMode is now ${this.autoWaveMode}`);
    }

    public isWaveActive(): boolean {
        return this.waveActive;
    }

    public destroy(): void {
        console.log("WaveManager: Destroying...");
        this.scene.game.events.off('start-wave', this.startNextWave, this);
        this.scene.game.events.off('toggle-autowave', this.toggleAutoWave, this);
        if (this.nextWaveTimer) {
            this.nextWaveTimer.remove(false);
            this.nextWaveTimer = undefined;
        }
        if (this.enemyTimer) {
            this.enemyTimer.remove(false);
            this.enemyTimer = undefined;
        }
        this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
        console.log("WaveManager: Destroyed.");
    }
}