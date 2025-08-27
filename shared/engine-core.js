// Engine Core - Reusable simulation engine for stat applets
// Extracted from CLT component for modularity

(function() {
    'use strict';
    
    // ============ Mathematical Utilities ============
    window.StatUtils = {
        rngMulberry32: function(seed) {
            let t = seed >>> 0;
            return function () {
                t += 0x6D2B79F5;
                let r = Math.imul(t ^ (t >>> 15), 1 | t);
                r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
                return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
            };
        },

        clamp: function(x, a, b) { 
            return Math.max(a, Math.min(b, x)); 
        },

        mean: function(a) { 
            return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; 
        },

        varianceUnbiased: function(a) {
            const n = a.length; 
            if (n < 2) return NaN; 
            const m = this.mean(a);
            let s2 = 0; 
            for (let i = 0; i < n; i++) s2 += (a[i] - m) ** 2;
            return s2 / (n - 1);
        },

        robustSD: function(a) { 
            const v = this.varianceUnbiased(a); 
            return isFinite(v) && v >= 0 ? Math.sqrt(v) : 0; 
        },

        median: function(a) {
            if (!a.length) return NaN; 
            const b = a.slice().sort((x, y) => x - y);
            const m = b.length >> 1; 
            return b.length % 2 ? b[m] : 0.5 * (b[m - 1] + b[m]);
        },

        normalPdf: function(x, mu, sigma) { 
            return sigma > 1e-12 ? Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0; 
        },

        statLabel: function(s) { 
            return ({ mean: "x̄", median: "Median", sd: "s", proportion: "p̂" })[s]; 
        },

        validateSampleSize: function(n) {
            if (n < 2) return { valid: false, message: "Sample size must be at least 2" };
            if (n > 1000) return { valid: false, message: "Sample size too large (max 1000)" };
            return { valid: true };
        }
    };

    // ============ Core Engine Class ============
    window.StatEngine = class StatEngine {
        constructor(ctx, config = {}) {
            this.ctx = ctx;
            this.config = {
                cols: config.cols || 60,
                statBins: config.statBins || 60,
                pad: config.pad || 16,
                topUnits: config.topUnits || 30,
                midUnits: config.midUnits || 24,
                botUnits: config.botUnits || 36,
                colors: config.colors || this.getDefaultColors(),
                ...config
            };

            // Geometry
            this.plotW = 960; 
            this.gridW = 0; 
            this.colW = 0; 
            this.BOX = 8; 
            this.gridX0 = 0;
            this.H_TOP = 300; 
            this.H_MID = 240; 
            this.H_BOT = 360; 
            this.marginY = 8;
            this.BOX_TOP_Y = 8; 
            this.BOX_MID_Y = 8; 
            this.BOX_BOT_Y = 8;

            // Data structures
            this.popCounts = new Uint16Array(this.config.cols);
            this.midCounts = new Uint16Array(this.config.cols);
            this.botCounts = new Uint32Array(this.config.statBins);

            // Animation state
            this.sampleParticles = []; 
            this.statParticles = []; 
            this.popFlashes = [];
            this.gatherParticles = []; 
            this.gatherTarget = null; 
            this.gathering = false;
            this.gatherStart = 0; 
            this.gatherDur = 260; 
            this.emissionPlan = null;

            // Simulation parameters
            this.lastSample = []; 
            this.statistic = "mean"; 
            this.threshold = 0.5; 
            this.speed = "normal";
            this.showParamLine = true; 
            this.showNormalFit = false; 
            this.rng = StatUtils.rngMulberry32(1234);
            this.needsRedraw = true;
            this.lastGatheringSample = null;

            // Line tracking for enhanced visualization
            this.lines = {
                parameter: { value: null, x: null, visible: true },
                sampleStat: { value: null, x: null, visible: false },
                samplingMean: { value: null, x: null, visible: false }
            };

            this.resetGeometry({});
        }

        getDefaultColors() {
            return {
                text: "#001524",
                band: "rgba(0,0,0,0.04)",
                tick: "#EAECEF",
                popFill: "#15616D",
                popTop: "#2199AB",
                midFill: "#FF7D00",
                midTop: "#ff9c33",
                botFill: "#901328",
                botTop: "#B51732",
                flash: "rgba(255,125,0,0.85)",
                theta: "#78290F",
                normal: "#111827",
                sampleMean: "#FF7D00",
                active: "#FF7D00",
                idle: "#15616D",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444"
            };
        }

        resetGeometry({ plotW = 960, topH = 300, midH = 240, botH = 360 }) {
            this.plotW = plotW; 
            const innerW = plotW - 2 * this.config.pad; 
            this.colW = Math.floor(innerW / this.config.cols);
            this.BOX = Math.max(6, this.colW); 
            this.gridW = this.BOX * this.config.cols;
            this.gridX0 = Math.floor((plotW - this.gridW) / 2);
            this.H_TOP = topH; 
            this.H_MID = midH; 
            this.H_BOT = botH;
            this.needsRedraw = true;
        }

        layoutFromViewport(plotW, canvasH) {
            const totalUnits = this.config.topUnits + this.config.midUnits + this.config.botUnits;
            const innerW = Math.max(200, plotW - 2 * this.config.pad);
            const fromWidth = Math.max(6, Math.floor(innerW / this.config.cols));
            const fromHeight = Math.max(6, Math.floor((canvasH - 2 * 16) / totalUnits));
            const BOX = Math.min(fromWidth, fromHeight);
            const H_TOP = this.config.topUnits * BOX; 
            const H_MID = this.config.midUnits * BOX; 
            const H_BOT = this.config.botUnits * BOX;
            this.resetGeometry({ plotW, topH: H_TOP, midH: H_MID, botH: H_BOT });
        }

        applyGenerator(name) {
            const counts = new Uint16Array(this.config.cols);
            for (let c = 0; c < this.config.cols; c++) {
                const x = (c + 0.5) / this.config.cols; 
                let w = 1;
                if (name === "normal") { 
                    const z = (x - 0.5) / 0.16; 
                    w = Math.exp(-0.5 * z * z); 
                }
                else if (name === "uniform") { 
                    w = 1; 
                }
                else if (name === "bimodal") { 
                    const z1 = (x - 0.32) / 0.07, z2 = (x - 0.72) / 0.07; 
                    w = 0.55 * Math.exp(-0.5 * z1 * z1) + 0.45 * Math.exp(-0.5 * z2 * z2); 
                }
                else if (name === "lognormal") { 
                    const mu = Math.log(0.3), sig = 0.6; 
                    const lx = Math.log(Math.max(1e-4, x)); 
                    const z = (lx - mu) / sig; 
                    w = Math.exp(-0.5 * z * z) / Math.max(x, 1e-4); 
                }
                counts[c] = Math.max(0, Math.round(w * 20));
            }
            this.popCounts = counts;
            this.updateLines();
            this.needsRedraw = true;
        }

        get popStats() {
            const pc = this.popCounts; 
            let total = 0, mu = 0;
            for (let c = 0; c < this.config.cols; c++) { 
                const x = (c + 0.5) / this.config.cols, w = pc[c]; 
                total += w; 
                mu += w * x; 
            }
            mu = total ? mu / total : 0.5; 
            let s2 = 0;
            for (let c = 0; c < this.config.cols; c++) { 
                const x = (c + 0.5) / this.config.cols, w = pc[c]; 
                s2 += w * (x - mu) * (x - mu); 
            }
            const sdPop = total ? Math.sqrt(s2 / total) : 0;
            let medv = 0.5; 
            if (total) { 
                let acc = 0, half = total / 2; 
                for (let c = 0; c < this.config.cols; c++) { 
                    acc += pc[c]; 
                    if (acc >= half) { 
                        medv = (c + 0.5) / this.config.cols; 
                        break; 
                    } 
                } 
            }
            let greater = 0; 
            for (let c = 0; c < this.config.cols; c++) { 
                const x = (c + 0.5) / this.config.cols; 
                if (x > this.threshold) greater += pc[c]; 
            }
            const pthr = total ? greater / total : 0; 
            return { mu, sd: sdPop, med: medv, pthr, total };
        }

        statDomain() { 
            return this.statistic === "sd" ? { min: 0, max: 0.5 } : { min: 0, max: 1 }; 
        }

        computeStat(xs) {
            if (!xs.length) return NaN;
            if (this.statistic === "mean") return StatUtils.mean(xs);
            if (this.statistic === "median") return StatUtils.median(xs);
            if (this.statistic === "sd") return StatUtils.robustSD(xs);
            if (this.statistic === "proportion") return xs.filter((v) => v > this.threshold).length / xs.length;
            return NaN;
        }

        // Enhanced line tracking and updating
        updateLines() {
            const popStats = this.popStats;
            
            // Update parameter line
            let paramValue = popStats.mu;
            if (this.statistic === "median") paramValue = popStats.med;
            else if (this.statistic === "sd") paramValue = popStats.sd;
            else if (this.statistic === "proportion") paramValue = popStats.pthr;
            
            this.lines.parameter.value = paramValue;
            this.lines.parameter.x = this.valueToX(paramValue);
            
            // Update sample statistic line if we have a current sample
            if (this.lastSample && this.lastSample.length > 0) {
                const sampleStatValue = this.computeStat(this.lastSample);
                this.lines.sampleStat.value = sampleStatValue;
                this.lines.sampleStat.x = this.valueToX(sampleStatValue);
                this.lines.sampleStat.visible = !isNaN(sampleStatValue);
            } else {
                this.lines.sampleStat.visible = false;
            }
            
            // Update sampling distribution mean line
            const dom = this.statDomain();
            let total = 0, samplingMean = 0;
            for (let b = 0; b < this.config.statBins; b++) {
                const w = this.botCounts[b];
                total += w;
                const x01 = (b + 0.5) / this.config.statBins;
                const val = dom.min + x01 * (dom.max - dom.min);
                samplingMean += w * val;
            }
            
            if (total > 0) {
                samplingMean /= total;
                this.lines.samplingMean.value = samplingMean;
                this.lines.samplingMean.x = this.valueToX(samplingMean);
                this.lines.samplingMean.visible = true;
            } else {
                this.lines.samplingMean.visible = false;
            }
        }

        valueToX(value) {
            const domain = this.statDomain();
            const proportion = StatUtils.clamp((value - domain.min) / (domain.max - domain.min), 0, 1);
            return this.gridX0 + proportion * this.gridW;
        }

        // Additional methods for particle and animation management
        sampleN(n) {
            const rng = this.rng, weights = this.popCounts; 
            let total = 0; 
            for (let i = 0; i < this.config.cols; i++) total += weights[i];
            const xs = new Array(n), cols = new Array(n);
            
            if (total === 0) {
                for (let i = 0; i < n; i++) { 
                    const col = Math.floor(rng() * this.config.cols); 
                    cols[i] = col; 
                    xs[i] = (col + 0.5) / this.config.cols; 
                }
            } else {
                for (let i = 0; i < n; i++) { 
                    let target = rng() * total, acc = 0, chosen = this.config.cols >> 1; 
                    for (let c = 0; c < this.config.cols; c++) { 
                        acc += weights[c]; 
                        if (target <= acc) { 
                            chosen = c; 
                            break; 
                        } 
                    } 
                    cols[i] = chosen; 
                    xs[i] = (chosen + 0.5) / this.config.cols; 
                }
            }
            return { xs, cols };
        }

        hasActiveAnimations() {
            return this.emissionPlan || this.sampleParticles.length || this.statParticles.length || 
                   this.gathering || this.popFlashes.length || this.gatherParticles.length;
        }

        scheduleEmission(xs, cols, dropMs) { 
            this.lastSample = xs.slice(); 
            const now = performance.now(); 
            this.emissionPlan = { 
                start: now, 
                end: now + dropMs, 
                total: cols.length, 
                emitted: 0, 
                cols: cols.slice(), 
                xs: xs.slice() 
            }; 
        }

        colLeft(col) { 
            return this.gridX0 + col * this.BOX; 
        }
        
        colCenter(col) { 
            return this.gridX0 + col * this.BOX + this.BOX / 2; 
        }

        clickPopulation(xCanvas, yCanvas) { 
            if (yCanvas > this.marginY + this.H_TOP) return; 
            const col = StatUtils.clamp(Math.floor((xCanvas - this.gridX0) / this.BOX), 0, this.config.cols - 1); 
            this.popCounts[col] = StatUtils.clamp((this.popCounts[col] || 0) + 1, 0, 10000); 
            this.updateLines();
            this.needsRedraw = true; 
        }
        
        altClickPopulation(xCanvas, yCanvas) { 
            if (yCanvas > this.marginY + this.H_TOP) return; 
            const col = StatUtils.clamp(Math.floor((xCanvas - this.gridX0) / this.BOX), 0, this.config.cols - 1); 
            this.popCounts[col] = StatUtils.clamp((this.popCounts[col] || 0) - 1, 0, 10000); 
            this.updateLines();
            this.needsRedraw = true; 
        }

        // Animation and state management methods
        tick(dt, now) {
            const hadAnimations = this.hasActiveAnimations();
            const g = this.speed === "fast" ? 2400 : 1400;
            
            // Emission logic
            if (this.emissionPlan) {
                const p = this.emissionPlan; 
                const f = StatUtils.clamp((now - p.start) / (p.end - p.start), 0, 1);
                let targetEmitted = Math.floor(f * p.total); 
                let toEmit = targetEmitted - p.emitted;
                if (toEmit <= 0 && f >= 1) toEmit = p.total - p.emitted;
                
                if (toEmit > 0) {
                    const inflight = new Uint16Array(this.config.cols);
                    for (const s of this.sampleParticles) inflight[s.col]++;
                    const topBase = this.marginY + this.H_TOP - 16; 
                    const midBase = this.marginY + this.H_TOP + this.H_MID - 8;
                    
                    while (toEmit-- > 0 && p.emitted < p.total) {
                        const col = p.cols[p.emitted];
                        const yStart = this.popCounts[col] > 0 ? 
                            topBase - (this.popCounts[col] - 1) * this.BOX_TOP_Y - this.BOX_TOP_Y / 2 : 
                            this.BOX_TOP_Y * 2;
                        const level = (this.midCounts[col] || 0) + inflight[col]; 
                        inflight[col]++;
                        const targetY = midBase - level * this.BOX_MID_Y - this.BOX_MID_Y / 2;
                        this.popFlashes.push({ col, y: yStart, until: now + 160 });
                        this.sampleParticles.push({ col, x: this.colCenter(col), y: yStart, vy: 0, targetY });
                        p.emitted++;
                    }
                }
                if (this.emissionPlan && this.emissionPlan.emitted >= this.emissionPlan.total) {
                    this.emissionPlan = null;
                    this.updateLines(); // Update lines when emission completes
                }
            }
            
            // Sample particle physics
            if (this.sampleParticles.length) {
                const survivors = [];
                for (const s of this.sampleParticles) { 
                    s.vy += g * dt; 
                    s.y = Math.min(s.y + s.vy * dt, s.targetY); 
                    if (s.y < s.targetY - 0.1) {
                        survivors.push(s); 
                    } else {
                        this.midCounts[s.col] = (this.midCounts[s.col] || 0) + 1;
                        this.updateLines(); // Update lines when particles land
                    }
                }
                this.sampleParticles = survivors;
            }
            
            // Gathering animation
            if (this.gathering && this.gatherTarget) {
                const t = StatUtils.clamp((now - this.gatherStart) / this.gatherDur, 0, 1);
                
                for (const gp of this.gatherParticles) {
                    const dx = this.gatherTarget.x - gp.sx;
                    const dy = this.gatherTarget.y - gp.sy;
                    gp.x = gp.sx + dx * t;
                    gp.y = gp.sy + dy * t;
                }
                
                if (t >= 1) {
                    const botBase = this.marginY + this.H_TOP + this.H_MID + this.H_BOT - 8;
                    const inflightForBin = this.statParticles.filter((q) => q.bin === this.gatherTarget.bin).length;
                    const level = (this.botCounts[this.gatherTarget.bin] || 0) + inflightForBin;
                    const targetY = botBase - level * this.BOX_BOT_Y - this.BOX_BOT_Y / 2;
                    const xCenter = this.gridX0 + this.gatherTarget.bin * this.BOX + this.BOX / 2;
                    this.statParticles.push({ x: xCenter, y: this.gatherTarget.y, vy: 0, targetY, bin: this.gatherTarget.bin });
                    this.gathering = false; 
                    this.gatherTarget = null; 
                    this.gatherParticles = []; 
                    this.lastGatheringSample = null;
                    this.updateLines(); // Update lines when gathering completes
                }
            }
            
            // Statistic particle physics
            if (this.statParticles.length) {
                const survivors = [];
                for (const p of this.statParticles) { 
                    p.vy += g * dt; 
                    p.y = Math.min(p.y + p.vy * dt, p.targetY); 
                    if (p.y < p.targetY - 0.1) {
                        survivors.push(p); 
                    } else {
                        this.botCounts[p.bin] = (this.botCounts[p.bin] || 0) + 1;
                        this.updateLines(); // Update lines when stat particles land
                    }
                }
                this.statParticles = survivors;
            }
            
            // Clean up expired flashes
            this.popFlashes = this.popFlashes.filter((f) => f.until > now);
            
            if (this.hasActiveAnimations() || hadAnimations) {
                this.needsRedraw = true;
            }
        }

        // Utility methods for other components to extend
        startSample(n, dropMs) { 
            const { xs, cols } = this.sampleN(n); 
            this.scheduleEmission(xs, cols, dropMs); 
        }

        calculateWithGather() {
            const xs = this.lastSample || []; 
            let hasMid = false; 
            for (let i = 0; i < this.config.cols; i++) {
                if (this.midCounts[i] > 0) { 
                    hasMid = true; 
                    break; 
                }
            }
            if (!xs.length && !hasMid) return;
            
            if (xs.length) {
                this.lastGatheringSample = xs.slice();
            } else {
                const list = []; 
                for (let c = 0; c < this.config.cols; c++) {
                    for (let r = 0; r < (this.midCounts[c] || 0); r++) {
                        list.push((c + 0.5) / this.config.cols);
                    }
                }
                this.lastGatheringSample = list;
            }
            
            const val = this.computeStat(this.lastGatheringSample);
            const { min, max } = this.statDomain(); 
            const x01 = StatUtils.clamp((val - min) / (max - min + 1e-9), 0, 1); 
            const bin = StatUtils.clamp(Math.floor(x01 * this.config.statBins), 0, this.config.statBins - 1);
            const binCenterX = this.gridX0 + bin * this.BOX + this.BOX / 2; 
            const gatherX = binCenterX; 
            const gatherY = this.marginY + this.H_TOP + this.H_MID / 2; 
            const midBase = this.marginY + this.H_TOP + this.H_MID - 16;
            
            this.gatherParticles = []; 
            for (let c = 0; c < this.config.cols; c++) { 
                const stack = this.midCounts[c] || 0; 
                if (!stack) continue; 
                for (let r = 0; r < stack; r++) { 
                    const startY = midBase - r * this.BOX_MID_Y - this.BOX_MID_Y / 2; 
                    const startX = this.colCenter(c);
                    this.gatherParticles.push({ 
                        sx: startX, sy: startY, x: startX, y: startY
                    }); 
                } 
            }
            
            this.midCounts = new Uint16Array(this.config.cols); 
            this.gatherTarget = { x: gatherX, y: gatherY, bin }; 
            this.gathering = true; 
            this.gatherStart = performance.now(); 
            this.lastSample = [];
        }

        drawSampleWithAutoCalculate(n, dropMs) {
            if (this.lastSample?.length || this.hasSampleInMid()) { 
                this.calculateWithGather(); 
                setTimeout(() => { 
                    this.startSample(n, dropMs); 
                }, 100); 
            } else { 
                this.startSample(n, dropMs); 
            }
        }
        
        hasSampleInMid() { 
            for (let i = 0; i < this.config.cols; i++) { 
                if (this.midCounts[i] > 0) return true; 
            } 
            return false; 
        }
        
        clearTray() { 
            this.midCounts = new Uint16Array(this.config.cols); 
            this.lastSample = []; 
            this.sampleParticles = []; 
            this.emissionPlan = null; 
            this.gatherParticles = []; 
            this.gathering = false; 
            this.updateLines();
            this.needsRedraw = true; 
        }
        
        resetExperiment() { 
            this.botCounts = new Uint32Array(this.config.statBins); 
            this.statParticles = []; 
            this.updateLines();
            this.needsRedraw = true; 
        }
        
        handleRepeatTurbo(n) { 
            for (let i = 0; i < 1000; i++) { 
                const { xs } = this.sampleN(n); 
                const v = this.computeStat(xs); 
                const { min, max } = this.statDomain(); 
                const x01 = StatUtils.clamp((v - min) / (max - min + 1e-9), 0, 1); 
                const bin = StatUtils.clamp(Math.floor(x01 * this.config.statBins), 0, this.config.statBins - 1); 
                this.botCounts[bin] = (this.botCounts[bin] || 0) + 1; 
            } 
            this.updateLines();
            this.needsRedraw = true;
        }
    };
})();