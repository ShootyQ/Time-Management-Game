// Web Audio API Retro Sound Effects (Zero external audio file dependencies)
class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.5;
        this.muted = false;
        this.sfxEnabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    playTone(freq, type = 'square', duration = 0.08, rampTo = null) {
        if (this.muted || !this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (rampTo !== null) {
            osc.frequency.exponentialRampToValueAtTime(rampTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(this.masterVolume * 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playClick() {
        this.playTone(880, 'square', 0.04);
    }

    playSelect() {
        this.playTone(440, 'triangle', 0.06, 880);
    }

    playCancel() {
        this.playTone(440, 'sawtooth', 0.08, 220);
    }

    playSirenBlip() {
        if (this.muted || !this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(950, this.ctx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(this.masterVolume * 0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.32);
    }
}

window.soundManager = new SoundManager();
