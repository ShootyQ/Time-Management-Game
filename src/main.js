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

        // Canvas
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
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
        });

        this.seedInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                this.districtSeed = val;
                this.tickerDistrict.textContent = `#${this.districtSeed}`;
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

        this.renderMapScene();
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
        // Adjust canvas resolution
        this.canvas.width = 800;
        this.canvas.height = 480;
        this.renderMapScene();
    }

    renderMapScene() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Dark grass background
        ctx.fillStyle = '#14532d';
        ctx.fillRect(0, 0, w, h);

        // Grid lines (subtle)
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1;
        const gridSize = 48;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Horizontal Main Street
        ctx.fillStyle = '#27272a';
        ctx.fillRect(0, 200, w, 80);
        // White curb edges
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 202, w, 3);
        ctx.fillRect(0, 275, w, 3);
        // Yellow dashed center divider
        ctx.fillStyle = '#eab308';
        for (let x = 10; x < w; x += 36) {
            ctx.fillRect(x, 238, 20, 4);
        }

        // Vertical Avenue Intersection
        ctx.fillStyle = '#27272a';
        ctx.fillRect(360, 0, 80, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(362, 0, 3, h);
        ctx.fillRect(435, 0, 3, h);
        ctx.fillStyle = '#eab308';
        for (let y = 10; y < h; y += 36) {
            ctx.fillRect(398, y, 4, 20);
        }

        // Draw crosswalk zebra lines
        ctx.fillStyle = '#f8fafc';
        for (let y = 208; y < 274; y += 12) {
            ctx.fillRect(346, y, 10, 6);
            ctx.fillRect(444, y, 10, 6);
        }

        // Informational overlay badge on canvas
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(20, 20, 310, 70);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, 310, 70);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('DISPATCH RADAR // DISTRICT #' + this.districtSeed, 32, 42);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.fillText('Road Graph & Lots Ready for Phase 2', 32, 60);
        ctx.fillText('Click "EXIT TO MENU" to return', 32, 76);
    }
}

// Launch application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new GameApp();
});
