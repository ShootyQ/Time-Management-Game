// ========================================================
// CHRONOS DISPATCH - Advanced Multi-Archetype City Engine
// Features:
// 1. Locked 22x13 Aspect Ratio (dynamically scales to screen)
// 2. 3 Distinct Town Topologies:
//    - Archetype 0: Suburb Loops & Dogleg Avenues
//    - Archetype 1: Ring Boulevard & Central Civic Plaza
//    - Archetype 2: River Canal with Cross Bridges (Natural Choke Points!)
// 3. Multi-Tile Landmark Buildings (Hospital 2x2, School 2x2, Fire Station 2x1, Police HQ 2x1, Supermarket 2x1)
// 4. Zero Dead Space: Dense back-to-back residential blocks
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

        // Fixed 22 cols by 13 rows aspect ratio
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

        // Fit 22x13 grid into container while preserving ratio
        const cellW = Math.floor(w / this.cols);
        const cellH = Math.floor(h / this.rows);
        this.cellSize = Math.max(38, Math.min(cellW, cellH));

        // Center within canvas
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

    // ==========================================
    // PROCEDURAL GENERATION: 3 DISTINCT TOPOLOGIES
    // ==========================================
    generate(seed) {
        this.seed = seed;
        this.prng.setSeed(seed);
        this.grid = [];
        this.lots = [];
        this.parks = [];
        this.waters = [];
        this.roadNodes = [];
        this.roadEdges = [];

        // 1. Initialize grid
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

        const setRoad = (c, r) => {
            if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                this.grid[r][c].type = CELL_TYPE.ROAD;
            }
        };

        const isRoadOrBridge = (c, r) => {
            if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
            return this.grid[r][c].type === CELL_TYPE.ROAD || this.grid[r][c].type === CELL_TYPE.BRIDGE;
        };

        // Select Town Archetype from Seed (0, 1, or 2)
        const archetype = Math.abs(parseInt(this.seed, 10) || 1042) % 3;

        if (archetype === 0) {
            // ====================================================
            // ARCHETYPE 0: Neighborhood Loops & Connecting Avenues
            // ====================================================
            const hRows = [0, 3, 6, 9, 12];
            for (const hr of hRows) {
                for (let c = 0; c < this.cols; c++) setRoad(c, hr);
            }
            const vCols = [0, 5, 11, 16, 21];
            for (const vc of vCols) {
                for (let r = 0; r < this.rows; r++) setRoad(vc, r);
            }
            // Cut corners for loops
            if (this.prng.random() > 0.2) { this.grid[3][2].type = CELL_TYPE.EMPTY; this.grid[3][3].type = CELL_TYPE.EMPTY; }
            if (this.prng.random() > 0.2) { this.grid[9][18].type = CELL_TYPE.EMPTY; this.grid[9][19].type = CELL_TYPE.EMPTY; }
            if (this.prng.random() > 0.2) { this.grid[3][13].type = CELL_TYPE.EMPTY; this.grid[3][14].type = CELL_TYPE.EMPTY; }

        } else if (archetype === 1) {
            // ====================================================
            // ARCHETYPE 1: Ring Boulevard & Central Civic Plaza
            // ====================================================
            // Perimeter Ring
            for (let c = 0; c < this.cols; c++) { setRoad(c, 0); setRoad(c, 12); }
            for (let r = 0; r < this.rows; r++) { setRoad(0, r); setRoad(21, r); }

            // Inner Ring Boulevard around City Center (Rows 4 & 8, Cols 6 & 15)
            for (let c = 6; c <= 15; c++) { setRoad(c, 4); setRoad(c, 8); }
            for (let r = 4; r <= 8; r++) { setRoad(6, r); setRoad(15, r); }

            // Radiating Spoke Avenues connecting inner ring to perimeter
            for (let c = 0; c <= 6; c++) setRoad(c, 6);
            for (let c = 15; c <= 21; c++) setRoad(c, 6);
            for (let r = 0; r <= 4; r++) { setRoad(10, r); }
            for (let r = 8; r <= 12; r++) { setRoad(10, r); }

            // Secondary residential courts
            for (let c = 1; c <= 5; c++) { setRoad(c, 3); setRoad(c, 9); }
            for (let c = 16; c <= 20; c++) { setRoad(c, 3); setRoad(c, 9); }

        } else {
            // ====================================================
            // ARCHETYPE 2: River Canal & Road Bridges (Choke Points!)
            // ====================================================
            // Natural river cuts across Row 6
            const riverY = 6;
            for (let c = 0; c < this.cols; c++) {
                this.grid[riverY][c].type = CELL_TYPE.WATER;
                this.waters.push({ col: c, row: riverY });
            }

            // North District Streets
            for (let c = 0; c < this.cols; c++) { setRoad(c, 0); setRoad(c, 3); }
            // South District Streets
            for (let c = 0; c < this.cols; c++) { setRoad(c, 9); setRoad(c, 12); }

            // Vertical Avenues
            const bridgeCols = [4, 11, 17];
            for (let r = 0; r < this.rows; r++) {
                setRoad(0, r);
                setRoad(21, r);
                for (const bc of bridgeCols) {
                    if (r === riverY) {
                        this.grid[r][bc].type = CELL_TYPE.BRIDGE; // Road Bridge over water
                    } else {
                        setRoad(bc, r);
                    }
                }
            }
        }

        // Classify all road junctions
        this.classifyRoads();

        // --- Step 2: Place Multi-Tile Landmarks (Hospital 2x2, School 2x2, Firehouse 2x1, Police 2x1, Supermarket 2x1) ---
        this.placeLandmarkLots();

        // --- Step 3: Fill Remaining Blocks with Single-Tile Lots (100% Dense, ZERO dead space) ---
        this.placeResidentialLots();

        // --- Step 4: Build Road Navigation Graph ---
        this.buildRoadGraph();
    }

    placeLandmarkLots() {
        // Multi-tile building specs
        const landmarks = [
            { type: LOT_TYPE.STATION_HOSPITAL, name: 'County General Hospital', address: '100 Medical Way', sprite: 'hospital', w: 2, h: 2, hazard: 'Dispatches Paramedic Unit' },
            { type: LOT_TYPE.CIVIC_SCHOOL, name: 'Lincoln Elementary School', address: '85 School Lane', sprite: 'school', w: 2, h: 2, hazard: '08:15 School Bell Pedestrian Jam' },
            { type: LOT_TYPE.STATION_FIRE, name: 'Engine Co. 4 Firehouse', address: '12 Firehouse Lane', sprite: 'fire_station', w: 2, h: 1, hazard: 'Dispatches Fire Engine' },
            { type: LOT_TYPE.STATION_POLICE, name: 'Precinct 9 Police HQ', address: '50 Civic Plaza', sprite: 'police_station', w: 2, h: 1, hazard: 'Dispatches Police Patrol' },
            { type: LOT_TYPE.COMMERCIAL_SUPERMARKET, name: 'FreshGrocer Supermarket', address: '150 Commercial St', sprite: 'supermarket', w: 2, h: 1, hazard: 'Delivery Truck Bottleneck' },
            { type: LOT_TYPE.INDUSTRIAL_WAREHOUSE, name: 'Keystone Storage', address: '300 Industrial Blvd', sprite: 'warehouse', w: 2, h: 1, hazard: 'Chemical Cascade Hazard' },
            // Prominent 1x1 Commercial Spots
            { type: LOT_TYPE.COMMERCIAL_GAS, name: 'Apex Gas & Fuel', address: '200 Main Highway', sprite: 'gas_station', w: 1, h: 1, hazard: 'High Explosion Risk (90s Timer)' },
            { type: LOT_TYPE.COMMERCIAL_DINER, name: 'Sunrise 24/7 Diner', address: '44 Main Street', sprite: 'diner', w: 1, h: 1, hazard: 'Grease Fryer Fire Risk' },
            { type: LOT_TYPE.COMMERCIAL_BANK, name: 'First National Bank', address: '10 Bank Street', sprite: 'bank', w: 1, h: 1, hazard: 'Silent Alarm / Robbery Risk' }
        ];

        for (const spec of landmarks) {
            let placed = false;
            // Search candidate positions for multi-tile lot
            for (let r = 1; r < this.rows - spec.h; r++) {
                if (placed) break;
                for (let c = 1; c < this.cols - spec.w; c++) {
                    if (this.canFitLot(c, r, spec.w, spec.h)) {
                        const lot = {
                            id: `lot_${c}_${r}`,
                            col: c,
                            row: r,
                            w: spec.w,
                            h: spec.h,
                            type: spec.type,
                            name: spec.name,
                            address: spec.address,
                            spriteKey: spec.sprite,
                            hazard: spec.hazard,
                            isRoot: true,
                            onFire: false
                        };
                        // Reserve all cells
                        for (let dy = 0; dy < spec.h; dy++) {
                            for (let dx = 0; dx < spec.w; dx++) {
                                this.grid[r + dy][c + dx].type = CELL_TYPE.LOT;
                                this.grid[r + dy][c + dx].lot = lot;
                            }
                        }
                        this.lots.push(lot);
                        placed = true;
                        break;
                    }
                }
            }
        }
    }

    canFitLot(c, r, w, h) {
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
                        // Pocket park courtyard if landlocked
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
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type !== CELL_TYPE.ROAD && this.grid[r][c].type !== CELL_TYPE.BRIDGE) continue;

                const N = r > 0 && (this.grid[r - 1][c].type === CELL_TYPE.ROAD || this.grid[r - 1][c].type === CELL_TYPE.BRIDGE);
                const S = r < this.rows - 1 && (this.grid[r + 1][c].type === CELL_TYPE.ROAD || this.grid[r + 1][c].type === CELL_TYPE.BRIDGE);
                const W = c > 0 && (this.grid[r][c - 1].type === CELL_TYPE.ROAD || this.grid[r][c - 1].type === CELL_TYPE.BRIDGE);
                const E = c < this.cols - 1 && (this.grid[r][c + 1].type === CELL_TYPE.ROAD || this.grid[r][c + 1].type === CELL_TYPE.BRIDGE);

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
                    this.grid[r][c].roadType = 'CUL_DE_SAC';
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

    // ==========================================
    // RENDERING PIPELINE
    // ==========================================
    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // Dark Canvas Backdrop
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Lawn mowing grid texture within the grid bounds
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

        // 1. Render River Water tiles
        for (const water of this.waters) {
            this.renderWater(water);
        }

        // 2. Render Parks
        for (const park of this.parks) {
            this.renderPark(park);
        }

        // 3. Render Roads & Bridges
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.renderRoadTile(c, r, this.grid[r][c].roadType);
                } else if (this.grid[r][c].type === CELL_TYPE.BRIDGE) {
                    this.renderBridgeTile(c, r);
                }
            }
        }

        // 4. Render Building Lots (Multi-tile and Single-tile)
        for (const lot of this.lots) {
            if (lot.isRoot) {
                this.renderLot(lot);
            }
        }

        // 5. Overlays & Tooltips
        this.renderOverlays();
    }

    renderWater(water) {
        const ctx = this.ctx;
        const x = this.offsetX + water.col * this.cellSize;
        const y = this.offsetY + water.row * this.cellSize;
        const s = this.cellSize;

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x, y, s, s);

        // Water wave highlights
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 4, y + s / 3, 12, 2);
        ctx.fillRect(x + s / 2, y + (s * 2) / 3, 14, 2);
    }

    renderBridgeTile(c, r) {
        const ctx = this.ctx;
        const x = this.offsetX + c * this.cellSize;
        const y = this.offsetY + r * this.cellSize;
        const s = this.cellSize;

        // Bridge deck over water
        ctx.fillStyle = '#475569';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#27272a';
        ctx.fillRect(x + 4, y, s - 8, s);

        // Concrete Bridge Rails
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 1, y, 3, s);
        ctx.fillRect(x + s - 4, y, 3, s);

        // Yellow divider
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + s / 2 - 2, y + 4, 3, s - 8);
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

        const N = r > 0 && (this.grid[r - 1][c].type === CELL_TYPE.ROAD || this.grid[r - 1][c].type === CELL_TYPE.BRIDGE);
        const S = r < this.rows - 1 && (this.grid[r + 1][c].type === CELL_TYPE.ROAD || this.grid[r + 1][c].type === CELL_TYPE.BRIDGE);
        const W = c > 0 && (this.grid[r][c - 1].type === CELL_TYPE.ROAD || this.grid[r][c - 1].type === CELL_TYPE.BRIDGE);
        const E = c < this.cols - 1 && (this.grid[r][c + 1].type === CELL_TYPE.ROAD || this.grid[r][c + 1].type === CELL_TYPE.BRIDGE);

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
            ctx.beginPath(); ctx.arc(x, y + s, half, (3 * Math.PI) / 2, 0); ctx.stroke();
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
        } else if (roadType === 'CUL_DE_SAC') {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x + half - 8, y + half - 2, 16, 4);
        }
    }

    renderLot(lot) {
        const ctx = this.ctx;
        const x = this.offsetX + lot.col * this.cellSize;
        const y = this.offsetY + lot.row * this.cellSize;
        const w = (lot.w || 1) * this.cellSize;
        const h = (lot.h || 1) * this.cellSize;

        // Driveway apron
        if (lot.facingRoad) {
            ctx.fillStyle = '#475569';
            const dw = Math.floor(this.cellSize * 0.35);
            const dh = Math.floor(this.cellSize * 0.16);
            if (lot.facingRoad.dir === 'S') ctx.fillRect(x + (w - dw) / 2, y + h - dh, dw, dh);
            if (lot.facingRoad.dir === 'N') ctx.fillRect(x + (w - dw) / 2, y, dw, dh);
            if (lot.facingRoad.dir === 'E') ctx.fillRect(x + w - dh, y + (h - dw) / 2, dh, dw);
            if (lot.facingRoad.dir === 'W') ctx.fillRect(x, y + (h - dw) / 2, dh, dw);
        }

        // Draw Building Sprite (Multi-tile buildings scale to fit full lot dimensions!)
        const sprite = this.images[lot.spriteKey];
        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, x + 2, y + 2, w - 4, h - 4);
        } else {
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        }

        // Multi-Tile Landmark Badges (Distinct & High-Vis!)
        if (lot.type === LOT_TYPE.STATION_FIRE) this.renderBadge(x + 4, y + 4, '🚒 FIRE STATION (HQ)', '#ef4444');
        else if (lot.type === LOT_TYPE.STATION_POLICE) this.renderBadge(x + 4, y + 4, '🚓 POLICE PRECINCT', '#3b82f6');
        else if (lot.type === LOT_TYPE.STATION_HOSPITAL) this.renderBadge(x + 4, y + 4, '🚑 GENERAL HOSPITAL', '#10b981');
        else if (lot.type === LOT_TYPE.CIVIC_SCHOOL) this.renderBadge(x + 4, y + 4, '🏫 ELEMENTARY SCHOOL', '#f59e0b');
    }

    renderBadge(bx, by, label, badgeColor) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(bx, by, 130, 18);
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 130, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(label, bx + 4, by + 12);
    }

    renderOverlays() {
        const ctx = this.ctx;

        if (this.hoveredCell && this.hoveredCell.lot) {
            const lot = this.hoveredCell.lot;
            const x = this.offsetX + lot.col * this.cellSize;
            const y = this.offsetY + lot.row * this.cellSize;
            const w = (lot.w || 1) * this.cellSize;
            const h = (lot.h || 1) * this.cellSize;

            // Tactical Corner Brackets
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
