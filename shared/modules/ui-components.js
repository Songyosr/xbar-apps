// UI Components Module - Reusable interface components for stat applets
// Handles controls, responsive design, and user interactions

(function(global) {
    'use strict';

    // ============ UI Component Base Class ============
    class UIComponent {
        constructor(element, options = {}) {
            this.element = element;
            this.options = options;
            this.listeners = new Map();
        }

        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        }

        emit(event, data) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(callback => callback(data));
            }
        }

        destroy() {
            this.listeners.clear();
        }
    }

    // ============ Control Panel Component ============
    class ControlPanel extends UIComponent {
        constructor(container, options = {}) {
            super(container, options);
            
            this.controls = {
                distribution: 'normal',
                statistic: 'mean',
                sampleSize: 30,
                threshold: 0.5,
                speed: 'normal',
                seed: 1234,
                showParameterLine: true,
                showNormalFit: false
            };

            this.render();
            this.attachEventListeners();
        }

        render() {
            this.element.innerHTML = `
                <div class="control-panel">
                    <div class="panel-header">
                        <h3>Controls</h3>
                    </div>
                    
                    <div class="keyboard-shortcuts">
                        <strong>Keyboard shortcuts:</strong><br/>
                        Space: Draw Sample • R: Reset • E: Toggle Erase • 1: ×10 • 2: ×1000
                    </div>
                    
                    <div class="control-group">
                        <label>Population shape</label>
                        <select id="distribution-select">
                            <option value="normal">Normal</option>
                            <option value="lognormal">Skewed (lognormal)</option>
                            <option value="uniform">Uniform</option>
                            <option value="bimodal">Bimodal</option>
                        </select>
                        <div class="pop-stats" id="pop-stats">μ≈0.500 · σ≈0.161</div>
                        <div class="help-text">Click/drag on the population to paint your own distribution!</div>
                    </div>
                    
                    <div class="control-group">
                        <label>Statistic</label>
                        <select id="statistic-select">
                            <option value="mean">Mean (x̄)</option>
                            <option value="median">Median</option>
                            <option value="sd">Standard Deviation (s)</option>
                            <option value="proportion">Proportion (&gt; threshold)</option>
                        </select>
                        <div id="threshold-controls" class="threshold-controls" style="display: none;">
                            <label>Threshold</label>
                            <input type="range" id="threshold-slider" min="0.05" max="0.95" step="0.01" value="0.5" />
                            <div id="threshold-display">θ = P(X &gt; 0.50)</div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>Sample size (n)</label>
                        <input type="range" id="sample-size-slider" min="2" max="500" step="1" value="30" />
                        <div class="sample-size-display">
                            <span id="sample-size-value">30</span>
                        </div>
                    </div>
                    
                    <div class="control-group checkboxes">
                        <label class="checkbox-label">
                            <span>Show parameter line (θ)</span>
                            <input type="checkbox" id="param-line-checkbox" checked />
                        </label>
                        
                        <label class="checkbox-label">
                            <span>Show normal fit</span>
                            <input type="checkbox" id="normal-fit-checkbox" />
                        </label>
                    </div>
                    
                    <div class="control-group two-column">
                        <div>
                            <label>Speed</label>
                            <select id="speed-select">
                                <option value="normal">Normal</option>
                                <option value="fast">Fast</option>
                            </select>
                        </div>
                        <div>
                            <label>Seed</label>
                            <input type="number" id="seed-input" value="1234" />
                        </div>
                    </div>
                    
                    <div class="info-box">
                        <strong>Central Limit Theorem:</strong> SE = σ/√n decreases as n increases. 
                        The sampling distribution approaches normal regardless of population shape!
                    </div>
                </div>
            `;

            this.addStyles();
        }

        addStyles() {
            if (document.getElementById('control-panel-styles')) return;

            const style = document.createElement('style');
            style.id = 'control-panel-styles';
            style.textContent = `
                .control-panel {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #FFF7EB;
                    border-radius: 16px;
                    padding: 0.75rem;
                    width: 320px;
                    height: 100%;
                    overflow-y: auto;
                }
                
                .panel-header h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: #001524;
                }
                
                .keyboard-shortcuts {
                    font-size: 0.6875rem;
                    color: #6B7280;
                    margin-bottom: 0.75rem;
                    padding: 0.5rem;
                    background: #F3F4F6;
                    border-radius: 6px;
                }
                
                .control-group {
                    margin-bottom: 0.75rem;
                }
                
                .control-group label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 0.25rem;
                    color: #001524;
                }
                
                .control-group select,
                .control-group input[type="number"] {
                    width: 100%;
                    padding: 0.5rem 0.625rem;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    font-size: 0.875rem;
                }
                
                .control-group input[type="range"] {
                    width: 100%;
                    margin: 0.25rem 0;
                }
                
                .pop-stats {
                    font-size: 0.75rem;
                    color: #475569;
                    margin-top: 0.25rem;
                }
                
                .help-text {
                    font-size: 0.75rem;
                    color: #475569;
                    margin-top: 0.25rem;
                }
                
                .threshold-controls {
                    padding-top: 0.5rem;
                }
                
                .threshold-controls label {
                    font-size: 0.75rem;
                }
                
                .threshold-controls #threshold-display {
                    font-size: 0.75rem;
                    color: #475569;
                    margin-top: 0.25rem;
                }
                
                .sample-size-display {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #001524;
                    margin-top: 0.25rem;
                }
                
                .checkboxes label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.375rem;
                    cursor: pointer;
                }
                
                .checkbox-label {
                    font-size: 0.875rem;
                }
                
                .two-column {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                }
                
                .info-box {
                    font-size: 0.75rem;
                    color: #475569;
                    padding: 0.5rem;
                    background: #F0F9FF;
                    border-radius: 6px;
                    margin-top: 0.75rem;
                }
                
                .info-box strong {
                    color: #001524;
                }
            `;
            document.head.appendChild(style);
        }

        attachEventListeners() {
            // Distribution change
            const distributionSelect = this.element.querySelector('#distribution-select');
            distributionSelect?.addEventListener('change', (e) => {
                this.controls.distribution = e.target.value;
                this.emit('distributionChange', e.target.value);
            });

            // Statistic change
            const statisticSelect = this.element.querySelector('#statistic-select');
            const thresholdControls = this.element.querySelector('#threshold-controls');
            statisticSelect?.addEventListener('change', (e) => {
                this.controls.statistic = e.target.value;
                if (e.target.value === 'proportion') {
                    thresholdControls.style.display = 'block';
                } else {
                    thresholdControls.style.display = 'none';
                }
                this.emit('statisticChange', e.target.value);
            });

            // Threshold change
            const thresholdSlider = this.element.querySelector('#threshold-slider');
            const thresholdDisplay = this.element.querySelector('#threshold-display');
            thresholdSlider?.addEventListener('input', (e) => {
                this.controls.threshold = parseFloat(e.target.value);
                thresholdDisplay.textContent = `θ = P(X > ${e.target.value})`;
                this.emit('thresholdChange', parseFloat(e.target.value));
            });

            // Sample size change
            const sampleSizeSlider = this.element.querySelector('#sample-size-slider');
            const sampleSizeValue = this.element.querySelector('#sample-size-value');
            sampleSizeSlider?.addEventListener('input', (e) => {
                this.controls.sampleSize = parseInt(e.target.value);
                sampleSizeValue.textContent = e.target.value;
                this.emit('sampleSizeChange', parseInt(e.target.value));
            });

            // Parameter line toggle
            const paramLineCheckbox = this.element.querySelector('#param-line-checkbox');
            paramLineCheckbox?.addEventListener('change', (e) => {
                this.controls.showParameterLine = e.target.checked;
                this.emit('parameterLineToggle', e.target.checked);
            });

            // Normal fit toggle
            const normalFitCheckbox = this.element.querySelector('#normal-fit-checkbox');
            normalFitCheckbox?.addEventListener('change', (e) => {
                this.controls.showNormalFit = e.target.checked;
                this.emit('normalFitToggle', e.target.checked);
            });

            // Speed change
            const speedSelect = this.element.querySelector('#speed-select');
            speedSelect?.addEventListener('change', (e) => {
                this.controls.speed = e.target.value;
                this.emit('speedChange', e.target.value);
            });

            // Seed change
            const seedInput = this.element.querySelector('#seed-input');
            seedInput?.addEventListener('input', (e) => {
                this.controls.seed = parseInt(e.target.value) || 0;
                this.emit('seedChange', parseInt(e.target.value) || 0);
            });
        }

        updatePopulationStats(stats) {
            const popStatsElement = this.element.querySelector('#pop-stats');
            if (popStatsElement) {
                popStatsElement.textContent = `μ≈${stats.mean.toFixed(3)} · σ≈${stats.sd.toFixed(3)}`;
            }
        }

        updateSampleSizeDisplay(size) {
            const displays = this.element.querySelectorAll('.sample-size-display');
            displays.forEach(display => {
                display.textContent = size;
            });
        }

        getControls() {
            return { ...this.controls };
        }
    }

    // ============ Action Bar Component ============
    class ActionBar extends UIComponent {
        constructor(container, options = {}) {
            super(container, options);
            this.render();
            this.attachEventListeners();
        }

        render() {
            this.element.innerHTML = `
                <div class="action-bar">
                    <button id="draw-sample-btn" class="primary-button">
                        Draw Sample (<span id="sample-size-display">30</span>)
                    </button>
                    
                    <div class="action-group">
                        <button id="repeat-10-btn" class="secondary-button">×10</button>
                        <button id="repeat-1000-btn" class="secondary-button">×1000</button>
                        <button id="reset-btn" class="outline-button">Reset</button>
                    </div>
                </div>
            `;

            this.addStyles();
        }

        addStyles() {
            if (document.getElementById('action-bar-styles')) return;

            const style = document.createElement('style');
            style.id = 'action-bar-styles';
            style.textContent = `
                .action-bar {
                    padding: 0.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .primary-button {
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    background: #FF7D00;
                    color: #fff;
                    font-weight: 600;
                    border: 0;
                    font-size: 1rem;
                    width: 100%;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                
                .primary-button:hover {
                    background: #E66A00;
                }
                
                .primary-button:disabled {
                    background: #9CA3AF;
                    cursor: not-allowed;
                }
                
                .action-group {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                
                .secondary-button {
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    background: #15616D;
                    color: #fff;
                    font-weight: 600;
                    border: 0;
                    flex: 1;
                    min-width: 80px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                
                .secondary-button:hover {
                    background: #134B54;
                }
                
                .secondary-button:disabled {
                    background: #9CA3AF;
                    cursor: not-allowed;
                }
                
                .outline-button {
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    background: #fff;
                    color: #001524;
                    font-weight: 600;
                    border: 1px solid #cbd5e1;
                    flex: 1;
                    min-width: 80px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .outline-button:hover {
                    background: #F9FAFB;
                    border-color: #9CA3AF;
                }
            `;
            document.head.appendChild(style);
        }

        attachEventListeners() {
            const drawSampleBtn = this.element.querySelector('#draw-sample-btn');
            const repeat10Btn = this.element.querySelector('#repeat-10-btn');
            const repeat1000Btn = this.element.querySelector('#repeat-1000-btn');
            const resetBtn = this.element.querySelector('#reset-btn');

            drawSampleBtn?.addEventListener('click', () => {
                this.emit('drawSample');
            });

            repeat10Btn?.addEventListener('click', () => {
                this.emit('repeat', 10);
            });

            repeat1000Btn?.addEventListener('click', () => {
                this.emit('repeat', 1000);
            });

            resetBtn?.addEventListener('click', () => {
                this.emit('reset');
            });
        }

        updateSampleSizeDisplay(size) {
            const display = this.element.querySelector('#sample-size-display');
            if (display) {
                display.textContent = size;
            }
        }

        setButtonState(button, enabled) {
            const btn = this.element.querySelector(`#${button}-btn`);
            if (btn) {
                btn.disabled = !enabled;
            }
        }
    }

    // ============ Responsive Layout Manager ============
    class ResponsiveLayout {
        constructor(options = {}) {
            this.breakpoint = options.breakpoint || 768;
            this.callbacks = {
                onDesktopChange: options.onDesktopChange || (() => {}),
                onMobileChange: options.onMobileChange || (() => {})
            };
            
            this.isDesktop = window.innerWidth >= this.breakpoint;
            this.setupEventListeners();
        }

        setupEventListeners() {
            window.addEventListener('resize', () => {
                const wasDesktop = this.isDesktop;
                this.isDesktop = window.innerWidth >= this.breakpoint;
                
                if (wasDesktop !== this.isDesktop) {
                    if (this.isDesktop) {
                        this.callbacks.onDesktopChange();
                    } else {
                        this.callbacks.onMobileChange();
                    }
                }
            });

            // Initial call
            if (this.isDesktop) {
                this.callbacks.onDesktopChange();
            } else {
                this.callbacks.onMobileChange();
            }
        }

        createMobilePanel(panelContent) {
            const mobileHTML = `
                <button id="mobile-panel-toggle" class="mobile-toggle">
                    Controls
                </button>
                
                <div id="mobile-panel-overlay" class="mobile-overlay">
                    <div class="mobile-backdrop"></div>
                    <div class="mobile-panel">
                        <div class="mobile-header">
                            <h3>Controls</h3>
                            <button id="mobile-panel-close" class="close-button">Close</button>
                        </div>
                        <div class="mobile-content">
                            ${panelContent}
                        </div>
                    </div>
                </div>
            `;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = mobileHTML;
            
            // Add to body
            while (tempDiv.firstChild) {
                document.body.appendChild(tempDiv.firstChild);
            }

            this.addMobileStyles();
            this.attachMobileEventListeners();
        }

        addMobileStyles() {
            if (document.getElementById('mobile-panel-styles')) return;

            const style = document.createElement('style');
            style.id = 'mobile-panel-styles';
            style.textContent = `
                .mobile-toggle {
                    position: fixed;
                    right: 12px;
                    top: calc(env(safe-area-inset-top, 0px) + 12px);
                    z-index: 30;
                    padding: 10px 12px;
                    border-radius: 9999px;
                    background: #FF7D00;
                    color: #fff;
                    font-weight: 700;
                    border: 0;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                    cursor: pointer;
                    display: none;
                }
                
                .mobile-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    display: none;
                }
                
                .mobile-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.35);
                }
                
                .mobile-panel {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 86vw;
                    max-width: 420px;
                    background: #FFF7EB;
                    border-top-left-radius: 16px;
                    border-bottom-left-radius: 16px;
                    box-shadow: -8px 0 24px rgba(0,0,0,0.2);
                    overflow-y: auto;
                }
                
                .mobile-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    border-bottom: 1px solid rgba(0,0,0,0.1);
                }
                
                .mobile-header h3 {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0;
                }
                
                .close-button {
                    padding: 8px 10px;
                    border-radius: 8px;
                    background: #FF7D00;
                    color: #fff;
                    border: 0;
                    font-weight: 700;
                    cursor: pointer;
                }
                
                .mobile-content {
                    padding: 12px;
                }
                
                @media (min-width: 768px) {
                    .mobile-toggle {
                        display: none !important;
                    }
                    .mobile-overlay {
                        display: none !important;
                    }
                }
                
                @media (max-width: 767px) {
                    .mobile-toggle {
                        display: block !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        attachMobileEventListeners() {
            const toggle = document.getElementById('mobile-panel-toggle');
            const overlay = document.getElementById('mobile-panel-overlay');
            const backdrop = overlay?.querySelector('.mobile-backdrop');
            const closeBtn = document.getElementById('mobile-panel-close');

            toggle?.addEventListener('click', () => {
                if (overlay) overlay.style.display = 'block';
            });

            backdrop?.addEventListener('click', () => {
                if (overlay) overlay.style.display = 'none';
            });

            closeBtn?.addEventListener('click', () => {
                if (overlay) overlay.style.display = 'none';
            });
        }
    }

    // ============ Keyboard Shortcuts Manager ============
    class KeyboardShortcuts {
        constructor(callbacks = {}) {
            this.callbacks = callbacks;
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('keydown', (e) => {
                // Ignore if typing in input fields
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                
                switch (e.key) {
                    case ' ':
                        e.preventDefault();
                        this.callbacks.drawSample?.();
                        break;
                    case 'r':
                    case 'R':
                        e.preventDefault();
                        this.callbacks.reset?.();
                        break;
                    case 'e':
                    case 'E':
                        e.preventDefault();
                        this.callbacks.toggleErase?.();
                        break;
                    case '1':
                        this.callbacks.repeat10?.();
                        break;
                    case '2':
                        this.callbacks.repeat1000?.();
                        break;
                }
            });
        }
    }

    // Export to global scope
    global.UIComponents = {
        UIComponent,
        ControlPanel,
        ActionBar,
        ResponsiveLayout,
        KeyboardShortcuts
    };

})(window || this);