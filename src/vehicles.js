// ========================================================
// CHRONOS DISPATCH - Phase 3 & 4: Vehicle Engine, Tow Wrecker & Traffic
// Features:
// 1. Station Bay Emergence & Return:
//    - 5 Responders stay hidden inside their station garage until dispatched:
//      [1] ENGINE 4 (Fire), [2] UNIT 101 (Police), [3] MEDIC 2 (Ambulance),
//      [4] CHIEF 1 (Command SUV), [5] TOW 5 (Heavy Wrecker Tow Truck)
// 2. Live Traffic Lights (4-Way) & Stop Signs (3-Way)
// 3. Rare, Impactful Traffic Collisions + Tow Truck Hauling to Mechanic Shop:
//    - Strict cooldowns (no immediate spam: 25s grace period + 60s global cooldown, max 1 random crash)
//    - Dispatch [5] TOW 5 to hook up wrecked vehicles and physically tow them back to the Mechanic Shop!
// ========================================================

const UNIT_STATUS = {
    IDLE_AT_BASE: 'IN GARAGE',
    STAGED: 'STAGED',
    EN_ROUTE: 'EN ROUTE',
    ON_SCENE: 'ON SCENE',
    TOWING: 'TOWING WRECK',
    ER_TRANSPORT: 'ER TRANSPORT',
    RETURNING: 'RETURNING'
};

class VehicleManager {
    constructor(world) {
        this.world = world;
        this.responders = [];
        this.civilians = [];
        this.collisions = [];
        this.selectedUnit = null;

        this.totalDamage = 0;
        this.totalCasualties = 0;
        this.globalCrashCooldown = 25.0; // 25s grace period at start of shift
        this.erAdmissionTimer = 0;       // Visual celebration timer when MEDIC 2 delivers patient to ER

        this.sprites = {};
        this.loadSprites();
    }

    loadSprites() {
        const responderKeys = [
            'responder_police_cruiser',
            'responder_fire_engine',
            'responder_ambulance',
            'responder_chief_suv',
            'responder_tow_truck'
        ];

        for (const baseKey of responderKeys) {
            for (const suffix of ['', '_siren_1', '_siren_2']) {
                const k = `${baseKey}${suffix}`;
                const img = new Image();
                img.src = `assets/vehicles/${k}.png`;
                img.onload = () => { this.sprites[k] = img; };
            }
        }

        const civilianKeys = [
            'car_compact_green',
            'car_compact_orange',
            'car_garbage_truck',
            'car_pickup_white',
            'car_school_bus',
            'car_sedan_blue',
            'car_sedan_red',
            'car_sedan_silver',
            'car_sports_coupe',
            'car_station_wagon',
            'car_suv_dark',
            'car_taxi_yellow',
            'car_van_delivery'
        ];

        for (const k of civilianKeys) {
            const img = new Image();
            img.src = `assets/vehicles/${k}.png`;
            img.onload = () => { this.sprites[k] = img; };
        }
    }

    getRoadAlignedHeading(col, row) {
        const E = this.world.isRoadOrBridge(col + 1, row);
        const W = this.world.isRoadOrBridge(col - 1, row);
        const N = this.world.isRoadOrBridge(col, row - 1);
        const S = this.world.isRoadOrBridge(col, row + 1);

        if (E) return Math.PI / 2;   // East
        if (S) return Math.PI;       // South
        if (W) return -Math.PI / 2;  // West
        if (N) return 0;             // North
        return Math.PI / 2;
    }

    getLotGarageXY(lot, facingRoad) {
        const s = this.world.cellSize;
        if (!lot) {
            return {
                x: this.world.offsetX + facingRoad.col * s + s / 2,
                y: this.world.offsetY + facingRoad.row * s + s / 2
            };
        }
        let bayCol = lot.col;
        let bayRow = lot.row;
        let bestD = 999;
        for (let dy = 0; dy < (lot.h || 1); dy++) {
            for (let dx = 0; dx < (lot.w || 1); dx++) {
                const tc = lot.col + dx;
                const tr = lot.row + dy;
                const d = Math.abs(tc - facingRoad.col) + Math.abs(tr - facingRoad.row);
                if (d < bestD) {
                    bestD = d;
                    bayCol = tc;
                    bayRow = tr;
                }
            }
        }
        return {
            x: this.world.offsetX + bayCol * s + s / 2,
            y: this.world.offsetY + bayRow * s + s / 2
        };
    }

    // ========================================================
    // INITIALIZE RESPONDERS & SEEDED CIVILIAN TRAFFIC
    // ========================================================
    initForWorld(seed) {
        this.prng = new PRNG(seed + 777);
        this.responders = [];
        this.civilians = [];
        this.collisions = [];
        this.totalDamage = 0;
        this.totalCasualties = 0;
        this.globalCrashCooldown = 25.0; // No immediate accidents on load!
        this.updateDamageHUD();

        const findStationRoad = (lotType, fallbackIndex = 0) => {
            const lot = this.world.lots.find(l => l.type === lotType);
            if (lot && lot.facingRoad) {
                return {
                    col: lot.facingRoad.col,
                    row: lot.facingRoad.row,
                    lot: lot
                };
            }
            const node = this.world.roadNodes[fallbackIndex % Math.max(1, this.world.roadNodes.length)] || { col: 1, row: 1 };
            return { col: node.col, row: node.row, lot: lot || null };
        };

        const fireSpawn = findStationRoad(LOT_TYPE.STATION_FIRE, 0);
        const policeSpawn = findStationRoad(LOT_TYPE.STATION_POLICE, 4);
        const hospitalSpawn = findStationRoad(LOT_TYPE.STATION_HOSPITAL, 8);
        const towSpawn = findStationRoad(LOT_TYPE.STATION_TOW, 12);

        const defs = [
            {
                id: 'unit_fire',
                callsign: 'ENGINE 4',
                role: 'Fire & Rescue Pumper',
                hotkey: '1',
                spriteBase: 'responder_fire_engine',
                color: '#ef4444',
                speedTilesPerSec: 3.4,
                spawn: fireSpawn
            },
            {
                id: 'unit_police',
                callsign: 'UNIT 101',
                role: 'Police Interceptor',
                hotkey: '2',
                spriteBase: 'responder_police_cruiser',
                color: '#3b82f6',
                speedTilesPerSec: 4.3,
                spawn: policeSpawn
            },
            {
                id: 'unit_medic',
                callsign: 'MEDIC 2',
                role: 'Paramedic Ambulance',
                hotkey: '3',
                spriteBase: 'responder_ambulance',
                color: '#10b981',
                speedTilesPerSec: 3.8,
                spawn: hospitalSpawn
            },
            {
                id: 'unit_chief',
                callsign: 'CHIEF 1',
                role: 'Battalion Command SUV',
                hotkey: '4',
                spriteBase: 'responder_chief_suv',
                color: '#f59e0b',
                speedTilesPerSec: 4.1,
                spawn: fireSpawn
            },
            {
                id: 'unit_tow',
                callsign: 'TOW 5',
                role: 'Heavy Wrecker Tow Truck',
                hotkey: '5',
                spriteBase: 'responder_tow_truck',
                color: '#f97316',
                speedTilesPerSec: 3.5,
                spawn: towSpawn
            }
        ];

        defs.forEach((d, idx) => {
            const initialHeading = this.getRoadAlignedHeading(d.spawn.col, d.spawn.row);
            this.responders.push({
                id: d.id,
                callsign: d.callsign,
                role: d.role,
                hotkey: d.hotkey,
                spriteBase: d.spriteBase,
                color: d.color,
                speedTilesPerSec: d.speedTilesPerSec,
                homeCol: d.spawn.col,
                homeRow: d.spawn.row,
                homeLot: d.spawn.lot,
                col: d.spawn.col,
                row: d.spawn.row,
                progress: 0,
                path: [],
                targetLot: null,
                targetCol: d.spawn.col,
                targetRow: d.spawn.row,
                headingRad: initialHeading,
                status: UNIT_STATUS.IDLE_AT_BASE,
                sirenActive: false,
                inGarage: true,
                bayMode: null,
                bayProgress: 0,
                towedSpriteKey: null, // Holds wrecked car sprite when TOW 5 hauls a wreck back to shop!
                unitIndex: idx
            });
        });

        this.selectedUnit = this.responders[0];

        this.spawnCivilianTraffic();
        this.syncHUD();
    }

    spawnCivilianTraffic() {
        if (this.world.roadNodes.length < 4) return;

        // Only 1 reckless car in the pool so random accidents are rare!
        const civPool = [
            { sprite: 'car_sports_coupe', name: 'Reckless Sports Coupe', speed: 2.15, prefLot: null, reckless: true },
            { sprite: 'car_taxi_yellow', name: 'Metro Cab #44', speed: 1.9, prefLot: LOT_TYPE.COMMERCIAL_BANK, reckless: false },
            { sprite: 'car_compact_orange', name: 'Compact Coupe', speed: 1.8, prefLot: null, reckless: false },
            { sprite: 'car_school_bus', name: 'School Bus #12', speed: 1.35, prefLot: LOT_TYPE.CIVIC_SCHOOL, reckless: false },
            { sprite: 'car_van_delivery', name: 'FreshGrocer Delivery Van', speed: 1.55, prefLot: LOT_TYPE.COMMERCIAL_SUPERMARKET, reckless: false },
            { sprite: 'car_garbage_truck', name: 'Municipal Sanitation Truck', speed: 1.2, prefLot: null, reckless: false },
            { sprite: 'car_sedan_blue', name: 'Civilian Sedan', speed: 1.8, prefLot: null, reckless: false },
            { sprite: 'car_sedan_red', name: 'Civilian Sedan', speed: 1.85, prefLot: null, reckless: false },
            { sprite: 'car_sedan_silver', name: 'Commuter Sedan', speed: 1.75, prefLot: null, reckless: false },
            { sprite: 'car_pickup_white', name: 'Utility Pickup', speed: 1.7, prefLot: LOT_TYPE.INDUSTRIAL_WAREHOUSE, reckless: false },
            { sprite: 'car_suv_dark', name: 'Suburban SUV', speed: 1.8, prefLot: null, reckless: false },
            { sprite: 'car_compact_green', name: 'Compact Hatchback', speed: 1.65, prefLot: null, reckless: false },
            { sprite: 'car_station_wagon', name: 'Family Wagon', speed: 1.6, prefLot: null, reckless: false }
        ];

        const nodes = [...this.world.roadNodes];
        this.prng.shuffle(nodes);

        const count = Math.min(12, nodes.length);
        for (let i = 0; i < count; i++) {
            const spec = civPool[i % civPool.length];
            const startNode = nodes[i];
            const civ = {
                id: `civ_${i}`,
                name: spec.name,
                spriteKey: spec.sprite,
                speedTilesPerSec: spec.speed,
                prefLot: spec.prefLot,
                isReckless: spec.reckless && i === 0, // Only 1 reckless car total
                col: startNode.col,
                row: startNode.row,
                progress: 0,
                path: [],
                headingRad: this.getRoadAlignedHeading(startNode.col, startNode.row),
                pauseTimer: 0,
                stopSignWait: 0,
                stoppedAtTileKey: null,
                involvedInCrash: false,
                crashCooldown: 15.0
            };
            this.assignNextCivilianRoute(civ);
            this.civilians.push(civ);
        }
    }

    assignNextCivilianRoute(civ) {
        if (this.world.roadNodes.length < 2) return;
        let destNode = null;

        if (civ.prefLot && this.prng.random() < 0.45) {
            const lot = this.world.lots.find(l => l.type === civ.prefLot);
            if (lot && lot.facingRoad) {
                destNode = { col: lot.facingRoad.col, row: lot.facingRoad.row };
            }
        }

        if (!destNode) {
            for (let tries = 0; tries < 10; tries++) {
                const candidate = this.prng.choice(this.world.roadNodes);
                const dist = Math.abs(candidate.col - civ.col) + Math.abs(candidate.row - civ.row);
                if (dist >= 5 && !this.isCellBlockedByCrash(candidate.col, candidate.row)) {
                    destNode = candidate;
                    break;
                }
            }
        }

        if (!destNode) destNode = this.prng.choice(this.world.roadNodes);

        const path = this.findPath(civ.col, civ.row, destNode.col, destNode.row);
        if (path && path.length > 1) {
            civ.path = path.slice(1);
            civ.progress = 0;
            this.updateHeadingFromStep(civ, civ.col, civ.row, civ.path[0].col, civ.path[0].row);
        }
    }

    isCellBlockedByCrash(c, r) {
        return this.collisions.some(crash => crash.col === c && crash.row === r);
    }

    // ========================================================
    // A* PATHFINDING ON ROAD & BRIDGE GRAPH
    // ========================================================
    findPath(startCol, startRow, endCol, endRow, ignoreCrashAtDest = true) {
        if (!this.world.isRoadOrBridge(startCol, startRow) || !this.world.isRoadOrBridge(endCol, endRow)) {
            return null;
        }
        if (startCol === endCol && startRow === endRow) {
            return [{ col: startCol, row: startRow }];
        }

        const startKey = `${startCol},${startRow}`;
        const endKey = `${endCol},${endRow}`;

        const openSet = [{ col: startCol, row: startRow, key: startKey, f: 0 }];
        const cameFrom = new Map();
        const gScore = new Map();
        const closedSet = new Set();

        gScore.set(startKey, 0);

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.key === endKey) {
                const totalPath = [{ col: current.col, row: current.row }];
                let currKey = current.key;
                while (cameFrom.has(currKey)) {
                    const prev = cameFrom.get(currKey);
                    totalPath.unshift({ col: prev.col, row: prev.row });
                    currKey = prev.key;
                }
                return totalPath;
            }

            closedSet.add(current.key);

            for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nc = current.col + dc;
                const nr = current.row + dr;
                if (!this.world.isRoadOrBridge(nc, nr)) continue;

                const neighborKey = `${nc},${nr}`;
                if (closedSet.has(neighborKey)) continue;

                let stepCost = 1.0;
                if (this.hasCivilianOnCell(nc, nr)) {
                    stepCost += 0.35;
                }
                if (this.isCellBlockedByCrash(nc, nr) && !(ignoreCrashAtDest && nc === endCol && nr === endRow)) {
                    stepCost += 6.0;
                }

                const tentativeG = gScore.get(current.key) + stepCost;
                const existingG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;

                if (tentativeG < existingG) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    const h = Math.abs(nc - endCol) + Math.abs(nr - endRow);
                    const f = tentativeG + h;

                    const existingOpen = openSet.find(o => o.key === neighborKey);
                    if (existingOpen) {
                        existingOpen.f = f;
                    } else {
                        openSet.push({ col: nc, row: nr, key: neighborKey, f });
                    }
                }
            }
        }

        return null;
    }

    hasCivilianOnCell(c, r) {
        return this.civilians.some(civ => !civ.involvedInCrash && civ.col === c && civ.row === r);
    }

    // ========================================================
    // DISPATCH COMMANDS (WITH GARAGE EXIT & RETURN)
    // ========================================================
    selectUnitById(unitId) {
        const unit = this.responders.find(u => u.id === unitId);
        if (unit) {
            this.selectedUnit = unit;
            if (window.soundManager) window.soundManager.playSelect();
            this.syncHUD();
        }
    }

    dispatchSelectedUnitToLot(lot) {
        if (!this.selectedUnit || !lot || !lot.facingRoad) return false;
        if (lot === this.selectedUnit.homeLot && !this.selectedUnit.inGarage) {
            return this.returnUnitToBase(this.selectedUnit);
        }
        return this.dispatchUnit(
            this.selectedUnit,
            lot.facingRoad.col,
            lot.facingRoad.row,
            lot
        );
    }

    dispatchSelectedUnitToRoad(col, row) {
        if (!this.selectedUnit || !this.world.isRoadOrBridge(col, row)) return false;
        // If user clicked directly on an active crash tile, prefer dispatching TOW 5 if selectedUnit is at base or dispatch selectedUnit
        return this.dispatchUnit(this.selectedUnit, col, row, null);
    }

    isUnitFreeForAutoDispatch(unit) {
        if (!unit) return false;
        return unit.inGarage || unit.status === UNIT_STATUS.IDLE_AT_BASE || unit.status === UNIT_STATUS.RETURNING;
    }

    tryAutoDispatchQueuedForUnit(unit) {
        if (!unit || !this.isUnitFreeForAutoDispatch(unit)) return false;

        // First check if TOW 5 has an active traffic collision waiting
        if (unit.id === 'unit_tow' && this.collisions.length > 0) {
            const crash = this.collisions[0];
            return this.dispatchUnit(unit, crash.col, crash.row, null, false);
        }

        // Next check if TimelineManager has an ACTIVE unattended incident requiring this unit
        if (window.timelineManager) {
            const waitingInc = window.timelineManager.incidents.find(
                inc => inc.state === 'ACTIVE' && inc.reqUnit === unit.id
            );
            if (waitingInc) {
                if (waitingInc.lot && waitingInc.lot.facingRoad) {
                    return this.dispatchUnit(unit, waitingInc.lot.facingRoad.col, waitingInc.lot.facingRoad.row, waitingInc.lot, false);
                } else if (waitingInc.roadCol !== undefined) {
                    return this.dispatchUnit(unit, waitingInc.roadCol, waitingInc.roadRow, null, false);
                }
            }
        }
        return false;
    }

    returnUnitToBase(unit, isTowing = false, isErTransport = false) {
        if (!unit || unit.inGarage) return false;
        // If not towing or transporting a patient, check if another active call for this unit is already waiting!
        if (!isTowing && !isErTransport && window.timelineManager) {
            const waitingInc = window.timelineManager.incidents.find(
                inc => inc.state === 'ACTIVE' && inc.reqUnit === unit.id
            );
            if (waitingInc) {
                if (waitingInc.lot && waitingInc.lot.facingRoad) {
                    return this.dispatchUnit(unit, waitingInc.lot.facingRoad.col, waitingInc.lot.facingRoad.row, waitingInc.lot, false);
                } else if (waitingInc.roadCol !== undefined) {
                    return this.dispatchUnit(unit, waitingInc.roadCol, waitingInc.roadRow, null, false);
                }
            }
        }
        const ok = this.dispatchUnit(unit, unit.homeCol, unit.homeRow, unit.homeLot, true);
        if (ok) {
            unit.status = isTowing ? UNIT_STATUS.TOWING : (isErTransport ? UNIT_STATUS.ER_TRANSPORT : UNIT_STATUS.RETURNING);
            unit.sirenActive = isTowing || isErTransport;
            this.syncHUD();
        }
        return ok;
    }

    dispatchUnit(unit, destCol, destRow, targetLot = null, isReturn = false) {
        const startC = unit.inGarage ? unit.homeCol : unit.col;
        const startR = unit.inGarage ? unit.homeRow : unit.row;

        const path = this.findPath(startC, startR, destCol, destRow);
        if (!path) return false;

        unit.targetCol = destCol;
        unit.targetRow = destRow;
        unit.targetLot = targetLot;

        if (unit.inGarage) {
            unit.inGarage = false;
            unit.col = unit.homeCol;
            unit.row = unit.homeRow;
            unit.progress = 0;
            unit.bayMode = 'EXITING';
            unit.bayProgress = 0;
        } else if (unit.bayMode === 'ENTERING') {
            unit.bayMode = null;
            unit.bayProgress = 0;
        }

        if (path.length <= 1) {
            unit.path = [];
            unit.progress = 0;
            if (isReturn) {
                unit.bayMode = 'ENTERING';
                unit.bayProgress = 0;
                unit.status = unit.towedSpriteKey ? UNIT_STATUS.TOWING : UNIT_STATUS.RETURNING;
                unit.sirenActive = Boolean(unit.towedSpriteKey);
            } else {
                unit.status = targetLot ? UNIT_STATUS.ON_SCENE : UNIT_STATUS.STAGED;
                unit.sirenActive = Boolean(targetLot);
            }
        } else {
            unit.path = path.slice(1);
            unit.status = isReturn ? (unit.towedSpriteKey ? UNIT_STATUS.TOWING : UNIT_STATUS.RETURNING) : UNIT_STATUS.EN_ROUTE;
            unit.sirenActive = !isReturn || Boolean(unit.towedSpriteKey);
            this.updateHeadingFromStep(unit, unit.col, unit.row, unit.path[0].col, unit.path[0].row);
        }

        if (window.soundManager) {
            if (isReturn && !unit.towedSpriteKey) window.soundManager.playClick();
            else window.soundManager.playSirenBlip();
        }

        this.syncHUD();
        return true;
    }

    updateHeadingFromStep(vehicle, c1, r1, c2, r2) {
        const dc = c2 - c1;
        const dr = r2 - r1;
        if (dr < 0) vehicle.headingRad = 0;               // North (UP)
        else if (dc > 0) vehicle.headingRad = Math.PI / 2; // East  (RIGHT)
        else if (dr > 0) vehicle.headingRad = Math.PI;     // South (DOWN)
        else if (dc < 0) vehicle.headingRad = -Math.PI / 2;// West  (LEFT)
    }

    // ========================================================
    // FRAME UPDATE (TRAFFIC SIGNALS, MOVEMENT & COLLISIONS)
    // ========================================================
    update(dtSeconds, simSpeed = 1, isPaused = false) {
        if (isPaused) return;
        const dt = Math.min(0.1, dtSeconds) * simSpeed;
        this.world.simTime += dt;

        if (this.globalCrashCooldown > 0) {
            this.globalCrashCooldown -= dt;
        }
        if (this.erAdmissionTimer > 0) {
            this.erAdmissionTimer = Math.max(0, this.erAdmissionTimer - dt);
        }

        // 1. Update Emergency Responders (including Garage Exit / Enter animations)
        for (const unit of this.responders) {
            if (unit.inGarage) continue;

            if (unit.bayMode === 'EXITING') {
                unit.bayProgress += dt * 2.4;
                const bayPos = this.getLotGarageXY(unit.homeLot, { col: unit.homeCol, row: unit.homeRow });
                this.updateHeadingFromStep(
                    unit,
                    Math.round((bayPos.x - this.world.offsetX) / this.world.cellSize),
                    Math.round((bayPos.y - this.world.offsetY) / this.world.cellSize),
                    unit.homeCol,
                    unit.homeRow
                );

                if (unit.bayProgress >= 1.0) {
                    unit.bayMode = null;
                    unit.bayProgress = 0;
                    if (unit.path.length > 0) {
                        this.updateHeadingFromStep(unit, unit.col, unit.row, unit.path[0].col, unit.path[0].row);
                    }
                }
                continue;
            }

            if (unit.bayMode === 'ENTERING') {
                unit.bayProgress += dt * 2.4;
                const bayPos = this.getLotGarageXY(unit.homeLot, { col: unit.homeCol, row: unit.homeRow });
                this.updateHeadingFromStep(
                    unit,
                    unit.homeCol,
                    unit.homeRow,
                    Math.floor((bayPos.x - this.world.offsetX) / this.world.cellSize),
                    Math.floor((bayPos.y - this.world.offsetY) / this.world.cellSize)
                );

                if (unit.bayProgress >= 1.0) {
                    const wasErTransport = unit.status === UNIT_STATUS.ER_TRANSPORT;
                    unit.bayMode = null;
                    unit.bayProgress = 0;
                    unit.inGarage = true;
                    unit.towedSpriteKey = null; // Wreck delivered inside Mechanic Shop!
                    unit.status = UNIT_STATUS.IDLE_AT_BASE;
                    unit.sirenActive = false;

                    if (wasErTransport) {
                        this.erAdmissionTimer = 3.8;
                        if (window.timelineManager) {
                            window.timelineManager.showAlertBanner(
                                '🏥 COUNTY GENERAL ER: Patient admitted to Trauma Bay — Life Saved!',
                                '#10b981',
                                3200
                            );
                        }
                    }

                    this.syncHUD();
                    // Check if another active incident is queued for this unit!
                    this.tryAutoDispatchQueuedForUnit(unit);
                }
                continue;
            }

            if (unit.path && unit.path.length > 0) {
                const nextStep = unit.path[0];
                this.updateHeadingFromStep(unit, unit.col, unit.row, nextStep.col, nextStep.row);

                const trafficFactor = this.hasCivilianOnCell(unit.col, unit.row) ? 0.85 : 1.0;
                unit.progress += unit.speedTilesPerSec * trafficFactor * dt;

                while (unit.progress >= 1.0 && unit.path.length > 0) {
                    unit.progress -= 1.0;
                    const arrived = unit.path.shift();
                    unit.col = arrived.col;
                    unit.row = arrived.row;

                    if (unit.path.length > 0) {
                        this.updateHeadingFromStep(unit, unit.col, unit.row, unit.path[0].col, unit.path[0].row);
                    } else {
                        unit.progress = 0;
                        if (unit.status === UNIT_STATUS.RETURNING || unit.status === UNIT_STATUS.TOWING || unit.status === UNIT_STATUS.ER_TRANSPORT) {
                            unit.bayMode = 'ENTERING';
                            unit.bayProgress = 0;
                            unit.sirenActive = false;
                        } else if (unit.targetLot) {
                            unit.status = UNIT_STATUS.ON_SCENE;
                            unit.sirenActive = true;
                        } else {
                            unit.status = UNIT_STATUS.STAGED;
                            unit.sirenActive = true;
                        }
                        this.syncHUD();
                    }
                }
            }
        }

        // 2. Update Seeded Civilian Traffic
        for (const civ of this.civilians) {
            if (civ.involvedInCrash) continue;
            if (civ.crashCooldown > 0) civ.crashCooldown -= dt;

            if (civ.pauseTimer > 0) {
                civ.pauseTimer -= dt;
                continue;
            }

            if (civ.stopSignWait > 0) {
                civ.stopSignWait -= dt;
                continue;
            }

            if (civ.path && civ.path.length > 0) {
                const nextStep = civ.path[0];
                this.updateHeadingFromStep(civ, civ.col, civ.row, nextStep.col, nextStep.row);

                if (this.isCellBlockedByCrash(nextStep.col, nextStep.row) && civ.progress >= 0.45) {
                    this.assignNextCivilianRoute(civ);
                    continue;
                }

                const nextRoadType = this.world.grid[nextStep.row][nextStep.col].roadType;
                const nextKey = `${nextStep.col},${nextStep.row}`;

                if (civ.progress >= 0.45 && civ.progress <= 0.68) {
                    if (nextRoadType === '4WAY') {
                        const tl = this.world.getTrafficLightState(nextStep.col, nextStep.row);
                        const movingNS = nextStep.row !== civ.row;
                        const signal = movingNS ? tl.NS : tl.EW;

                        if (signal !== 'GREEN') {
                            // Only run a yellow/red light if globalCrashCooldown <= 0 AND this is the reckless car
                            const blowsLight = civ.isReckless && this.globalCrashCooldown <= 0 && signal === 'YELLOW';
                            if (!blowsLight) {
                                civ.progress = Math.min(civ.progress, 0.52);
                                continue;
                            }
                        }
                    } else if (nextRoadType && nextRoadType.startsWith('3WAY')) {
                        if (civ.stoppedAtTileKey !== nextKey) {
                            civ.stoppedAtTileKey = nextKey;
                            if (!(civ.isReckless && this.globalCrashCooldown <= 0)) {
                                civ.stopSignWait = 0.55;
                                civ.progress = Math.min(civ.progress, 0.52);
                                continue;
                            }
                        }
                    }
                }

                const blockedAhead = this.civilians.some(other =>
                    other !== civ &&
                    Math.abs(other.headingRad - civ.headingRad) < 0.1 &&
                    ((other.col === civ.col && other.row === civ.row && other.progress > civ.progress && other.progress - civ.progress < 0.62) ||
                     (other.col === nextStep.col && other.row === nextStep.row && (1.0 - civ.progress) + other.progress < 0.62))
                );

                if (blockedAhead) {
                    continue;
                }

                civ.progress += civ.speedTilesPerSec * dt;

                while (civ.progress >= 1.0 && civ.path.length > 0) {
                    civ.progress -= 1.0;
                    const arrived = civ.path.shift();
                    civ.col = arrived.col;
                    civ.row = arrived.row;

                    if (civ.path.length > 0) {
                        this.updateHeadingFromStep(civ, civ.col, civ.row, civ.path[0].col, civ.path[0].row);
                    } else {
                        civ.progress = 0;
                        civ.pauseTimer = 0.5;
                        this.assignNextCivilianRoute(civ);
                    }
                }
            } else {
                this.assignNextCivilianRoute(civ);
            }
        }

        // 3. Detect Rare Intersection Collisions & Update Active Wreckage Recovery
        this.checkVehicleCollisions();
        this.updateCollisions(dt);
    }

    // ========================================================
    // RARE INTERSECTION COLLISIONS & TOW WRECKER HAULING
    // ========================================================
    checkVehicleCollisions() {
        // Strict cap: max 1 active random crash, and only when globalCrashCooldown <= 0
        if (this.collisions.length >= 1 || this.globalCrashCooldown > 0) return;

        const s = this.world.cellSize;
        const crashDist = s * 0.34;

        for (let i = 0; i < this.civilians.length; i++) {
            const a = this.civilians[i];
            if (a.involvedInCrash || a.crashCooldown > 0) continue;
            const posA = this.getVehicleWorldXY(a, false);

            for (let j = i + 1; j < this.civilians.length; j++) {
                const b = this.civilians[j];
                if (b.involvedInCrash || b.crashCooldown > 0) continue;
                if (!a.isReckless && !b.isReckless) continue; // Only reckless car triggers random crash

                const angleDiff = Math.abs(Math.sin(a.headingRad - b.headingRad));
                if (angleDiff < 0.7) continue;

                const posB = this.getVehicleWorldXY(b, false);
                const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y);

                if (dist < crashDist) {
                    const crashCol = Math.round(((posA.centerX + posB.centerX) / 2 - this.world.offsetX - s / 2) / s);
                    const crashRow = Math.round(((posA.centerY + posB.centerY) / 2 - this.world.offsetY - s / 2) / s);
                    if (this.world.isRoadOrBridge(crashCol, crashRow) && !this.isCellBlockedByCrash(crashCol, crashRow)) {
                        const rType = this.world.grid[crashRow][crashCol].roadType;
                        // Only trigger inside actual 4-way or 3-way intersections
                        if (rType === '4WAY' || (rType && rType.startsWith('3WAY'))) {
                            this.triggerCollision(a, b, crashCol, crashRow);
                            return;
                        }
                    }
                }
            }
        }
    }

    // Can also be called by Phase 4 Scheduled Timeline Pileup Incident!
    triggerScheduledCollisionAt(col, row) {
        if (this.isCellBlockedByCrash(col, row) || this.civilians.length < 2) return;
        const freeCivs = this.civilians.filter(c => !c.involvedInCrash);
        if (freeCivs.length >= 2) {
            this.triggerCollision(freeCivs[0], freeCivs[1], col, row);
        }
    }

    triggerCollision(civA, civB, col, row) {
        civA.involvedInCrash = true;
        civB.involvedInCrash = true;
        civA.col = col;
        civA.row = row;
        civB.col = col;
        civB.row = row;
        civA.progress = 0;
        civB.progress = 0;

        this.globalCrashCooldown = 60.0; // 60 seconds before another random accident can occur
        this.totalDamage += 2500;
        this.totalCasualties += 1;
        this.updateDamageHUD();

        if (window.soundManager) {
            window.soundManager.playCrash();
        }

        this.collisions.push({
            id: `crash_${Date.now()}_${col}_${row}`,
            col,
            row,
            civA,
            civB,
            clearProgress: 0,
            clearDuration: 3.0
        });

        // Auto-dispatch TOW 5 [5] if available!
        const towUnit = this.responders.find(u => u.id === 'unit_tow');
        if (towUnit && this.isUnitFreeForAutoDispatch(towUnit)) {
            this.dispatchUnit(towUnit, col, row, null, false);
        }
    }

    updateCollisions(dt) {
        for (let i = this.collisions.length - 1; i >= 0; i--) {
            const crash = this.collisions[i];

            // Check if TOW 5 (or any responder) is on or adjacent to the crash tile
            const responderOnScene = this.responders.find(u =>
                !u.inGarage &&
                !u.bayMode &&
                u.path.length === 0 &&
                Math.abs(u.col - crash.col) + Math.abs(u.row - crash.row) <= 1
            );

            if (responderOnScene) {
                responderOnScene.status = UNIT_STATUS.ON_SCENE;
                responderOnScene.sirenActive = true;
                // Tow Truck hooks up wrecks fastest (1.4x speed)
                const rate = responderOnScene.id === 'unit_tow' ? 1.4 : 1.0;
                crash.clearProgress += (dt * rate) / crash.clearDuration;

                if (crash.clearProgress >= 1.0) {
                    crash.civA.involvedInCrash = false;
                    crash.civB.involvedInCrash = false;
                    crash.civA.crashCooldown = 30.0;
                    crash.civB.crashCooldown = 30.0;
                    this.assignNextCivilianRoute(crash.civA);
                    this.assignNextCivilianRoute(crash.civB);

                    if (this.totalCasualties > 0) {
                        this.totalCasualties = Math.max(0, this.totalCasualties - 1);
                        this.updateDamageHUD();
                    }

                    // If TOW 5 (or if TOW 5 is available, hook the wrecked car onto TOW 5 and haul it back to the Mechanic Shop!)
                    const towUnit = responderOnScene.id === 'unit_tow'
                        ? responderOnScene
                        : this.responders.find(u => u.id === 'unit_tow');

                    if (responderOnScene.id === 'unit_tow') {
                        responderOnScene.towedSpriteKey = crash.civA.spriteKey;
                        this.returnUnitToBase(responderOnScene, true);
                    } else if (towUnit && !towUnit.inGarage && Math.abs(towUnit.col - crash.col) + Math.abs(towUnit.row - crash.row) <= 2) {
                        towUnit.towedSpriteKey = crash.civA.spriteKey;
                        this.returnUnitToBase(towUnit, true);
                    }

                    if (window.soundManager) window.soundManager.playResolved();
                    this.collisions.splice(i, 1);
                    this.syncHUD();
                }
            }
        }
    }

    updateDamageHUD() {
        const dmgEl = document.getElementById('hud-damage');
        const casEl = document.getElementById('hud-casualties');
        if (dmgEl) {
            dmgEl.textContent = `$${this.totalDamage.toLocaleString()}`;
            dmgEl.style.color = this.totalDamage > 0 ? 'var(--accent-red)' : 'var(--accent-cyan)';
        }
        if (casEl) {
            casEl.textContent = String(this.totalCasualties);
            casEl.style.color = this.totalCasualties > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
        }
    }

    // ========================================================
    // TRUE RIGHT-HAND LANE POSITIONING & GARAGE INTERPOLATION
    // ========================================================
    getVehicleWorldXY(v, isResponder = false) {
        const s = this.world.cellSize;

        if (isResponder && v.bayMode) {
            const bayPos = this.getLotGarageXY(v.homeLot, { col: v.homeCol, row: v.homeRow });
            const roadX = this.world.offsetX + v.homeCol * s + s / 2 + Math.cos(v.headingRad) * (s * 0.22);
            const roadY = this.world.offsetY + v.homeRow * s + s / 2 + Math.sin(v.headingRad) * (s * 0.22);
            const t = Math.max(0, Math.min(1, v.bayProgress));

            if (v.bayMode === 'EXITING') {
                const x = bayPos.x + (roadX - bayPos.x) * t;
                const y = bayPos.y + (roadY - bayPos.y) * t;
                return { x, y, centerX: x, centerY: y };
            } else if (v.bayMode === 'ENTERING') {
                const x = roadX + (bayPos.x - roadX) * t;
                const y = roadY + (bayPos.y - roadY) * t;
                return { x, y, centerX: x, centerY: y };
            }
        }

        let currC = v.col;
        let currR = v.row;

        if (v.path && v.path.length > 0) {
            const next = v.path[0];
            currC = v.col + (next.col - v.col) * v.progress;
            currR = v.row + (next.row - v.row) * v.progress;
        }

        const centerX = this.world.offsetX + currC * s + s / 2;
        const centerY = this.world.offsetY + currR * s + s / 2;

        const laneOffset = s * (isResponder ? 0.22 : 0.24);
        const rightX = Math.cos(v.headingRad);
        const rightY = Math.sin(v.headingRad);

        const x = centerX + rightX * laneOffset;
        const y = centerY + rightY * laneOffset;

        return { x, y, centerX, centerY, rightX, rightY, laneOffset };
    }

    getResponderAtPixel(px, py) {
        const hitRadius = this.world.cellSize * 0.48;
        for (const unit of this.responders) {
            if (unit.inGarage) continue;
            const pos = this.getVehicleWorldXY(unit, true);
            const dist = Math.hypot(px - pos.x, py - pos.y);
            if (dist <= hitRadius) return unit;
        }
        return null;
    }

    // ========================================================
    // RENDERING: ROUTES, CIVILIANS, COLLISIONS & RESPONDERS
    // ========================================================
    render(ctx) {
        const s = this.world.cellSize;
        const nowMs = performance.now();
        const sirenFrame = Math.floor(nowMs / 130) % 2 === 0 ? 1 : 2;

        // 1. Render Active Tactical A* Route Lines for Responders
        for (const unit of this.responders) {
            if (!unit.inGarage && unit.path && unit.path.length > 0) {
                const isSelected = this.selectedUnit && this.selectedUnit.id === unit.id;
                ctx.save();
                ctx.strokeStyle = unit.color;
                ctx.lineWidth = isSelected ? 4 : 2.5;
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -Math.floor(nowMs / 35);
                ctx.globalAlpha = isSelected ? 0.95 : 0.55;

                const startPos = this.getVehicleWorldXY(unit, true);
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);

                for (let i = 0; i < unit.path.length; i++) {
                    const step = unit.path[i];
                    const prev = i === 0 ? { col: unit.col, row: unit.row } : unit.path[i - 1];
                    const dc = step.col - prev.col;
                    const dr = step.row - prev.row;
                    const segOffset = s * 0.22;
                    const sx = this.world.offsetX + step.col * s + s / 2 + (-dr) * segOffset;
                    const sy = this.world.offsetY + step.row * s + s / 2 + (dc) * segOffset;
                    ctx.lineTo(sx, sy);
                }
                ctx.stroke();

                const last = unit.path[unit.path.length - 1];
                const tx = this.world.offsetX + last.col * s + s / 2;
                const ty = this.world.offsetY + last.row * s + s / 2;
                const pulseRadius = 6 + Math.sin(nowMs / 150) * 3;

                ctx.setLineDash([]);
                ctx.fillStyle = unit.color;
                ctx.beginPath();
                ctx.arc(tx, ty, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = unit.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(tx, ty, pulseRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // 2. Render Civilian Vehicles
        const civDrawSize = Math.floor(s * 1.05);
        for (const civ of this.civilians) {
            if (civ.involvedInCrash) continue;
            const pos = this.getVehicleWorldXY(civ, false);
            const sprite = this.sprites[civ.spriteKey];

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(civ.headingRad);
            if (sprite && sprite.complete) {
                ctx.drawImage(sprite, -civDrawSize / 2, -civDrawSize / 2, civDrawSize, civDrawSize);
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-6, -10, 12, 20);
            }
            ctx.restore();
        }

        // 3. Render Active Traffic Collisions & Wreckage
        this.renderCollisions(ctx, s, nowMs, civDrawSize);

        // 4. Render Active Emergency Responder Units (plus Towed Wreck behind TOW 5!)
        const respDrawSize = Math.floor(s * 1.24);
        for (const unit of this.responders) {
            if (unit.inGarage) continue;

            const pos = this.getVehicleWorldXY(unit, true);
            const isSelected = this.selectedUnit && this.selectedUnit.id === unit.id;

            // If TOW 5 is towing a wrecked vehicle back to the Mechanic Shop, render the towed car behind it!
            if (unit.towedSpriteKey) {
                const towedSprite = this.sprites[unit.towedSpriteKey];
                // Backward direction vector along unit.headingRad (since 0 is North (0, -1), backward is (-sin, cos))
                const backX = -Math.sin(unit.headingRad);
                const backY = Math.cos(unit.headingRad);
                const towX = pos.x + backX * (s * 0.56);
                const towY = pos.y + backY * (s * 0.56);

                ctx.save();
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(towX, towY);
                ctx.stroke();

                if (towedSprite && towedSprite.complete) {
                    ctx.translate(towX, towY);
                    ctx.rotate(unit.headingRad);
                    ctx.drawImage(towedSprite, -civDrawSize / 2, -civDrawSize / 2, civDrawSize, civDrawSize);
                }
                ctx.restore();
            }

            if (isSelected) {
                ctx.save();
                ctx.strokeStyle = unit.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, Math.floor(s * 0.36), 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = unit.color;
                ctx.globalAlpha = 0.22;
                ctx.fill();
                ctx.restore();
            }

            const spriteKey = unit.sirenActive
                ? `${unit.spriteBase}_siren_${sirenFrame}`
                : unit.spriteBase;
            const sprite = this.sprites[spriteKey] || this.sprites[unit.spriteBase];

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(unit.headingRad);
            if (sprite && sprite.complete) {
                ctx.drawImage(sprite, -respDrawSize / 2, -respDrawSize / 2, respDrawSize, respDrawSize);
            } else {
                ctx.fillStyle = unit.color;
                ctx.fillRect(-7, -12, 14, 24);
            }
            ctx.restore();

            this.renderUnitCallsign(ctx, pos.x, pos.y - Math.floor(s * 0.36), unit, isSelected);
        }

        // 5. Render Hospital ER Trauma Bay Reception & Patient Admission Animation
        this.renderHospitalERAnimation(ctx, s, nowMs);
    }

    renderHospitalERAnimation(ctx, s, nowMs) {
        const medicUnit = this.responders.find(u => u.id === 'unit_medic');
        if (!medicUnit || !medicUnit.homeLot) return;

        const isTransporting = !medicUnit.inGarage && medicUnit.status === UNIT_STATUS.ER_TRANSPORT;
        if (!isTransporting && this.erAdmissionTimer <= 0) return;

        const lot = medicUnit.homeLot;
        const x = this.world.offsetX + lot.col * s;
        const y = this.world.offsetY + lot.row * s;
        const w = (lot.w || 1) * s;
        const h = (lot.h || 1) * s;
        const cx = x + w / 2;
        const cy = y + h / 2;

        ctx.save();
        if (isTransporting) {
            // Pulsing ER Trauma Bay beacon while Ambulance is inbound with patient
            const pulse = 0.5 + 0.45 * Math.sin(nowMs / 120);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
            ctx.setLineDash([]);

            ctx.fillStyle = `rgba(16, 185, 129, ${0.28 * pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
            ctx.fill();

            const tag = '🏥 ER BAY RECEIVING PATIENT';
            ctx.font = 'bold 12px monospace';
            const tw = Math.ceil(ctx.measureText(tag).width + 16);
            ctx.fillStyle = 'rgba(6, 78, 59, 0.96)';
            ctx.fillRect(cx - tw / 2, y - 24, tw, 20);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - tw / 2, y - 24, tw, 20);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(tag, cx - tw / 2 + 6, y - 10);
        } else if (this.erAdmissionTimer > 0) {
            // Celebratory floating "+1 PATIENT ADMITTED TO ER!" animation
            const rise = (3.8 - this.erAdmissionTimer) * 14;
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

            const tag = '🏥 +1 PATIENT SAVED AT ER! 💚';
            ctx.font = 'bold 13px monospace';
            const tw = Math.ceil(ctx.measureText(tag).width + 18);
            const by = y - 18 - rise;
            ctx.fillStyle = 'rgba(6, 78, 59, 0.98)';
            ctx.fillRect(cx - tw / 2, by, tw, 22);
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - tw / 2, by, tw, 22);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(tag, cx - tw / 2 + 7, by + 15);
        }
        ctx.restore();
    }

    renderCollisions(ctx, s, nowMs, civDrawSize) {
        for (const crash of this.collisions) {
            const cx = this.world.offsetX + crash.col * s + s / 2;
            const cy = this.world.offsetY + crash.row * s + s / 2;

            const pulse = 0.4 + 0.3 * Math.sin(nowMs / 100);
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.44, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.stroke();

            const spriteA = this.sprites[crash.civA.spriteKey];
            const spriteB = this.sprites[crash.civB.spriteKey];

            if (spriteA && spriteA.complete) {
                ctx.save();
                ctx.translate(cx - s * 0.12, cy - s * 0.08);
                ctx.rotate(0.65);
                ctx.drawImage(spriteA, -civDrawSize / 2, -civDrawSize / 2, civDrawSize, civDrawSize);
                ctx.restore();
            }
            if (spriteB && spriteB.complete) {
                ctx.save();
                ctx.translate(cx + s * 0.12, cy + s * 0.08);
                ctx.rotate(-0.85);
                ctx.drawImage(spriteB, -civDrawSize / 2, -civDrawSize / 2, civDrawSize, civDrawSize);
                ctx.restore();
            }

            const smokeOffset = (nowMs / 25) % 16;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.beginPath();
            ctx.arc(cx, cy - 4 - smokeOffset, 6 + smokeOffset * 0.25, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = Math.floor(nowMs / 120) % 2 === 0 ? '#ef4444' : '#f97316';
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();

            if (crash.clearProgress > 0) {
                const bw = 82;
                const bh = 10;
                ctx.fillStyle = '#090d16';
                ctx.fillRect(cx - bw / 2, cy - s * 0.58, bw, bh);
                ctx.fillStyle = '#f97316';
                ctx.fillRect(cx - bw / 2 + 1, cy - s * 0.58 + 1, Math.floor((bw - 2) * crash.clearProgress), bh - 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(cx - bw / 2, cy - s * 0.58, bw, bh);
            } else {
                const lbl = '💥 SEND TOW [5]';
                ctx.font = 'bold 12px monospace';
                const bw = Math.ceil(ctx.measureText(lbl).width + 16);
                const bh = 20;
                ctx.fillStyle = 'rgba(127, 29, 29, 0.96)';
                ctx.fillRect(cx - bw / 2, cy - s * 0.62, bw, bh);
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - bw / 2, cy - s * 0.62, bw, bh);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(lbl, cx - bw / 2 + 6, cy - s * 0.62 + 14);
            }
            ctx.restore();
        }
    }

    renderUnitCallsign(ctx, cx, cy, unit, isSelected) {
        const label = unit.callsign;
        ctx.font = 'bold 12px monospace';
        const bw = Math.ceil(ctx.measureText(label).width + 14);
        const bh = 19;
        const bx = Math.floor(cx - bw / 2);
        const by = Math.floor(cy - bh);

        ctx.fillStyle = isSelected ? unit.color : 'rgba(11, 17, 32, 0.94)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = isSelected ? '#ffffff' : unit.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = isSelected ? '#090d16' : '#ffffff';
        ctx.fillText(label, bx + 6, by + 14);
    }

    // ========================================================
    // SYNC INTERACTIVE DISPATCH UNIT CARDS IN DOCK
    // ========================================================
    syncHUD() {
        const container = document.getElementById('unit-dispatch-bar');
        if (!container) return;

        container.innerHTML = '';
        for (const unit of this.responders) {
            const isSelected = this.selectedUnit && this.selectedUnit.id === unit.id;
            const card = document.createElement('div');
            card.className = `unit-card ${isSelected ? 'selected' : ''}`;
            card.style.borderColor = isSelected ? unit.color : 'var(--border-color)';

            const destName = unit.inGarage
                ? 'In Station Bay'
                : (unit.status === UNIT_STATUS.TOWING
                    ? 'Hauling to Tow Shop'
                    : (unit.status === UNIT_STATUS.ER_TRANSPORT
                        ? 'Patient -> County ER'
                        : (unit.targetLot
                            ? unit.targetLot.name
                            : `Grid (${unit.targetCol}, ${unit.targetRow})`)));

            card.innerHTML = `
                <div class="unit-card-top">
                    <span class="unit-hotkey" style="background:${unit.color}">[${unit.hotkey}]</span>
                    <strong class="unit-callsign" style="color:${unit.color}">${unit.callsign}</strong>
                    <span class="unit-status-pill">${unit.status}</span>
                </div>
                <div class="unit-card-dest">${destName}</div>
                <div class="unit-card-actions">
                    <button class="unit-btn-select" data-unit="${unit.id}">${isSelected ? '🎯 SELECTED' : 'SELECT'}</button>
                    <button class="unit-btn-rtb" data-rtb="${unit.id}" title="Return Inside Station Bay" ${unit.inGarage ? 'disabled style="opacity:0.4"' : ''}>↩ BAY</button>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.dataset.rtb) {
                    e.stopPropagation();
                    this.returnUnitToBase(unit);
                    return;
                }
                this.selectUnitById(unit.id);
            });

            container.appendChild(card);
        }
    }
}

window.VehicleManager = VehicleManager;
