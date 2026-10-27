// ========================================================
// CHRONOS DISPATCH - Procedural Topographic & Organic Road Engine
// Features:
// 1. Locked 22x13 Aspect Ratio (scales cleanly to viewport)
// 2. 8 Distinct Macro Road Archetypes (No repetitive outer rectangle!):
//    - Serpentine S-Curve Highway, Diagonal River Valley, Pinwheel Courts,
//      Twin Harbor Peninsula, Switchback Terraces, Central Lake & Spokes,
//      Forked Arterial Groves, Cross-Town Canal & Docks
// 3. Distributed Multi-Tile Landmarks (2x2 & 2x1 Fire, Police, Hospital, School)
// 4. Near-Zero Dead Space: Organic L-spurs, cul-de-sacs & 2-tile compound pairing
// 5. 100% Connected Road Graph for Phase 3 A* Pathfinding
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
        // Combine seed parity + PRNG so consecutive seeds always jump across archetypes
        const styleRoll = (Math.abs(Math.floor(seed)) + this.prng.range(0, 7)) % 8;
        this.generateTopology(styleRoll);

        // 3. Connect any disconnected road islands into a single 100% unified network
        this.connectAllRoadComponents();
        this.cleanupRoadClumps();

        // 4. Grow organic L-streets & doglegs into any large open regions (leaving 2x2 pockets for landmarks)
        this.growOrganicNeighborhoodStreets();
        this.connectAllRoadComponents();
        this.cleanupRoadClumps();

        // 5. Place Distributed Multi-Tile Landmarks (2x2 & 2x1 Fire, Police, Hospital, School)
        this.placeLandmarkLots();

        // 6. Carve Cul-de-sacs into any remaining deep interior pockets
        this.carveCulDeSacsForDeepBlocks();
        this.connectAllRoadComponents();
        this.cleanupRoadClumps();

        // 7. Classify all road intersections, corners, T-junctions, cul-de-sacs & bridges
        this.classifyRoads();

        // 8. Fill remaining road-adjacent tiles with Residential Houses & 2-tile Estates
        this.placeResidentialLots();

        // 9. Build Navigation Graph for Phase 3 A* Pathfinding
        this.buildRoadGraph();
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
            const midC = Math.floor((c1 + c2) / 2) + this.prng.choice([-1, 0, 1]);
            this.drawRoadLine(c1, r1, midC, r1);
            this.drawRoadLine(midC, r1, midC, r2);
            this.drawRoadLine(midC, r2, c2, r2);
        } else {
            const midR = Math.floor((r1 + r2) / 2) + this.prng.choice([-1, 0, 1]);
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
            const rB = 6 + this.prng.choice([-1, 0, 1]);
            const rC = flipV ? 2 : 10;

            const c1 = this.prng.range(4, 6);
            const c2 = this.prng.range(10, 12);
            const c3 = this.prng.range(15, 17);

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
            this.drawRoadLine(2, oppA, c2 - 2, oppA);
            this.drawRoadLine(2, rA, 2, oppA);
            this.drawRoadLine(c2 - 2, rB, c2 - 2, oppA);

            this.drawRoadLine(c2 + 2, oppC, 19, oppC);
            this.drawRoadLine(19, oppC, 19, rB);
            this.drawRoadLine(c2 + 2, oppC, c2 + 2, rC);

        } else if (styleRoll === 1) {
            // ARCHETYPE 1: Diagonal / Winding River Valley with 2 Strategic Bridges
            this.topologyName = 'RIVERFRONT TWIN-BANK';
            let rc = this.prng.range(7, 11);
            const dir = this.prng.choice([-1, 1]);
            const riverCenter = [];
            for (let r = 0; r < this.rows; r++) {
                this.setWaterCell(rc, r);
                this.setWaterCell(rc + 1, r);
                riverCenter[r] = rc;
                if (r % 2 === 1) {
                    const nextRc = Math.max(5, Math.min(15, rc + (this.prng.random() < 0.7 ? dir : 0)));
                    if (nextRc !== rc) {
                        this.setWaterCell(nextRc, r);
                        rc = nextRc;
                    }
                }
            }

            // Two cross-river bridges at stepped rows
            const b1 = this.prng.range(2, 4);
            const b2 = this.prng.range(8, 10);
            this.drawRoadLine(1, b1, 20, b1);
            this.drawRoadLine(1, b2, 20, b2);

            // West bank stepped avenues
            const wCol = Math.max(1, Math.min(...riverCenter) - 3);
            this.drawRoadLine(wCol, 1, wCol, 11);
            this.drawRoadLine(1, b1, 1, b2);

            // East bank stepped avenues
            const eCol = Math.min(20, Math.max(...riverCenter) + 4);
            this.drawRoadLine(eCol, 1, eCol, 11);
            this.drawRoadLine(20, b1, 20, b2);

        } else if (styleRoll === 2) {
            // ARCHETYPE 2: Central Pinwheel Plaza & Radial Cul-de-Sac Arms
            this.topologyName = 'PINWHEEL CIVIC PLAZA';
            const pLeft = this.prng.range(7, 9);
            const pRight = pLeft + this.prng.range(5, 6);
            const pTop = this.prng.range(4, 5);
            const pBot = pTop + this.prng.range(3, 4);

            // Central ring square
            this.drawRoadLine(pLeft, pTop, pRight, pTop);
            this.drawRoadLine(pLeft, pBot, pRight, pBot);
            this.drawRoadLine(pLeft, pTop, pLeft, pBot);
            this.drawRoadLine(pRight, pTop, pRight, pBot);

            // 4 Pinwheel radial arms spinning out from corners
            // 1. North-West arm
            this.drawRoadLine(pLeft, pTop, pLeft, 1);
            this.drawRoadLine(pLeft, 1, 1, 1);
            this.drawRoadLine(1, 1, 1, pBot - 1);

            // 2. North-East arm
            this.drawRoadLine(pRight, pTop, 20, pTop);
            this.drawRoadLine(20, pTop, 20, 1);
            this.drawRoadLine(20, 1, pLeft + 3, 1);

            // 3. South-East arm
            this.drawRoadLine(pRight, pBot, pRight, 11);
            this.drawRoadLine(pRight, 11, 20, 11);
            this.drawRoadLine(20, 11, 20, pTop + 2);

            // 4. South-West arm
            this.drawRoadLine(pLeft, pBot, 2, pBot);
            this.drawRoadLine(2, pBot, 2, 11);
            this.drawRoadLine(2, 11, pRight - 3, 11);

        } else if (styleRoll === 3) {
            // ARCHETYPE 3: Twin Harbor Bays & Coastal Peninsula
            this.topologyName = 'TWIN HARBOR PENINSULA';
            const bayTopLeft = this.prng.random() < 0.5;
            // Carve two opposing coastal water bays at corners
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

            // Stepped coastal road wrapping around the two bays
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
            }

        } else if (styleRoll === 4) {
            // ARCHETYPE 4: Switchback Terraces (Interlocking Doglegs, zero straight lines across map)
            this.topologyName = 'SWITCHBACK CANYON TERRACES';
            // Create 3 stepped horizontal switchbacks that shift row every 5-6 columns
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

            // Connect the 3 switchback terraces with staggered vertical cross-links
            this.drawRoadLine(2, bands[0][0], 2, bands[2][0]);
            this.drawRoadLine(8, bands[0][1], 8, bands[1][1]);
            this.drawRoadLine(13, bands[1][2], 13, bands[2][2]);
            this.drawRoadLine(19, bands[0][3], 19, bands[2][3]);

        } else if (styleRoll === 5) {
            // ARCHETYPE 5: Central Lake & Causeway Bridge
            this.topologyName = 'MIRROR LAKE CAUSEWAY';
            const lakeC = this.prng.range(7, 9);
            const lakeW = 6;
            const lakeR = 4;
            const lakeH = 5;

            for (let r = lakeR; r < lakeR + lakeH; r++) {
                for (let c = lakeC; c < lakeC + lakeW; c++) {
                    // Round off two corners of the lake for an organic shape
                    if ((r === lakeR && c === lakeC) || (r === lakeR + lakeH - 1 && c === lakeC + lakeW - 1)) continue;
                    this.setWaterCell(c, r);
                }
            }

            // Lakeside boulevard wrapping the lake (1-2 tiles away)
            this.drawRoadLine(lakeC - 1, lakeR - 2, lakeC + lakeW, lakeR - 2);
            this.drawRoadLine(lakeC - 1, lakeR + lakeH + 1, lakeC + lakeW, lakeR + lakeH + 1);
            this.drawRoadLine(lakeC - 2, lakeR - 1, lakeC - 2, lakeR + lakeH);
            this.drawRoadLine(lakeC + lakeW + 1, lakeR - 1, lakeC + lakeW + 1, lakeR + lakeH);

            // Connect corners of lakeside drive
            this.drawRoadLine(lakeC - 2, lakeR - 1, lakeC - 1, lakeR - 2);
            this.drawRoadLine(lakeC + lakeW, lakeR - 2, lakeC + lakeW + 1, lakeR - 1);
            this.drawRoadLine(lakeC - 2, lakeR + lakeH, lakeC - 1, lakeR + lakeH + 1);
            this.drawRoadLine(lakeC + lakeW, lakeR + lakeH + 1, lakeC + lakeW + 1, lakeR + lakeH);

            // Central Causeway Bridge right across the lake!
            const bridgeC = lakeC + Math.floor(lakeW / 2);
            this.drawRoadLine(bridgeC, lakeR - 2, bridgeC, lakeR + lakeH + 1);

            // Stepped wings to East and West towns
            this.drawDoglegRoad(1, 2, lakeC - 2, lakeR - 1, true);
            this.drawDoglegRoad(1, 10, lakeC - 2, lakeR + lakeH, true);
            this.drawRoadLine(1, 2, 1, 10);

            this.drawDoglegRoad(lakeC + lakeW + 1, lakeR - 1, 20, 2, true);
            this.drawDoglegRoad(lakeC + lakeW + 1, lakeR + lakeH, 20, 10, true);
            this.drawRoadLine(20, 2, 20, 10);

        } else if (styleRoll === 6) {
            // ARCHETYPE 6: Y-Forked Highway & Cul-de-Sac Groves
            this.topologyName = 'FORKED PARKWAY GROVES';
            const stemR = this.prng.range(5, 7);
            const forkC = this.prng.range(7, 10);

            // Main trunk from West edge to Fork
            this.drawRoadLine(0, stemR, forkC, stemR);

            // Upper Fork climbing in steps to North-East
            this.drawRoadLine(forkC, stemR, forkC, 2);
            this.drawRoadLine(forkC, 2, 15, 2);
            this.drawRoadLine(15, 2, 15, 1);
            this.drawRoadLine(15, 1, 20, 1);

            // Lower Fork dropping in steps to South-East
            this.drawRoadLine(forkC, stemR, forkC, 9);
            this.drawRoadLine(forkC, 9, 14, 9);
            this.drawRoadLine(14, 9, 14, 11);
            this.drawRoadLine(14, 11, 20, 11);

            // Eastern connector loop between the two forks
            this.drawRoadLine(18, 1, 18, 11);
            this.drawRoadLine(forkC + 4, 2, forkC + 4, 9);

            // Western neighborhood loops branching off the main trunk
            this.drawRoadLine(3, 1, 3, 11);
            this.drawRoadLine(1, 2, forkC - 2, 2);
            this.drawRoadLine(1, 10, forkC - 2, 10);

        } else {
            // ARCHETYPE 7: Stepped Canal & Asymmetric Industrial Quays
            this.topologyName = 'STEPPED CANAL & QUAYS';
            const bendC = this.prng.range(9, 12);
            const rWest = this.prng.choice([4, 8]);
            const rEast = rWest === 4 ? 8 : 4;

            // Canal with a 90-degree mid-town bend
            for (let c = 0; c <= bendC; c++) this.setWaterCell(c, rWest);
            const stepR = rEast > rWest ? 1 : -1;
            for (let r = rWest; r !== rEast + stepR; r += stepR) this.setWaterCell(bendC, r);
            for (let c = bendC; c < this.cols; c++) this.setWaterCell(c, rEast);

            // Two bridges crossing the canal (one on West reach, one on East reach)
            const bWestC = this.prng.range(3, 6);
            const bEastC = this.prng.range(15, 18);
            this.drawRoadLine(bWestC, 1, bWestC, 11);
            this.drawRoadLine(bEastC, 1, bEastC, 11);

            // Embankment roads & stepped loops
            const northR = Math.min(rWest, rEast) - 2;
            const southR = Math.max(rWest, rEast) + 2;
            this.drawRoadLine(1, northR, 20, northR);
            this.drawRoadLine(1, southR, 20, southR);

            // Connect the deep quadrants on either side of the canal bend
            if (rWest === 4) {
                // Deep space in South-West (r=6..11, c=1..bendC-2) and North-East (r=1..6, c=bendC+2..20)
                this.drawDoglegRoad(1, 7, bendC - 2, 11, false);
                this.drawDoglegRoad(bendC + 2, 1, 20, 5, false);
            } else {
                this.drawDoglegRoad(1, 1, bendC - 2, 5, false);
                this.drawDoglegRoad(bendC + 2, 7, 20, 11, false);
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
    // ORGANIC NEIGHBORHOOD SUBDIVISION (L-BENDS & T-JUNCTIONS)
    // ========================================================
    growOrganicNeighborhoodStreets() {
        // Instead of full-grid straight lines, find points deep inside open blocks (distance >= 3 from road)
        // and connect them to the nearest road with an L-shaped street or T-branch!
        for (let pass = 0; pass < 18; pass++) {
            let deepestCell = null;
            let maxDist = 0;

            for (let r = 1; r < this.rows - 1; r++) {
                for (let c = 1; c < this.cols - 1; c++) {
                    if (this.grid[r][c].type !== CELL_TYPE.EMPTY) continue;
                    const d = this.distanceToNearestRoad(c, r);
                    if (d > maxDist) {
                        maxDist = d;
                        deepestCell = { c, r };
                    }
                }
            }

            // Stop once all interior spaces are within 2 tiles of a road (leaving 2x2 pockets for landmarks!)
            if (!deepestCell || maxDist <= 2) break;

            const nearestRoad = this.findNearestRoadCell(deepestCell.c, deepestCell.r);
            if (!nearestRoad) break;

            // Carve an L-branch from nearestRoad to deepestCell, then extend 1-2 tiles to make a neighborhood court
            const horizFirst = this.prng.random() < 0.5;
            this.carveSafePath(nearestRoad.c, nearestRoad.r, deepestCell.c, deepestCell.r, horizFirst);
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
                }
            }
        };

        if (horizFirst) {
            while (c !== c2) { c += stepC; trySet(c, r); }
            while (r !== r2) { r += stepR; trySet(c, r); }
        } else {
            while (r !== r2) { r += stepR; trySet(c, r); }
            while (c !== c2) { c += stepC; trySet(c, r); }
        }
    }

    distanceToNearestRoad(c, r) {
        let minD = 999;
        for (let rr = 0; rr < this.rows; rr++) {
            for (let cc = 0; cc < this.cols; cc++) {
                if (this.grid[rr][cc].type === CELL_TYPE.ROAD || this.grid[rr][cc].type === CELL_TYPE.BRIDGE) {
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
                if (this.grid[rr][cc].type === CELL_TYPE.ROAD || this.grid[rr][cc].type === CELL_TYPE.BRIDGE) {
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

    // ========================================================
    // CUL-DE-SAC CARVER FOR NEAR-ZERO DEAD SQUARES
    // ========================================================
    carveCulDeSacsForDeepBlocks() {
        let changed = true;
        let passes = 0;
        while (changed && passes < 25) {
            changed = false;
            passes++;

            // Find all EMPTY cells that currently do NOT touch any road
            const landlocked = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c].type === CELL_TYPE.EMPTY && !this.getAdjacentRoad(c, r)) {
                        landlocked.push({ c, r });
                    }
                }
            }

            if (landlocked.length === 0) break;

            // Find the single EMPTY cell adjacent to an existing road whose conversion to ROAD
            // unlocks the maximum number of landlocked EMPTY neighbors without creating a 2x2 clump!
            let bestCandidate = null;
            let bestScore = 0;

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c].type !== CELL_TYPE.EMPTY) continue;
                    if (!this.getAdjacentRoad(c, r)) continue;
                    if (this.wouldCreateRoadClump(c, r)) continue;

                    // Score how many landlocked cells this candidate is adjacent to (or gets closer to)
                    let score = 0;
                    for (const [dc, dr] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
                        const nc = c + dc;
                        const nr = r + dr;
                        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                            if (this.grid[nr][nc].type === CELL_TYPE.EMPTY && !this.getAdjacentRoad(nc, nr)) {
                                score += 3;
                            }
                        }
                    }
                    // Also check 2 steps away so we can tunnel 2-step spurs to edge/corner pockets
                    for (const [dc, dr] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) {
                        const nc = c + dc;
                        const nr = r + dr;
                        const mc = c + dc / 2;
                        const mr = r + dr / 2;
                        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                            if (this.grid[nr][nc].type === CELL_TYPE.EMPTY && !this.getAdjacentRoad(nc, nr) &&
                                this.grid[mr][mc].type === CELL_TYPE.EMPTY) {
                                score += 1;
                            }
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestCandidate = { c, r };
                    }
                }
            }

            if (bestCandidate && bestScore > 0) {
                this.grid[bestCandidate.r][bestCandidate.c].type = CELL_TYPE.ROAD;
                changed = true;
            }
        }
    }

    wouldCreateRoadClump(c, r) {
        const isR = (x, y) => {
            if (x === c && y === r) return true;
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
            return this.grid[y][x].type === CELL_TYPE.ROAD || this.grid[y][x].type === CELL_TYPE.BRIDGE;
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

    cleanupRoadClumps() {
        const isR = (c, r) => c >= 0 && c < this.cols && r >= 0 && r < this.rows &&
            (this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE);

        let cleaned = true;
        while (cleaned) {
            cleaned = false;
            for (let r = 0; r < this.rows - 1; r++) {
                for (let c = 0; c < this.cols - 1; c++) {
                    if (isR(c, r) && isR(c + 1, r) && isR(c, r + 1) && isR(c + 1, r + 1)) {
                        // Pick one corner of the 2x2 clump that isn't a bridge and revert to EMPTY
                        const corners = [[c + 1, r + 1], [c, r + 1], [c + 1, r], [c, r]];
                        for (const [cx, cy] of corners) {
                            if (this.grid[cy][cx].type === CELL_TYPE.ROAD) {
                                this.grid[cy][cx].type = CELL_TYPE.EMPTY;
                                cleaned = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Guarantees 100% of roads are connected by bridging any disconnected components
    connectAllRoadComponents() {
        const isR = (c, r) => c >= 0 && c < this.cols && r >= 0 && r < this.rows &&
            (this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE);

        for (let iter = 0; iter < 10; iter++) {
            const components = [];
            const visited = new Set();

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (isR(c, r) && !visited.has(`${c},${r}`)) {
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
                                if (isR(nc, nr) && !visited.has(key)) {
                                    visited.add(key);
                                    queue.push({ c: nc, r: nr });
                                }
                            }
                        }
                        components.push(comp);
                    }
                }
            }

            if (components.length <= 1) break;

            // Connect component[1] to component[0] using the closest pair of road cells
            let bestA = null;
            let bestB = null;
            let minD = 999;

            for (const a of components[0]) {
                for (const b of components[1]) {
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
            }
        }
    }

    // ========================================================
    // DISTRIBUTED MULTI-TILE LANDMARKS (2x2 & 2x1)
    // ========================================================
    placeLandmarkLots() {
        // Fire, Police, Hospital, and School are 2x2 (4 tiles) or 2x1 (2 tiles) — easy to spot & distributed!
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

            // Try preferred size (2x2 for stations/school, 2x1 for commercial compounds) with spacing
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
            if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
                if (this.grid[nr][nc].type === CELL_TYPE.ROAD || this.grid[nr][nc].type === CELL_TYPE.BRIDGE) {
                    return { col: nc, row: nr, dir: d.dir };
                }
            }
        }
        return null;
    }

    classifyRoads() {
        const isR = (c, r) => c >= 0 && c < this.cols && r >= 0 && r < this.rows &&
            (this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE);

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!isR(c, r)) continue;

                const N = isR(c, r - 1);
                const S = isR(c, r + 1);
                const W = isR(c - 1, r);
                const E = isR(c + 1, r);

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
                if (this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE) {
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

        const isHoriz = roadType === 'STRAIGHT_H' || roadType === 'CUL_DE_SAC_W' || roadType === 'CUL_DE_SAC_E';

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

        const isR = (col, row) => col >= 0 && col < this.cols && row >= 0 && row < this.rows &&
            (this.grid[row][col].type === CELL_TYPE.ROAD || this.grid[row][col].type === CELL_TYPE.BRIDGE);

        const N = isR(c, r - 1);
        const S = isR(c, r + 1);
        const W = isR(c - 1, r);
        const E = isR(c + 1, r);

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
            ctx.beginPath(); ctx.arc(x + half, y + half, Math.floor(s * 0.34), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x + half, y + half, Math.floor(s * 0.16), 0, Math.PI * 2); ctx.stroke();
        }
    }

    renderLot(lot) {
        const ctx = this.ctx;
        const x = this.offsetX + lot.col * this.cellSize;
        const y = this.offsetY + lot.row * this.cellSize;
        const s = this.cellSize;
        const w = (lot.w || 1) * s;
        const h = (lot.h || 1) * s;

        // Paved compound base for multi-tile lots
        if (lot.w > 1 || lot.h > 1) {
            ctx.fillStyle = lot.type === LOT_TYPE.RESIDENTIAL ? '#14532d' : '#334155';
            ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
            ctx.strokeStyle = lot.type === LOT_TYPE.RESIDENTIAL ? '#22c55e' : '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        }

        // Driveway apron connecting to street
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
                // 1x1 or 2x2 square lots draw at crisp 1:1 aspect ratio
                ctx.drawImage(sprite, x + 2, y + 2, w - 4, h - 4);
            }
        } else {
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        }

        // High-Vis Landmark Header Badges
        if (lot.type === LOT_TYPE.STATION_FIRE) this.renderBadge(x + 4, y + 4, '🚒 FIRE HQ', '#ef4444');
        else if (lot.type === LOT_TYPE.STATION_POLICE) this.renderBadge(x + 4, y + 4, '🚓 POLICE HQ', '#3b82f6');
        else if (lot.type === LOT_TYPE.STATION_HOSPITAL) this.renderBadge(x + 4, y + 4, '🚑 HOSPITAL ER', '#10b981');
        else if (lot.type === LOT_TYPE.CIVIC_SCHOOL) this.renderBadge(x + 4, y + 4, '🏫 SCHOOL', '#f59e0b');
    }

    renderCompoundYard(yx, yy, s, lotType) {
        const ctx = this.ctx;
        if (lotType === LOT_TYPE.RESIDENTIAL) {
            // Backyard lawn with garden trees & patio
            ctx.fillStyle = '#15803d';
            ctx.fillRect(yx + 5, yy + 5, s - 10, s - 10);
            ctx.fillStyle = '#166534';
            ctx.beginPath(); ctx.arc(yx + s * 0.35, yy + s * 0.4, s * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(yx + s * 0.68, yy + s * 0.65, s * 0.15, 0, Math.PI * 2); ctx.fill();
            return;
        }

        // Asphalt motor pool / loading yard for stations & commercial
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
