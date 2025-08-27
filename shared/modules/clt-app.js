// Central Limit Theorem Application - Using Modular Components
// Integrates StatEngine, StatRenderer, and UIComponents

(function(global) {
    'use strict';

    class CLTApp {
        constructor(canvasId, controlsId, actionsId) {
            this.canvas = document.getElementById(canvasId);
            this.controlsContainer = document.getElementById(controlsId);
            this.actionsContainer = document.getElementById(actionsId);
            
            if (!this.canvas || !this.controlsContainer || !this.actionsContainer) {
                throw new Error('Required DOM elements not found');
            }

            // Initialize components
            this.initializeComponents();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupResponsiveLayout();
            
            // Initial render
            this.render();
        }

        initializeComponents() {
            console.log('Initializing CLT App components...');
            
            // Check if required classes are available
            if (!window.StatEngine) throw new Error('StatEngine not loaded');
            if (!window.StatRenderer) throw new Error('StatRenderer not loaded');
            if (!window.UIComponents) throw new Error('UIComponents not loaded');
            
            // Initialize statistical engine
            this.engine = new StatEngine({
                cols: 60,
                statBins: 60,
                seed: 1234
            });
            console.log('StatEngine initialized');

            // Set default population (normal)
            this.engine.setPopulationGenerator('normal');
            console.log('Population set to normal distribution');

            // Initialize renderer
            this.renderer = new StatRenderer(this.canvas);
            console.log('StatRenderer initialized');

            // Initialize UI components
            this.controlPanel = new UIComponents.ControlPanel(this.controlsContainer);
            this.actionBar = new UIComponents.ActionBar(this.actionsContainer);
            console.log('UI Components initialized');

            // Animation state
            this.animationState = {
                isRunning: false,
                currentIteration: 0,
                totalIterations: 0,
                particles: [],
                startTime: 0
            };
        }

        setupEventListeners() {
            // Control panel events
            this.controlPanel.on('distributionChange', (distribution) => {
                this.engine.setPopulationGenerator(distribution);
                this.updatePopulationStats();
                this.render();
            });

            this.controlPanel.on('statisticChange', (statistic) => {
                this.engine.statistic = statistic;
                this.render();
            });

            this.controlPanel.on('thresholdChange', (threshold) => {
                this.engine.threshold = threshold;
                this.updatePopulationStats();
                this.render();
            });

            this.controlPanel.on('sampleSizeChange', (sampleSize) => {
                this.actionBar.updateSampleSizeDisplay(sampleSize);
            });

            this.controlPanel.on('speedChange', (speed) => {
                this.engine.speed = speed;
            });

            this.controlPanel.on('seedChange', (seed) => {
                this.engine.config.seed = seed;
                this.engine.rng = MathUtils.createRNG(seed);
                this.engine.clearAll();
                this.render();
            });

            // Action bar events
            this.actionBar.on('drawSample', () => {
                this.drawSample();
            });

            this.actionBar.on('repeat', (count) => {
                this.runMultipleSamples(count);
            });

            this.actionBar.on('reset', () => {
                this.reset();
            });

            // Canvas interaction for population modification
            this.setupCanvasInteraction();
        }

        setupCanvasInteraction() {
            let isDrawing = false;
            let lastPosition = null;

            const getCanvasPosition = (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                
                return {
                    x: (e.clientX - rect.left) * scaleX,
                    y: (e.clientY - rect.top) * scaleY
                };
            };

            const modifyPopulation = (e, isAdding = true) => {
                const pos = getCanvasPosition(e);
                const proportion = this.renderer.screenToValue(pos.x);
                
                // Only modify if in population area
                if (pos.y < this.renderer.layout.heights.top + this.renderer.layout.marginY) {
                    this.engine.modifyPopulation(proportion, isAdding ? 1 : -1);
                    this.updatePopulationStats();
                    this.render();
                }
            };

            this.canvas.addEventListener('mousedown', (e) => {
                isDrawing = true;
                lastPosition = getCanvasPosition(e);
                modifyPopulation(e, !e.shiftKey);
            });

            this.canvas.addEventListener('mousemove', (e) => {
                if (!isDrawing) return;
                modifyPopulation(e, !e.shiftKey);
            });

            this.canvas.addEventListener('mouseup', () => {
                isDrawing = false;
                lastPosition = null;
            });

            this.canvas.addEventListener('mouseleave', () => {
                isDrawing = false;
                lastPosition = null;
            });
        }

        setupKeyboardShortcuts() {
            this.shortcuts = new UIComponents.KeyboardShortcuts({
                drawSample: () => this.drawSample(),
                reset: () => this.reset(),
                repeat10: () => this.runMultipleSamples(10),
                repeat1000: () => this.runMultipleSamples(1000),
                toggleErase: () => {
                    // Toggle erase mode (for future enhancement)
                    console.log('Toggle erase mode');
                }
            });
        }

        setupResponsiveLayout() {
            this.layout = new UIComponents.ResponsiveLayout({
                breakpoint: 768,
                onDesktopChange: () => {
                    // Show normal desktop layout
                    this.controlsContainer.style.display = 'block';
                },
                onMobileChange: () => {
                    // Hide controls container and show mobile toggle
                    this.controlsContainer.style.display = 'none';
                    this.layout.createMobilePanel(this.controlsContainer.innerHTML);
                }
            });
        }

        drawSample() {
            if (this.animationState.isRunning) return;
            
            const controls = this.controlPanel.getControls();
            const sampleResult = this.engine.drawSample(controls.sampleSize);
            
            // Update sample visualization
            this.updateSampleVisualization(sampleResult);
            
            // Calculate and add statistic
            const statisticValue = this.engine.computeStatistic(sampleResult.values);
            if (!isNaN(statisticValue)) {
                this.engine.addToSamplingDistribution(statisticValue);
            }
            
            this.render();
        }

        updateSampleVisualization(sampleResult) {
            // Clear previous sample
            this.engine.clearSample();
            
            // Add to sample data for visualization
            sampleResult.columns.forEach(col => {
                this.engine.sampleData[col] = (this.engine.sampleData[col] || 0) + 1;
            });
        }

        runMultipleSamples(count) {
            if (this.animationState.isRunning) return;
            
            const controls = this.controlPanel.getControls();
            
            if (controls.speed === 'fast' || count >= 100) {
                // Run bulk simulation for fast mode or large counts
                this.engine.runBulkSimulation(controls.sampleSize, count);
                this.render();
            } else {
                // Animated mode for normal speed and small counts
                this.runAnimatedSampling(count, controls.sampleSize);
            }
        }

        runAnimatedSampling(count, sampleSize) {
            this.animationState = {
                isRunning: true,
                currentIteration: 0,
                totalIterations: count,
                startTime: Date.now()
            };

            const animate = () => {
                if (this.animationState.currentIteration >= this.animationState.totalIterations) {
                    this.animationState.isRunning = false;
                    return;
                }

                // Draw one sample
                const sampleResult = this.engine.drawSample(sampleSize);
                this.updateSampleVisualization(sampleResult);
                
                const statisticValue = this.engine.computeStatistic(sampleResult.values);
                if (!isNaN(statisticValue)) {
                    this.engine.addToSamplingDistribution(statisticValue);
                }
                
                this.render();
                this.animationState.currentIteration++;
                
                // Continue animation
                setTimeout(animate, 50); // 50ms delay for smooth animation
            };

            animate();
        }

        reset() {
            this.animationState.isRunning = false;
            this.engine.clearAll();
            this.render();
        }

        updatePopulationStats() {
            const stats = this.engine.getPopulationStats();
            this.controlPanel.updatePopulationStats(stats);
        }

        render() {
            // Update canvas size for responsiveness
            this.updateCanvasSize();
            
            // Render the visualization
            this.renderer.render(this.engine);
        }

        updateCanvasSize() {
            const container = this.canvas.parentElement;
            const containerWidth = container.clientWidth;
            
            // Calculate responsive dimensions
            const plotWidth = Math.min(960, containerWidth - 32); // 32px for padding
            
            this.renderer.layoutFromViewport(plotWidth, this.renderer.calculateCanvasHeight());
            this.renderer.requestRedraw();
        }

        // Public API
        setDistribution(name) {
            this.engine.setPopulationGenerator(name);
            this.updatePopulationStats();
            this.render();
        }

        setStatistic(stat) {
            this.engine.statistic = stat;
            this.render();
        }

        setSeed(seed) {
            this.engine.config.seed = seed;
            this.engine.rng = MathUtils.createRNG(seed);
            this.engine.clearAll();
            this.render();
        }
    }

    // Export to global scope
    global.CLTApp = CLTApp;

})(window || this);