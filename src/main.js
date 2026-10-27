// ========================================================
// CHRONOS DISPATCH - Main Controller & Game State Machine
// ========================================================

const STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
};

class GameApp {
    constructor() {
        this.currentState = STATE.MENU;
        this.districtSeed = 1042;
        this.currentLoop = 1;
        this.nudgeTokens = 3;
        this.simSpeed = 1;
        this.isPaused = false;

        // In-game clock (starts at 08:00:00 AM)
        this.inGameSeconds = 8 * 3600; // 08:00:00 AM
        this.clockTimer = null;

        this.initDOM();
        this.initEventListeners();
        this.initCanvasPreview();
    }

    initDOM() {
        // Screens & Modals
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.settingsModal = document.getElementById('settings-modal');
        this.briefingModal = document.getElementById('briefing-modal');

        // Inputs & Labels
        this.seedInput = document.getElementById('seed-input');
        this.tickerDistrict = document.getElementById('ticker-district');
        this.menuClock = document.getElementById('menu-clock');
        this.hudClock = document.getElementById('hud-clock');
        this.hudLoop = document.getElementById('hud-loop');
        this.hudTokens = document.getElementById('hud-tokens');

        // Buttons
        this.btnStartShift = document.getElementById('btn-start-shift');
        this.btnRandomSeed = document.getElementById('btn-random-seed');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnSaveSettings = document.getElementById('btn-save-settings');
        this.btnBriefing = document.getElementById('btn-briefing');
        this.btnCloseBriefing = document.getElementById('btn-close-briefing');
        this.btnBriefingReady = document.getElementById('btn-briefing-ready');
        this.btnExitToMenu = document.getElementById('btn-exit-to-menu');
        this.btnPauseShift = document.getElementById('btn-pause-shift');

        // Settings toggles
        this.settingVolume = document.getElementById('setting-volume');
        this.settingSfx = document.getElementById('setting-sfx');
        this.settingCrt = document.getElementById('setting-crt');
        this.settingSpeed = document.getElementById('setting-speed');

        // Canvas & World
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.world = new World(this.canvas, this.districtSeed);

        // Start continuous render loop for smooth hover effects and vehicle animation
        this.startRenderLoop();
    }

    startRenderLoop() {
        const loop = () => {
            if (this.currentState === STATE.PLAYING && this.world) {
                this.world.render();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    initEventListeners() {
        // Start Shift
        this.btnStartShift.addEventListener('click', () => {
            window.soundManager.playSirenBlip();
            this.startShift();
        });

        // Seed Randomizer
        this.btnRandomSeed.addEventListener('click', () => {
            window.soundManager.playClick();
            this.districtSeed = Math.floor(1000 + Math.random() * 9000);
            this.seedInput.value = this.districtSeed;
            this.tickerDistrict.textContent = `#${this.districtSeed}`;
            if (this.world) this.world.generate(this.districtSeed);
        });

        this.seedInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                this.districtSeed = val;
                this.tickerDistrict.textContent = `#${this.districtSeed}`;
                if (this.world) this.world.generate(this.districtSeed);
            }
        });

        // Settings Modal
        this.btnSettings.addEventListener('click', () => {
            window.soundManager.playSelect();
            this.settingsModal.classList.remove('hidden');
        });

        const closeSettings = () => {
            window.soundManager.playClick();
            this.settingsModal.classList.add('hidden');
        };
        this.btnCloseSettings.addEventListener('click', closeSettings);
        this.btnSaveSettings.addEventListener('click', closeSettings);

        // Settings changes
        this.settingVolume.addEventListener('input', (e) => {
            window.soundManager.setVolume(e.target.value / 100);
        });

        this.settingSfx.addEventListener('change', (e) => {
            window.soundManager.sfxEnabled = e.target.checked;
            window.soundManager.playClick();
        });

        this.settingCrt.addEventListener('change', (e) => {
            document.body.classList.toggle('crt-off', !e.target.checked);
            window.soundManager.playClick();
        });

        this.settingSpeed.addEventListener('change', (e) => {
            this.simSpeed = parseInt(e.target.value, 10);
            window.soundManager.playClick();
        });

        // Briefing Modal
        this.btnBriefing.addEventListener('click', () => {
            window.soundManager.playSelect();
            this.briefingModal.classList.remove('hidden');
        });

        const closeBriefing = () => {
            window.soundManager.playClick();
            this.briefingModal.classList.add('hidden');
        };
        this.btnCloseBriefing.addEventListener('click', closeBriefing);
        this.btnBriefingReady.addEventListener('click', closeBriefing);

        // In-game Exit
        this.btnExitToMenu.addEventListener('click', () => {
            window.soundManager.playCancel();
            this.exitToMenu();
        });

        // In-game Pause
        this.btnPauseShift.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            window.soundManager.playClick();
            this.btnPauseShift.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
            this.btnPauseShift.style.borderColor = this.isPaused ? 'var(--accent-amber)' : 'var(--border-color)';
        });
    }

    startShift() {
        this.currentState = STATE.PLAYING;
        this.menuScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');

        this.inGameSeconds = 8 * 3600; // Reset to 8:00 AM
        this.isPaused = false;
        this.btnPauseShift.textContent = '⏸ PAUSE';
        this.btnPauseShift.style.borderColor = 'var(--border-color)';

        this.hudLoop.textContent = `#${this.currentLoop}`;
        this.hudTokens.textContent = `${this.nudgeTokens}/3`;
        this.updateClockDisplay();

        // Start clock tick loop
        if (this.clockTimer) clearInterval(this.clockTimer);
        this.clockTimer = setInterval(() => this.tick(), 1000 / this.simSpeed);

        if (this.world) this.world.render();
    }

    exitToMenu() {
        this.currentState = STATE.MENU;
        if (this.clockTimer) clearInterval(this.clockTimer);
        this.gameScreen.classList.add('hidden');
        this.menuScreen.classList.remove('hidden');
    }

    tick() {
        if (this.isPaused) return;

        this.inGameSeconds += 1;
        this.updateClockDisplay();

        // Check for 09:00:00 AM (End of 1-Hour Shift)
        if (this.inGameSeconds >= 9 * 3600) {
            this.endShift();
        }
    }

    updateClockDisplay() {
        const hours = Math.floor(this.inGameSeconds / 3600);
        const mins = Math.floor((this.inGameSeconds % 3600) / 60);
        const secs = this.inGameSeconds % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} AM`;
        this.hudClock.textContent = timeStr;
    }

    endShift() {
        clearInterval(this.clockTimer);
        window.soundManager.playSelect();
        alert(`SHIFT COMPLETED! (09:00 AM)\nLoop #${this.currentLoop} evaluated.\nPreparing Loop #${this.currentLoop + 1}...`);
        this.currentLoop += 1;
        this.startShift();
    }

    // Canvas Initializer & Rendering
    initCanvasPreview() {
        this.canvas.width = 800;
        this.canvas.height = 480;
    }
}

// Launch application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new GameApp();
});
