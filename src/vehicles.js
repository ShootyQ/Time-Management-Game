// ========================================================
// CHRONOS DISPATCH - Phase 3: Vehicle Engine & A* Navigation
// Features:
// 1. A* Shortest-Path Navigation across Road & Bridge Graph
// 2. 4 Controllable Emergency Responders with Flashing Sirens:
//    - ENGINE 4 (Fire Engine), UNIT 101 (Police Cruiser),
//      MEDIC 2 (Ambulance), CHIEF 1 (Battalion Chief SUV)
// 3. Deterministic Seeded Civilian Traffic (School Bus, Delivery Vans,
//    Taxis, Garbage Trucks, Commuters) driving in right-hand lanes
// 4. Interactive Click-to-Select & Click-to-Dispatch with Tactical Route Lines
// ========================================================

const UNIT_STATUS = {
    IDLE_AT_BASE: 'AT BASE',
    STAGED: 'STAGED',
    EN_ROUTE: 'EN ROUTE',
    ON_SCENE: 'ON SCENE',
    RETURNING: 'RETURNING'
};

class VehicleManager {
    constructor(world) {
        this.world = world;
        this.responders = [];
        this.civilians = [];
        this.selectedUnit = null;
        this.hoveredUnit = null;

        this.sprites = {};
        this.loadSprites();
    }

    loadSprites() {
        const responderKeys = [
            'responder_police_cruiser',
            'responder_fire_engine',
            'responder_ambulance',
            'responder_chief_suv'
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

    // ========================================================
    // INITIALIZE RESPONDERS & SEEDED CIVILIAN TRAFFIC
    // ========================================================
    initForWorld(seed) {
        this.prng = new PRNG(seed + 777);
        this.responders = [];
        this.civilians = [];

        const findStationRoad = (lotType, fallbackIndex = 0) => {
            const lot = this.world.lots.find(l => l.type === lotType);
            if (lot && lot.facingRoad) {
                return {
                    col: lot.facingRoad.col,
                    row: lot.facingRoad.row,
                    lot: lot
                };
            }
            // Fallback to a road node if station was not found
            const node = this.world.roadNodes[fallbackIndex % Math.max(1, this.world.roadNodes.length)] || { col: 1, row: 1 };
            return { col: node.col, row: node.row, lot: lot || null };
        };

        const fireSpawn = findStationRoad(LOT_TYPE.STATION_FIRE, 0);
        const policeSpawn = findStationRoad(LOT_TYPE.STATION_POLICE, 5);
        const hospitalSpawn = findStationRoad(LOT_TYPE.STATION_HOSPITAL, 10);

        const defs = [
            {
                id: 'unit_fire',
                callsign: 'ENGINE 4',
                role: 'Fire & Rescue Pumper',
                hotkey: '1',
                spriteBase: 'responder_fire_engine',
                color: '#ef4444',
                speedTilesPerSec: 2.6,
                spawn: fireSpawn
            },
            {
                id: 'unit_police',
                callsign: 'UNIT 101',
                role: 'Police Interceptor',
                hotkey: '2',
                spriteBase: 'responder_police_cruiser',
                color: '#3b82f6',
                speedTilesPerSec: 3.6,
                spawn: policeSpawn
            },
            {
                id: 'unit_medic',
                callsign: 'MEDIC 2',
                role: 'Paramedic Ambulance',
                hotkey: '3',
                spriteBase: 'responder_ambulance',
                color: '#10b981',
                speedTilesPerSec: 3.1,
                spawn: hospitalSpawn
            },
            {
                id: 'unit_chief',
                callsign: 'CHIEF 1',
                role: 'Battalion Command SUV',
                hotkey: '4',
                spriteBase: 'responder_chief_suv',
                color: '#f59e0b',
                speedTilesPerSec: 3.5,
                spawn: fireSpawn
            }
        ];

        defs.forEach((d, idx) => {
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
                headingRad: 0,
                status: UNIT_STATUS.IDLE_AT_BASE,
                sirenActive: false,
                unitIndex: idx
            });
        });

        // Default select Engine 4 so the player can immediately click anywhere to test dispatch
        this.selectedUnit = this.responders[0];

        // Spawn 12 deterministic civilian vehicles across the road network
        this.spawnCivilianTraffic();
        this.syncHUD();
    }

    spawnCivilianTraffic() {
        if (this.world.roadNodes.length < 4) return;

        const civPool = [
            { sprite: 'car_school_bus', name: 'School Bus #12', speed: 1.4, prefLot: LOT_TYPE.CIVIC_SCHOOL },
            { sprite: 'car_van_delivery', name: 'FreshGrocer Delivery Van', speed: 1.6, prefLot: LOT_TYPE.COMMERCIAL_SUPERMARKET },
            { sprite: 'car_garbage_truck', name: 'Municipal Sanitation Truck', speed: 1.2, prefLot: null },
            { sprite: 'car_taxi_yellow', name: 'Metro Cab #44', speed: 2.1, prefLot: LOT_TYPE.COMMERCIAL_BANK },
            { sprite: 'car_sedan_blue', name: 'Civilian Sedan', speed: 1.9, prefLot: null },
            { sprite: 'car_sedan_red', name: 'Civilian Sedan', speed: 2.0, prefLot: null },
            { sprite: 'car_sedan_silver', name: 'Commuter Sedan', speed: 1.8, prefLot: null },
            { sprite: 'car_pickup_white', name: 'Utility Pickup', speed: 1.8, prefLot: LOT_TYPE.INDUSTRIAL_WAREHOUSE },
            { sprite: 'car_suv_dark', name: 'Suburban SUV', speed: 1.9, prefLot: null },
            { sprite: 'car_sports_coupe', name: 'Sports Coupe', speed: 2.3, prefLot: null },
            { sprite: 'car_compact_green', name: 'Compact Hatchback', speed: 1.7, prefLot: null },
            { sprite: 'car_compact_orange', name: 'Compact Coupe', speed: 1.8, prefLot: null },
            { sprite: 'car_station_wagon', name: 'Family Wagon', speed: 1.6, prefLot: null }
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
                col: startNode.col,
                row: startNode.row,
                progress: 0,
                path: [],
                headingRad: 0,
                pauseTimer: 0
            };
            this.assignNextCivilianRoute(civ);
            this.civilians.push(civ);
        }
    }

    assignNextCivilianRoute(civ) {
        if (this.world.roadNodes.length < 2) return;
        let destNode = null;

        // 40% chance to drive toward preferred commercial/school lot if applicable
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
                if (dist >= 5) {
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

    // ========================================================
    // A* PATHFINDING ON ROAD & BRIDGE GRAPH
    // ========================================================
    findPath(startCol, startRow, endCol, endRow) {
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

                // Slight congestion penalty if civilian vehicles occupy that road cell
                let stepCost = 1.0;
                if (this.hasCivilianOnCell(nc, nr)) {
                    stepCost += 0.35;
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
        return this.civilians.some(civ => civ.col === c && civ.row === r);
    }

    // ========================================================
    // DISPATCH COMMANDS
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
        return this.dispatchUnit(
            this.selectedUnit,
            lot.facingRoad.col,
            lot.facingRoad.row,
            lot
        );
    }

    dispatchSelectedUnitToRoad(col, row) {
        if (!this.selectedUnit || !this.world.isRoadOrBridge(col, row)) return false;
        return this.dispatchUnit(this.selectedUnit, col, row, null);
    }

    returnUnitToBase(unit) {
        if (!unit) return false;
        const ok = this.dispatchUnit(unit, unit.homeCol, unit.homeRow, unit.homeLot, true);
        if (ok) {
            unit.status = UNIT_STATUS.RETURNING;
            unit.sirenActive = false;
            this.syncHUD();
        }
        return ok;
    }

    dispatchUnit(unit, destCol, destRow, targetLot = null, isReturn = false) {
        // Start from current tile (or next tile if already mid-step)
        const startC = unit.col;
        const startR = unit.row;
        const path = this.findPath(startC, startR, destCol, destRow);
        if (!path) return false;

        unit.targetCol = destCol;
        unit.targetRow = destRow;
        unit.targetLot = targetLot;

        if (path.length <= 1) {
            unit.path = [];
            unit.progress = 0;
            unit.status = isReturn ? UNIT_STATUS.IDLE_AT_BASE : (targetLot ? UNIT_STATUS.ON_SCENE : UNIT_STATUS.STAGED);
            unit.sirenActive = false;
        } else {
            unit.path = path.slice(1);
            unit.status = isReturn ? UNIT_STATUS.RETURNING : UNIT_STATUS.EN_ROUTE;
            unit.sirenActive = !isReturn;
            this.updateHeadingFromStep(unit, unit.col, unit.row, unit.path[0].col, unit.path[0].row);
        }

        if (window.soundManager) {
            if (isReturn) window.soundManager.playClick();
            else window.soundManager.playSirenBlip();
        }

        this.syncHUD();
        return true;
    }

    updateHeadingFromStep(vehicle, c1, r1, c2, r2) {
        const dc = c2 - c1;
        const dr = r2 - r1;
        // Sprites are drawn facing North (UP = 0 rad)
        if (dr < 0) vehicle.headingRad = 0;               // North
        else if (dc > 0) vehicle.headingRad = Math.PI / 2; // East
        else if (dr > 0) vehicle.headingRad = Math.PI;     // South
        else if (dc < 0) vehicle.headingRad = -Math.PI / 2;// West
    }

    // ========================================================
    // FRAME UPDATE (CALLED EVERY ANIMATION FRAME)
    // ========================================================
    update(dtSeconds, simSpeed = 1, isPaused = false) {
        if (isPaused) return;
        const dt = Math.min(0.1, dtSeconds) * simSpeed;

        // 1. Update Emergency Responders
        for (const unit of this.responders) {
            if (unit.path && unit.path.length > 0) {
                const nextStep = unit.path[0];
                this.updateHeadingFromStep(unit, unit.col, unit.row, nextStep.col, nextStep.row);

                // Slight slowdown if driving through heavy civilian traffic
                const trafficFactor = this.hasCivilianOnCell(unit.col, unit.row) ? 0.8 : 1.0;
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
                        if (unit.status === UNIT_STATUS.RETURNING ||
                            (unit.col === unit.homeCol && unit.row === unit.homeRow && unit.targetLot === unit.homeLot)) {
                            unit.status = UNIT_STATUS.IDLE_AT_BASE;
                            unit.sirenActive = false;
                        } else if (unit.targetLot) {
                            unit.status = UNIT_STATUS.ON_SCENE;
                            unit.sirenActive = true;
                        } else {
                            unit.status = UNIT_STATUS.STAGED;
                            unit.sirenActive = false;
                        }
                        this.syncHUD();
                    }
                }
            }
        }

        // 2. Update Seeded Civilian Traffic
        for (const civ of this.civilians) {
            if (civ.pauseTimer > 0) {
                civ.pauseTimer -= dt;
                continue;
            }

            if (civ.path && civ.path.length > 0) {
                const nextStep = civ.path[0];
                this.updateHeadingFromStep(civ, civ.col, civ.row, nextStep.col, nextStep.row);
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
                        civ.pauseTimer = 0.6;
                        this.assignNextCivilianRoute(civ);
                    }
                }
            } else {
                this.assignNextCivilianRoute(civ);
            }
        }
    }

    // Compute exact pixel coordinates with right-hand lane offset
    getVehicleWorldXY(v, isResponder = false) {
        const s = this.world.cellSize;
        let currC = v.col;
        let currR = v.row;

        if (v.path && v.path.length > 0) {
            const next = v.path[0];
            currC = v.col + (next.col - v.col) * v.progress;
            currR = v.row + (next.row - v.row) * v.progress;
        }

        const centerX = this.world.offsetX + currC * s + s / 2;
        const centerY = this.world.offsetY + currR * s + s / 2;

        // Right-hand lane offset based on heading
        const laneOffset = s * (isResponder ? 0.16 : 0.21);
        const rightAngle = v.headingRad + Math.PI / 2;
        const x = centerX + Math.cos(rightAngle) * laneOffset;
        const y = centerY + Math.sin(rightAngle) * laneOffset;

        return { x, y, centerX, centerY };
    }

    getResponderAtPixel(px, py) {
        const hitRadius = this.world.cellSize * 0.45;
        for (const unit of this.responders) {
            const pos = this.getVehicleWorldXY(unit, true);
            const dist = Math.hypot(px - pos.x, py - pos.y);
            if (dist <= hitRadius) return unit;
        }
        return null;
    }

    // ========================================================
    // RENDERING: TACTICAL ROUTES, CIVILIAN CARS & RESPONDERS
    // ========================================================
    render(ctx) {
        const s = this.world.cellSize;
        const nowMs = performance.now();
        const sirenFrame = Math.floor(nowMs / 130) % 2 === 0 ? 1 : 2;

        // 1. Render Active Tactical A* Route Lines for Responders
        for (const unit of this.responders) {
            if (unit.path && unit.path.length > 0) {
                const isSelected = this.selectedUnit && this.selectedUnit.id === unit.id;
                ctx.save();
                ctx.strokeStyle = unit.color;
                ctx.lineWidth = isSelected ? 4 : 2.5;
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -Math.floor(nowMs / 35);
                ctx.globalAlpha = isSelected ? 0.95 : 0.55;

                const startPos = this.getVehicleWorldXY(unit, true);
                ctx.beginPath();
                ctx.moveTo(startPos.centerX, startPos.centerY);

                for (const step of unit.path) {
                    const sx = this.world.offsetX + step.col * s + s / 2;
                    const sy = this.world.offsetY + step.row * s + s / 2;
                    ctx.lineTo(sx, sy);
                }
                ctx.stroke();

                // Target destination beacon
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
        const civDrawSize = Math.floor(s * 0.62);
        for (const civ of this.civilians) {
            const pos = this.getVehicleWorldXY(civ, false);
            const sprite = this.sprites[civ.spriteKey];

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(civ.headingRad);
            if (sprite && sprite.complete) {
                ctx.drawImage(sprite, -civDrawSize / 2, -civDrawSize / 2, civDrawSize, civDrawSize);
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-5, -8, 10, 16);
            }
            ctx.restore();
        }

        // 3. Render Emergency Responder Units
        const respDrawSize = Math.floor(s * 0.78);
        for (const unit of this.responders) {
            // Slight stagger when two units are parked at the same station
            let pos = this.getVehicleWorldXY(unit, true);
            if (unit.id === 'unit_chief' && unit.path.length === 0 &&
                unit.col === this.responders[0].col && unit.row === this.responders[0].row) {
                pos.x -= s * 0.24;
            }

            const isSelected = this.selectedUnit && this.selectedUnit.id === unit.id;

            // Selection ring under selected responder
            if (isSelected) {
                ctx.save();
                ctx.strokeStyle = unit.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, Math.floor(s * 0.34), 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = unit.color;
                ctx.globalAlpha = 0.18;
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
                ctx.fillRect(-6, -10, 12, 20);
            }
            ctx.restore();

            // Floating Callsign Tag above responder
            this.renderUnitCallsign(ctx, pos.x, pos.y - Math.floor(s * 0.34), unit, isSelected);
        }
    }

    renderUnitCallsign(ctx, cx, cy, unit, isSelected) {
        const label = unit.callsign;
        const bw = label.length * 5.5 + 10;
        const bh = 13;
        const bx = Math.floor(cx - bw / 2);
        const by = Math.floor(cy - bh);

        ctx.fillStyle = isSelected ? unit.color : 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = isSelected ? '#ffffff' : unit.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = isSelected ? '#090d16' : '#f8fafc';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(label, bx + 4, by + 9.5);
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

            const destName = unit.targetLot
                ? unit.targetLot.name
                : (unit.status === UNIT_STATUS.IDLE_AT_BASE ? 'Station Standby' : `Grid (${unit.targetCol}, ${unit.targetRow})`);

            card.innerHTML = `
                <div class="unit-card-top">
                    <span class="unit-hotkey" style="background:${unit.color}">[${unit.hotkey}]</span>
                    <strong class="unit-callsign" style="color:${unit.color}">${unit.callsign}</strong>
                    <span class="unit-status-pill">${unit.status}</span>
                </div>
                <div class="unit-card-dest">${destName}</div>
                <div class="unit-card-actions">
                    <button class="unit-btn-select" data-unit="${unit.id}">${isSelected ? '🎯 SELECTED (CLICK MAP)' : 'SELECT UNIT'}</button>
                    <button class="unit-btn-rtb" data-rtb="${unit.id}" title="Return to Base">↩ BASE</button>
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
