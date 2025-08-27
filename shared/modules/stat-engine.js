// Statistical Engine Module - Core reusable engine for stat applets
// Provides foundation for CLT, confidence intervals, p-values, etc.

(function(global) {
    'use strict';

    // ============ Mathematical Utilities ============
    const MathUtils = {
        // Deterministic RNG
        createRNG(seed) {
            let t = seed >>> 0;
            return function() {
                t += 0x6D2B79F5;
                let r = Math.imul(t ^ (t >>> 15), 1 | t);
                r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
                return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
            };
        },

        clamp(x, a, b) { 
            return Math.max(a, Math.min(b, x)); 
        },

        mean(array) { 
            return array.length ? array.reduce((s, v) => s + v, 0) / array.length : NaN; 
        },

        variance(array, unbiased = true) {
            const n = array.length;
            if (n < (unbiased ? 2 : 1)) return NaN;
            const m = this.mean(array);
            let s2 = 0;
            for (let i = 0; i < n; i++) s2 += (array[i] - m) ** 2;
            return s2 / (n - (unbiased ? 1 : 0));
        },

        standardDeviation(array, unbiased = true) {
            const v = this.variance(array, unbiased);
            return isFinite(v) && v >= 0 ? Math.sqrt(v) : 0;
        },

        median(array) {
            if (!array.length) return NaN;
            const sorted = array.slice().sort((x, y) => x - y);
            const mid = sorted.length >> 1;
            return sorted.length % 2 ? sorted[mid] : 0.5 * (sorted[mid - 1] + sorted[mid]);
        },

        normalPDF(x, mu, sigma) {
            return sigma > 1e-12 ? 
                Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) : 0;
        },

        validateSampleSize(n, min = 2, max = 1000) {
            if (n < min) return { valid: false, message: `Sample size must be at least ${min}` };
            if (n > max) return { valid: false, message: `Sample size too large (max ${max})` };
            return { valid: true };
        }
    };

    // ============ Core Statistical Engine ============
    class StatEngine {
        constructor(options = {}) {
            // Configuration
            this.config = {
                cols: options.cols || 60,
                statBins: options.statBins || 60,
                seed: options.seed || 1234,
                colors: {
                    text: "#001524",
                    background: "#FFFFFF",
                    accent: "#FF7D00",
                    primary: "#15616D",
                    secondary: "#78290F",
                    ...options.colors
                },
                ...options
            };

            // Initialize state
            this.reset();
            this.rng = MathUtils.createRNG(this.config.seed);
        }

        reset() {
            // Data structures
            this.populationData = new Uint16Array(this.config.cols);
            this.sampleData = new Uint16Array(this.config.cols);
            this.samplingDistData = new Uint32Array(this.config.statBins);
            
            // Simulation state
            this.currentSample = [];
            this.statistic = "mean";
            this.threshold = 0.5;
            this.speed = "normal";
            
            // Animation state
            this.particles = {
                sampling: [],
                statistic: [],
                effects: []
            };
            
            this.animations = {
                emission: null,
                gathering: false,
                gatherStart: 0,
                gatherDuration: 260
            };
        }

        // ============ Population Management ============
        setPopulationGenerator(generatorName, params = {}) {
            const generators = {
                normal: (x) => {
                    const z = (x - 0.5) / 0.16;
                    return Math.exp(-0.5 * z * z);
                },
                uniform: (x) => 1,
                bimodal: (x) => {
                    const z1 = (x - 0.32) / 0.07;
                    const z2 = (x - 0.72) / 0.07;
                    return 0.55 * Math.exp(-0.5 * z1 * z1) + 0.45 * Math.exp(-0.5 * z2 * z2);
                },
                lognormal: (x) => {
                    const mu = Math.log(0.3);
                    const sigma = 0.6;
                    const lx = Math.log(Math.max(1e-4, x));
                    const z = (lx - mu) / sigma;
                    return Math.exp(-0.5 * z * z) / Math.max(x, 1e-4);
                }
            };

            const generator = generators[generatorName];
            if (!generator) throw new Error(`Unknown generator: ${generatorName}`);

            for (let c = 0; c < this.config.cols; c++) {
                const x = (c + 0.5) / this.config.cols;
                const weight = generator(x);
                this.populationData[c] = Math.max(0, Math.round(weight * 20));
            }
        }

        getPopulationStats() {
            let total = 0, mean = 0;
            
            // Calculate mean
            for (let c = 0; c < this.config.cols; c++) {
                const x = (c + 0.5) / this.config.cols;
                const weight = this.populationData[c];
                total += weight;
                mean += weight * x;
            }
            mean = total ? mean / total : 0.5;

            // Calculate variance
            let variance = 0;
            for (let c = 0; c < this.config.cols; c++) {
                const x = (c + 0.5) / this.config.cols;
                const weight = this.populationData[c];
                variance += weight * (x - mean) * (x - mean);
            }
            const sd = total ? Math.sqrt(variance / total) : 0;

            // Calculate median
            let median = 0.5;
            if (total) {
                let acc = 0;
                const half = total / 2;
                for (let c = 0; c < this.config.cols; c++) {
                    acc += this.populationData[c];
                    if (acc >= half) {
                        median = (c + 0.5) / this.config.cols;
                        break;
                    }
                }
            }

            // Calculate proportion above threshold
            let aboveThreshold = 0;
            for (let c = 0; c < this.config.cols; c++) {
                const x = (c + 0.5) / this.config.cols;
                if (x > this.threshold) {
                    aboveThreshold += this.populationData[c];
                }
            }
            const proportion = total ? aboveThreshold / total : 0;

            return { mean, sd, median, proportion, total };
        }

        modifyPopulation(position, delta) {
            const col = MathUtils.clamp(
                Math.floor(position * this.config.cols), 
                0, 
                this.config.cols - 1
            );
            this.populationData[col] = MathUtils.clamp(
                (this.populationData[col] || 0) + delta, 
                0, 
                10000
            );
        }

        // ============ Sampling ============
        drawSample(sampleSize) {
            const weights = this.populationData;
            let totalWeight = 0;
            for (let i = 0; i < this.config.cols; i++) {
                totalWeight += weights[i];
            }

            const sample = [];
            const sampleCols = [];

            if (totalWeight === 0) {
                // Uniform sampling if no population data
                for (let i = 0; i < sampleSize; i++) {
                    const col = Math.floor(this.rng() * this.config.cols);
                    sampleCols.push(col);
                    sample.push((col + 0.5) / this.config.cols);
                }
            } else {
                // Weighted sampling
                for (let i = 0; i < sampleSize; i++) {
                    let target = this.rng() * totalWeight;
                    let acc = 0;
                    let chosen = this.config.cols >> 1;
                    
                    for (let c = 0; c < this.config.cols; c++) {
                        acc += weights[c];
                        if (target <= acc) {
                            chosen = c;
                            break;
                        }
                    }
                    
                    sampleCols.push(chosen);
                    sample.push((chosen + 0.5) / this.config.cols);
                }
            }

            this.currentSample = sample;
            return { values: sample, columns: sampleCols };
        }

        // ============ Statistics Calculation ============
        getStatisticDomain() {
            return this.statistic === "sd" ? { min: 0, max: 0.5 } : { min: 0, max: 1 };
        }

        computeStatistic(values) {
            if (!values.length) return NaN;
            
            switch (this.statistic) {
                case "mean":
                    return MathUtils.mean(values);
                case "median":
                    return MathUtils.median(values);
                case "sd":
                    return MathUtils.standardDeviation(values, true);
                case "proportion":
                    return values.filter(v => v > this.threshold).length / values.length;
                default:
                    return NaN;
            }
        }

        getStatisticLabel(short = false) {
            const labels = {
                mean: short ? "x̄" : "Sample Mean",
                median: short ? "med" : "Sample Median", 
                sd: short ? "s" : "Sample SD",
                proportion: short ? "p̂" : "Sample Proportion"
            };
            return labels[this.statistic] || this.statistic;
        }

        getParameterLabel(short = false) {
            const labels = {
                mean: short ? "μ" : "Population Mean",
                median: short ? "μ̃" : "Population Median",
                sd: short ? "σ" : "Population SD", 
                proportion: short ? "π" : "Population Proportion"
            };
            return labels[this.statistic] || this.statistic;
        }

        // ============ Sampling Distribution ============
        addToSamplingDistribution(statisticValue) {
            const domain = this.getStatisticDomain();
            const proportion = MathUtils.clamp(
                (statisticValue - domain.min) / (domain.max - domain.min), 
                0, 1
            );
            const bin = MathUtils.clamp(
                Math.floor(proportion * this.config.statBins), 
                0, 
                this.config.statBins - 1
            );
            this.samplingDistData[bin] = (this.samplingDistData[bin] || 0) + 1;
        }

        getSamplingDistributionStats() {
            const domain = this.getStatisticDomain();
            let total = 0, mean = 0;

            // Calculate mean
            for (let b = 0; b < this.config.statBins; b++) {
                const weight = this.samplingDistData[b];
                total += weight;
                const x01 = (b + 0.5) / this.config.statBins;
                const value = domain.min + x01 * (domain.max - domain.min);
                mean += weight * value;
            }
            mean = total ? mean / total : 0;

            // Calculate standard deviation
            let variance = 0;
            if (total) {
                for (let b = 0; b < this.config.statBins; b++) {
                    const weight = this.samplingDistData[b];
                    const x01 = (b + 0.5) / this.config.statBins;
                    const value = domain.min + x01 * (domain.max - domain.min);
                    variance += weight * (value - mean) * (value - mean);
                }
                variance = variance / total;
            }
            const sd = Math.sqrt(Math.max(0, variance));

            return { mean, sd, total };
        }

        // ============ Bulk Operations ============
        runBulkSimulation(sampleSize, iterations) {
            for (let i = 0; i < iterations; i++) {
                const { values } = this.drawSample(sampleSize);
                const statValue = this.computeStatistic(values);
                if (!isNaN(statValue)) {
                    this.addToSamplingDistribution(statValue);
                }
            }
        }

        // ============ Clear Operations ============
        clearSample() {
            this.sampleData.fill(0);
            this.currentSample = [];
        }

        clearSamplingDistribution() {
            this.samplingDistData.fill(0);
        }

        clearAll() {
            this.clearSample();
            this.clearSamplingDistribution();
        }
    }

    // Export to global scope
    global.StatEngine = StatEngine;
    global.MathUtils = MathUtils;

})(window || this);