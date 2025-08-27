// Gesture Handler - Touch and swipe gesture management for responsive panels
// Handles mobile panel interactions and responsive design

(function() {
    'use strict';
    
    window.GestureHandler = class GestureHandler {
        constructor(options = {}) {
            this.options = {
                breakpoint: options.breakpoint || 768,
                panelWidth: options.panelWidth || 320,
                swipeThreshold: options.swipeThreshold || 60,
                edgeDetectionWidth: options.edgeDetectionWidth || 24,
                animationDuration: options.animationDuration || 220,
                ...options
            };
            
            this.state = {
                isDesktop: window.innerWidth >= this.options.breakpoint,
                isPanelOpen: false,
                isDragging: false,
                dragX: 0,
                startX: 0,
                startY: 0
            };
            
            this.callbacks = {
                onPanelToggle: options.onPanelToggle || (() => {}),
                onResponsiveChange: options.onResponsiveChange || (() => {})
            };
            
            this.setupEventListeners();
        }

        setupEventListeners() {
            // Window resize handling
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // Initial responsive check
            this.handleResize();
        }

        handleResize() {
            const wasDesktop = this.state.isDesktop;
            this.state.isDesktop = window.innerWidth >= this.options.breakpoint;
            
            if (wasDesktop !== this.state.isDesktop) {
                // Close mobile panel when switching to desktop
                if (this.state.isDesktop && this.state.isPanelOpen) {
                    this.state.isPanelOpen = false;
                    this.callbacks.onPanelToggle(false);
                }
                
                this.callbacks.onResponsiveChange(this.state.isDesktop);
            }
        }

        attachToContainer(containerElement) {
            if (!containerElement) return;
            
            this.containerElement = containerElement;
            
            // Add edge swipe detection for mobile
            if (!this.state.isDesktop) {
                this.setupEdgeSwipeDetection();
            }
        }

        setupEdgeSwipeDetection() {
            if (!this.containerElement) return;
            
            const handleTouchStart = (e) => {
                if (this.state.isDesktop) return;
                
                const touch = e.touches[0];
                this.state.startX = touch.clientX;
                this.state.startY = touch.clientY;
                
                // Detect if touch started from right edge
                const isRightEdge = touch.clientX > (window.innerWidth - this.options.edgeDetectionWidth);
                
                if (isRightEdge && !this.state.isPanelOpen) {
                    this.state.tracking = true;
                }
            };
            
            const handleTouchMove = (e) => {
                if (!this.state.tracking || this.state.isDesktop) return;
                
                const touch = e.touches[0];
                const dx = touch.clientX - this.state.startX;
                const dy = touch.clientY - this.state.startY;
                
                // Check if horizontal swipe is dominant and leftward
                if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) && dx < -30) {
                    this.openPanel();
                    this.state.tracking = false;
                }
            };
            
            const handleTouchEnd = () => {
                this.state.tracking = false;
            };
            
            this.containerElement.addEventListener('touchstart', handleTouchStart, { passive: true });
            this.containerElement.addEventListener('touchmove', handleTouchMove, { passive: true });
            this.containerElement.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        setupPanelDragHandlers(panelElement) {
            if (!panelElement) return;
            
            const handleTouchStart = (e) => {
                if (this.state.isDesktop) return;
                
                const touch = e.touches[0];
                this.state.isDragging = true;
                this.state.dragX = 0;
                this.state.startX = touch.clientX;
                this.state.startY = touch.clientY;
                
                panelElement.style.transition = 'none';
            };
            
            const handleTouchMove = (e) => {
                if (!this.state.isDragging || this.state.isDesktop) return;
                
                const touch = e.touches[0];
                const dx = touch.clientX - this.state.startX;
                const dy = touch.clientY - this.state.startY;
                
                // Only allow rightward (closing) drag
                if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
                    this.state.dragX = Math.min(dx, this.options.panelWidth);
                    panelElement.style.transform = `translateX(${this.state.dragX}px)`;
                }
            };
            
            const handleTouchEnd = () => {
                if (!this.state.isDragging || this.state.isDesktop) return;
                
                this.state.isDragging = false;
                
                // Reset transition
                panelElement.style.transition = `transform ${this.options.animationDuration}ms ease-in-out`;
                
                if (this.state.dragX > this.options.swipeThreshold) {
                    this.closePanel();
                } else {
                    // Snap back
                    panelElement.style.transform = 'translateX(0)';
                }
                
                this.state.dragX = 0;
            };
            
            panelElement.addEventListener('touchstart', handleTouchStart, { passive: true });
            panelElement.addEventListener('touchmove', handleTouchMove, { passive: true });
            panelElement.addEventListener('touchend', handleTouchEnd, { passive: true });
            
            return {
                destroy: () => {
                    panelElement.removeEventListener('touchstart', handleTouchStart);
                    panelElement.removeEventListener('touchmove', handleTouchMove);
                    panelElement.removeEventListener('touchend', handleTouchEnd);
                }
            };
        }

        openPanel() {
            if (this.state.isDesktop) return;
            
            this.state.isPanelOpen = true;
            this.callbacks.onPanelToggle(true);
        }

        closePanel() {
            if (this.state.isDesktop) return;
            
            this.state.isPanelOpen = false;
            this.callbacks.onPanelToggle(false);
        }

        togglePanel() {
            if (this.state.isPanelOpen) {
                this.closePanel();
            } else {
                this.openPanel();
            }
        }

        // Utility method to create responsive panel HTML
        createResponsivePanelHTML(panelContent, options = {}) {
            const panelId = options.panelId || 'responsive-panel';
            const toggleButtonId = options.toggleButtonId || 'panel-toggle-btn';
            const overlayId = options.overlayId || 'panel-overlay';
            
            return `
                <!-- Mobile Panel Toggle Button -->
                <button 
                    id="${toggleButtonId}"
                    aria-label="Open controls" 
                    style="
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
                    "
                >
                    Controls
                </button>
                
                <!-- Mobile Panel Overlay and Panel -->
                <div 
                    id="${overlayId}" 
                    style="
                        position: fixed; 
                        inset: 0; 
                        z-index: 50; 
                        display: none;
                    "
                >
                    <div 
                        class="panel-backdrop" 
                        style="
                            position: absolute; 
                            inset: 0; 
                            background: rgba(0,0,0,0.35);
                        "
                    ></div>
                    <div 
                        id="${panelId}" 
                        style="
                            position: absolute; 
                            top: 0; 
                            right: 0; 
                            bottom: 0; 
                            width: 86vw; 
                            max-width: 420px; 
                            background: #FFF7EB; 
                            border-top-left-radius: 16px; 
                            border-bottom-left-radius: 16px; 
                            transform: translateX(0); 
                            transition: transform ${this.options.animationDuration}ms ease-in-out; 
                            padding: 12px; 
                            box-shadow: -8px 0 24px rgba(0,0,0,0.2); 
                            overflow-y: auto;
                        "
                    >
                        <div style="
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center; 
                            margin-bottom: 8px;
                        ">
                            <div style="font-size: 18px; font-weight: 700;">Controls</div>
                            <button 
                                class="panel-close-btn" 
                                aria-label="Close controls" 
                                style="
                                    padding: 8px 10px; 
                                    border-radius: 8px; 
                                    background: #FF7D00; 
                                    color: #fff; 
                                    border: 0; 
                                    font-weight: 700;
                                    cursor: pointer;
                                "
                            >
                                Close
                            </button>
                        </div>
                        ${panelContent}
                    </div>
                </div>
            `;
        }

        // Attach event listeners to the responsive panel
        attachPanelEventListeners(options = {}) {
            const toggleButtonId = options.toggleButtonId || 'panel-toggle-btn';
            const overlayId = options.overlayId || 'panel-overlay';
            const panelId = options.panelId || 'responsive-panel';
            
            const toggleButton = document.getElementById(toggleButtonId);
            const overlay = document.getElementById(overlayId);
            const panel = document.getElementById(panelId);
            const backdrop = overlay?.querySelector('.panel-backdrop');
            const closeButton = overlay?.querySelector('.panel-close-btn');
            
            if (!toggleButton || !overlay || !panel) {
                console.error('GestureHandler: Could not find required panel elements');
                return;
            }
            
            // Toggle button click
            toggleButton.addEventListener('click', () => this.openPanel());
            
            // Backdrop click to close
            if (backdrop) {
                backdrop.addEventListener('click', () => this.closePanel());
            }
            
            // Close button click
            if (closeButton) {
                closeButton.addEventListener('click', () => this.closePanel());
            }
            
            // Setup panel drag handlers
            const dragHandlers = this.setupPanelDragHandlers(panel);
            
            // Panel toggle callback to show/hide overlay
            this.callbacks.onPanelToggle = (isOpen) => {
                if (isOpen) {
                    overlay.style.display = 'block';
                    // Small delay to ensure display block is applied before animation
                    requestAnimationFrame(() => {
                        panel.style.transform = 'translateX(0)';
                    });
                } else {
                    panel.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        overlay.style.display = 'none';
                    }, this.options.animationDuration);
                }
            };
            
            // Responsive change callback to show/hide mobile button
            this.callbacks.onResponsiveChange = (isDesktop) => {
                if (isDesktop) {
                    toggleButton.style.display = 'none';
                    overlay.style.display = 'none';
                } else {
                    toggleButton.style.display = 'block';
                }
            };
            
            // Initial responsive setup
            this.callbacks.onResponsiveChange(this.state.isDesktop);
            
            return {
                destroy: () => {
                    toggleButton.removeEventListener('click', this.openPanel);
                    if (backdrop) backdrop.removeEventListener('click', this.closePanel);
                    if (closeButton) closeButton.removeEventListener('click', this.closePanel);
                    if (dragHandlers) dragHandlers.destroy();
                }
            };
        }

        destroy() {
            window.removeEventListener('resize', this.handleResize);
            
            if (this.containerElement) {
                // Remove container event listeners
                // Note: Since we used { passive: true }, we need to track and remove them properly
                // This is a simplified cleanup - in production, you'd want to track the listeners
            }
        }
    };
})();