
import Phaser from 'phaser';
import { GameConstants } from '../scenes/GameConstants';
import { EnemyManager } from './EnemyManager';

export class WaveManager {
    private scene: Phaser.Scene;
    private enemyManager: EnemyManager;
    private registry: Phaser.Registry.RegistryPlugin;

    private waveActive: boolean = false;
    private waveSpawning: boolean = false;
    private waveSpawnsRemaining: number = 0;
    private autoWaveMode: boolean = false; // This local property should ideally stay in sync with registry
    private nextWaveTimer?: Phaser.Time.TimerEvent;
    private enemyTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, enemyManager: EnemyManager) {
        this.scene = scene;
        this.enemyManager = enemyManager;
        this.registry = scene.registry;

        // 1. Initialisation de base
        this.autoWaveMode = this.registry.get('autoWaveMode') ?? false;

        this.scene.game.events.on('start-wave', this.startNextWave, this);
        this.scene.game.events.on('toggle-autowave', this.toggleAutoWave, this);

        // --- CORRECTION A ---
        // Écoute les changements du registre (ex: quand la sauvegarde est chargée)
        // Si 'autoWaveMode' change dans le registre, on met à jour la variable locale
        this.registry.events.on('changedata-autoWaveMode', (parent: any, value: boolean) => {
            this.autoWaveMode = value;
            console.log(`WaveManager: AutoWaveMode updated from registry to ${value}`);
            // Si on charge le jeu, que l'auto est ON, et qu'aucune vague n'est active, on relance le cycle
            this.checkAutoStart();
        });

        // Register for scene shutdown to clean up timers
        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

        // --- CORRECTION B ---
        // Tente de démarrer le timer si le jeu vient d'être chargé
        this.checkAutoStart();
    }

    /**
     * Vérifie si on doit relancer le timer automatique au chargement
     */
    private checkAutoStart(): void {
        const isWaveActive = this.registry.get('waveActive') ?? false;
        // Si le mode auto est activé, qu'aucune vague n'est en cours, et qu'on a pas déjà un timer
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
        // console.log("WaveManager: update running. waveActive:", this.waveActive, "waveSpawning:", this.waveSpawning, "enemyCount:", this.enemyManager.getEnemyCount());

        if (this.nextWaveTimer && this.autoWaveMode && !this.waveActive) {
            this.registry.set('nextWaveIn', Math.ceil(this.nextWaveTimer.getRemaining() / 1000));
        }
        
        if (this.waveActive && !this.waveSpawning && this.enemyManager.getEnemyCount() === 0) {
            console.log("WaveManager: Conditions met to call endWave."); // New log
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
        // Always read autoWaveMode from registry to be sure
        let autoModeFromRegistry = this.registry.get('autoWaveMode') ?? false;
        console.log(`WaveManager: endWave: currentWave = ${currentWave}, autoModeFromRegistry = ${autoModeFromRegistry}`);

        // Logic to enable autoWaveMode after the first wave if it's not already on
        if (currentWave >= 1 && !autoModeFromRegistry) {
            this.autoWaveMode = true; // Update local property
            this.registry.set('autoWaveMode', true); // Update registry
            autoModeFromRegistry = true; // Update local variable for immediate use
            console.log("WaveManager: endWave: autoWaveMode forced to true after first wave.");
        }
        
        console.log(`WaveManager: endWave: autoWaveMode after check = ${autoModeFromRegistry}`);

        if (autoModeFromRegistry) { // Use the registry value
            this.scene.game.events.emit('wave-ended-autowave');
            this.registry.set('nextWaveIn', 5);
            // Correctly bind 'this' context for the callback
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
