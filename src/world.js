// ========================================================
// CHRONOS DISPATCH - Dynamic Fullscreen World Engine
// Featuring Organic Corner-Rich Roads, Loops & Cul-de-sacs
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

        // Smaller scale for richer city density (56px cells)
        this.cellSize = 56;
        this.cols = 16;
        this.rows = 9;
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

        // Setup resize observer for dynamic full-screen responsiveness
        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.generate(this.seed);
        });

        this.initInteractions();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.cols = Math.max(12, Math.floor(this.canvas.width / this.cellSize));
        this.rows = Math.max(7, Math.floor(this.canvas.height / this.cellSize));

        // Center the grid within the viewport
        this.offsetX = Math.floor((this.canvas.width - this.cols * this.cellSize) / 2);
        this.offsetY = Math.floor((this.canvas.height - this.rows * this.cellSize) / 2);
    }

    loadAssets() {
        const assets = {
            // Stations
            'fire_station': 'assets/stations/fire_station_1.png',
            'police_station': 'assets/stations/police_station_1.png',
            'hospital': 'assets/stations/hospital_1.png',
            // Commercial & Civic
            'gas_station': 'assets/commercial/gas_station.png',
            'diner': 'assets/commercial/diner.png',
            'school': 'assets/commercial/school.png',
            'supermarket': 'assets/commercial/supermarket.png',
            'bank': 'assets/commercial/bank.png',
            'warehouse': 'assets/commercial/industrial_warehouse.png',
            // 10 Residential houses
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
    // PROCEDURAL ROAD & CORNER GENERATION
    // ==========================================
    generate(seed) {
        this.seed = seed;
        this.prng.setSeed(seed);
        this.grid = [];
        this.lots = [];
        this.parks = [];
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

        // 2. Generate Organic Corner-Rich Road Network
        const midCol = Math.floor(this.cols / 2);
        const midRow = Math.floor(this.rows / 2);

        // --- Loop 1: West Neighborhood Loop (4 Corners!) ---
        const wLeft = this.prng.range(1, 2);
        const wRight = Math.min(midCol - 1, wLeft + this.prng.range(3, 5));
        const wTop = this.prng.range(1, 2);
        const wBottom = Math.min(this.rows - 2, wTop + this.prng.range(3, 4));

        for (let c = wLeft; c <= wRight; c++) { setRoad(c, wTop); setRoad(c, wBottom); }
        for (let r = wTop; r <= wBottom; r++) { setRoad(wLeft, r); setRoad(wRight, r); }

        // --- Loop 2: East Neighborhood Loop (4 Corners!) ---
        const eLeft = Math.max(midCol + 1, wRight + 2);
        const eRight = Math.min(this.cols - 2, eLeft + this.prng.range(3, 5));
        const eTop = this.prng.range(1, 3);
        const eBottom = Math.min(this.rows - 2, eTop + this.prng.range(3, 4));

        for (let c = eLeft; c <= eRight; c++) { setRoad(c, eTop); setRoad(c, eBottom); }
        for (let r = eTop; r <= eBottom; r++) { setRoad(eLeft, r); setRoad(eRight, r); }

        // --- Arterial Connecting Boulevard with a Dogleg / Corner ---
        const connectRow = this.prng.choice([wTop, wBottom, midRow]);
        for (let c = wRight; c <= eLeft; c++) {
            setRoad(c, connectRow);
        }

        // Vertical spine or bypass connector
        const spineCol = midCol;
        const spineStart = Math.min(wTop, eTop);
        const spineEnd = Math.max(wBottom, eBottom);
        for (let r = spineStart; r <= spineEnd; r++) {
            setRoad(spineCol, r);
        }

        // --- 2-3 Cul-de-Sacs / Dead-Ends (Charming dead-end courts) ---
        const culDeSacRows = [wTop > 1 ? 0 : this.rows - 1, eBottom < this.rows - 1 ? this.rows - 1 : 0];
        setRoad(wLeft + 1, culDeSacRows[0]);
        setRoad(wLeft + 1, culDeSacRows[0] === 0 ? 1 : this.rows - 2);

        setRoad(eRight - 1, culDeSacRows[1]);
        setRoad(eRight - 1, culDeSacRows[1] === 0 ? 1 : this.rows - 2);

        // Classify all road pieces (Corner NE, NW, SE, SW, T-Junctions, 4-Way, Straight)
        this.classifyRoads();

        // 3. Find candidate cells adjacent to roads for building lots
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

        // 4. Place Key Emergency Stations & Civic Hotspots
        const specialRoster = [
            { type: LOT_TYPE.STATION_FIRE, name: 'Engine Co. 4 Firehouse', address: '12 Firehouse Lane', sprite: 'fire_station', hazard: 'Dispatches Fire Engine' },
            { type: LOT_TYPE.STATION_POLICE, name: 'Precinct 9 Police HQ', address: '50 Civic Plaza', sprite: 'police_station', hazard: 'Dispatches Police Patrol' },
            { type: LOT_TYPE.STATION_HOSPITAL, name: 'County Hospital ER', address: '100 Medical Way', sprite: 'hospital', hazard: 'Dispatches Paramedic Unit' },
            { type: LOT_TYPE.CIVIC_SCHOOL, name: 'Lincoln Elementary School', address: '85 School Lane', sprite: 'school', hazard: '08:15 School Bell Pedestrian Jam' },
            { type: LOT_TYPE.COMMERCIAL_GAS, name: 'Apex Gas & Fuel', address: '200 Main Highway', sprite: 'gas_station', hazard: 'High Explosion Risk (90s Timer)' },
            { type: LOT_TYPE.COMMERCIAL_DINER, name: 'Sunrise 24/7 Diner', address: '44 Main Street', sprite: 'diner', hazard: 'Grease Fryer Fire Risk' },
            { type: LOT_TYPE.COMMERCIAL_BANK, name: 'First National Bank', address: '10 Bank Street', sprite: 'bank', hazard: 'Silent Alarm / Robbery Risk' },
            { type: LOT_TYPE.COMMERCIAL_SUPERMARKET, name: 'FreshGrocer Supermarket', address: '150 Commercial St', sprite: 'supermarket', hazard: 'Delivery Truck Bottleneck' },
            { type: LOT_TYPE.INDUSTRIAL_WAREHOUSE, name: 'Keystone Chemical Storage', address: '300 Industrial Blvd', sprite: 'warehouse', hazard: 'Chemical Cascade Hazard' }
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

        // 5. Fill remaining candidate lots with diverse 16-bit Residential Houses
        const streetNames = ['Oak Street', 'Elm Avenue', 'Maple Court', 'Cedar Way', 'Pine Road', 'Willow Lane', 'Birch St'];
        let houseIndex = 1;
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
                name: `Residence #${houseIndex}`,
                address: `${this.prng.range(10, 99)} ${street}`,
                spriteKey: `house_${houseVariant}`,
                hazard: 'Domestic / Kitchen Fire Risk',
                onFire: false
            };
            this.grid[cell.row][cell.col].type = CELL_TYPE.LOT;
            this.grid[cell.row][cell.col].lot = lot;
            this.lots.push(lot);
            houseIndex++;
        }

        // 6. Turn remaining empty internal blocks into City Parks with Trees
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.EMPTY) {
                    this.grid[r][c].type = CELL_TYPE.PARK;
                    this.parks.push({ col: c, row: r, treeVariant: this.prng.range(1, 3) });
                }
            }
        }

        // 7. Extract Road Navigation Graph for Responders
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
                    // 4 Distinct Corner Types
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

        // 1. Dark grass background filling entire fullscreen canvas
        ctx.fillStyle = '#14532d';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Subtle lawn mowing grid pattern
        ctx.fillStyle = '#166534';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if ((r + c) % 2 === 0) {
                    ctx.fillRect(this.offsetX + c * this.cellSize, this.offsetY + r * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }

        // 3. Render City Parks (Trees & trails)
        for (const park of this.parks) {
            this.renderPark(park);
        }

        // 4. Render Roads with Bends & Corners
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.renderRoadTile(c, r, this.grid[r][c].roadType);
                }
            }
        }

        // 5. Render Building Lots with Sprites
        for (const lot of this.lots) {
            this.renderLot(lot);
        }

        // 6. Tactical Hover & Selection Overlay
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

        // Curbs / Sidewalk Lines
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;

        const N = r > 0 && this.grid[r - 1][c].type === CELL_TYPE.ROAD;
        const S = r < this.rows - 1 && this.grid[r + 1][c].type === CELL_TYPE.ROAD;
        const W = c > 0 && this.grid[r][c - 1].type === CELL_TYPE.ROAD;
        const E = c < this.cols - 1 && this.grid[r][c + 1].type === CELL_TYPE.ROAD;

        // Outer curbs where road borders grass/lots
        if (!N) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + s, y + 2); ctx.stroke(); }
        if (!S) { ctx.beginPath(); ctx.moveTo(x, y + s - 2); ctx.lineTo(x + s, y + s - 2); ctx.stroke(); }
        if (!W) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + s); ctx.stroke(); }
        if (!E) { ctx.beginPath(); ctx.moveTo(x + s - 2, y); ctx.lineTo(x + s - 2, y + s); ctx.stroke(); }

        // --- Corner Centerdivider & Markings ---
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;

        if (roadType === 'STRAIGHT_H') {
            ctx.fillRect(x + 4, y + half - 2, 14, 4);
            ctx.fillRect(x + 22, y + half - 2, 14, 4);
            ctx.fillRect(x + 40, y + half - 2, 14, 4);
        } else if (roadType === 'STRAIGHT_V') {
            ctx.fillRect(x + half - 2, y + 4, 4, 14);
            ctx.fillRect(x + half - 2, y + 22, 4, 14);
            ctx.fillRect(x + half - 2, y + 40, 4, 14);
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
            for (let i = 6; i < s - 6; i += 8) {
                ctx.fillRect(x + i, y + 4, 5, 6);
                ctx.fillRect(x + i, y + s - 10, 5, 6);
                ctx.fillRect(x + 4, y + i, 6, 5);
                ctx.fillRect(x + s - 10, y + i, 6, 5);
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

        if (lot.facingRoad) {
            ctx.fillStyle = '#475569';
            if (lot.facingRoad.dir === 'S') ctx.fillRect(x + 18, y + s - 10, 20, 10);
            if (lot.facingRoad.dir === 'N') ctx.fillRect(x + 18, y, 20, 10);
            if (lot.facingRoad.dir === 'E') ctx.fillRect(x + s - 10, y + 18, 10, 20);
            if (lot.facingRoad.dir === 'W') ctx.fillRect(x, y + 18, 10, 20);
        }

        const sprite = this.images[lot.spriteKey];
        if (sprite && sprite.complete) {
            ctx.drawImage(sprite, x + 3, y + 3, s - 6, s - 6);
        } else {
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
        }

        if (lot.type === LOT_TYPE.STATION_FIRE) this.renderBadge(x + 2, y + 2, '🚒');
        else if (lot.type === LOT_TYPE.STATION_POLICE) this.renderBadge(x + 2, y + 2, '🚓');
        else if (lot.type === LOT_TYPE.STATION_HOSPITAL) this.renderBadge(x + 2, y + 2, '🚑');
    }

    renderBadge(bx, by, icon) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bx, by, 16, 16);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 16, 16);
        ctx.font = '10px sans-serif';
        ctx.fillText(icon, bx + 2, by + 12);
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
            const b = 8;
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
