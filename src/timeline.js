// ========================================================
// CHRONOS DISPATCH - Phase 4, 5 & 6: Auto-Response, Early-Warning Radar,
// Risky Time-Shifting, Causal Domino Cascades & 16-Bit Incident Animations
// ========================================================

const INCIDENT_STATE = {
    HIDDEN: 'HIDDEN',       // Unknown until 6 in-game minutes before trigger!
    INCOMING: 'INCOMING',   // Early-Warning Radar window (can be nudged/moved to another time!)
    ACTIVE: 'ACTIVE',       // Emergency in progress — units AUTO-DISPATCH if available!
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

        // Track incidents discovered across loops for the same seed
        this.discoveredBySeed = {};

        this.draggingInc = null;
        this.dragMoved = false;

        this.fxSprites = {};
        this.loadFxSprites();
        this.initDragHandlers();
    }

    loadFxSprites() {
        const files = [
            'fx_fire_1', 'fx_fire_2', 'fx_fire_3',
            'fx_police_1', 'fx_police_2',
            'fx_medical_1', 'fx_medical_2',
            'fx_hazmat_1', 'fx_hazmat_2'
        ];
        for (const name of files) {
            const img = new Image();
            img.src = `assets/fx/${name}.png`;
            img.onload = () => {
                this.fxSprites[name] = img;
            };
        }
    }

    initForWorld(world, seed) {
        this.world = world;
        this.seed = seed;
        this.prng = new PRNG(seed + 404);
        this.incidents = [];
        this.dominoesPrevented = 0;
        if (!this.discoveredBySeed[seed]) {
            this.discoveredBySeed[seed] = new Set();
        }
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
        const houseB = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)) + 2);
        const houseC = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)) + 5);
        const houseD = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)) + 8);
        const houseE = pickHouse(this.prng.range(0, Math.max(1, houses.length - 1)) + 11);

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

        // 13 High-Pace Seeded Emergencies across 08:00 - 09:00 AM (1 in-game min = 3 real seconds!)
        // First emergency erupts at 08:01 AM (only 3 real seconds into the shift!)
        const rawDefs = [
            {
                id: 'inc_1',
                minuteOffset: 1,
                title: 'House Kitchen Fire',
                icon: '🔥',
                fxType: 'FIRE',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: houseA,
                immovable: false,
                durationSec: 26,
                damagePenalty: 3500
            },
            {
                id: 'inc_2',
                minuteOffset: 4,
                title: 'Diner Hold-Up',
                icon: '🚓',
                fxType: 'POLICE',
                color: '#3b82f6',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: diner,
                immovable: false,
                durationSec: 26,
                damagePenalty: 3000
            },
            {
                id: 'inc_3',
                minuteOffset: 7,
                title: 'Attic Electrical Blaze',
                icon: '🔥',
                fxType: 'FIRE',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: houseC,
                immovable: false,
                durationSec: 26,
                damagePenalty: 4000,
                dominoSpec: {
                    id: 'dom_1',
                    delayMinutes: 3,
                    title: 'Grid Blackout Fire',
                    icon: '⚡',
                    fxType: 'FIRE',
                    color: '#ef4444',
                    reqUnit: 'unit_fire',
                    reqLabel: 'ENGINE 4 [1]',
                    lot: houseD,
                    durationSec: 25,
                    damagePenalty: 4500
                }
            },
            {
                id: 'inc_4',
                minuteOffset: 11,
                title: 'Cardiac Emergency',
                icon: '🚑',
                fxType: 'MEDICAL',
                color: '#10b981',
                reqUnit: 'unit_medic',
                reqLabel: 'MEDIC 2 [3]',
                lot: houseB,
                immovable: false,
                durationSec: 28,
                damagePenalty: 2500,
                requiresErTransport: true
            },
            {
                id: 'inc_5',
                minuteOffset: 16,
                title: 'Diner Fryer Inferno',
                icon: '🔥',
                fxType: 'FIRE',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: diner,
                immovable: false,
                durationSec: 26,
                damagePenalty: 3800
            },
            {
                id: 'inc_6',
                minuteOffset: 21,
                title: 'School Bell Surge',
                icon: '🏫',
                fxType: 'POLICE',
                color: '#f59e0b',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: school,
                immovable: true, // Fixed public schedule — always known!
                alwaysKnown: true,
                durationSec: 26,
                damagePenalty: 2000
            },
            {
                id: 'inc_7',
                minuteOffset: 25,
                title: 'Armed Bank Heist',
                icon: '🚓',
                fxType: 'POLICE',
                color: '#3b82f6',
                reqUnit: 'unit_police',
                reqLabel: 'UNIT 101 [2]',
                lot: bank,
                immovable: false,
                durationSec: 26,
                damagePenalty: 5000,
                dominoSpec: {
                    id: 'dom_2',
                    delayMinutes: 3,
                    title: 'Getaway Chase Wreck',
                    icon: '💥',
                    fxType: 'POLICE',
                    color: '#f97316',
                    reqUnit: 'unit_tow',
                    reqLabel: 'TOW 5 [5]',
                    lot: null,
                    roadCol: dominoCrashNode.col,
                    roadRow: dominoCrashNode.row,
                    durationSec: 28,
                    damagePenalty: 4000
                }
            },
            {
                id: 'inc_8',
                minuteOffset: 30,
                title: 'Collapse at Market',
                icon: '🚑',
                fxType: 'MEDICAL',
                color: '#10b981',
                reqUnit: 'unit_medic',
                reqLabel: 'MEDIC 2 [3]',
                lot: supermarket,
                immovable: false,
                durationSec: 28,
                damagePenalty: 3000,
                requiresErTransport: true
            },
            {
                id: 'inc_9',
                minuteOffset: 35,
                title: 'Intersection Pileup',
                icon: '💥',
                fxType: 'CRASH',
                color: '#f97316',
                reqUnit: 'unit_tow',
                reqLabel: 'TOW 5 [5]',
                lot: null,
                roadCol: crashNode.col,
                roadRow: crashNode.row,
                immovable: false,
                durationSec: 28,
                damagePenalty: 2500
            },
            {
                id: 'inc_10',
                minuteOffset: 40,
                title: 'Garage Roof Blaze',
                icon: '🔥',
                fxType: 'FIRE',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: houseE,
                immovable: false,
                durationSec: 26,
                damagePenalty: 3500
            },
            {
                id: 'inc_11',
                minuteOffset: 45,
                title: 'Chemical Drum Leak',
                icon: '⚠️',
                fxType: 'HAZMAT',
                color: '#eab308',
                reqUnit: 'unit_chief',
                reqLabel: 'CHIEF 1 [4]',
                lot: warehouse,
                immovable: false,
                durationSec: 26,
                damagePenalty: 4500,
                dominoSpec: {
                    id: 'dom_3',
                    delayMinutes: 3,
                    title: 'Hazmat Vapor Blaze',
                    icon: '☣️',
                    fxType: 'FIRE',
                    color: '#ef4444',
                    reqUnit: 'unit_fire',
                    reqLabel: 'ENGINE 4 [1]',
                    lot: supermarket,
                    durationSec: 26,
                    damagePenalty: 5500
                }
            },
            {
                id: 'inc_12',
                minuteOffset: 50,
                title: 'Fuel Pump Inferno',
                icon: '🔥',
                fxType: 'FIRE',
                color: '#ef4444',
                reqUnit: 'unit_fire',
                reqLabel: 'ENGINE 4 [1]',
                lot: gas,
                immovable: false,
                durationSec: 26,
                damagePenalty: 6000
            },
            {
                id: 'inc_13',
                minuteOffset: 54,
                title: 'Critical Trauma Call',
                icon: '🚑',
                fxType: 'MEDICAL',
                color: '#10b981',
                reqUnit: 'unit_medic',
                reqLabel: 'MEDIC 2 [3]',
                lot: houseD,
                immovable: false,
                durationSec: 26,
                damagePenalty: 3500,
                requiresErTransport: true
            }
        ];

        const knownSet = this.discoveredBySeed[this.seed] || new Set();

        this.incidents = rawDefs.map(d => {
            // Revealed if within first 6 minutes of 08:00 AM, or fixed public schedule, or remembered from prior loop!
            const isKnown = d.minuteOffset <= 6 || d.alwaysKnown || knownSet.has(d.id);
            if (isKnown) knownSet.add(d.id);

            return {
                ...d,
                baseMinute: d.minuteOffset,
                currentMinute: d.minuteOffset,
                nudged: false,
                isDomino: false,
                rememberedFromPriorLoop: knownSet.has(d.id) && d.minuteOffset > 6 && !d.alwaysKnown,
                state: isKnown ? INCIDENT_STATE.INCOMING : INCIDENT_STATE.HIDDEN,
                elapsedActiveSec: 0,
                resolveProgress: 0,
                resolveDuration: 4.0
            };
        });
    }

    formatMinute(min) {
        const clamped = Math.max(0, Math.min(59, Math.round(min)));
        return `08:${String(clamped).padStart(2, '0')}`;
    }

    // Spend 1 Nudge Token to shift an INCOMING incident to another time!
    // Risk: Because future HIDDEN incidents aren't revealed until 6m before they happen,
    // delaying an incident can land it right on top of another hidden call for the same unit!
    nudgeIncidentToMinute(inc, targetMinute) {
        if (!inc || inc.immovable || inc.state !== INCIDENT_STATE.INCOMING) return false;
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

        // Check if moving it to newMin puts it dangerously close (within 5 mins) to a HIDDEN or INCOMING call for the same unit!
        const collisionRisk = this.incidents.find(other =>
            other !== inc &&
            other.reqUnit === inc.reqUnit &&
            other.state !== INCIDENT_STATE.RESOLVED &&
            other.state !== INCIDENT_STATE.FAILED &&
            Math.abs(other.currentMinute - newMin) <= 5
        );

        if (collisionRisk && collisionRisk.state === INCIDENT_STATE.HIDDEN) {
            this.showAlertBanner(
                `⏳ MOVED "${inc.title}" to ${this.formatMinute(newMin)} AM — ⚠️ DANGER: Unknown future timeline slot!`,
                '#f59e0b',
                3500
            );
        } else if (collisionRisk) {
            this.showAlertBanner(
                `⚠️ OVERLAP WARNING! "${inc.title}" at ${this.formatMinute(newMin)} clashes with "${collisionRisk.title}" (${inc.reqLabel})!`,
                '#ef4444',
                3800
            );
        } else {
            this.showAlertBanner(
                `⏳ TIMELINE NUDGED: "${inc.title}" rescheduled to ${this.formatMinute(inc.currentMinute)} AM`,
                '#38bdf8',
                2800
            );
        }

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
        let domNeedsUpdate = false;

        for (const inc of this.incidents) {
            // 1. Reveal HIDDEN incidents 6 in-game minutes right before they happen!
            if (inc.state === INCIDENT_STATE.HIDDEN && currentShiftMin >= inc.currentMinute - 6) {
                inc.state = INCIDENT_STATE.INCOMING;
                if (this.discoveredBySeed[this.seed]) {
                    this.discoveredBySeed[this.seed].add(inc.id);
                }
                const locName = inc.lot ? inc.lot.name : `Intersection (${inc.roadCol}, ${inc.roadRow})`;
                this.showAlertBanner(
                    `📡 INCOMING CALL IN 6m (${this.formatMinute(inc.currentMinute)}): ${inc.icon} ${inc.title} at ${locName} — Nudge/Drag to Delay!`,
                    '#38bdf8',
                    4200
                );
                if (window.soundManager) window.soundManager.playClick();
                domNeedsUpdate = true;
            }

            // 2. Activate INCOMING incidents when the clock reaches their currentMinute -> AUTO-DISPATCH!
            if (inc.state === INCIDENT_STATE.INCOMING && currentShiftMin >= inc.currentMinute) {
                this.activateIncident(inc);
                domNeedsUpdate = true;
            } else if (inc.state === INCIDENT_STATE.ACTIVE) {
                inc.elapsedActiveSec += dt;

                // Check if a responder is on scene at this incident
                const vm = this.world.vehicleManager;
                if (vm) {
                    const targetC = inc.lot && inc.lot.facingRoad ? inc.lot.facingRoad.col : inc.roadCol;
                    const targetR = inc.lot && inc.lot.facingRoad ? inc.lot.facingRoad.row : inc.roadRow;

                    // If the required unit just became free in garage/returning while this incident is still unattended, auto-dispatch it!
                    const reqResponder = vm.responders.find(u => u.id === inc.reqUnit);
                    if (reqResponder && vm.isUnitFreeForAutoDispatch(reqResponder)) {
                        this.autoDispatchResponderToIncident(inc);
                    }

                    const unitOnScene = vm.responders.find(u =>
                        !u.inGarage &&
                        !u.bayMode &&
                        u.path.length === 0 &&
                        Math.abs(u.col - targetC) + Math.abs(u.row - targetR) <= 1
                    );

                    if (unitOnScene) {
                        unitOnScene.status = 'ON SCENE';
                        unitOnScene.sirenActive = true;
                        inc.responderUnit = unitOnScene;
                        const bonus = unitOnScene.id === inc.reqUnit ? 1.4 : 0.85;
                        inc.resolveProgress += (dt * bonus) / inc.resolveDuration;

                        if (inc.resolveProgress >= 1.0) {
                            this.resolveIncident(inc, unitOnScene);
                            domNeedsUpdate = true;
                            continue;
                        }
                    } else {
                        inc.responderUnit = null;
                    }
                }

                // Check if incident timer expired (Domino Cascade Failure!)
                if (inc.elapsedActiveSec >= inc.durationSec) {
                    this.failIncident(inc, currentShiftMin);
                    domNeedsUpdate = true;
                }
            }
        }

        if (domNeedsUpdate) {
            this.renderTimelineDOM();
        }
    }

    autoDispatchResponderToIncident(inc) {
        if (!this.world || !this.world.vehicleManager) return false;
        const vm = this.world.vehicleManager;
        const unit = vm.responders.find(u => u.id === inc.reqUnit);
        if (!unit) return false;

        if (vm.isUnitFreeForAutoDispatch(unit)) {
            if (inc.lot && inc.lot.facingRoad) {
                return vm.dispatchUnit(unit, inc.lot.facingRoad.col, inc.lot.facingRoad.row, inc.lot, false);
            } else if (inc.roadCol !== undefined) {
                return vm.dispatchUnit(unit, inc.roadCol, inc.roadRow, null, false);
            }
        }
        return false;
    }

    activateIncident(inc) {
        inc.state = INCIDENT_STATE.ACTIVE;
        if (this.discoveredBySeed[this.seed]) {
            this.discoveredBySeed[this.seed].add(inc.id);
        }

        if (inc.lot) {
            inc.lot.onFire = true;
        } else if (inc.roadCol !== undefined && this.world.vehicleManager) {
            this.world.vehicleManager.triggerScheduledCollisionAt(inc.roadCol, inc.roadRow);
        }

        // Attempt AUTO-DISPATCH of the required responder!
        const dispatched = this.autoDispatchResponderToIncident(inc);
        const locName = inc.lot ? inc.lot.name : `Intersection (${inc.roadCol}, ${inc.roadRow})`;

        if (dispatched) {
            this.showAlertBanner(
                `🚨 AUTO-DISPATCH: ${inc.reqLabel} responding to ${inc.icon} ${inc.title} at ${locName}!`,
                inc.color,
                4000
            );
        } else {
            this.showAlertBanner(
                `⚠️ UNIT BUSY / OVERBOOKED! ${inc.reqLabel} tied up — ${inc.icon} "${inc.title}" at ${locName} is UNATTENDED!`,
                '#ef4444',
                5000
            );
        }

        if (window.soundManager) {
            window.soundManager.playSirenBlip();
        }
        this.renderTimelineDOM();
    }

    resolveIncident(inc, unitOnScene) {
        inc.state = INCIDENT_STATE.RESOLVED;
        inc.responderUnit = null;
        if (inc.lot) inc.lot.onFire = false;

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

        // Auto-return or ER patient transport after resolving!
        const vm = this.world.vehicleManager;
        if (vm) {
            if (inc.requiresErTransport || unitOnScene.id === 'unit_medic') {
                // MEDIC 2 transports patient to County General Hospital ER!
                vm.returnUnitToBase(unitOnScene, false, true);
            } else {
                // Fire, Police, Chief automatically check for another active call or return to station bay!
                vm.returnUnitToBase(unitOnScene, false, false);
            }
        }

        if (window.soundManager) window.soundManager.playResolved();
        this.renderTimelineDOM();
    }

    failIncident(inc, currentShiftMin) {
        inc.state = INCIDENT_STATE.FAILED;
        inc.responderUnit = null;
        if (inc.lot) inc.lot.onFire = false;

        const vm = this.world.vehicleManager;
        if (vm) {
            vm.totalDamage += inc.damagePenalty;
            vm.totalCasualties += 1;
            vm.updateDamageHUD();
        }

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
                fxType: spec.fxType || 'FIRE',
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
                state: INCIDENT_STATE.INCOMING,
                elapsedActiveSec: 0,
                resolveProgress: 0,
                resolveDuration: 4.0
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

    // ========================================================
    // RICH 16-BIT PIXEL ART VISUALS & ANIMATIONS FOR FIRES, POLICE, MEDICAL & HAZMAT
    // ========================================================
    renderMapIncidents(ctx) {
        if (!this.world) return;
        const s = this.world.cellSize;
        const nowMs = performance.now();

        for (const inc of this.incidents) {
            // 1. Render Early-Warning Radar Ring on buildings with an INCOMING alert within 6 minutes
            if (inc.state === INCIDENT_STATE.INCOMING && inc.lot && !inc.alwaysKnown) {
                const app = window.gameApp;
                const currentShiftMin = app ? (app.inGameSeconds - 8 * 3600) / 60 : 0;
                const minsUntil = Math.max(0, Math.ceil(inc.currentMinute - currentShiftMin));
                if (minsUntil <= 6) {
                    const lot = inc.lot;
                    const x = this.world.offsetX + lot.col * s;
                    const y = this.world.offsetY + lot.row * s;
                    const w = (lot.w || 1) * s;
                    const h = (lot.h || 1) * s;
                    const cx = x + w / 2;

                    ctx.save();
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([6, 4]);
                    ctx.lineDashOffset = -Math.floor(nowMs / 40);
                    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
                    ctx.setLineDash([]);

                    const tag = `📡 IN ${minsUntil}m: ${inc.icon} DRAG TIMELINE`;
                    ctx.font = 'bold 11px monospace';
                    const tw = Math.ceil(ctx.measureText(tag).width + 14);
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                    ctx.fillRect(cx - tw / 2, y - 22, tw, 18);
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(cx - tw / 2, y - 22, tw, 18);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillText(tag, cx - tw / 2 + 6, y - 9);
                    ctx.restore();
                }
                continue;
            }

            if (inc.state !== INCIDENT_STATE.ACTIVE || !inc.lot) continue;

            const lot = inc.lot;
            const x = this.world.offsetX + lot.col * s;
            const y = this.world.offsetY + lot.row * s;
            const w = (lot.w || 1) * s;
            const h = (lot.h || 1) * s;
            const cx = x + w / 2;
            const cy = y + h / 2;

            ctx.save();

            // 2. Type-Specific Visuals & 16-Bit Sprite Animations!
            if (inc.fxType === 'FIRE') {
                this.renderFireIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs);
            } else if (inc.fxType === 'POLICE') {
                this.renderPoliceIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs);
            } else if (inc.fxType === 'MEDICAL') {
                this.renderMedicalIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs);
            } else {
                this.renderHazmatIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs);
            }

            // 3. Countdown bar / Resolve bar above the lot
            const bw = Math.max(78, w - 4);
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

            // 4. High-Contrast Callout Pill
            const statusText = inc.responderUnit ? `🛠️ ${inc.responderUnit.callsign}` : `${inc.icon} ${inc.reqLabel}`;
            ctx.font = 'bold 12px monospace';
            const tw = Math.ceil(ctx.measureText(statusText).width + 16);
            const th = 20;
            ctx.fillStyle = 'rgba(11, 17, 32, 0.96)';
            ctx.fillRect(cx - tw / 2, by - th - 2, tw, th);
            ctx.strokeStyle = inc.responderUnit ? '#10b981' : inc.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - tw / 2, by - th - 2, tw, th);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(statusText, cx - tw / 2 + 6, by - 7);

            ctx.restore();
        }
    }

    renderFireIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs) {
        const pulse = 0.55 + 0.4 * Math.sin(nowMs / 95);
        // Fiery orange-red heat glow around structure
        ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * pulse})`;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.strokeStyle = Math.floor(nowMs / 110) % 2 === 0 ? '#ef4444' : '#f97316';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        // Billowing dark smoke plumes rising from roof
        for (let i = 0; i < 3; i++) {
            const cycle = ((nowMs / 18) + i * 11) % 32;
            const sx = cx + Math.sin(nowMs / 200 + i * 2) * (w * 0.22);
            const sy = cy - 4 - cycle;
            const sr = 6 + cycle * 0.28;
            ctx.fillStyle = `rgba(30, 41, 59, ${Math.max(0.1, 0.78 - cycle / 36)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw multi-frame 16-bit pixel art Fire Sprites across the roof/windows
        const frameIdx = (Math.floor(nowMs / 110) % 3) + 1;
        const fireSprite = this.fxSprites[`fx_fire_${frameIdx}`];
        const flameSize = Math.floor(s * 0.68);
        if (fireSprite && fireSprite.complete) {
            ctx.drawImage(fireSprite, cx - flameSize / 2, cy - flameSize / 2, flameSize, flameSize);
            if (w > s * 1.2) {
                const frameIdx2 = ((frameIdx) % 3) + 1;
                const fireSprite2 = this.fxSprites[`fx_fire_${frameIdx2}`] || fireSprite;
                ctx.drawImage(fireSprite2, cx - w * 0.26 - flameSize / 2, cy - flameSize * 0.4, flameSize * 0.85, flameSize * 0.85);
                ctx.drawImage(fireSprite2, cx + w * 0.24 - flameSize / 2, cy - flameSize * 0.35, flameSize * 0.85, flameSize * 0.85);
            }
        }

        // Active Fire Engine High-Pressure Water Cannon Stream when Responder is ON SCENE!
        if (inc.responderUnit && this.world.vehicleManager) {
            const unitPos = this.world.vehicleManager.getVehicleWorldXY(inc.responderUnit, true);
            ctx.save();
            // Outer cyan water stream
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(unitPos.x, unitPos.y);
            ctx.quadraticCurveTo((unitPos.x + cx) / 2, Math.min(unitPos.y, cy) - 18, cx, cy);
            ctx.stroke();

            // Inner white pressurized water core
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -Math.floor(nowMs / 20);
            ctx.beginPath();
            ctx.moveTo(unitPos.x, unitPos.y);
            ctx.quadraticCurveTo((unitPos.x + cx) / 2, Math.min(unitPos.y, cy) - 18, cx, cy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Water splash & white steam burst on the fire
            const splashR = 7 + (nowMs % 140) / 16;
            ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
            ctx.beginPath();
            ctx.arc(cx, cy, splashR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderPoliceIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs) {
        const isRedPhase = Math.floor(nowMs / 130) % 2 === 0;
        // Alternating Red & Blue Police Strobe Floodlights across the lot
        ctx.fillStyle = isRedPhase ? 'rgba(239, 68, 68, 0.24)' : 'rgba(59, 130, 246, 0.26)';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.strokeStyle = isRedPhase ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        // Yellow & Black Crime Scene Police Tape Perimeter along bottom of lot
        const tapeY = y + h - 8;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + 2, tapeY, w - 4, 6);
        ctx.fillStyle = '#090d16';
        const stripeOffset = Math.floor(nowMs / 50) % 8;
        for (let sx = x + 2 + stripeOffset; sx < x + w - 4; sx += 8) {
            ctx.fillRect(sx, tapeY, 3, 6);
        }

        // Draw 16-bit Police Shield & Strobe Sprite
        const frameIdx = isRedPhase ? 1 : 2;
        const polSprite = this.fxSprites[`fx_police_${frameIdx}`];
        const drawSize = Math.floor(s * 0.64);
        if (polSprite && polSprite.complete) {
            ctx.drawImage(polSprite, cx - drawSize / 2, cy - drawSize / 2 - 2, drawSize, drawSize);
        }

        // When Police Unit 101 is ON SCENE, render tactical spotlight beam from Cruiser to building!
        if (inc.responderUnit && this.world.vehicleManager) {
            const unitPos = this.world.vehicleManager.getVehicleWorldXY(inc.responderUnit, true);
            ctx.save();
            ctx.fillStyle = isRedPhase ? 'rgba(59, 130, 246, 0.28)' : 'rgba(239, 68, 68, 0.28)';
            ctx.beginPath();
            ctx.moveTo(unitPos.x, unitPos.y);
            ctx.lineTo(cx - 14, cy);
            ctx.lineTo(cx + 14, cy);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    renderMedicalIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs) {
        const pulse = 0.5 + 0.45 * Math.sin(nowMs / 110);
        // Emerald & White Paramedic Triage Glow
        ctx.fillStyle = `rgba(16, 185, 129, ${0.22 * pulse})`;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        // Draw 16-bit Paramedic Cross + ECG Sprite
        const frameIdx = (Math.floor(nowMs / 220) % 2) + 1;
        const medSprite = this.fxSprites[`fx_medical_${frameIdx}`];
        const drawSize = Math.floor(s * 0.62);
        if (medSprite && medSprite.complete) {
            ctx.drawImage(medSprite, cx - drawSize / 2, cy - drawSize / 2 - 2, drawSize, drawSize);
        }

        // Animated Live ECG Heartbeat Monitor Wave across bottom of building
        ctx.save();
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const waveY = y + h - 7;
        const beatPhase = ((nowMs / 12) % w);
        for (let wx = 4; wx < w - 4; wx += 3) {
            const dist = Math.abs(wx - beatPhase);
            let dy = 0;
            if (dist < 3) dy = -7;
            else if (dist < 6) dy = 6;
            else if (dist < 9) dy = -3;
            if (wx === 4) ctx.moveTo(x + wx, waveY + dy);
            else ctx.lineTo(x + wx, waveY + dy);
        }
        ctx.stroke();
        ctx.restore();

        // When MEDIC 2 is ON SCENE, render emerald defibrillator / stabilization beam!
        if (inc.responderUnit && this.world.vehicleManager) {
            const unitPos = this.world.vehicleManager.getVehicleWorldXY(inc.responderUnit, true);
            ctx.save();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 4]);
            ctx.lineDashOffset = -Math.floor(nowMs / 25);
            ctx.beginPath();
            ctx.moveTo(unitPos.x, unitPos.y);
            ctx.lineTo(cx, cy);
            ctx.stroke();
            ctx.restore();
        }
    }

    renderHazmatIncidentFX(ctx, inc, x, y, w, h, cx, cy, s, nowMs) {
        const pulse = 0.5 + 0.4 * Math.sin(nowMs / 120);
        ctx.fillStyle = `rgba(234, 179, 8, ${0.24 * pulse})`;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        const frameIdx = (Math.floor(nowMs / 180) % 2) + 1;
        const hazSprite = this.fxSprites[`fx_hazmat_${frameIdx}`];
        const drawSize = Math.floor(s * 0.66);
        if (hazSprite && hazSprite.complete) {
            ctx.drawImage(hazSprite, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);
        }

        if (inc.responderUnit && this.world.vehicleManager) {
            const unitPos = this.world.vehicleManager.getVehicleWorldXY(inc.responderUnit, true);
            ctx.save();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 4;
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -Math.floor(nowMs / 22);
            ctx.beginPath();
            ctx.moveTo(unitPos.x, unitPos.y);
            ctx.lineTo(cx, cy);
            ctx.stroke();
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

        // Only display revealed (INCOMING, ACTIVE, RESOLVED, FAILED) incidents on the timeline,
        // plus a mysterious fog-of-time indicator for how many hidden events remain!
        const visibleIncs = this.incidents
            .filter(i => i.state !== INCIDENT_STATE.HIDDEN)
            .sort((a, b) => a.currentMinute - b.currentMinute);

        const hiddenCount = this.incidents.filter(i => i.state === INCIDENT_STATE.HIDDEN).length;
        if (hiddenCount > 0) {
            const fogBadge = document.createElement('div');
            fogBadge.className = 'timeline-fog-badge';
            fogBadge.innerHTML = `📡 RADAR ACTIVE: <strong>${hiddenCount} UNKNOWN FUTURE CALLS</strong> (Revealed 6m Before Trigger — Drag Incoming Calls to Shift Time!)`;
            track.appendChild(fogBadge);
        }

        visibleIncs.forEach((inc, idx) => {
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

            const nudgeControls = (!inc.immovable && inc.state === INCIDENT_STATE.INCOMING)
                ? `<span class="nudge-btn" data-dir="-4" title="Move Earlier (-4m)">◀ -4m</span>
                   <span class="nudge-btn" data-dir="5" title="Push Later (+5m) — Beware Hidden Calls!">▶ +5m</span>`
                : (inc.immovable ? `<span class="lock-icon" title="Fixed Schedule">🔒</span>` : '');

            pill.innerHTML = `
                <span class="pill-time">${this.formatMinute(inc.currentMinute)}</span>
                <span class="pill-title">${inc.icon} ${inc.title}</span>
                ${dominoBadge}
                ${nudgeControls}
            `;

            pill.addEventListener('mousedown', (e) => {
                if (e.target.dataset.dir) return;
                if (!inc.immovable && inc.state === INCIDENT_STATE.INCOMING) {
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

                // Clicking an incident card selects the recommended unit & dispatches/stages there!
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
