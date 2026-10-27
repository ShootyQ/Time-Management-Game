// ========================================================
// CHRONOS DISPATCH - Deterministic Seeded PRNG (Mulberry32)
// ========================================================

class PRNG {
    constructor(seed = 1042) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        if (typeof seed === 'string') {
            // Hash string into a 32-bit integer
            let h = 2166136261 >>> 0;
            for (let i = 0; i < seed.length; i++) {
                h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
            }
            seed = h;
        }
        this.s = seed >>> 0;
    }

    // Returns float in [0, 1)
    random() {
        let t = (this.s += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Returns integer in [min, max] inclusive
    range(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }

    // Pick random item from array
    choice(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(this.random() * arr.length)];
    }

    // Shuffle array in-place
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

window.PRNG = PRNG;
