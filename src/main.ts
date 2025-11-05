import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

// Configuration principale du jeu
// Zone totale: 1200x700 (map 800x600 au centre + marges UI)
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // Laisse Phaser choisir le meilleur moteur de rendu (WebGL ou Canvas)
    width: 1200, // Largeur totale avec marges UI
    height: 700, // Hauteur totale avec marges UI
    parent: 'app', // Conteneur DOM parent
    scene: [GameScene, UIScene], // Enregistre les deux scènes dans le jeu
    plugins: {
        global: [
            {
                key: 'rexUI',
                plugin: Phaser.Plugins.BasePlugin,
                start: false
            }
        ]
    },
    dom: {
        createContainer: true
    },
    physics: {
        default: 'arcade', // On activate le moteur physique "Arcade", simple et efficace.
        arcade: {
            gravity: { x: 0, y: 0 }, // x et y fournis pour respecter le type Vector2Like et éviter TS2741
            debug: false // Mettre 'true' pour voir les boîtes de collision.
        }
    },
    backgroundColor: '#0b0a09' // Fond très sombre pour l'ambiance dark fantasy
};

// Création d'une nouvelle instance du jeu avec notre configuration
new Phaser.Game(config);
