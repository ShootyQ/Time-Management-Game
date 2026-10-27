// ========================================================
// CHRONOS DISPATCH - Phase 4 & 5: Timeline System, Causal Domino Cascades & Nudging
// Features:
// 1. Deterministic Seeded 08:00 AM - 09:00 AM Incident Schedule:
//    - Fires, Medical Calls, Bank Robberies, Chemical Leaks, School Surge, Pileups
// 2. Interactive 2-Row Staggered Bottom Timeline Track with Live Playhead Cursor:
//    - Large, bold 13px cards staggered across 2 rows so cards NEVER overlap
//    - Click any incident pill on the timeline to inspect & auto-dispatch best unit
//    - Drag incident pills left/right OR click ◀ / ▶ buttons using Nudge Tokens!
// 3. Causal Domino Cascades ("The Butterfly Effect"):
//    - Unresolved root emergencies spawn secondary Domino Disasters!
//    - Resolving root emergencies snuffs out the future Domino branch & awards Prevented score!
// 4. Ambulance ER Patient Transport:
//    - Resolving medical calls with MEDIC 2 automatically transports patient to County General ER!
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
        this.dominoesPrevented = 0;
        this.bannerTimer = null;

        this.draggingInc = null;
        this.dragMoved = false;
        this.initDragHandlers();
    }

    initForWorld(world, seed) {
        this.world = world;
        this.seed = seed;
        this.prng = new PRNG(seed + 404);
        this.incidents = [];
        this.dominoesPrevented = 0;
        this.updatePreventedHUD();

        this.generateSchedule();
        this.renderTimelineDOM();
    }

    updatePreventedHUD() {
        const el = document.getElementById('hud-prevented');
        if (el) {
            el.textContent = String(this.dominoesPrevented);
        }
    }

    showAlertBanner(message, borderColor = '#f59e0b', durationMs = 4200) {
        const banner = document.getElementById('domino-alert-banner');
        if (!banner) return;
        banner.textContent = message;
        banner.style.borderColor = borderColor;
        banner.classList.remove('hidden');

        if (this.bannerTimer) clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => {
            banner.classList.add('hidden');
        }, durationMs);
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

        // Pick intersections for scheduled pileup & domino cascades
        const intersections = this.world.roadNodes.filter(n => {
            const rt = this.world.grid[n.row][n.col].roadType;
            return rt === '4WAY' || (rt && rt.startsWith('3WAY'));
        });
        const crashNode = intersections.length > 0
            ? intersections[this.prng.range(0, intersections.length - 1)]
            : (this.world.roadNodes[0] || { col: 10, row: 6 });
        const dominoCrashNode = intersections.length > 1
            ? intersections[(this.prng.range(0, intersections.length - 1) + 1) % intersections.length]
            : crashNode;

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
                durationSec: 45,
                damagePenalty: 3500,
                dominoSpec: {
                    id: 'dom_1',
                    delayMinutes: 4,
                    title: 'Grid Blackout Blaze',
                    icon: '⚡',
                    color: '#ef4444',
                    reqUnit: 'unit_fire',
                    reqLabel: 'ENGINE 4 [1]',
                    lot: houseB,
                    durationSec: 45,
                    damagePenalty: 4500
                }
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
                durationSec: 50,
                damagePenalty: 2500,
                requiresErTransport: true
            },
            {
                id: 'inc_3',
                minuteOffset: 20,
                title: 'School Bell Surge',
                icon: '🏫',
                color: '#f59e0b',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: school,
                immovable: true, // Fixed bell schedule!
                durationSec: 45,
                damagePenalty: 2000
            },
            {
                id: 'inc_4',
                minuteOffset: 28,
                title: 'Silent Bank Alarm',
                icon: '🚓',
                color: '#3b82f6',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: bank,
                immovable: false,
                durationSec: 45,
                damagePenalty: 5000,
                dominoSpec: {
                    id: 'dom_2',
                    delayMinutes: 4,
                    title: 'Getaway Chase Wreck',
                    icon: '💥',
                    color: '#f97316',
                    reqUnit: 'unit_tow',
                    reqLabel: 'TOW 5 [5]',
                    lot: null,
                    roadCol: dominoCrashNode.col,
                    roadRow: dominoCrashNode.row,
                    durationSec: 50,
                    damagePenalty: 4000
                }
            },
            {
                id: 'inc_5',
                minuteOffset: 36,
                title: 'Intersection Pileup',
                icon: '💥',
                color: '#f97316',
                reqUnit: 'unit_tow',
                reqLabel: 'TOW 5 [5]',
                lot: null,
                roadCol: crashNode.col,
                roadRow: crashNode.row,
                immovable: false,
                durationSec: 50,
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
                durationSec: 45,
                damagePenalty: 4500,
                dominoSpec: {
                    id: 'dom_3',
                    delayMinutes: 4,
                    title: 'Hazmat Vapor Fire',
                    icon: '☣️',
                    color: '#ef4444',
                    reqUnit: 'unit_fire',
                    reqLabel: 'ENGINE 4 [1]',
                    lot: supermarket,
                    durationSec: 45,
                    damagePenalty: 5500
                }
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
                durationSec: 45,
                damagePenalty: 6000
            }
        ];

        this.incidents = rawDefs.map(d => ({
            ...d,
            baseMinute: d.minuteOffset,
            currentMinute: d.minuteOffset,
            nudged: false,
            isDomino: false,
            state: INCIDENT_STATE.SCHEDULED,
            elapsedActiveSec: 0,
            resolveProgress: 0,
            resolveDuration: 3.5
        }));
    }

    formatMinute(min) {
        const clamped = Math.max(0, Math.min(59, Math.round(min)));
        return `08:${String(clamped).padStart(2, '0')}`;
    }

    // Spend 1 Nudge Token to shift an incident earlier or later by deltaMinutes (or to targetMinute)
    nudgeIncidentToMinute(inc, targetMinute) {
        if (!inc || inc.immovable || inc.state !== INCIDENT_STATE.SCHEDULED) return false;
        const app = window.gameApp;
        if (!app) return false;

        if (!inc.nudged && app.nudgeTokens <= 0) {
            this.showAlertBanner('⚠️ OUT OF NUDGE TOKENS! (0/3 Remaining)', '#ef4444', 2500);
            if (window.soundManager) window.soundManager.playCancel();
            return false;
        }

        const currentClockMin = (app.inGameSeconds - 8 * 3600) / 60;
        const newMin = Math.max(Math.ceil(currentClockMin) + 1, Math.min(58, Math.round(targetMinute)));
        if (newMin === inc.currentMinute) return false;

        if (!inc.nudged) {
            inc.nudged = true;
            app.nudgeTokens = Math.max(0, app.nudgeTokens - 1);
            if (app.hudTokens) app.hudTokens.textContent = `${app.nudgeTokens}/3`;
        }

        inc.currentMinute = newMin;
        if (window.soundManager) window.soundManager.playSelect();
        this.showAlertBanner(
            `⏳ TIMELINE NUDGED: "${inc.title}" shifted to ${this.formatMinute(inc.currentMinute)} AM`,
            '#f59e0b',
            2600
        );
        this.renderTimelineDOM();
        return true;
    }

    nudgeIncident(inc, deltaMinutes) {
        if (!inc) return false;
        return this.nudgeIncidentToMinute(inc, inc.currentMinute + deltaMinutes);
    }

    initDragHandlers() {
        window.addEventListener('mousemove', (e) => {
            if (!this.draggingInc) return;
            const track = document.getElementById('timeline-track');
            if (!track) return;
            const rect = track.getBoundingClientRect();
            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const targetMin = Math.round((relX / rect.width) * 60);
            if (Math.abs(targetMin - this.draggingInc.currentMinute) >= 1) {
                this.dragMoved = true;
                this.nudgeIncidentToMinute(this.draggingInc, targetMin);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggingInc) {
                setTimeout(() => {
                    this.draggingInc = null;
                    this.dragMoved = false;
                }, 40);
            }
        });
    }

    // Called every frame from GameApp loop
    update(dtSeconds, inGameSeconds, simSpeed = 1, isPaused = false) {
        this.updatePlayheadDOM(inGameSeconds);
        if (isPaused || !this.world) return;

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
                        const bonus = unitOnScene.id === inc.reqUnit ? 1.45 : 0.9;
                        inc.resolveProgress += (dt * bonus) / inc.resolveDuration;

                        if (inc.resolveProgress >= 1.0) {
                            this.resolveIncident(inc, unitOnScene);
                            continue;
                        }
                    }
                }

                // Check if incident timer expired (Domino Cascade Failure!)
                if (inc.elapsedActiveSec >= inc.durationSec) {
                    this.failIncident(inc, currentShiftMin);
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

        const locName = inc.lot ? inc.lot.name : `Intersection (${inc.roadCol}, ${inc.roadRow})`;
        this.showAlertBanner(
            `🚨 DISPATCH ALERT: ${inc.icon} ${inc.title} at ${locName} — Send ${inc.reqLabel}!`,
            inc.color,
            4000
        );

        if (window.soundManager) {
            window.soundManager.playSirenBlip();
        }
        this.renderTimelineDOM();
    }

    resolveIncident(inc, unitOnScene) {
        inc.state = INCIDENT_STATE.RESOLVED;
        if (inc.lot) inc.lot.onFire = false;

        // If this root incident had a Domino Cascade risk, preventing it awards a Domino Prevented bonus!
        if (inc.dominoSpec) {
            this.dominoesPrevented += 1;
            this.updatePreventedHUD();
            this.showAlertBanner(
                `⛓️ BUTTERFLY EFFECT: Resolved "${inc.title}" — Prevented Domino "${inc.dominoSpec.title}"!`,
                '#10b981',
                4200
            );
        } else {
            this.showAlertBanner(
                `✅ RESOLVED: ${inc.icon} ${inc.title} cleared by ${unitOnScene.callsign}!`,
                '#10b981',
                3000
            );
        }

        // If this was a medical call and MEDIC 2 is on scene, automatically transport patient to County General ER!
        const vm = this.world.vehicleManager;
        if (vm && (inc.requiresErTransport || unitOnScene.id === 'unit_medic')) {
            const medicUnit = unitOnScene.id === 'unit_medic'
                ? unitOnScene
                : vm.responders.find(u => u.id === 'unit_medic');
            if (medicUnit && !medicUnit.inGarage) {
                vm.returnUnitToBase(medicUnit, false, true);
            }
        }

        if (window.soundManager) window.soundManager.playResolved();
        this.renderTimelineDOM();
    }

    failIncident(inc, currentShiftMin) {
        inc.state = INCIDENT_STATE.FAILED;
        if (inc.lot) inc.lot.onFire = false;

        const vm = this.world.vehicleManager;
        if (vm) {
            vm.totalDamage += inc.damagePenalty;
            vm.totalCasualties += 1;
            vm.updateDamageHUD();
        }

        // Trigger Causal Domino Cascade if this root incident had a dominoSpec!
        if (inc.dominoSpec) {
            const spec = inc.dominoSpec;
            const spawnMin = Math.min(58, Math.ceil(currentShiftMin) + 1);
            const dominoInc = {
                id: spec.id,
                minuteOffset: spawnMin,
                baseMinute: spawnMin,
                currentMinute: spawnMin,
                title: spec.title,
                icon: spec.icon,
                color: spec.color,
                reqUnit: spec.reqUnit,
                reqLabel: spec.reqLabel,
                lot: spec.lot || null,
                roadCol: spec.roadCol,
                roadRow: spec.roadRow,
                immovable: true,
                isDomino: true,
                nudged: false,
                durationSec: spec.durationSec || 45,
                damagePenalty: spec.damagePenalty || 4000,
                state: INCIDENT_STATE.SCHEDULED,
                elapsedActiveSec: 0,
                resolveProgress: 0,
                resolveDuration: 3.5
            };
            this.incidents.push(dominoInc);
            this.activateIncident(dominoInc);
            this.showAlertBanner(
                `⛓️ DOMINO CASCADE TRIGGERED: "${inc.title}" failed -> Spawned "${spec.title}"!`,
                '#ef4444',
                5000
            );
        } else {
            this.showAlertBanner(
                `💥 INCIDENT FAILED: ${inc.icon} ${inc.title} (+1 Casualty, +$${inc.damagePenalty.toLocaleString()} Damage)`,
                '#ef4444',
                4000
            );
        }

        if (window.soundManager) window.soundManager.playCrash();
        this.renderTimelineDOM();
    }

    // Render active incident hazards on lots on the main canvas with large readable callouts
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
            ctx.lineWidth = 3.5;
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

            // Animated rising smoke & hazard glow
            const smokeY = (nowMs / 22) % 18;
            ctx.fillStyle = `rgba(15, 23, 42, ${0.78 * pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy - 6 - smokeY, 9 + smokeY * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // Countdown bar / Resolve bar above the lot
            const bw = Math.max(76, w - 4);
            const bh = 10;
            const bx = cx - bw / 2;
            const by = y - 12;

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
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);

            // Large High-Contrast Callout Pill
            const tag = `${inc.icon} ${inc.reqLabel}`;
            ctx.font = 'bold 12px monospace';
            const tw = Math.ceil(ctx.measureText(tag).width + 16);
            const th = 20;
            ctx.fillStyle = 'rgba(11, 17, 32, 0.96)';
            ctx.fillRect(cx - tw / 2, by - th - 2, tw, th);
            ctx.strokeStyle = inc.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - tw / 2, by - th - 2, tw, th);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(tag, cx - tw / 2 + 6, by - 7);

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

        // Preserve playhead & ticks, rebuild incident pills staggered across 2 rows
        track.innerHTML = `
            <div class="timeline-ticks">
                <span>08:00 AM</span>
                <span>08:10</span>
                <span>08:20</span>
                <span>08:30</span>
                <span>08:40</span>
                <span>08:50</span>
                <span>09:00 AM</span>
            </div>
            <div class="timeline-playhead" id="timeline-playhead"></div>
        `;

        const sorted = [...this.incidents].sort((a, b) => a.currentMinute - b.currentMinute);

        sorted.forEach((inc, idx) => {
            // Clamp visual left % between 6% and 94% so edge pills never clip off screen
            const rawPct = (inc.currentMinute / 60) * 100;
            const pct = Math.max(7, Math.min(93, rawPct));
            const rowClass = idx % 2 === 0 ? 'row-0' : 'row-1';

            const pill = document.createElement('div');
            pill.className = `timeline-pill ${rowClass} state-${inc.state.toLowerCase()} ${inc.nudged ? 'nudged' : ''}`;
            pill.style.left = `${pct}%`;
            pill.style.borderColor = inc.color;

            const dominoBadge = inc.dominoSpec
                ? `<span class="domino-tag" title="Causal Domino Risk: Ignored call triggers '${inc.dominoSpec.title}'!">⛓️</span>`
                : (inc.isDomino ? `<span class="domino-tag" title="Cascaded Domino Disaster!">⚡DOMINO</span>` : '');

            const nudgeControls = (!inc.immovable && inc.state === INCIDENT_STATE.SCHEDULED)
                ? `<span class="nudge-btn" data-dir="-3" title="Nudge Earlier (-3m)">◀</span>
                   <span class="nudge-btn" data-dir="3" title="Delay Incident (+3m)">▶</span>`
                : (inc.immovable ? `<span class="lock-icon" title="Fixed Schedule">🔒</span>` : '');

            pill.innerHTML = `
                <span class="pill-time">${this.formatMinute(inc.currentMinute)}</span>
                <span class="pill-title">${inc.icon} ${inc.title}</span>
                ${dominoBadge}
                ${nudgeControls}
            `;

            pill.addEventListener('mousedown', (e) => {
                if (e.target.dataset.dir) return;
                if (!inc.immovable && inc.state === INCIDENT_STATE.SCHEDULED) {
                    this.draggingInc = inc;
                    this.dragMoved = false;
                }
            });

            pill.addEventListener('click', (e) => {
                if (this.dragMoved) return;
                if (e.target.dataset.dir) {
                    e.stopPropagation();
                    this.nudgeIncident(inc, parseInt(e.target.dataset.dir, 10));
                    return;
                }

                // Clicking an incident card selects the recommended unit & dispatches immediately!
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
        });

        if (window.gameApp) {
            this.updatePlayheadDOM(window.gameApp.inGameSeconds);
        }
    }
}

window.timelineManager = new TimelineManager();
