// ========================================================
// CHRONOS DISPATCH - World Engine, Road Graph & Lot Generator
// ========================================================

const CELL_TYPE = {
    EMPTY: 'EMPTY',
    ROAD: 'ROAD',
    LOT: 'LOT'
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

        // Grid config
        this.cols = 10;
        this.rows = 6;
        this.cellSize = 80; // 10 * 80 = 800w, 6 * 80 = 480h

        this.grid = [];
        this.lots = [];
        this.roadNodes = [];
        this.roadEdges = [];

        this.hoveredCell = null;
        this.selectedLot = null;

        this.images = {};
        this.loadAssets();
        this.generate(seed);
        this.initInteractions();
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
            'house_10': 'assets/residential/house_10_apartment.png',
            // Vehicles (Responders)
            'police_cruiser': 'assets/vehicles/responder_police_cruiser.png',
            'police_cruiser_s1': 'assets/vehicles/responder_police_cruiser_siren_1.png',
            'police_cruiser_s2': 'assets/vehicles/responder_police_cruiser_siren_2.png',
            'fire_engine': 'assets/vehicles/responder_fire_engine.png',
            'fire_engine_s1': 'assets/vehicles/responder_fire_engine_siren_1.png',
            'fire_engine_s2': 'assets/vehicles/responder_fire_engine_siren_2.png',
            'ambulance': 'assets/vehicles/responder_ambulance.png',
            'ambulance_s1': 'assets/vehicles/responder_ambulance_siren_1.png',
            'ambulance_s2': 'assets/vehicles/responder_ambulance_siren_2.png'
        };

        for (const [key, src] of Object.entries(assets)) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.images[key] = img;
            };
        }
    }

    generate(seed) {
        this.seed = seed;
        this.prng.setSeed(seed);
        this.grid = [];
        this.lots = [];
        this.roadNodes = [];
        this.roadEdges = [];

        // 1. Initialize grid with empty cells
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = {
                    col: c,
                    row: r,
                    type: CELL_TYPE.EMPTY,
                    lot: null,
                    roadType: null
                };
            }
        }

        // 2. Generate Road Arteries
        // Horizontal main street (Row 2 or 3)
        const mainHRow = this.prng.choice([2, 3]);
        for (let c = 0; c < this.cols; c++) {
            this.grid[mainHRow][c].type = CELL_TYPE.ROAD;
        }

        // Two vertical avenues
        const vCol1 = this.prng.choice([2, 3]);
        const vCol2 = this.prng.choice([6, 7]);
        for (let r = 0; r < this.rows; r++) {
            this.grid[r][vCol1].type = CELL_TYPE.ROAD;
            this.grid[r][vCol2].type = CELL_TYPE.ROAD;
        }

        // 50% chance of a secondary horizontal street branch
        if (this.prng.random() > 0.4) {
            const secondaryH = mainHRow === 2 ? 4 : 1;
            const startCol = Math.min(vCol1, vCol2);
            const endCol = Math.max(vCol1, vCol2);
            for (let c = startCol; c <= endCol; c++) {
                this.grid[secondaryH][c].type = CELL_TYPE.ROAD;
            }
        }

        // Classify road intersection types (Straight, Corner, T-Junction, 4-Way)
        this.classifyRoads();

        // 3. Find all candidate cells for building lots (must touch at least 1 road)
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

        // Shuffle candidate locations using seeded PRNG
        this.prng.shuffle(candidateCells);

        // Street names for addresses
        const streetNames = ['Oak Street', 'Elm Avenue', '4th Street', 'Pine Road', 'Maple Boulevard', 'Cedar Way'];

        // 4. Place Essential Buildings
        const buildingRoster = [
            // Responders
            { type: LOT_TYPE.STATION_FIRE, name: 'Engine Company 4', address: '12 Firehouse Lane', sprite: 'fire_station', hazard: 'Dispatches Fire Engine' },
            { type: LOT_TYPE.STATION_POLICE, name: 'Precinct 9 Patrol', address: '50 Civic Plaza', sprite: 'police_station', hazard: 'Dispatches Police Patrol' },
            { type: LOT_TYPE.STATION_HOSPITAL, name: 'County General ER', address: '100 Medical Way', sprite: 'hospital', hazard: 'Dispatches Paramedic Unit' },
            // Civic / Commercial
            { type: LOT_TYPE.CIVIC_SCHOOL, name: 'Lincoln Elementary', address: '85 School Lane', sprite: 'school', hazard: '08:15 School Bell Pedestrian Jam' },
            { type: LOT_TYPE.COMMERCIAL_GAS, name: 'Apex Gas & Fuel', address: '200 Main Highway', sprite: 'gas_station', hazard: 'High Explosion Risk (90s Timer)' },
            { type: LOT_TYPE.COMMERCIAL_DINER, name: 'Sunrise 24/7 Diner', address: '44 Main Street', sprite: 'diner', hazard: 'Grease Fryer Fire Risk' },
            { type: LOT_TYPE.COMMERCIAL_BANK, name: 'First National Bank', address: '10 Bank Street', sprite: 'bank', hazard: 'Alarm Trip / Burglary Hazard' },
            { type: LOT_TYPE.COMMERCIAL_SUPERMARKET, name: 'FreshGrocer Market', address: '150 Commercial St', sprite: 'supermarket', hazard: 'Delivery Truck Bottleneck' },
            { type: LOT_TYPE.INDUSTRIAL_WAREHOUSE, name: 'Keystone Storage', address: '300 Industrial Blvd', sprite: 'warehouse', hazard: 'Chemical Cloud Cascade Hazard' }
        ];

        // Place special buildings
        buildingRoster.forEach((spec) => {
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
                    onFire: false,
                    isProtected: false
                };
                this.grid[cell.row][cell.col].type = CELL_TYPE.LOT;
                this.grid[cell.row][cell.col].lot = lot;
                this.lots.push(lot);
            }
        });

        // 5. Fill remaining candidate lots with Residential houses
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
                hazard: 'Kitchen / Domestic Fire Risk',
                onFire: false,
                isProtected: false
            };
            this.grid[cell.row][cell.col].type = CELL_TYPE.LOT;
            this.grid[cell.row][cell.col].lot = lot;
            this.lots.push(lot);
            houseNum++;
        }

        // 6. Build Navigation Graph for Responders
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
                    this.grid[r][c].roadType = '3WAY';
                } else if (count === 2) {
                    if (N && S) this.grid[r][c].roadType = 'STRAIGHT_V';
                    else if (W && E) this.grid[r][c].roadType = 'STRAIGHT_H';
                    else this.grid[r][c].roadType = 'CORNER';
                } else {
                    this.grid[r][c].roadType = (N || S) ? 'STRAIGHT_V' : 'STRAIGHT_H';
                }
            }
        }
    }

    buildRoadGraph() {
        // Collect all road cell centers as nodes
        this.roadNodes = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.roadNodes.push({
                        id: `road_${c}_${r}`,
                        col: c,
                        row: r,
                        x: c * this.cellSize + this.cellSize / 2,
                        y: r * this.cellSize + this.cellSize / 2
                    });
                }
            }
        }

        // Build edges between directly neighboring road cells
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

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

        // 1. Dark grass yard base
        ctx.fillStyle = '#14532d';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Subtle lawn mowing grid texture
        ctx.fillStyle = '#15803d';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if ((r + c) % 2 === 0) {
                    ctx.fillRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }

        // 3. Render Roads
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].type === CELL_TYPE.ROAD) {
                    this.renderRoadTile(c, r, this.grid[r][c].roadType);
                }
            }
        }

        // 4. Render Building Lots with Sprites
        for (const lot of this.lots) {
            this.renderLot(lot);
        }

        // 5. Render Hover & Inspection Tooltip Overlay
        this.renderOverlays();
    }

    renderRoadTile(c, r, roadType) {
        const ctx = this.ctx;
        const x = c * this.cellSize;
        const y = r * this.cellSize;
        const s = this.cellSize;

        // Dark Asphalt Base
        ctx.fillStyle = '#27272a';
        ctx.fillRect(x, y, s, s);

        // Sidewalk / Curb Trim
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;

        const N = r > 0 && this.grid[r - 1][c].type === CELL_TYPE.ROAD;
        const S = r < this.rows - 1 && this.grid[r + 1][c].type === CELL_TYPE.ROAD;
        const W = c > 0 && this.grid[r][c - 1].type === CELL_TYPE.ROAD;
        const E = c < this.cols - 1 && this.grid[r][c + 1].type === CELL_TYPE.ROAD;

        // Outer white curb edges where road meets grass
        if (!N) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + s, y + 2); ctx.stroke(); }
        if (!S) { ctx.beginPath(); ctx.moveTo(x, y + s - 2); ctx.lineTo(x + s, y + s - 2); ctx.stroke(); }
        if (!W) { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + s); ctx.stroke(); }
        if (!E) { ctx.beginPath(); ctx.moveTo(x + s - 2, y); ctx.lineTo(x + s - 2, y + s); ctx.stroke(); }

        // Yellow Centerdivider striping
        ctx.fillStyle = '#facc15';
        if (roadType === 'STRAIGHT_H' || (W && E && !N && !S)) {
            // Horizontal dashed lines
            ctx.fillRect(x + 6, y + s / 2 - 2, 18, 4);
            ctx.fillRect(x + 32, y + s / 2 - 2, 18, 4);
            ctx.fillRect(x + 58, y + s / 2 - 2, 18, 4);
        } else if (roadType === 'STRAIGHT_V' || (N && S && !W && !E)) {
            // Vertical dashed lines
            ctx.fillRect(x + s / 2 - 2, y + 6, 4, 18);
            ctx.fillRect(x + s / 2 - 2, y + 32, 4, 18);
            ctx.fillRect(x + s / 2 - 2, y + 58, 4, 18);
        } else if (roadType === '4WAY') {
            // Crosswalk zebra stripes on all 4 branches
            ctx.fillStyle = '#f8fafc';
            for (let i = 8; i < s - 8; i += 10) {
                // North zebra
                ctx.fillRect(x + i, y + 4, 6, 8);
                // South zebra
                ctx.fillRect(x + i, y + s - 12, 6, 8);
                // West zebra
                ctx.fillRect(x + 4, y + i, 8, 6);
                // East zebra
                ctx.fillRect(x + s - 12, y + i, 8, 6);
            }
        } else if (roadType === '3WAY') {
            // Center intersection dot
            ctx.fillStyle = '#eab308';
            ctx.fillRect(x + s / 2 - 3, y + s / 2 - 3, 6, 6);
        }
    }

    renderLot(lot) {
        const ctx = this.ctx;
        const x = lot.col * this.cellSize;
        const y = lot.row * this.cellSize;
        const s = this.cellSize;

        // Driveway / concrete apron connecting to facing road
        if (lot.facingRoad) {
            ctx.fillStyle = '#475569';
            if (lot.facingRoad.dir === 'S') ctx.fillRect(x + 28, y + 60, 24, 20);
            if (lot.facingRoad.dir === 'N') ctx.fillRect(x + 28, y, 24, 20);
            if (lot.facingRoad.dir === 'E') ctx.fillRect(x + 60, y + 28, 20, 24);
            if (lot.facingRoad.dir === 'W') ctx.fillRect(x, y + 28, 20, 24);
        }

        // Draw Building Sprite
        const sprite = this.images[lot.spriteKey];
        if (sprite && sprite.complete) {
            // Scale sprite to fit nicely within lot boundaries (e.g. 72x72)
            ctx.drawImage(sprite, x + 4, y + 4, s - 8, s - 8);
        } else {
            // Fallback placeholder while images finish loading
            ctx.fillStyle = lot.type.includes('STATION') ? '#ef4444' : '#0284c7';
            ctx.fillRect(x + 10, y + 10, s - 20, s - 20);
        }

        // Small indicator icon badge on roof for Station Hubs
        if (lot.type === LOT_TYPE.STATION_FIRE) {
            this.renderBadge(x + 4, y + 4, '🚒');
        } else if (lot.type === LOT_TYPE.STATION_POLICE) {
            this.renderBadge(x + 4, y + 4, '🚓');
        } else if (lot.type === LOT_TYPE.STATION_HOSPITAL) {
            this.renderBadge(x + 4, y + 4, '🚑');
        }
    }

    renderBadge(bx, by, icon) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(bx, by, 18, 18);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 18, 18);
        ctx.font = '11px sans-serif';
        ctx.fillText(icon, bx + 2, by + 14);
    }

    renderOverlays() {
        const ctx = this.ctx;

        // Highlight Hovered Building Lot
        if (this.hoveredCell && this.hoveredCell.lot) {
            const lot = this.hoveredCell.lot;
            const x = lot.col * this.cellSize;
            const y = lot.row * this.cellSize;
            const s = this.cellSize;

            // Tactical Corner Cursor Brackets
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            const b = 10;
            // Top-left
            ctx.beginPath(); ctx.moveTo(x, y + b); ctx.lineTo(x, y); ctx.lineTo(x + b, y); ctx.stroke();
            // Top-right
            ctx.beginPath(); ctx.moveTo(x + s - b, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + b); ctx.stroke();
            // Bottom-left
            ctx.beginPath(); ctx.moveTo(x, y + s - b); ctx.lineTo(x, y + s); ctx.lineTo(x + b, y + s); ctx.stroke();
            // Bottom-right
            ctx.beginPath(); ctx.moveTo(x + s - b, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + s - b); ctx.stroke();

            // Tactical Tooltip box
            this.renderTooltip(lot, x, y);
        }
    }

    renderTooltip(lot, lx, ly) {
        const ctx = this.ctx;
        const pad = 10;
        const tw = 240;
        const th = 64;

        // Position tooltip to avoid overflowing canvas edges
        let tx = lx + this.cellSize + 8;
        let ty = ly;
        if (tx + tw > this.canvas.width) tx = lx - tw - 8;
        if (ty + th > this.canvas.height) ty = this.canvas.height - th - 8;

        ctx.fillStyle = 'rgba(11, 17, 32, 0.95)';
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, tw, th);

        // Header (Building Name)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(lot.name, tx + pad, ty + 18);

        // Address
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.fillText(`📍 ${lot.address}`, tx + pad, ty + 34);

        // Inherent Hazard
        ctx.fillStyle = lot.hazard.includes('Dispatches') ? '#10b981' : '#f59e0b';
        ctx.font = '10px monospace';
        ctx.fillText(`⚠️ ${lot.hazard}`, tx + pad, ty + 50);
    }
}

window.World = World;
