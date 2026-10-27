// ========================================================
// CHRONOS DISPATCH - Procedural Topographic & Organic Road Engine
// Features:
// 1. Locked 22x13 Aspect Ratio (scales cleanly to viewport)
// 2. 8 Distinct Macro Road Archetypes (No repetitive outer rectangle!):
//    - Serpentine S-Curve Highway, Diagonal River Valley, Pinwheel Courts,
//      Twin Harbor Peninsula, Switchback Terraces, Central Lake & Spokes,
//      Forked Arterial Groves, Cross-Town Canal & Docks
// 3. 100% Connected Road Guarantee:
//    - Zero unattached road segments (verified topological connectivity)
//    - Zero dead-end bridges (bridges always span water completely & link both banks)
//    - Zero 1-tile road "pimples" (spurs extend cleanly into L-streets or T-loops)
// 4. Distributed Multi-Tile Landmarks (2x2 & 2x1 Fire, Police, Hospital, School)
// 5. Near-Zero Dead Space: Automatic pocket streets & 2-tile estate pairing
// ========================================================

const CELL_TYPE = {
    EMPTY: 'EMPTY',
    ROAD: 'ROAD',
    WATER: 'WATER',
    BRIDGE: 'BRIDGE',
    LOT: 'LOT',
    PARK: 'PARK'
};

const LOT_TYPE = {
    STATION_FIRE: 'STATION_FIRE',
    STATION_POLICE: 'STATION_POLICE',
    STATION_HOSPITAL: 'STATION_HOSPITAL',
    COMMERCIAL_GAS: 'COMMERCIAL_GAS',
    COMMERCIAL_DINER: 'COMMERCIAL_DINER',
    CIVIC_SCHOOL: 'CIVIC_SCHOOL',
    COMMERCIAL_BANK: 'COMMERCIAL_BANK',
    COMMERCIAL_SUPERMARKET: 'COMMERCIAL_SUPERMARKET',
    INDUSTRIAL_WAREHOUSE: 'INDUSTRIAL_WAREHOUSE',
    RESIDENTIAL: 'RESIDENTIAL'
};

class World {
    constructor(canvas, seed = 1042) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.seed = seed;
        this.prng = new PRNG(seed);

        // Locked 22 cols by 13 rows aspect ratio
        this.cols = 22;
        this.rows = 13;
        this.cellSize = 56;
        this.offsetX = 0;
        this.offsetY = 0;

        this.grid = [];
        this.lots = [];
        this.parks = [];
        this.waters = [];
        this.roadNodes = [];
        this.roadEdges = [];
        this.topologyName = '';

        this.hoveredCell = null;
        this.selectedLot = null;

        this.images = {};
        this.loadAssets();

        this.resize();
        this.generate(this.seed);

        window.addEventListener('resize', () => {
            this.resize();
        });

        this.initInteractions();
    }

    resize() {
        const container = this.canvas.parentElement;
        const w = container && container.clientWidth ? container.clientWidth : window.innerWidth;
        const h = container && container.clientHeight ? container.clientHeight : (window.innerHeight - 200);

        this.canvas.width = Math.floor(w);
        this.canvas.height = Math.floor(h);

        const cellW = Math.floor(w / this.cols);
        const cellH = Math.floor(h / this.rows);
        this.cellSize = Math.max(38, Math.min(cellW, cellH));

        this.offsetX = Math.floor((this.canvas.width - this.cols * this.cellSize) / 2);
        this.offsetY = Math.floor((this.canvas.height - this.rows * this.cellSize) / 2);
    }

    loadAssets() {
        const assets = {
            'fire_station': 'assets/stations/fire_station_1.png',
            'police_station': 'assets/stations/police_station_1.png',
            'hospital': 'assets/stations/hospital_1.png',
            'gas_station': 'assets/commercial/gas_station.png',
            'diner': 'assets/commercial/diner.png',
            'school': 'assets/commercial/school.png',
            'supermarket': 'assets/commercial/supermarket.png',
            'bank': 'assets/commercial/bank.png',
            'warehouse': 'assets/commercial/industrial_warehouse.png',
            'house_01': 'assets/residential/house_01_blue_suburban.png',
            'house_02': 'assets/residential/house_02_brick_ranch.png',
            'house_03': 'assets/residential/house_03_terracotta_cottage.png',
            'house_04': 'assets/residential/house_04_modern_minimal.png',
            'house_05': 'assets/residential/house_05_craftsman_bungalow.png',
            'house_06': 'assets/residential/house_06_victorian_manor.png',
            'house_07': 'assets/residential/house_07_yellow_colonial.png',
            'house_08': 'assets/residential/house_08_brick_townhome.png',
            'house_09': 'assets/residential/house_09_log_cabin.png',
            'house_10': 'assets/residential/house_10_apartment.png'
        };

        for (const [key, src] of Object.entries(assets)) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.images[key] = img;
            };
        }
    }

    // ========================================================
    // MASTER GENERATION PIPELINE
    // ========================================================
    generate(seed) {
        this.seed = seed;
        this.prng.setSeed(seed);
        this.grid = [];
        this.lots = [];
        this.parks = [];
        this.waters = [];
        this.roadNodes = [];
        this.roadEdges = [];

        // 1. Initialize empty 22x13 grid
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = {
                    col: c,
                    row: r,
                    type: CELL_TYPE.EMPTY,
                    lot: null,
                    park: null,
                    roadType: null
                };
            }
        }

        // 2. Pick one of 8 radically different macro road archetypes
        const styleRoll = (Math.abs(Math.floor(seed)) + this.prng.range(0, 7)) % 8;
        this.generateTopology(styleRoll);

        // 3. Validate all bridges span completely across water & connect road components
        this.validateBridges();
        this.connectAllRoadComponents();
        this.cleanupRoadClumpsSafely();

        // 4. Grow organic L-streets & doglegs into open regions (leaving 2x2 pockets for landmarks)
        this.growOrganicNeighborhoodStreets();
        this.validateBridges();
        this.connectAllRoadComponents();
        this.cleanupRoadClumpsSafely();

        // 5. Place Distributed Multi-Tile Landmarks (2x2 & 2x1 Fire, Police, Hospital, School)
        this.placeLandmarkLots();

        // 6. Carve clean multi-tile streets/courts into any remaining deep pockets (no 1-tile pimples!)
        this.carveCleanPocketStreets();
        this.pruneStubbyRoadWarts();
        this.validateBridges();
        this.connectAllRoadComponents();
        this.cleanupRoadClumpsSafely();

        // 7. Classify all road intersections, corners, T-junctions, cul-de-sacs & bridges
        this.classifyRoads();

        // 8. Fill remaining road-adjacent tiles with Residential Houses & 2-tile Estates
        this.placeResidentialLots();

        // 9. Build Navigation Graph for Phase 3 A* Pathfinding
        this.buildRoadGraph();
    }

    isRoadOrBridge(c, r) {
        return c >= 0 && c < this.cols && r >= 0 && r < this.rows &&
            (this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE);
    }

    setRoadCell(c, r) {
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
            if (this.grid[r][c].type === CELL_TYPE.WATER) {
                this.grid[r][c].type = CELL_TYPE.BRIDGE;
            } else if (this.grid[r][c].type === CELL_TYPE.EMPTY) {
                this.grid[r][c].type = CELL_TYPE.ROAD;
            }
        }
    }

    setWaterCell(c, r) {
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
            this.grid[r][c].type = CELL_TYPE.WATER;
        }
    }

    drawRoadLine(c1, r1, c2, r2) {
        let c = c1;
        let r = r1;
        this.setRoadCell(c, r);
        while (c !== c2 || r !== r2) {
            if (c !== c2) c += (c2 > c ? 1 : -1);
            else if (r !== r2) r += (r2 > r ? 1 : -1);
            this.setRoadCell(c, r);
        }
    }

    drawDoglegRoad(c1, r1, c2, r2, horizFirst = true) {
        if (horizFirst) {
            const midC = Math.floor((c1 + c2) / 2);
            this.drawRoadLine(c1, r1, midC, r1);
            this.drawRoadLine(midC, r1, midC, r2);
            this.drawRoadLine(midC, r2, c2, r2);
        } else {
            const midR = Math.floor((r1 + r2) / 2);
            this.drawRoadLine(c1, r1, c1, midR);
            this.drawRoadLine(c1, midR, c2, midR);
            this.drawRoadLine(c2, midR, c2, r2);
        }
    }

    // ========================================================
    // 8 DISTINCT MACRO TOPOLOGIES (NO FIXED OUTER RECTANGLE)
    // ========================================================
    generateTopology(styleRoll) {
        if (styleRoll === 0) {
            // ARCHETYPE 0: Winding Serpentine S-Curve Highway + Branching Courts
            this.topologyName = 'SERPENTINE S-CURVE VALLEY';
            const flipV = this.prng.random() < 0.5;
            const rA = flipV ? 10 : 2;
            const rB = 6;
            const rC = flipV ? 2 : 10;

            const c1 = this.prng.range(4, 6);
            const c2 = this.prng.range(10, 12);
            const c3 = this.prng.range(16, 18);

            // Main serpentine spine from West edge to East edge
            this.drawRoadLine(0, rA, c1, rA);
            this.drawRoadLine(c1, rA, c1, rB);
            this.drawRoadLine(c1, rB, c2, rB);
            this.drawRoadLine(c2, rB, c2, rC);
            this.drawRoadLine(c2, rC, c3, rC);
            this.drawRoadLine(c3, rC, c3, rB);
            this.drawRoadLine(c3, rB, 21, rB);

            // Secondary offset collector loops (NOT a full border box)
            const oppA = flipV ? 2 : 10;
            const oppC = flipV ? 10 : 2;
            this.drawRoadLine(1, oppA, c2 - 3, oppA);
            this.drawRoadLine(1, rA, 1, oppA);
            this.drawRoadLine(c2 - 3, rB, c2 - 3, oppA);

            this.drawRoadLine(c2 + 3, oppC, 20, oppC);
            this.drawRoadLine(20, oppC, 20, rB);
            this.drawRoadLine(c2 + 3, oppC, c2 + 3, rC);

        } else if (styleRoll === 1) {
            // ARCHETYPE 1: Diagonal / Winding River Valley with 2 Strategic Bridges
            this.topologyName = 'RIVERFRONT TWIN-BANK';
            let rc = this.prng.range(8, 11);
            const dir = this.prng.choice([-1, 1]);
            const riverLeft = [];
            const riverRight = [];

            for (let r = 0; r < this.rows; r++) {
                this.setWaterCell(rc, r);
                this.setWaterCell(rc + 1, r);
                let rL = rc;
                let rR = rc + 1;
                if (r % 3 === 1) {
                    const nextRc = Math.max(6, Math.min(14, rc + dir));
                    if (nextRc < rc) {
                        this.setWaterCell(nextRc, r);
                        rL = nextRc;
                    } else if (nextRc > rc) {
                        this.setWaterCell(nextRc + 1, r);
                        rR = nextRc + 1;
                    }
                    rc = nextRc;
                }
                riverLeft[r] = rL;
                riverRight[r] = rR;
            }

            // Two cross-river bridges at stepped rows (kept well away from river bends)
            const b1 = 3;
            const b2 = 9;
            this.drawRoadLine(1, b1, 20, b1);
            this.drawRoadLine(1, b2, 20, b2);

            // West bank arterial & stepped loops
            const wCol = Math.max(4, Math.min(...riverLeft) - 2);
            this.drawRoadLine(1, 1, wCol, 1);
            this.drawRoadLine(wCol, 1, wCol, 11);
            this.drawRoadLine(1, 11, wCol, 11);
            this.drawRoadLine(1, b1, 1, b2);

            // East bank arterial & stepped loops
            const eCol = Math.min(17, Math.max(...riverRight) + 2);
            this.drawRoadLine(eCol, 1, 20, 1);
            this.drawRoadLine(eCol, 1, eCol, 11);
            this.drawRoadLine(eCol, 11, 20, 11);
            this.drawRoadLine(20, b1, 20, b2);

        } else if (styleRoll === 2) {
            // ARCHETYPE 2: Central Pinwheel Plaza & Radial Arms
            this.topologyName = 'PINWHEEL CIVIC PLAZA';
            const pLeft = this.prng.range(7, 8);
            const pRight = pLeft + 6;
            const pTop = 4;
            const pBot = 8;

            // Central ring square
            this.drawRoadLine(pLeft, pTop, pRight, pTop);
            this.drawRoadLine(pLeft, pBot, pRight, pBot);
            this.drawRoadLine(pLeft, pTop, pLeft, pBot);
            this.drawRoadLine(pRight, pTop, pRight, pBot);

            // 4 Pinwheel radial arms spinning out from corners
            this.drawRoadLine(pLeft, pTop, pLeft, 1);
            this.drawRoadLine(pLeft, 1, 1, 1);
            this.drawRoadLine(1, 1, 1, pBot - 1);
            this.drawRoadLine(1, pBot - 1, pLeft, pBot - 1);

            this.drawRoadLine(pRight, pTop, 20, pTop);
            this.drawRoadLine(20, pTop, 20, 1);
            this.drawRoadLine(20, 1, pLeft + 3, 1);
            this.drawRoadLine(pLeft + 3, 1, pLeft + 3, pTop);

            this.drawRoadLine(pRight, pBot, pRight, 11);
            this.drawRoadLine(pRight, 11, 20, 11);
            this.drawRoadLine(20, 11, 20, pTop + 1);
            this.drawRoadLine(20, pTop + 1, pRight, pTop + 1);

            this.drawRoadLine(pLeft, pBot, 1, pBot);
            this.drawRoadLine(1, pBot, 1, 11);
            this.drawRoadLine(1, 11, pRight - 3, 11);
            this.drawRoadLine(pRight - 3, 11, pRight - 3, pBot);

        } else if (styleRoll === 3) {
            // ARCHETYPE 3: Twin Harbor Bays & Coastal Peninsula
            this.topologyName = 'TWIN HARBOR PENINSULA';
            const bayTopLeft = this.prng.random() < 0.5;
            for (let r = 0; r < 5; r++) {
                const wCols = 6 - r;
                for (let d = 0; d < wCols; d++) {
                    const c = bayTopLeft ? d : (this.cols - 1 - d);
                    this.setWaterCell(c, r);
                }
            }
            for (let r = this.rows - 5; r < this.rows; r++) {
                const wCols = r - (this.rows - 6);
                for (let d = 0; d < wCols; d++) {
                    const c = bayTopLeft ? (this.cols - 1 - d) : d;
                    this.setWaterCell(c, r);
                }
            }

            if (bayTopLeft) {
                this.drawRoadLine(7, 1, 20, 1);
                this.drawRoadLine(7, 1, 7, 5);
                this.drawRoadLine(7, 5, 1, 5);
                this.drawRoadLine(1, 5, 1, 11);
                this.drawRoadLine(1, 11, 14, 11);
                this.drawRoadLine(14, 11, 14, 7);
                this.drawRoadLine(14, 7, 20, 7);
                this.drawRoadLine(20, 1, 20, 7);
                this.drawDoglegRoad(7, 5, 14, 7, true);
                this.drawRoadLine(14, 1, 14, 7);
                this.drawRoadLine(7, 5, 7, 11);
            } else {
                this.drawRoadLine(1, 1, 14, 1);
                this.drawRoadLine(14, 1, 14, 5);
                this.drawRoadLine(14, 5, 20, 5);
                this.drawRoadLine(20, 5, 20, 11);
                this.drawRoadLine(20, 11, 7, 11);
                this.drawRoadLine(7, 11, 7, 7);
                this.drawRoadLine(7, 7, 1, 7);
                this.drawRoadLine(1, 1, 1, 7);
                this.drawDoglegRoad(7, 7, 14, 5, true);
                this.drawRoadLine(7, 1, 7, 7);
                this.drawRoadLine(14, 5, 14, 11);
            }

        } else if (styleRoll === 4) {
            // ARCHETYPE 4: Switchback Terraces (Interlocking Doglegs)
            this.topologyName = 'SWITCHBACK CANYON TERRACES';
            const bands = [
                [2, 1, 3, 1],
                [6, 5, 7, 6],
                [10, 11, 9, 11]
            ];
            const splitCols = [5, 11, 16];

            for (const b of bands) {
                let cStart = 1;
                for (let i = 0; i < splitCols.length; i++) {
                    const cEnd = splitCols[i];
                    this.drawRoadLine(cStart, b[i], cEnd, b[i]);
                    this.drawRoadLine(cEnd, b[i], cEnd, b[i + 1]);
                    cStart = cEnd;
                }
                this.drawRoadLine(cStart, b[3], 20, b[3]);
            }

            this.drawRoadLine(1, bands[0][0], 1, bands[2][0]);
            this.drawRoadLine(8, bands[0][1], 8, bands[2][1]);
            this.drawRoadLine(14, bands[0][2], 14, bands[2][2]);
            this.drawRoadLine(20, bands[0][3], 20, bands[2][3]);

        } else if (styleRoll === 5) {
            // ARCHETYPE 5: Central Lake & Causeway Bridge
            this.topologyName = 'MIRROR LAKE CAUSEWAY';
            const lakeC = 8;
            const lakeW = 6;
            const lakeR = 4;
            const lakeH = 5;

            for (let r = lakeR; r < lakeR + lakeH; r++) {
                for (let c = lakeC; c < lakeC + lakeW; c++) {
                    this.setWaterCell(c, r);
                }
            }

            // Clean lakeside ring road (1 tile outside lake so no 2x2 diagonal clumps)
            const rTop = lakeR - 2;
            const rBot = lakeR + lakeH + 1;
            const cLeft = lakeC - 2;
            const cRight = lakeC + lakeW + 1;

            this.drawRoadLine(cLeft, rTop, cRight, rTop);
            this.drawRoadLine(cLeft, rBot, cRight, rBot);
            this.drawRoadLine(cLeft, rTop, cLeft, rBot);
            this.drawRoadLine(cRight, rTop, cRight, rBot);

            // Central Causeway Bridge straight across the lake!
            const bridgeC = lakeC + 3;
            this.drawRoadLine(bridgeC, rTop, bridgeC, rBot);

            // Stepped wings to West and East districts
            this.drawRoadLine(1, 1, cLeft, 1);
            this.drawRoadLine(1, 1, 1, 11);
            this.drawRoadLine(1, 11, cLeft, 11);
            this.drawRoadLine(1, 6, cLeft, 6);

            this.drawRoadLine(cRight, 1, 20, 1);
            this.drawRoadLine(20, 1, 20, 11);
            this.drawRoadLine(cRight, 11, 20, 11);
            this.drawRoadLine(cRight, 6, 20, 6);

        } else if (styleRoll === 6) {
            // ARCHETYPE 6: Y-Forked Highway & Parkway Loops
            this.topologyName = 'FORKED PARKWAY GROVES';
            const stemR = 6;
            const forkC = 9;

            // Main trunk from West edge to Fork
            this.drawRoadLine(0, stemR, forkC, stemR);

            // Upper Fork climbing in steps to North-East
            this.drawRoadLine(forkC, stemR, forkC, 2);
            this.drawRoadLine(forkC, 2, 15, 2);
            this.drawRoadLine(15, 2, 15, 1);
            this.drawRoadLine(15, 1, 20, 1);

            // Lower Fork dropping in steps to South-East
            this.drawRoadLine(forkC, stemR, forkC, 10);
            this.drawRoadLine(forkC, 10, 15, 10);
            this.drawRoadLine(15, 10, 15, 11);
            this.drawRoadLine(15, 11, 20, 11);

            // Eastern connector loops between the two forks
            this.drawRoadLine(20, 1, 20, 11);
            this.drawRoadLine(15, 2, 15, 10);
            this.drawRoadLine(forkC, 6, 20, 6);

            // Western stepped loops
            this.drawRoadLine(1, 1, 5, 1);
            this.drawRoadLine(1, 1, 1, 11);
            this.drawRoadLine(1, 11, 5, 11);
            this.drawRoadLine(5, 1, 5, 11);

        } else {
            // ARCHETYPE 7: Stepped Canal & Asymmetric Industrial Quays
            this.topologyName = 'STEPPED CANAL & QUAYS';
            const bendC = 11;
            const rWest = this.prng.choice([4, 8]);
            const rEast = rWest === 4 ? 8 : 4;

            for (let c = 0; c <= bendC; c++) this.setWaterCell(c, rWest);
            const stepR = rEast > rWest ? 1 : -1;
            for (let r = rWest; r !== rEast + stepR; r += stepR) this.setWaterCell(bendC, r);
            for (let c = bendC; c < this.cols; c++) this.setWaterCell(c, rEast);

            // Two bridges crossing the canal away from the central bend
            const bWestC = 4;
            const bEastC = 17;
            this.drawRoadLine(bWestC, 1, bWestC, 11);
            this.drawRoadLine(bEastC, 1, bEastC, 11);

            // Embankment roads & stepped loops
            this.drawRoadLine(1, 1, 20, 1);
            this.drawRoadLine(1, 11, 20, 11);
            this.drawRoadLine(1, 1, 1, bWestC === 1 ? 11 : 11);
            this.drawRoadLine(20, 1, 20, 11);

            if (rWest === 4) {
                this.drawRoadLine(1, 7, bendC - 2, 7);
                this.drawRoadLine(bendC - 2, 7, bendC - 2, 11);
                this.drawRoadLine(bendC + 2, 1, bendC + 2, 5);
                this.drawRoadLine(bendC + 2, 5, 20, 5);
            } else {
                this.drawRoadLine(1, 5, bendC - 2, 5);
                this.drawRoadLine(bendC - 2, 1, bendC - 2, 5);
                this.drawRoadLine(bendC + 2, 7, bendC + 2, 11);
                this.drawRoadLine(bendC + 2, 7, 20, 7);
            }
        }

        // Record water array for rendering
        this.waters = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.WATER) {
                    this.waters.push({ col: c, row: r });
                }
            }
        }
    }

    // ========================================================
    // BRIDGE VALIDATOR: ZERO DEAD-END BRIDGES OVER WATER
    // ========================================================
    validateBridges() {
        // Every BRIDGE cell must continue straight across any adjacent WATER cells
        // until it lands on a ROAD cell on both sides!
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type !== CELL_TYPE.BRIDGE) continue;

                // Determine if bridge is horizontal or vertical based on neighbors
                const horizWater = (c > 0 && this.grid[r][c - 1].type !== CELL_TYPE.WATER) ||
                                   (c < this.cols - 1 && this.grid[r][c + 1].type !== CELL_TYPE.WATER) ||
                                   this.isRoadOrBridge(c - 1, r) || this.isRoadOrBridge(c + 1, r);
                const vertWater = (r > 0 && this.grid[r - 1][c].type !== CELL_TYPE.WATER) ||
                                  (r < this.rows - 1 && this.grid[r + 1][c].type !== CELL_TYPE.WATER) ||
                                  this.isRoadOrBridge(c, r - 1) || this.isRoadOrBridge(c, r + 1);

                if (horizWater && !vertWater) {
                    // Extend West until hitting non-water, and ensure first land tile is ROAD
                    let cw = c - 1;
                    while (cw >= 0 && (this.grid[r][cw].type === CELL_TYPE.WATER || this.grid[r][cw].type === CELL_TYPE.BRIDGE)) {
                        this.grid[r][cw].type = CELL_TYPE.BRIDGE;
                        cw--;
                    }
                    if (cw >= 0 && this.grid[r][cw].type === CELL_TYPE.EMPTY) {
                        this.grid[r][cw].type = CELL_TYPE.ROAD;
                    }
                    // Extend East until hitting non-water, and ensure first land tile is ROAD
                    let ce = c + 1;
                    while (ce < this.cols && (this.grid[r][ce].type === CELL_TYPE.WATER || this.grid[r][ce].type === CELL_TYPE.BRIDGE)) {
                        this.grid[r][ce].type = CELL_TYPE.BRIDGE;
                        ce++;
                    }
                    if (ce < this.cols && this.grid[r][ce].type === CELL_TYPE.EMPTY) {
                        this.grid[r][ce].type = CELL_TYPE.ROAD;
                    }
                } else if (vertWater) {
                    // Extend North
                    let rn = r - 1;
                    while (rn >= 0 && (this.grid[rn][c].type === CELL_TYPE.WATER || this.grid[rn][c].type === CELL_TYPE.BRIDGE)) {
                        this.grid[rn][c].type = CELL_TYPE.BRIDGE;
                        rn--;
                    }
                    if (rn >= 0 && this.grid[rn][c].type === CELL_TYPE.EMPTY) {
                        this.grid[rn][c].type = CELL_TYPE.ROAD;
                    }
                    // Extend South
                    let rs = r + 1;
                    while (rs < this.rows && (this.grid[rs][c].type === CELL_TYPE.WATER || this.grid[rs][c].type === CELL_TYPE.BRIDGE)) {
                        this.grid[rs][c].type = CELL_TYPE.BRIDGE;
                        rs++;
                    }
                    if (rs < this.rows && this.grid[rs][c].type === CELL_TYPE.EMPTY) {
                        this.grid[rs][c].type = CELL_TYPE.ROAD;
                    }
                }
            }
        }

        // Refresh water list if any water tile became a bridge
        this.waters = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.WATER) {
                    this.waters.push({ col: c, row: r });
                }
            }
        }
    }

    // ========================================================
    // ORGANIC NEIGHBORHOOD SUBDIVISION (L-BENDS & T-JUNCTIONS)
    // ========================================================
    growOrganicNeighborhoodStreets() {
        for (let pass = 0; pass < 24; pass++) {
            let deepestCell = null;
            let maxDist = 0;

            // Include all rows (0..rows-1) and cols (0..cols-1) so map edges/corners are never ignored!
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c].type !== CELL_TYPE.EMPTY) continue;
                    const d = this.distanceToNearestRoad(c, r);
                    if (d > maxDist) {
                        maxDist = d;
                        deepestCell = { c, r };
                    }
                }
            }

            // Stop when all open spaces are within 2 tiles of a road (leaving 2x2 pockets for landmarks)
            if (!deepestCell || maxDist <= 2) break;

            // Pull target 1 tile inward from the extreme map border so the road serves the border row of houses
            const targetC = Math.max(1, Math.min(this.cols - 2, deepestCell.c));
            const targetR = Math.max(1, Math.min(this.rows - 2, deepestCell.r));

            const nearestRoad = this.findNearestRoadCell(targetC, targetR);
            if (!nearestRoad) break;

            const horizFirst = Math.abs(targetC - nearestRoad.c) >= Math.abs(targetR - nearestRoad.r);
            this.carveSafePath(nearestRoad.c, nearestRoad.r, targetC, targetR, horizFirst);
        }
    }

    carveSafePath(c1, r1, c2, r2, horizFirst) {
        let c = c1;
        let r = r1;
        const stepC = c2 > c1 ? 1 : -1;
        const stepR = r2 > r1 ? 1 : -1;

        const trySet = (x, y) => {
            if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                if (this.grid[y][x].type === CELL_TYPE.EMPTY && !this.wouldCreateRoadClump(x, y)) {
                    this.grid[y][x].type = CELL_TYPE.ROAD;
                    return true;
                }
                return this.isRoadOrBridge(x, y);
            }
            return false;
        };

        if (horizFirst) {
            while (c !== c2) { c += stepC; if (!trySet(c, r)) break; }
            while (r !== r2) { r += stepR; if (!trySet(c, r)) break; }
        } else {
            while (r !== r2) { r += stepR; if (!trySet(c, r)) break; }
            while (c !== c2) { c += stepC; if (!trySet(c, r)) break; }
        }
    }

    // Carve clean multi-tile streets into any remaining landlocked pockets after landmarks place
    carveCleanPocketStreets() {
        for (let pass = 0; pass < 20; pass++) {
            let bestCandidate = null;
            let bestScore = 0;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c].type !== CELL_TYPE.EMPTY) continue;
                    if (!this.getAdjacentRoad(c, r)) continue;
                    if (this.wouldCreateRoadClump(c, r)) continue;

                    // Count how many currently-landlocked EMPTY neighbors this tile would unlock
                    let unlocked = 0;
                    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                        const nc = c + dc;
                        const nr = r + dr;
                        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                            if (this.grid[nr][nc].type === CELL_TYPE.EMPTY && !this.getAdjacentRoad(nc, nr)) {
                                unlocked++;
                            }
                        }
                    }

                    // Only extend a road if it unlocks at least 2 landlocked cells (avoids 1-tile warts for single cells)
                    if (unlocked >= 2 && unlocked > bestScore) {
                        bestScore = unlocked;
                        bestCandidate = { c, r };
                    }
                }
            }

            if (bestCandidate) {
                this.grid[bestCandidate.r][bestCandidate.c].type = CELL_TYPE.ROAD;
            } else {
                break;
            }
        }
    }

    // Remove any 1-tile stubby road "warts" sticking out from straight roads unless needed
    pruneStubbyRoadWarts() {
        let changed = true;
        while (changed) {
            changed = false;
            for (let r = 1; r < this.rows - 1; r++) {
                for (let c = 1; c < this.cols - 1; c++) {
                    if (this.grid[r][c].type !== CELL_TYPE.ROAD) continue;

                    const neighbors = [];
                    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                        if (this.isRoadOrBridge(c + dc, r + dr)) {
                            neighbors.push({ c: c + dc, r: r + dr });
                        }
                    }

                    // If this road cell is a dead-end (only 1 road neighbor)
                    if (neighbors.length === 1) {
                        const parent = neighbors[0];
                        let parentDegree = 0;
                        for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                            if (this.isRoadOrBridge(parent.c + dc, parent.r + dr)) parentDegree++;
                        }
                        // If it's a 1-tile wart sticking off an intersection (parentDegree >= 3)
                        // and no landmark depends exclusively on it, revert it to EMPTY!
                        if (parentDegree >= 3 && !this.landmarkDependsOnRoad(c, r)) {
                            this.grid[r][c].type = CELL_TYPE.EMPTY;
                            changed = true;
                        }
                    }
                }
            }
        }
    }

    landmarkDependsOnRoad(rc, rr) {
        for (const lot of this.lots) {
            let touchesOtherRoad = false;
            let touchesThisRoad = false;
            for (let dy = 0; dy < lot.h; dy++) {
                for (let dx = 0; dx < lot.w; dx++) {
                    const lc = lot.col + dx;
                    const lr = lot.row + dy;
                    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                        const nc = lc + dc;
                        const nr = lr + dr;
                        if (nc === rc && nr === rr) touchesThisRoad = true;
                        else if (this.isRoadOrBridge(nc, nr)) touchesOtherRoad = true;
                    }
                }
            }
            if (touchesThisRoad && !touchesOtherRoad) return true;
        }
        return false;
    }

    distanceToNearestRoad(c, r) {
        let minD = 999;
        for (let rr = 0; rr < this.rows; rr++) {
            for (let cc = 0; cc < this.cols; cc++) {
                if (this.isRoadOrBridge(cc, rr)) {
                    const d = Math.abs(cc - c) + Math.abs(rr - r);
                    if (d < minD) minD = d;
                }
            }
        }
        return minD;
    }

    findNearestRoadCell(c, r) {
        let best = null;
        let minD = 999;
        for (let rr = 0; rr < this.rows; rr++) {
            for (let cc = 0; cc < this.cols; cc++) {
                if (this.isRoadOrBridge(cc, rr)) {
                    const d = Math.abs(cc - c) + Math.abs(rr - r);
                    if (d < minD) {
                        minD = d;
                        best = { c: cc, r: rr };
                    }
                }
            }
        }
        return best;
    }

    wouldCreateRoadClump(c, r) {
        const isR = (x, y) => {
            if (x === c && y === r) return true;
            return this.isRoadOrBridge(x, y);
        };
        for (const dy of [-1, 0]) {
            for (const dx of [-1, 0]) {
                if (isR(c + dx, r + dy) && isR(c + dx + 1, r + dy) &&
                    isR(c + dx, r + dy + 1) && isR(c + dx + 1, r + dy + 1)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Safely removes 2x2 road clumps ONLY when doing so does NOT disconnect the road graph or strand a bridge
    cleanupRoadClumpsSafely() {
        let cleaned = true;
        while (cleaned) {
            cleaned = false;
            for (let r = 0; r < this.rows - 1; r++) {
                for (let c = 0; c < this.cols - 1; c++) {
                    if (this.isRoadOrBridge(c, r) && this.isRoadOrBridge(c + 1, r) &&
                        this.isRoadOrBridge(c, r + 1) && this.isRoadOrBridge(c + 1, r + 1)) {

                        const corners = [[c + 1, r + 1], [c, r + 1], [c + 1, r], [c, r]];
                        for (const [cx, cy] of corners) {
                            if (this.grid[cy][cx].type !== CELL_TYPE.ROAD) continue;
                            if (this.touchesBridge(cx, cy)) continue;
                            if (this.landmarkDependsOnRoad(cx, cy)) continue;

                            // Temporarily remove and verify road graph remains 100% connected
                            this.grid[cy][cx].type = CELL_TYPE.EMPTY;
                            if (this.countRoadComponents() <= 1) {
                                cleaned = true;
                                break;
                            } else {
                                // Restore! Removing this tile would sever the road network!
                                this.grid[cy][cx].type = CELL_TYPE.ROAD;
                            }
                        }
                    }
                }
            }
        }
    }

    touchesBridge(c, r) {
        for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nc = c + dc;
            const nr = r + dr;
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                if (this.grid[nr][nc].type === CELL_TYPE.BRIDGE) return true;
            }
        }
        return false;
    }

    getRoadComponents() {
        const components = [];
        const visited = new Set();

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.isRoadOrBridge(c, r) && !visited.has(`${c},${r}`)) {
                    const comp = [];
                    const queue = [{ c, r }];
                    visited.add(`${c},${r}`);
                    while (queue.length > 0) {
                        const curr = queue.shift();
                        comp.push(curr);
                        for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                            const nc = curr.c + dc;
                            const nr = curr.r + dr;
                            const key = `${nc},${nr}`;
                            if (this.isRoadOrBridge(nc, nr) && !visited.has(key)) {
                                visited.add(key);
                                queue.push({ c: nc, r: nr });
                            }
                        }
                    }
                    components.push(comp);
                }
            }
        }
        return components;
    }

    countRoadComponents() {
        return this.getRoadComponents().length;
    }

    // Guarantees 100% of roads are connected into ONE unified network
    connectAllRoadComponents() {
        for (let iter = 0; iter < 12; iter++) {
            const components = this.getRoadComponents();
            if (components.length <= 1) break;

            // Sort components largest first
            components.sort((a, b) => b.length - a.length);

            const mainComp = components[0];
            const subComp = components[1];

            // If subComp is a tiny isolated 1-2 tile fragment not holding a bridge, remove it cleanly
            const hasBridge = subComp.some(cell => this.grid[cell.r][cell.c].type === CELL_TYPE.BRIDGE);
            if (subComp.length <= 2 && !hasBridge) {
                for (const cell of subComp) {
                    this.grid[cell.r][cell.c].type = CELL_TYPE.EMPTY;
                }
                continue;
            }

            // Otherwise, connect subComp to mainComp via the shortest orthogonal road line
            let bestA = null;
            let bestB = null;
            let minD = 999;

            for (const a of mainComp) {
                for (const b of subComp) {
                    const d = Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
                    if (d < minD) {
                        minD = d;
                        bestA = a;
                        bestB = b;
                    }
                }
            }

            if (bestA && bestB) {
                this.drawRoadLine(bestA.c, bestA.r, bestB.c, bestB.r);
                this.validateBridges();
            }
        }
    }

    // ========================================================
    // DISTRIBUTED MULTI-TILE LANDMARKS (2x2 & 2x1)
    // ========================================================
    placeLandmarkLots() {
        const majorLandmarks = [
            { type: LOT_TYPE.STATION_HOSPITAL, name: 'County General Hospital', address: '100 Medical Way', sprite: 'hospital', w: 2, h: 2, hazard: 'Dispatches Paramedic Unit' },
            { type: LOT_TYPE.STATION_FIRE, name: 'Engine Co. 4 Firehouse', address: '12 Firehouse Lane', sprite: 'fire_station', w: 2, h: 2, hazard: 'Dispatches Fire Engine' },
            { type: LOT_TYPE.STATION_POLICE, name: 'Precinct 9 Police HQ', address: '50 Civic Plaza', sprite: 'police_station', w: 2, h: 2, hazard: 'Dispatches Police Patrol' },
            { type: LOT_TYPE.CIVIC_SCHOOL, name: 'Lincoln Elementary School', address: '85 School Lane', sprite: 'school', w: 2, h: 2, hazard: '08:15 School Bell Pedestrian Jam' },
            { type: LOT_TYPE.COMMERCIAL_SUPERMARKET, name: 'FreshGrocer Supermarket', address: '150 Commercial St', sprite: 'supermarket', w: 2, h: 1, hazard: 'Delivery Truck Bottleneck' },
            { type: LOT_TYPE.INDUSTRIAL_WAREHOUSE, name: 'Keystone Chemical Storage', address: '300 Industrial Blvd', sprite: 'warehouse', w: 2, h: 1, hazard: 'Chemical Cascade Hazard' },
            { type: LOT_TYPE.COMMERCIAL_GAS, name: 'Apex Gas & Fuel', address: '200 Main Highway', sprite: 'gas_station', w: 1, h: 1, hazard: 'High Explosion Risk (90s Timer)' },
            { type: LOT_TYPE.COMMERCIAL_DINER, name: 'Sunrise 24/7 Diner', address: '44 Main Street', sprite: 'diner', w: 1, h: 1, hazard: 'Grease Fryer Fire Risk' },
            { type: LOT_TYPE.COMMERCIAL_BANK, name: 'First National Bank', address: '10 Bank Street', sprite: 'bank', w: 1, h: 1, hazard: 'Silent Alarm / Robbery Risk' }
        ];

        const allCoords = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                allCoords.push({ c, r });
            }
        }

        const placedMajorCenters = [];

        for (const spec of majorLandmarks) {
            this.prng.shuffle(allCoords);
            let placed = false;

            const shapesToTry = (spec.w === 2 && spec.h === 2)
                ? [{ w: 2, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 2 }]
                : (spec.w === 2 && spec.h === 1)
                    ? [{ w: 2, h: 1 }, { w: 1, h: 2 }]
                    : [{ w: 1, h: 1 }];

            for (const shape of shapesToTry) {
                if (placed) break;
                for (const minSpacing of [6, 4, 2, 0]) {
                    if (placed) break;
                    for (const pos of allCoords) {
                        if (this.canFitLot(pos.c, pos.r, shape.w, shape.h)) {
                            const tooClose = placedMajorCenters.some(
                                p => Math.abs(p.c - pos.c) + Math.abs(p.r - pos.r) < minSpacing
                            );
                            if (tooClose) continue;

                            this.commitLot(pos.c, pos.r, shape.w, shape.h, spec);
                            if (spec.w >= 2) {
                                placedMajorCenters.push(pos);
                            }
                            placed = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    commitLot(c, r, w, h, spec) {
        let facingRoad = null;
        for (let dy = 0; dy < h && !facingRoad; dy++) {
            for (let dx = 0; dx < w && !facingRoad; dx++) {
                facingRoad = this.getAdjacentRoad(c + dx, r + dy);
            }
        }

        const lot = {
            id: `lot_${c}_${r}`,
            col: c,
            row: r,
            w: w,
            h: h,
            facingRoad: facingRoad,
            type: spec.type,
            name: spec.name,
            address: spec.address,
            spriteKey: spec.sprite,
            hazard: spec.hazard,
            isRoot: true,
            onFire: false
        };

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.grid[r + dy][c + dx].type = CELL_TYPE.LOT;
                this.grid[r + dy][c + dx].lot = lot;
            }
        }
        this.lots.push(lot);
    }

    canFitLot(c, r, w, h) {
        if (c < 0 || r < 0 || c + w > this.cols || r + h > this.rows) return false;
        let touchesRoad = false;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const cell = this.grid[r + dy][c + dx];
                if (cell.type !== CELL_TYPE.EMPTY) return false;
                if (!touchesRoad && this.getAdjacentRoad(c + dx, r + dy)) {
                    touchesRoad = true;
                }
            }
        }
        return touchesRoad;
    }

    placeResidentialLots() {
        const streetNames = ['Oak St', 'Elm Ave', 'Maple Ct', 'Cedar Way', 'Pine Rd', 'Willow Ln', 'Birch St', '4th Ave', 'River Rd', 'Grand Blvd'];
        let houseNum = 1;

        // Pass 1: Pair any landlocked EMPTY cell with an adjacent road-touching EMPTY cell
        // into a 2-tile Residential Duplex / Estate so almost ZERO dead squares ever occur!
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.EMPTY && !this.getAdjacentRoad(c, r)) {
                    const dirs = [
                        { dc: -1, dr: 0, rootC: c - 1, rootR: r, w: 2, h: 1 },
                        { dc: 1, dr: 0, rootC: c, rootR: r, w: 2, h: 1 },
                        { dc: 0, dr: -1, rootC: c, rootR: r - 1, w: 1, h: 2 },
                        { dc: 0, dr: 1, rootC: c, rootR: r, w: 1, h: 2 }
                    ];
                    for (const d of dirs) {
                        const nc = c + d.dc;
                        const nr = r + d.dr;
                        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                            if (this.grid[nr][nc].type === CELL_TYPE.EMPTY && this.getAdjacentRoad(nc, nr)) {
                                const houseVariant = (this.prng.range(1, 10)).toString().padStart(2, '0');
                                const street = this.prng.choice(streetNames);
                                this.commitLot(d.rootC, d.rootR, d.w, d.h, {
                                    type: LOT_TYPE.RESIDENTIAL,
                                    name: `Residence #${houseNum} Estate`,
                                    address: `${this.prng.range(10, 99)} ${street}`,
                                    sprite: `house_${houseVariant}`,
                                    hazard: 'Domestic / Kitchen Fire Risk'
                                });
                                houseNum++;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Pass 2: Fill all remaining road-adjacent EMPTY cells with standard 1x1 Houses
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.EMPTY) {
                    const adjRoad = this.getAdjacentRoad(c, r);
                    if (adjRoad) {
                        const houseVariant = (this.prng.range(1, 10)).toString().padStart(2, '0');
                        const street = this.prng.choice(streetNames);
                        const lot = {
                            id: `lot_${c}_${r}`,
                            col: c,
                            row: r,
                            w: 1,
                            h: 1,
                            isRoot: true,
                            facingRoad: adjRoad,
                            type: LOT_TYPE.RESIDENTIAL,
                            name: `Residence #${houseNum}`,
                            address: `${this.prng.range(10, 99)} ${street}`,
                            spriteKey: `house_${houseVariant}`,
                            hazard: 'Domestic / Kitchen Fire Risk',
                            onFire: false
                        };
                        this.grid[r][c].type = CELL_TYPE.LOT;
                        this.grid[r][c].lot = lot;
                        this.lots.push(lot);
                        houseNum++;
                    } else {
                        this.grid[r][c].type = CELL_TYPE.PARK;
                        this.parks.push({ col: c, row: r });
                    }
                }
            }
        }
    }

    getAdjacentRoad(c, r) {
        const deltas = [
            { dc: 0, dr: -1, dir: 'N' },
            { dc: 0, dr: 1, dir: 'S' },
            { dc: -1, dr: 0, dir: 'W' },
            { dc: 1, dr: 0, dir: 'E' }
        ];
        for (const d of deltas) {
            const nc = c + d.dc;
            const nr = r + d.dr;
            if (this.isRoadOrBridge(nc, nr)) {
                return { col: nc, row: nr, dir: d.dir };
            }
        }
        return null;
    }

    classifyRoads() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.isRoadOrBridge(c, r)) continue;

                // Treat map-border roads that connect inward as continuing off-map (highway entry/exit)
                let N = this.isRoadOrBridge(c, r - 1);
                let S = this.isRoadOrBridge(c, r + 1);
                let W = this.isRoadOrBridge(c - 1, r);
                let E = this.isRoadOrBridge(c + 1, r);

                if (r === 0 && S && !W && !E) N = true;
                if (r === this.rows - 1 && N && !W && !E) S = true;
                if (c === 0 && E && !N && !S) W = true;
                if (c === this.cols - 1 && W && !N && !S) E = true;

                const count = (N ? 1 : 0) + (S ? 1 : 0) + (W ? 1 : 0) + (E ? 1 : 0);

                if (count === 4) {
                    this.grid[r][c].roadType = '4WAY';
                } else if (count === 3) {
                    if (!N) this.grid[r][c].roadType = '3WAY_S';
                    else if (!S) this.grid[r][c].roadType = '3WAY_N';
                    else if (!W) this.grid[r][c].roadType = '3WAY_E';
                    else this.grid[r][c].roadType = '3WAY_W';
                } else if (count === 2) {
                    if (N && S) this.grid[r][c].roadType = 'STRAIGHT_V';
                    else if (W && E) this.grid[r][c].roadType = 'STRAIGHT_H';
                    else if (N && E) this.grid[r][c].roadType = 'CORNER_NE';
                    else if (N && W) this.grid[r][c].roadType = 'CORNER_NW';
                    else if (S && E) this.grid[r][c].roadType = 'CORNER_SE';
                    else if (S && W) this.grid[r][c].roadType = 'CORNER_SW';
                } else if (count === 1) {
                    if (N) this.grid[r][c].roadType = 'CUL_DE_SAC_N';
                    else if (S) this.grid[r][c].roadType = 'CUL_DE_SAC_S';
                    else if (W) this.grid[r][c].roadType = 'CUL_DE_SAC_W';
                    else this.grid[r][c].roadType = 'CUL_DE_SAC_E';
                } else {
                    this.grid[r][c].roadType = 'STRAIGHT_H';
                }
            }
        }
    }

    buildRoadGraph() {
        this.roadNodes = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.isRoadOrBridge(c, r)) {
                    this.roadNodes.push({
                        id: `road_${c}_${r}`,
                        col: c,
                        row: r,
                        x: this.offsetX + c * this.cellSize + this.cellSize / 2,
                        y: this.offsetY + r * this.cellSize + this.cellSize / 2
                    });
                }
            }
        }

        this.roadEdges = [];
        for (let i = 0; i < this.roadNodes.length; i++) {
            const a = this.roadNodes[i];
            for (let j = i + 1; j < this.roadNodes.length; j++) {
                const b = this.roadNodes[j];
                const dist = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
                if (dist === 1) {
                    this.roadEdges.push({ from: a.id, to: b.id, length: this.cellSize });
                }
            }
        }
    }

    initInteractions() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left - this.offsetX;
            const y = e.clientY - rect.top - this.offsetY;

            const c = Math.floor(x / this.cellSize);
            const r = Math.floor(y / this.cellSize);

            if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                this.hoveredCell = this.grid[r][c];
            } else {
                this.hoveredCell = null;
            }
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoveredCell && this.hoveredCell.lot) {
                this.selectedLot = this.hoveredCell.lot;
                window.soundManager.playClick();
            }
        });
    }

    // ========================================================
    // RENDERING PIPELINE
    // ========================================================
    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#14532d';
        ctx.fillRect(this.offsetX, this.offsetY, this.cols * this.cellSize, this.rows * this.cellSize);

        ctx.fillStyle = '#166534';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if ((r + c) % 2 === 0) {
                    ctx.fillRect(this.offsetX + c * this.cellSize, this.offsetY + r * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }

        // 1. Render Water
        for (const water of this.waters) {
            this.renderWater(water);
        }

        // 2. Render Pocket Parks
        for (const park of this.parks) {
            this.renderPark(park);
        }

        // 3. Render Roads & Bridges
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.renderRoadTile(c, r, this.grid[r][c].roadType);
                } else if (this.grid[r][c].type === CELL_TYPE.BRIDGE) {
                    this.renderBridgeTile(c, r, this.grid[r][c].roadType);
                }
            }
        }

        // 4. Render Building Lots
        for (const lot of this.lots) {
            if (lot.isRoot) {
                this.renderLot(lot);
            }
        }

        // 5. Render Overlays & Tooltips
        this.renderOverlays();
    }

    renderWater(water) {
        const ctx = this.ctx;
        const x = this.offsetX + water.col * this.cellSize;
        const y = this.offsetY + water.row * this.cellSize;
        const s = this.cellSize;

        ctx.fillStyle = '#0369a1';
        ctx.fillRect(x, y, s, s);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 6, y + Math.floor(s * 0.3), Math.floor(s * 0.25), 2);
        ctx.fillRect(x + Math.floor(s * 0.5), y + Math.floor(s * 0.65), Math.floor(s * 0.3), 2);
    }

    renderBridgeTile(c, r, roadType) {
        const ctx = this.ctx;
        const x = this.offsetX + c * this.cellSize;
        const y = this.offsetY + r * this.cellSize;
        const s = this.cellSize;
        const half = s / 2;

        ctx.fillStyle = '#0369a1';
        ctx.fillRect(x, y, s, s);

        const isHoriz = roadType === 'STRAIGHT_H' || this.isRoadOrBridge(c - 1, r) || this.isRoadOrBridge(c + 1, r);

        ctx.fillStyle = '#334155';
        if (isHoriz) {
            ctx.fillRect(x, y + 4, s, s - 8);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x, y + 2, s, 3);
            ctx.fillRect(x, y + s - 5, s, 3);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(x + 6, y + half - 1, s - 12, 3);
        } else {
            ctx.fillRect(x + 4, y, s - 8, s);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x + 2, y, 3, s);
            ctx.fillRect(x + s - 5, y, 3, s);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(x + half - 1, y + 6, 3, s - 12);
        }
    }

    renderPark(park) {
        const ctx = this.ctx;
        const x = this.offsetX + park.col * this.cellSize;
        const y = this.offsetY + park.row * this.cellSize;
        const s = this.cellSize;

        ctx.fillStyle = '#0f4625';
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

        ctx.fillStyle = '#14532d';
        ctx.beginPath(); ctx.arc(x + s / 3, y + s / 3, s / 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + (s * 2) / 3, y + (s * 2) / 3, s / 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath(); ctx.arc(x + s / 3 - 2, y + s / 3 - 2, s / 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + (s * 2) / 3 - 2, y + (s * 2) / 3 - 2, s / 7, 0, Math.PI * 2); ctx.fill();
    }

    renderRoadTile(c, r, roadType) {
        const ctx = this.ctx;
        const x = this.offsetX + c * this.cellSize;
        const y = this.offsetY + r * this.cellSize;
        const s = this.cellSize;
        const half = s / 2;

        ctx.fillStyle = '#27272a';
        ctx.fillRect(x, y, s, s);

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;

        let N = this.isRoadOrBridge(c, r - 1);
        let S = this.isRoadOrBridge(c, r + 1);
        let W = this.isRoadOrBridge(c - 1, r);
        let E = this.isRoadOrBridge(c + 1, r);

        if (r === 0 && S && !W && !E) N = true;
        if (r === this.rows - 1 && N && !W && !E) S = true;
        if (c === 0 && E && !N && !S) W = true;
        if (c === this.cols - 1 && W && !N && !S) E = true;

        if (!N) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + s, y + 2); ctx.stroke(); }
        if (!S) { ctx.beginPath(); ctx.moveTo(x, y + s - 2); ctx.lineTo(x + s, y + s - 2); ctx.stroke(); }
        if (!W) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + s); ctx.stroke(); }
        if (!E) { ctx.beginPath(); ctx.moveTo(x + s - 2, y); ctx.lineTo(x + s - 2, y + s); ctx.stroke(); }

        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(2, Math.floor(s / 18));

        if (roadType === 'STRAIGHT_H') {
            const dashW = Math.floor(s / 4);
            ctx.fillRect(x + 3, y + half - 2, dashW, 3);
            ctx.fillRect(x + half - dashW / 2, y + half - 2, dashW, 3);
            ctx.fillRect(x + s - dashW - 3, y + half - 2, dashW, 3);
        } else if (roadType === 'STRAIGHT_V') {
            const dashH = Math.floor(s / 4);
            ctx.fillRect(x + half - 2, y + 3, 3, dashH);
            ctx.fillRect(x + half - 2, y + half - dashH / 2, 3, dashH);
            ctx.fillRect(x + half - 2, y + s - dashH - 3, 3, dashH);
        } else if (roadType === 'CORNER_NE') {
            ctx.beginPath(); ctx.arc(x + s, y, half, Math.PI / 2, Math.PI); ctx.stroke();
        } else if (roadType === 'CORNER_NW') {
            ctx.beginPath(); ctx.arc(x, y, half, 0, Math.PI / 2); ctx.stroke();
        } else if (roadType === 'CORNER_SE') {
            ctx.beginPath(); ctx.arc(x + s, y + s, half, Math.PI, (3 * Math.PI) / 2); ctx.stroke();
        } else if (roadType === 'CORNER_SW') {
            ctx.beginPath(); ctx.arc(x, y + s, half, (3 * Math.PI) / 2, 0);
            ctx.stroke();
        } else if (roadType === '4WAY') {
            ctx.fillStyle = '#f8fafc';
            const step = Math.max(6, Math.floor(s / 7));
            for (let i = 4; i < s - 4; i += step) {
                ctx.fillRect(x + i, y + 3, step - 2, 5);
                ctx.fillRect(x + i, y + s - 8, step - 2, 5);
                ctx.fillRect(x + 3, y + i, 5, step - 2);
                ctx.fillRect(x + s - 8, y + i, 5, step - 2);
            }
        } else if (roadType && roadType.startsWith('3WAY')) {
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(x + half, y + half, 3, 0, Math.PI * 2); ctx.fill();
        } else if (roadType && roadType.startsWith('CUL_DE_SAC')) {
            ctx.fillStyle = '#3f3f46';
            ctx.beginPath(); ctx.arc(x + half, y + half, Math.floor(s * 0.32), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x + half, y + half, Math.floor(s * 0.14), 0, Math.PI * 2); ctx.stroke();
        }
    }

    renderLot(lot) {
        const ctx = this.ctx;
        const x = this.offsetX + lot.col * this.cellSize;
        const y = this.offsetY + lot.row * this.cellSize;
        const s = this.cellSize;
        const w = (lot.w || 1) * s;
        const h = (lot.h || 1) * s;

        if (lot.w > 1 || lot.h > 1) {
            ctx.fillStyle = lot.type === LOT_TYPE.RESIDENTIAL ? '#14532d' : '#334155';
            ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
            ctx.strokeStyle = lot.type === LOT_TYPE.RESIDENTIAL ? '#22c55e' : '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        }

        if (lot.facingRoad) {
            ctx.fillStyle = '#475569';
            const dw = Math.floor(s * 0.35);
            const dh = Math.floor(s * 0.16);
            if (lot.facingRoad.dir === 'S') ctx.fillRect(x + (w - dw) / 2, y + h - dh, dw, dh);
            if (lot.facingRoad.dir === 'N') ctx.fillRect(x + (w - dw) / 2, y, dw, dh);
            if (lot.facingRoad.dir === 'E') ctx.fillRect(x + w - dh, y + (h - dw) / 2, dh, dw);
            if (lot.facingRoad.dir === 'W') ctx.fillRect(x, y + (h - dw) / 2, dh, dw);
        }

        const sprite = this.images[lot.spriteKey];
        if (sprite && sprite.complete) {
            if (lot.w === 2 && lot.h === 1) {
                ctx.drawImage(sprite, x + 2, y + 2, s - 4, s - 4);
                this.renderCompoundYard(x + s, y, s, lot.type);
            } else if (lot.w === 1 && lot.h === 2) {
                ctx.drawImage(sprite, x + 2, y + 2, s - 4, s - 4);
                this.renderCompoundYard(x, y + s, s, lot.type);
            } else {
                ctx.drawImage(sprite, x + 2, y + 2, w - 4, h - 4);
            }
        } else {
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        }

        if (lot.type === LOT_TYPE.STATION_FIRE) this.renderBadge(x + 4, y + 4, '🚒 FIRE HQ', '#ef4444');
        else if (lot.type === LOT_TYPE.STATION_POLICE) this.renderBadge(x + 4, y + 4, '🚓 POLICE HQ', '#3b82f6');
        else if (lot.type === LOT_TYPE.STATION_HOSPITAL) this.renderBadge(x + 4, y + 4, '🚑 HOSPITAL ER', '#10b981');
        else if (lot.type === LOT_TYPE.CIVIC_SCHOOL) this.renderBadge(x + 4, y + 4, '🏫 SCHOOL', '#f59e0b');
    }

    renderCompoundYard(yx, yy, s, lotType) {
        const ctx = this.ctx;
        if (lotType === LOT_TYPE.RESIDENTIAL) {
            ctx.fillStyle = '#15803d';
            ctx.fillRect(yx + 5, yy + 5, s - 10, s - 10);
            ctx.fillStyle = '#166534';
            ctx.beginPath(); ctx.arc(yx + s * 0.35, yy + s * 0.4, s * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(yx + s * 0.68, yy + s * 0.65, s * 0.15, 0, Math.PI * 2); ctx.fill();
            return;
        }

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(yx + 4, yy + 6, s - 8, s - 12);

        ctx.strokeStyle = lotType === LOT_TYPE.STATION_FIRE ? '#ef4444' : (lotType === LOT_TYPE.STATION_POLICE ? '#3b82f6' : '#facc15');
        ctx.lineWidth = 1;
        for (let i = 10; i < s - 10; i += 10) {
            ctx.beginPath();
            ctx.moveTo(yx + i, yy + 8);
            ctx.lineTo(yx + i, yy + 24);
            ctx.stroke();
        }
    }

    renderBadge(bx, by, label, badgeColor) {
        const ctx = this.ctx;
        const bw = label.length * 6 + 14;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(bx, by, bw, 16);
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(label, bx + 4, by + 11);
    }

    renderOverlays() {
        const ctx = this.ctx;

        if (this.hoveredCell && this.hoveredCell.lot) {
            const lot = this.hoveredCell.lot;
            const x = this.offsetX + lot.col * this.cellSize;
            const y = this.offsetY + lot.row * this.cellSize;
            const w = (lot.w || 1) * this.cellSize;
            const h = (lot.h || 1) * this.cellSize;

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            const b = 8;
            ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x, y); ctx.lineTo(x + b, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + w - b, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + b); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y + h - b); ctx.lineTo(x, y + h); ctx.lineTo(x + b, y + h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + w - b, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - b); ctx.stroke();

            this.renderTooltip(lot, x, y);
        }
    }

    renderTooltip(lot, lx, ly) {
        const ctx = this.ctx;
        const pad = 10;
        const tw = 250;
        const th = 64;

        let tx = lx + (lot.w || 1) * this.cellSize + 8;
        let ty = ly;
        if (tx + tw > this.canvas.width) tx = lx - tw - 8;
        if (ty + th > this.canvas.height) ty = this.canvas.height - th - 8;

        ctx.fillStyle = 'rgba(11, 17, 32, 0.95)';
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, tw, th);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(lot.name, tx + pad, ty + 18);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.fillText(`📍 ${lot.address}`, tx + pad, ty + 34);

        ctx.fillStyle = lot.hazard.includes('Dispatches') ? '#10b981' : '#f59e0b';
        ctx.font = '10px monospace';
        ctx.fillText(`⚠️ ${lot.hazard}`, tx + pad, ty + 50);
    }
}

window.World = World;
