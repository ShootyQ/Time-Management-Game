// ========================================================
// CHRONOS DISPATCH - Phase 4 & 5: Timeline System, Incident Scheduler & Nudging
// Features:
// 1. Deterministic Seeded 08:00 AM - 09:00 AM Incident Schedule:
//    - Fires, Medical Calls, Bank Robberies, Chemical Leaks, School Surge, Pileups
// 2. Interactive Bottom Timeline Track with Live Playhead Cursor:
//    - Click any incident pill on the timeline to inspect & auto-select the best unit
//    - Drag incident pills left/right (or click +/-3m) using Nudge Tokens!
// 3. On-Map Emergency Rendering, Countdown Timers & Responder Resolution
// ========================================================

const INCIDENT_STATE = {
    SCHEDULED: 'SCHEDULED',
    ACTIVE: 'ACTIVE',
    RESOLVED: 'RESOLVED',
    FAILED: 'FAILED'
};

class TimelineManager {
    constructor() {
        this.world = null;
        this.seed = 1042;
        this.incidents = [];
        this.selectedIncident = null;
        this.draggingIncident = null;
    }

    initForWorld(world, seed) {
        this.world = world;
        this.seed = seed;
        this.prng = new PRNG(seed + 404);
        this.incidents = [];
        this.selectedIncident = null;

        this.generateSchedule();
        this.renderTimelineDOM();
    }

    generateSchedule() {
        if (!this.world || !this.world.lots || this.world.lots.length === 0) return;

        const findLot = (type) => this.world.lots.find(l => l.type === type);
        const houses = this.world.lots.filter(l => l.type === LOT_TYPE.RESIDENTIAL);
        const pickHouse = (idx) => houses.length > 0 ? houses[idx % houses.length] : this.world.lots[0];

        const diner = findLot(LOT_TYPE.COMMERCIAL_DINER) || pickHouse(0);
        const school = findLot(LOT_TYPE.CIVIC_SCHOOL) || pickHouse(1);
        const bank = findLot(LOT_TYPE.COMMERCIAL_BANK) || pickHouse(2);
        const supermarket = findLot(LOT_TYPE.COMMERCIAL_SUPERMARKET) || pickHouse(3);
        const warehouse = findLot(LOT_TYPE.INDUSTRIAL_WAREHOUSE) || pickHouse(4);
        const gas = findLot(LOT_TYPE.COMMERCIAL_GAS) || pickHouse(5);
        const houseA = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)));
        const houseB = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)) + 3);

        // Pick an intersection for the scheduled pileup
        const intersections = this.world.roadNodes.filter(n => {
            const rt = this.world.grid[n.row][n.col].roadType;
            return rt === '4WAY' || (rt && rt.startsWith('3WAY'));
        });
        const crashNode = intersections.length > 0
            ? intersections[this.prng.range(0, intersections.length - 1)]
            : (this.world.roadNodes[0] || { col: 10, row: 6 });

        const rawDefs = [
            {
                id: 'inc_1',
                minuteOffset: 4,
                title: 'Grease Fryer Fire',
                icon: '🔥',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: diner,
                immovable: false,
                durationSec: 110,
                damagePenalty: 3500
            },
            {
                id: 'inc_2',
                minuteOffset: 12,
                title: 'Cardiac Distress',
                icon: '🚑',
                color: '#10b981',
                reqUnit: 'unit_medic',
                reqLabel: 'MEDIC 2 [3]',
                lot: houseA,
                immovable: false,
                durationSec: 120,
                damagePenalty: 2000
            },
            {
                id: 'inc_3',
                minuteOffset: 19,
                title: 'School Bell Jam',
                icon: '🏫',
                color: '#f59e0b',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: school,
                immovable: true, // Fixed bell schedule!
                durationSec: 100,
                damagePenalty: 1500
            },
            {
                id: 'inc_4',
                minuteOffset: 27,
                title: 'Silent Bank Alarm',
                icon: '🚓',
                color: '#3b82f6',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: bank,
                immovable: false,
                durationSec: 110,
                damagePenalty: 5000
            },
            {
                id: 'inc_5',
                minuteOffset: 35,
                title: 'Intersection Pileup',
                icon: '💥',
                color: '#f97316',
                reqUnit: 'unit_tow',
                reqLabel: 'TOW 5 [5]',
                lot: null,
                roadCol: crashNode.col,
                roadRow: crashNode.row,
                immovable: false,
                durationSec: 130,
                damagePenalty: 2500
            },
            {
                id: 'inc_6',
                minuteOffset: 44,
                title: 'Chemical Drum Leak',
                icon: '⚠️',
                color: '#eab308',
                reqUnit: 'unit_chief',
                reqLabel: 'CHIEF 1 [4]',
                lot: warehouse,
                immovable: false,
                durationSec: 115,
                damagePenalty: 4500
            },
            {
                id: 'inc_7',
                minuteOffset: 52,
                title: 'Fuel Pump Blaze',
                icon: '🔥',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: gas,
                immovable: false,
                durationSec: 100,
                damagePenalty: 6000
            }
        ];

        this.incidents = rawDefs.map(d => ({
            ...d,
            baseMinute: d.minuteOffset,
            currentMinute: d.minuteOffset,
            nudged: false,
            state: INCIDENT_STATE.SCHEDULED,
            elapsedActiveSec: 0,
            resolveProgress: 0,
            resolveDuration: 4.0
        }));
    }

    formatMinute(min) {
        const clamped = Math.max(0, Math.min(59, Math.round(min)));
        return `08:${String(clamped).padStart(2, '0')}`;
    }

    // Spend 1 Nudge Token to shift an incident earlier or later by deltaMinutes
    nudgeIncident(inc, deltaMinutes) {
        if (!inc || inc.immovable || inc.state !== INCIDENT_STATE.SCHEDULED) return false;
        const app = window.gameApp;
        if (!app) return false;

        if (!inc.nudged && app.nudgeTokens <= 0) {
            if (window.soundManager) window.soundManager.playCancel();
            return false;
        }

        const currentClockMin = (app.inGameSeconds - 8 * 3600) / 60;
        const newMin = Math.max(Math.ceil(currentClockMin) + 1, Math.min(58, inc.currentMinute + deltaMinutes));
        if (newMin === inc.currentMinute) return false;

        if (!inc.nudged) {
            inc.nudged = true;
            app.nudgeTokens = Math.max(0, app.nudgeTokens - 1);
            if (app.hudTokens) app.hudTokens.textContent = `${app.nudgeTokens}/3`;
        }

        inc.currentMinute = newMin;
        if (window.soundManager) window.soundManager.playSelect();
        this.renderTimelineDOM();
        return true;
    }

    // Called every frame from GameApp loop
    update(dtSeconds, inGameSeconds, simSpeed = 1, isPaused = false) {
        this.updatePlayheadDOM(inGameSeconds);
        if (isPaused || !this.world) return;

        // Accelerate incident timers slightly so player sees incidents trigger within ~20-30s of real play
        const dt = Math.min(0.1, dtSeconds) * simSpeed;
        const currentShiftMin = (inGameSeconds - 8 * 3600) / 60;

        for (const inc of this.incidents) {
            if (inc.state === INCIDENT_STATE.SCHEDULED && currentShiftMin >= inc.currentMinute) {
                this.activateIncident(inc);
            } else if (inc.state === INCIDENT_STATE.ACTIVE) {
                inc.elapsedActiveSec += dt;

                // Check if a responder is on scene at this incident
                const vm = this.world.vehicleManager;
                if (vm) {
                    const targetC = inc.lot && inc.lot.facingRoad ? inc.lot.facingRoad.col : inc.roadCol;
                    const targetR = inc.lot && inc.lot.facingRoad ? inc.lot.facingRoad.row : inc.roadRow;

                    const unitOnScene = vm.responders.find(u =>
                        !u.inGarage &&
                        !u.bayMode &&
                        u.path.length === 0 &&
                        Math.abs(u.col - targetC) + Math.abs(u.row - targetR) <= 1
                    );

                    if (unitOnScene) {
                        unitOnScene.status = 'ON SCENE';
                        unitOnScene.sirenActive = true;
                        const bonus = unitOnScene.id === inc.reqUnit ? 1.35 : 0.85;
                        inc.resolveProgress += (dt * bonus) / inc.resolveDuration;

                        if (inc.resolveProgress >= 1.0) {
                            inc.state = INCIDENT_STATE.RESOLVED;
                            if (inc.lot) inc.lot.onFire = false;
                            if (window.soundManager) window.soundManager.playResolved();
                            this.renderTimelineDOM();
                            continue;
                        }
                    }
                }

                // Check if incident timer expired (Domino Failure!)
                if (inc.elapsedActiveSec >= inc.durationSec) {
                    inc.state = INCIDENT_STATE.FAILED;
                    if (inc.lot) inc.lot.onFire = false;
                    if (vm) {
                        vm.totalDamage += inc.damagePenalty;
                        vm.totalCasualties += 1;
                        vm.updateDamageHUD();
                    }
                    if (window.soundManager) window.soundManager.playCrash();
                    this.renderTimelineDOM();
                }
            }
        }
    }

    activateIncident(inc) {
        inc.state = INCIDENT_STATE.ACTIVE;
        if (inc.lot) {
            inc.lot.onFire = true;
        } else if (inc.roadCol !== undefined && this.world.vehicleManager) {
            this.world.vehicleManager.triggerScheduledCollisionAt(inc.roadCol, inc.roadRow);
        }

        if (window.soundManager) {
            window.soundManager.playSirenBlip();
        }
        this.renderTimelineDOM();
    }

    // Render active incident hazards on lots on the main canvas
    renderMapIncidents(ctx) {
        if (!this.world) return;
        const s = this.world.cellSize;
        const nowMs = performance.now();

        for (const inc of this.incidents) {
            if (inc.state !== INCIDENT_STATE.ACTIVE || !inc.lot) continue;

            const lot = inc.lot;
            const x = this.world.offsetX + lot.col * s;
            const y = this.world.offsetY + lot.row * s;
            const w = (lot.w || 1) * s;
            const h = (lot.h || 1) * s;
            const cx = x + w / 2;
            const cy = y + h / 2;

            ctx.save();
            // Pulsing emergency border around the lot
            const pulse = 0.5 + 0.4 * Math.sin(nowMs / 110);
            ctx.strokeStyle = inc.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

            // Animated rising smoke & hazard glow
            const smokeY = (nowMs / 22) % 18;
            ctx.fillStyle = `rgba(15, 23, 42, ${0.75 * pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy - 6 - smokeY, 8 + smokeY * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Countdown bar / Resolve bar above the lot
            const bw = Math.max(54, w - 6);
            const bh = 8;
            const bx = cx - bw / 2;
            const by = y - 10;

            ctx.fillStyle = '#090d16';
            ctx.fillRect(bx, by, bw, bh);

            if (inc.resolveProgress > 0) {
                ctx.fillStyle = '#10b981';
                ctx.fillRect(bx + 1, by + 1, Math.floor((bw - 2) * inc.resolveProgress), bh - 2);
            } else {
                const pctLeft = Math.max(0, 1 - inc.elapsedActiveSec / inc.durationSec);
                ctx.fillStyle = inc.color;
                ctx.fillRect(bx + 1, by + 1, Math.floor((bw - 2) * pctLeft), bh - 2);
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, bh);

            // Callout pill
            const tag = `${inc.icon} ${inc.reqLabel}`;
            const tw = tag.length * 5.5 + 10;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.fillRect(cx - tw / 2, by - 15, tw, 14);
            ctx.strokeStyle = inc.color;
            ctx.strokeRect(cx - tw / 2, by - 15, tw, 14);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            ctx.fillText(tag, cx - tw / 2 + 4, by - 5);

            ctx.restore();
        }
    }

    updatePlayheadDOM(inGameSeconds) {
        const playhead = document.getElementById('timeline-playhead');
        if (!playhead) return;
        const pct = Math.max(0, Math.min(100, ((inGameSeconds - 8 * 3600) / 3600) * 100));
        playhead.style.left = `${pct}%`;
    }

    renderTimelineDOM() {
        const track = document.getElementById('timeline-track');
        if (!track) return;

        // Preserve playhead & ticks, rebuild incident pills
        track.innerHTML = `
            <div class="timeline-ticks">
                <span>08:00</span>
                <span>08:10</span>
                <span>08:20</span>
                <span>08:30</span>
                <span>08:40</span>
                <span>08:50</span>
                <span>09:00</span>
            </div>
            <div class="timeline-playhead" id="timeline-playhead"></div>
        `;

        for (const inc of this.incidents) {
            const pct = (inc.currentMinute / 60) * 100;
            const pill = document.createElement('div');
            pill.className = `timeline-pill state-${inc.state.toLowerCase()} ${inc.nudged ? 'nudged' : ''}`;
            pill.style.left = `${pct}%`;
            pill.style.borderColor = inc.color;

            const nudgeControls = (!inc.immovable && inc.state === INCIDENT_STATE.SCHEDULED)
                ? `<span class="nudge-btn" data-dir="-3" title="Nudge Earlier (-3m)">◀</span>
                   <span class="nudge-btn" data-dir="3" title="Delay Incident (+3m)">▶</span>`
                : (inc.immovable ? `<span class="lock-icon" title="Fixed Schedule">🔒</span>` : '');

            pill.innerHTML = `
                <span class="pill-time">${this.formatMinute(inc.currentMinute)}</span>
                <span class="pill-title">${inc.icon} ${inc.title}</span>
                ${nudgeControls}
            `;

            pill.addEventListener('click', (e) => {
                if (e.target.dataset.dir) {
                    e.stopPropagation();
                    this.nudgeIncident(inc, parseInt(e.target.dataset.dir, 10));
                    return;
                }

                // Clicking an incident card selects the recommended unit & dispatches if active!
                if (this.world && this.world.vehicleManager) {
                    const vm = this.world.vehicleManager;
                    vm.selectUnitById(inc.reqUnit);
                    if (inc.lot) {
                        this.world.selectedLot = inc.lot;
                        vm.dispatchSelectedUnitToLot(inc.lot);
                    } else if (inc.roadCol !== undefined) {
                        vm.dispatchSelectedUnitToRoad(inc.roadCol, inc.roadRow);
                    }
                }
            });

            track.appendChild(pill);
        }

        if (window.gameApp) {
            this.updatePlayheadDOM(window.gameApp.inGameSeconds);
        }
    }
}

window.timelineManager = new TimelineManager();
