// ========================================================
// CHRONOS DISPATCH - High-Density Zero-Dead-Space City Engine
// Features:
// 1. Locked Aspect Ratio (22 cols x 13 rows) that scales to fit viewport
// 2. Dense back-to-back residential blocks (ZERO dead squares!)
// 3. 100% connected road network with organic corners, loops & cul-de-sacs
// 4. Central Civic Plaza & Park surrounded by emergency hubs & commercial stores
// ========================================================

const CELL_TYPE = {
    EMPTY: 'EMPTY',
    ROAD: 'ROAD',
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

        // Locked Aspect Ratio: 22 columns by 13 rows
        this.cols = 22;
        this.rows = 13;
        this.cellSize = 56;
        this.offsetX = 0;
        this.offsetY = 0;

        this.grid = [];
        this.lots = [];
        this.parks = [];
        this.roadNodes = [];
        this.roadEdges = [];

        this.hoveredCell = null;
        this.selectedLot = null;

        this.images = {};
        this.loadAssets();

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
        });

        this.initInteractions();
    }

    // Locks the 22x13 aspect ratio and scales cell size to fill viewport cleanly
    resize() {
        const container = this.canvas.parentElement;
        const w = container ? container.clientWidth : window.innerWidth;
        const h = container ? container.clientHeight : (window.innerHeight - 200);

        this.canvas.width = Math.floor(w);
        this.canvas.height = Math.floor(h);

        // Calculate maximum cell size that fits the 22x13 grid in the container
        const cellW = Math.floor(w / this.cols);
        const cellH = Math.floor(h / this.rows);
        this.cellSize = Math.max(38, Math.min(cellW, cellH));

        // Center the 22x13 grid in the viewport
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
    // DENSE, ZERO-DEAD-SPACE MAP GENERATOR
    // ==========================================
    generate(seed) {
        this.seed = seed;
        this.prng.setSeed(seed);
        this.grid = [];
        this.lots = [];
        this.parks = [];
        this.roadNodes = [];
        this.roadEdges = [];

        // 1. Initialize 22x13 grid
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

        const isRoad = (c, r) => {
            if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
            return this.grid[r][c].type === CELL_TYPE.ROAD;
        };

        // --- Step A: Primary Connected Street Spine ---
        // Horizontal Streets: Rows 0, 3, 6 (Main Ave), 9, 12
        // Notice: Between Rows 0 & 3 are Rows 1 & 2 (2 houses back-to-back: ZERO waste!)
        const hStreets = [0, 3, 6, 9, 12];
        for (const hr of hStreets) {
            for (let c = 0; c < this.cols; c++) {
                setRoad(c, hr);
            }
        }

        // Vertical Avenues: Cols 0, 5, 10, 16, 21
        const vAvenues = [0, 5, 10, 16, 21];
        for (const vc of vAvenues) {
            for (let r = 0; r < this.rows; r++) {
                setRoad(vc, r);
            }
        }

        // --- Step B: Organic Road Modifications (Turn blocks into Corners, Loops & Cul-de-sacs) ---
        // Seed-based variations: replace certain straight cross sections with corners and cul-de-sacs
        
        // 1. Northwest Corner Loop Modification
        if (this.prng.random() > 0.3) {
            // Cut Row 3 between col 1 and 4, creating a perimeter corner turn at (0,0) -> (5,0)
            this.grid[3][2].type = CELL_TYPE.EMPTY;
            this.grid[3][3].type = CELL_TYPE.EMPTY;
        }

        // 2. Northeast Corner Loop Modification
        if (this.prng.random() > 0.3) {
            this.grid[3][18].type = CELL_TYPE.EMPTY;
            this.grid[3][19].type = CELL_TYPE.EMPTY;
        }

        // 3. Southwest Loop Modification
        if (this.prng.random() > 0.3) {
            this.grid[9][2].type = CELL_TYPE.EMPTY;
            this.grid[9][3].type = CELL_TYPE.EMPTY;
        }

        // 4. Southeast Loop Modification
        if (this.prng.random() > 0.3) {
            this.grid[9][18].type = CELL_TYPE.EMPTY;
            this.grid[9][19].type = CELL_TYPE.EMPTY;
        }

        // 5. Central Municipal Park / Town Square (Cols 11-14, Rows 4-5)
        // A single designated 2x2 green park in the center of town
        const parkC1 = 12, parkC2 = 14, parkR1 = 4, parkR2 = 5;
        for (let r = parkR1; r <= parkR2; r++) {
            for (let c = parkC1; c <= parkC2; c++) {
                this.grid[r][c].type = CELL_TYPE.PARK;
                this.parks.push({ col: c, row: r });
            }
        }

        // Classify all road junctions (Corners, T-junctions, 4-way, Straight)
        this.classifyRoads();

        // --- Step C: Zero-Dead-Space Lot Assignment ---
        // Every empty cell on the map that borders a road becomes a Building Lot!
        const candidateCells = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.EMPTY) {
                    const adjRoad = this.getAdjacentRoad(c, r);
                    if (adjRoad) {
                        candidateCells.push({ col: c, row: r, facingRoad: adjRoad });
                    }
                }
            }
        }

        this.prng.shuffle(candidateCells);

        // --- Step D: Place Critical Stations, Civic & Commercial Hazards ---
        const specialRoster = [
            // Responders placed at high-traffic intersections
            { type: LOT_TYPE.STATION_FIRE, name: 'Engine Co. 4 Firehouse', address: '12 Firehouse Lane', sprite: 'fire_station', hazard: 'Dispatches Fire Engine' },
            { type: LOT_TYPE.STATION_POLICE, name: 'Precinct 9 Police HQ', address: '50 Civic Plaza', sprite: 'police_station', hazard: 'Dispatches Police Patrol' },
            { type: LOT_TYPE.STATION_HOSPITAL, name: 'County Hospital ER', address: '100 Medical Way', sprite: 'hospital', hazard: 'Dispatches Paramedic Unit' },
            // Civic & Commercial Hotspots
            { type: LOT_TYPE.CIVIC_SCHOOL, name: 'Lincoln Elementary School', address: '85 School Lane', sprite: 'school', hazard: '08:15 School Bell Pedestrian Jam' },
            { type: LOT_TYPE.COMMERCIAL_GAS, name: 'Apex Gas & Fuel', address: '200 Main Highway', sprite: 'gas_station', hazard: 'High Explosion Risk (90s Timer)' },
            { type: LOT_TYPE.COMMERCIAL_DINER, name: 'Sunrise 24/7 Diner', address: '44 Main Street', sprite: 'diner', hazard: 'Grease Fryer Fire Risk' },
            { type: LOT_TYPE.COMMERCIAL_BANK, name: 'First National Bank', address: '10 Bank Street', sprite: 'bank', hazard: 'Silent Alarm / Robbery Risk' },
            { type: LOT_TYPE.COMMERCIAL_SUPERMARKET, name: 'FreshGrocer Market', address: '150 Commercial St', sprite: 'supermarket', hazard: 'Delivery Truck Bottleneck' },
            { type: LOT_TYPE.INDUSTRIAL_WAREHOUSE, name: 'Keystone Storage', address: '300 Industrial Blvd', sprite: 'warehouse', hazard: 'Chemical Cloud Cascade Hazard' }
        ];

        specialRoster.forEach((spec) => {
            if (candidateCells.length > 0) {
                const cell = candidateCells.pop();
                const lot = {
                    id: `lot_${cell.col}_${cell.row}`,
                    col: cell.col,
                    row: cell.row,
                    facingRoad: cell.facingRoad,
                    type: spec.type,
                    name: spec.name,
                    address: spec.address,
                    spriteKey: spec.sprite,
                    hazard: spec.hazard,
                    onFire: false
                };
                this.grid[cell.row][cell.col].type = CELL_TYPE.LOT;
                this.grid[cell.row][cell.col].lot = lot;
                this.lots.push(lot);
            }
        });

        // --- Step E: Fill EVERY remaining cell with 16-bit Residential Houses ---
        const streetNames = ['Oak St', 'Elm Ave', 'Maple Ct', 'Cedar Way', 'Pine Rd', 'Willow Ln', 'Birch St', '4th Ave', 'River Rd', 'Grand Blvd', 'Highland Dr'];
        let houseNum = 1;
        while (candidateCells.length > 0) {
            const cell = candidateCells.pop();
            const houseVariant = (this.prng.range(1, 10)).toString().padStart(2, '0');
            const street = this.prng.choice(streetNames);
            const lot = {
                id: `lot_${cell.col}_${cell.row}`,
                col: cell.col,
                row: cell.row,
                facingRoad: cell.facingRoad,
                type: LOT_TYPE.RESIDENTIAL,
                name: `Residence #${houseNum}`,
                address: `${this.prng.range(10, 99)} ${street}`,
                spriteKey: `house_${houseVariant}`,
                hazard: 'Domestic / Kitchen Fire Risk',
                onFire: false
            };
            this.grid[cell.row][cell.col].type = CELL_TYPE.LOT;
            this.grid[cell.row][cell.col].lot = lot;
            this.lots.push(lot);
            houseNum++;
        }

        // Build navigation graph
        this.buildRoadGraph();
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
                if (this.grid[nr][nc].type === CELL_TYPE.ROAD) {
                    return { col: nc, row: nr, dir: d.dir };
                }
            }
        }
        return null;
    }

    classifyRoads() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type !== CELL_TYPE.ROAD) continue;

                const N = r > 0 && this.grid[r - 1][c].type === CELL_TYPE.ROAD;
                const S = r < this.rows - 1 && this.grid[r + 1][c].type === CELL_TYPE.ROAD;
                const W = c > 0 && this.grid[r][c - 1].type === CELL_TYPE.ROAD;
                const E = c < this.cols - 1 && this.grid[r][c + 1].type === CELL_TYPE.ROAD;

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
                    // Clean 90° Corners
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
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
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
    // RENDERING
    // ==========================================
    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // Dark background filling canvas
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Lawn mowing texture within the grid bounds
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

        // 1. Render Central Park
        for (const park of this.parks) {
            this.renderPark(park);
        }

        // 2. Render Roads with Corners & Markings
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.renderRoadTile(c, r, this.grid[r][c].roadType);
                }
            }
        }

        // 3. Render Building Lots with Sprites
        for (const lot of this.lots) {
            this.renderLot(lot);
        }

        // 4. Overlays & Tooltips
        this.renderOverlays();
    }

    renderPark(park) {
        const ctx = this.ctx;
        const x = this.offsetX + park.col * this.cellSize;
        const y = this.offsetY + park.row * this.cellSize;
        const s = this.cellSize;

        ctx.fillStyle = '#0f4625';
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

        // Clustered Trees
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

        // Dark Asphalt Base
        ctx.fillStyle = '#27272a';
        ctx.fillRect(x, y, s, s);

        // Outer white curb lines
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;

        const N = r > 0 && this.grid[r - 1][c].type === CELL_TYPE.ROAD;
        const S = r < this.rows - 1 && this.grid[r + 1][c].type === CELL_TYPE.ROAD;
        const W = c > 0 && this.grid[r][c - 1].type === CELL_TYPE.ROAD;
        const E = c < this.cols - 1 && this.grid[r][c + 1].type === CELL_TYPE.ROAD;

        if (!N) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + s, y + 2); ctx.stroke(); }
        if (!S) { ctx.beginPath(); ctx.moveTo(x, y + s - 2); ctx.lineTo(x + s, y + s - 2); ctx.stroke(); }
        if (!W) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + s); ctx.stroke(); }
        if (!E) { ctx.beginPath(); ctx.moveTo(x + s - 2, y); ctx.lineTo(x + s - 2, y + s); ctx.stroke(); }

        // --- Centerlines & 90° Corner Curves ---
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
            ctx.beginPath();
            ctx.arc(x + s, y, half, Math.PI / 2, Math.PI);
            ctx.stroke();
        } else if (roadType === 'CORNER_NW') {
            ctx.beginPath();
            ctx.arc(x, y, half, 0, Math.PI / 2);
            ctx.stroke();
        } else if (roadType === 'CORNER_SE') {
            ctx.beginPath();
            ctx.arc(x + s, y + s, half, Math.PI, (3 * Math.PI) / 2);
            ctx.stroke();
        } else if (roadType === 'CORNER_SW') {
            ctx.beginPath();
            ctx.arc(x, y + s, half, (3 * Math.PI) / 2, 0);
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
        } else if (roadType === 'CUL_DE_SAC') {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x + half - 8, y + half - 2, 16, 4);
        }
    }

    renderLot(lot) {
        const ctx = this.ctx;
        const x = this.offsetX + lot.col * this.cellSize;
        const y = this.offsetY + lot.row * this.cellSize;
        const s = this.cellSize;

        // Driveway apron
        if (lot.facingRoad) {
            ctx.fillStyle = '#475569';
            const dw = Math.floor(s * 0.35);
            const dh = Math.floor(s * 0.16);
            if (lot.facingRoad.dir === 'S') ctx.fillRect(x + (s - dw) / 2, y + s - dh, dw, dh);
            if (lot.facingRoad.dir === 'N') ctx.fillRect(x + (s - dw) / 2, y, dw, dh);
            if (lot.facingRoad.dir === 'E') ctx.fillRect(x + s - dh, y + (s - dw) / 2, dh, dw);
            if (lot.facingRoad.dir === 'W') ctx.fillRect(x, y + (s - dw) / 2, dh, dw);
        }

        // Draw Building Sprite
        const sprite = this.images[lot.spriteKey];
        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, x + 2, y + 2, s - 4, s - 4);
        } else {
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
        }

        // Hub Badges
        if (lot.type === LOT_TYPE.STATION_FIRE) this.renderBadge(x + 2, y + 2, '🚒');
        else if (lot.type === LOT_TYPE.STATION_POLICE) this.renderBadge(x + 2, y + 2, '🚓');
        else if (lot.type === LOT_TYPE.STATION_HOSPITAL) this.renderBadge(x + 2, y + 2, '🚑');
    }

    renderBadge(bx, by, icon) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bx, by, 15, 15);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 15, 15);
        ctx.font = '10px sans-serif';
        ctx.fillText(icon, bx + 2, by + 11);
    }

    renderOverlays() {
        const ctx = this.ctx;

        if (this.hoveredCell && this.hoveredCell.lot) {
            const lot = this.hoveredCell.lot;
            const x = this.offsetX + lot.col * this.cellSize;
            const y = this.offsetY + lot.row * this.cellSize;
            const s = this.cellSize;

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            const b = 6;
            ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x, y); ctx.lineTo(x + b, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + s - b, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + b); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y + s - b); ctx.lineTo(x, y + s); ctx.lineTo(x + b, y + s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + s - b, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + s - b); ctx.stroke();

            this.renderTooltip(lot, x, y);
        }
    }

    renderTooltip(lot, lx, ly) {
        const ctx = this.ctx;
        const pad = 10;
        const tw = 240;
        const th = 64;

        let tx = lx + this.cellSize + 8;
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
