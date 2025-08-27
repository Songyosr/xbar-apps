// Renderer Module - Handles all visualization and canvas operations
// Reusable across different stat applets

(function(global) {
    'use strict';

    // ============ Rendering Configuration ============
    const DEFAULT_CONFIG = {
        padding: 16,
        topUnits: 30,
        midUnits: 24, 
        botUnits: 36,
        colors: {
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
            normal: "#111827",
            sampleMean: "#FF7D00",
            paramLine: "#15616D",
            samplingLine: "#901328"
        }
    };

    // ============ Statistical Renderer Class ============
    class StatRenderer {
        constructor(canvas, config = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.config = { ...DEFAULT_CONFIG, ...config };
            
            // Layout properties
            this.layout = {
                plotW: 960,
                gridW: 0,
                colW: 0,
                boxSize: 8,
                gridX0: 0,
                marginY: 8,
                heights: {
                    top: 300,
                    mid: 240,
                    bot: 360
                },
                boxHeights: {
                    top: 8,
                    mid: 8,
                    bot: 8
                }
            };

            // Rendering state
            this.needsRedraw = true;
            this.showLines = {
                parameter: true,
                sample: true,
                sampling: true
            };

            this.setupLayout();
        }

        setupLayout() {
            this.updateLayout(this.layout.plotW, this.calculateCanvasHeight());
        }

        calculateCanvasHeight() {
            const totalUnits = this.config.topUnits + this.config.midUnits + this.config.botUnits;
            return totalUnits * 12 + 2 * this.config.padding; // Base height
        }

        updateLayout(plotW, canvasH) {
            this.layout.plotW = plotW;
            
            // Calculate responsive dimensions
            const innerW = Math.max(200, plotW - 2 * this.config.padding);
            const cols = this.config.cols || 60;
            const fromWidth = Math.max(6, Math.floor(innerW / cols));
            const totalUnits = this.config.topUnits + this.config.midUnits + this.config.botUnits;
            const fromHeight = Math.max(6, Math.floor((canvasH - 2 * 16) / totalUnits));
            
            this.layout.boxSize = Math.min(fromWidth, fromHeight);
            this.layout.colW = Math.floor(innerW / cols);
            this.layout.gridW = this.layout.boxSize * cols;
            this.layout.gridX0 = Math.floor((plotW - this.layout.gridW) / 2);
            
            // Section heights
            this.layout.heights.top = this.config.topUnits * this.layout.boxSize;
            this.layout.heights.mid = this.config.midUnits * this.layout.boxSize;
            this.layout.heights.bot = this.config.botUnits * this.layout.boxSize;
            
            // Update canvas size
            this.canvas.width = plotW;
            this.canvas.height = this.layout.heights.top + this.layout.heights.mid + 
                                this.layout.heights.bot + 2 * this.layout.marginY;
            
            this.needsRedraw = true;
        }

        layoutFromViewport(plotW, canvasH) {
            this.updateLayout(plotW, canvasH);
        }

        // ============ Drawing Utilities ============
        clear() {
            const totalH = this.layout.heights.top + this.layout.heights.mid + 
                         this.layout.heights.bot + 2 * this.layout.marginY;
            this.ctx.clearRect(0, 0, this.layout.plotW, totalH);
        }

        drawTray(y, height, title) {
            const ctx = this.ctx;
            const colors = this.config.colors;
            
            // Background
            ctx.fillStyle = colors.band;
            ctx.fillRect(0, y, this.layout.plotW, height);
            
            // Title
            ctx.fillStyle = colors.text;
            ctx.font = "600 18px Inter, system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(title, this.layout.gridX0, y + 22);
            
            // Scale ticks
            ctx.fillStyle = colors.tick;
            const x0 = this.layout.gridX0;
            const effW = this.layout.gridW;
            
            for (let t = 0; t <= 10; t++) {
                const xpx = x0 + effW * (t / 10);
                ctx.fillRect(Math.round(xpx), y + height - 12, 1, 8);
            }
            
            // Scale labels
            ctx.fillStyle = "#475569";
            ctx.font = "13px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("0", x0, y + height - 2);
            ctx.fillText("1", x0 + effW, y + height - 2);
            ctx.textAlign = "left";
        }

        drawStacks(data, yBottom, boxHeight, fillColor, topColor) {
            const ctx = this.ctx;
            const cols = data.length;
            
            for (let c = 0; c < cols; c++) {
                const stack = data[c] || 0;
                if (!stack) continue;
                
                const xLeft = this.layout.gridX0 + c * this.layout.boxSize;
                
                for (let r = 0; r < stack; r++) {
                    const y = yBottom - r * boxHeight - boxHeight / 2;
                    
                    ctx.fillStyle = fillColor;
                    ctx.fillRect(
                        Math.floor(xLeft), 
                        Math.floor(y - boxHeight / 2), 
                        Math.ceil(this.layout.boxSize), 
                        Math.ceil(boxHeight)
                    );
                    
                    ctx.fillStyle = topColor;
                    ctx.fillRect(
                        Math.floor(xLeft), 
                        Math.floor(y - boxHeight / 2), 
                        Math.ceil(this.layout.boxSize), 
                        1
                    );
                }
            }
        }

        drawParticle(x, y, width, height, fillColor, topColor) {
            const ctx = this.ctx;
            
            ctx.fillStyle = fillColor;
            ctx.fillRect(
                Math.floor(x - width / 2), 
                Math.floor(y - height / 2), 
                Math.ceil(width), 
                Math.ceil(height)
            );
            
            ctx.fillStyle = topColor;
            ctx.fillRect(
                Math.floor(x - width / 2), 
                Math.floor(y - height / 2), 
                Math.ceil(width), 
                1
            );
        }

        // ============ Enhanced Line Drawing ============
        drawEnhancedLine(x, y1, y2, color, label, labelY, style = 'solid') {
            const ctx = this.ctx;
            
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = style === 'parameter' ? 3 : 2;
            
            if (style === 'parameter') {
                ctx.setLineDash([6, 3]);
            }
            
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.stroke();
            
            // Draw label with smart positioning
            if (label) {
                ctx.setLineDash([]);
                ctx.fillStyle = color;
                ctx.font = "600 12px Inter, system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(label, x, labelY);
            }
            
            ctx.restore();
        }

        // ============ Statistics Display ============
        drawStatsText(x, y, stats, align = 'left') {
            const ctx = this.ctx;
            
            ctx.fillStyle = this.config.colors.text;
            ctx.font = "600 18px Inter, system-ui, sans-serif";
            ctx.textAlign = align;
            
            let currentY = y;
            const lineHeight = 20;
            
            stats.forEach(stat => {
                ctx.fillText(stat, x, currentY);
                currentY += lineHeight;
            });
        }

        // ============ Main Render Method ============
        render(engine) {
            if (!this.needsRedraw) return;
            
            this.clear();
            
            // Calculate section positions
            const yTop = this.layout.marginY;
            const yMid = yTop + this.layout.heights.top;
            const yBot = yMid + this.layout.heights.mid;
            
            // Calculate dynamic box heights based on data
            const maxPop = Math.max(...engine.populationData, 1);
            const maxSample = Math.max(...engine.sampleData, 1);
            const maxSampling = Math.max(...engine.samplingDistData, 1);
            
            const scaleTop = Math.min(1, (this.layout.heights.top - 28) / (maxPop * this.layout.boxSize));
            const scaleMid = Math.min(1, (this.layout.heights.mid - 28) / (maxSample * this.layout.boxSize));
            const scaleBot = Math.min(1, (this.layout.heights.bot - 28) / (maxSampling * this.layout.boxSize));
            
            this.layout.boxHeights.top = this.layout.boxSize * scaleTop;
            this.layout.boxHeights.mid = this.layout.boxSize * scaleMid;
            this.layout.boxHeights.bot = this.layout.boxSize * scaleBot;
            
            // Draw sections
            this.drawTray(yTop, this.layout.heights.top, "Population Distribution");
            this.drawTray(yMid, this.layout.heights.mid, "Sample Distribution");
            this.drawTray(yBot, this.layout.heights.bot, `Sampling Distribution of the ${engine.getStatisticLabel()}`);
            
            // Draw data stacks
            const topBase = yTop + this.layout.heights.top - 8;
            const midBase = yMid + this.layout.heights.mid - 16;
            const botBase = yBot + this.layout.heights.bot - 16;
            
            this.drawStacks(engine.populationData, topBase, this.layout.boxHeights.top, 
                          this.config.colors.popFill, this.config.colors.popTop);
            this.drawStacks(engine.sampleData, midBase, this.layout.boxHeights.mid,
                          this.config.colors.midFill, this.config.colors.midTop);
            this.drawStacks(engine.samplingDistData, botBase, this.layout.boxHeights.bot,
                          this.config.colors.botFill, this.config.colors.botTop);
            
            // Draw population stats
            const popStats = engine.getPopulationStats();
            this.drawStatsText(
                this.layout.gridX0 + this.layout.gridW, 
                yTop + 40,
                [`μ = ${popStats.mean.toFixed(3)}`, `σ = ${popStats.sd.toFixed(3)}`],
                'right'
            );
            
            // Draw sampling distribution stats if available
            const samplingStats = engine.getSamplingDistributionStats();
            if (samplingStats.total > 0) {
                this.drawStatsText(
                    this.layout.gridX0,
                    yBot + 40,
                    [`runs = ${samplingStats.total}`],
                    'left'
                );
                
                this.drawStatsText(
                    this.layout.gridX0 + this.layout.gridW,
                    yBot + 40,
                    [
                        `E[${engine.getStatisticLabel(true)}] = ${samplingStats.mean.toFixed(3)}`,
                        `SD[${engine.getStatisticLabel(true)}] = ${samplingStats.sd.toFixed(3)}`
                    ],
                    'right'
                );
            }
            
            // Draw enhanced lines (will be implemented in next step)
            this.drawEnhancedLines(engine);
            
            this.needsRedraw = false;
        }

        // ============ Enhanced Lines (placeholder for now) ============
        drawEnhancedLines(engine) {
            // This will be expanded with the enhanced line features
            // For now, just basic parameter line
            if (!this.showLines.parameter) return;
            
            const popStats = engine.getPopulationStats();
            let paramValue = popStats.mean;
            
            if (engine.statistic === "median") paramValue = popStats.median;
            else if (engine.statistic === "sd") paramValue = popStats.sd;
            else if (engine.statistic === "proportion") paramValue = popStats.proportion;
            
            const domain = engine.getStatisticDomain();
            const proportion = this.clamp((paramValue - domain.min) / (domain.max - domain.min), 0, 1);
            const x = this.layout.gridX0 + proportion * this.layout.gridW;
            
            // Draw parameter line across middle and bottom sections
            const yMid = this.layout.marginY + this.layout.heights.top;
            const yBot = yMid + this.layout.heights.mid;
            const midBase = yMid + this.layout.heights.mid - 16;
            const botBase = yBot + this.layout.heights.bot - 16;
            
            this.drawEnhancedLine(
                x, yMid + 32, midBase - 8,
                this.config.colors.paramLine,
                engine.getParameterLabel(true),
                yMid + 46,
                'parameter'
            );
            
            this.drawEnhancedLine(
                x, yBot + 32, botBase - 8,
                this.config.colors.paramLine,
                null, // No label in bottom section
                null,
                'parameter'
            );
        }

        // ============ Utility Methods ============
        valueToX(value, domain) {
            const proportion = this.clamp((value - domain.min) / (domain.max - domain.min), 0, 1);
            return this.layout.gridX0 + proportion * this.layout.gridW;
        }

        screenToValue(screenX) {
            const proportion = (screenX - this.layout.gridX0) / this.layout.gridW;
            return this.clamp(proportion, 0, 1);
        }

        clamp(x, a, b) {
            return Math.max(a, Math.min(b, x));
        }

        requestRedraw() {
            this.needsRedraw = true;
        }
    }

    // Export to global scope
    global.StatRenderer = StatRenderer;

})(window || this);