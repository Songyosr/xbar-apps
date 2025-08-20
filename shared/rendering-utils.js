// Rendering Utilities - Reusable drawing functions for stat applets
// Handles advanced line rendering with particle masking

(function() {
    'use strict';
    
    window.RenderUtils = {
        // Enhanced line rendering with smart masking and labeling
        drawEnhancedLines: function(ctx, engine) {
            const lines = engine.lines;
            const colors = engine.config.colors;
            
            // Draw lines in order: parameter, sample stat, sampling mean
            this.drawParameterLine(ctx, engine, lines.parameter);
            if (lines.sampleStat.visible) {
                this.drawSampleStatLine(ctx, engine, lines.sampleStat);
            }
            if (lines.samplingMean.visible) {
                this.drawSamplingMeanLine(ctx, engine, lines.samplingMean);
            }
        },

        drawParameterLine: function(ctx, engine, line) {
            if (!line.visible || line.x === null) return;
            
            const colors = engine.config.colors;
            const yTop = engine.marginY;
            const yMid = yTop + engine.H_TOP;
            const yBot = yMid + engine.H_MID;
            const midBase = yMid + engine.H_MID - 16;
            const botBase = yBot + engine.H_BOT - 16;
            
            // Parameter line spans all three sections
            ctx.save();
            ctx.setLineDash([6, 3]);
            ctx.lineWidth = 3;
            
            // Check for particle masking in each section
            const maskedSegments = this.getParticleMaskedSegments(ctx, engine, line.x);
            
            // Draw line segments with masking
            this.drawLineWithMasking(ctx, line.x, yTop + 32, midBase - 8, colors.popFill, maskedSegments.mid);
            this.drawLineWithMasking(ctx, line.x, yMid + 32, botBase - 8, colors.popFill, maskedSegments.bot);
            
            // Draw parameter label with smart positioning
            ctx.setLineDash([]);
            this.drawParameterLabel(ctx, engine, line);
            
            ctx.restore();
        },

        drawSampleStatLine: function(ctx, engine, line) {
            if (!line.visible || line.x === null) return;
            
            const colors = engine.config.colors;
            const yMid = engine.marginY + engine.H_TOP;
            const midBase = yMid + engine.H_MID - 16;
            
            ctx.save();
            ctx.strokeStyle = colors.sampleMean;
            ctx.lineWidth = 2;
            
            // Check for particle masking
            const maskedSegments = this.getParticleMaskedSegments(ctx, engine, line.x);
            
            // Draw sample statistic line in middle section
            this.drawLineWithMasking(ctx, line.x, yMid + 32, midBase - 8, colors.sampleMean, maskedSegments.mid);
            
            // Draw sample stat label
            this.drawSampleStatLabel(ctx, engine, line);
            
            ctx.restore();
        },

        drawSamplingMeanLine: function(ctx, engine, line) {
            if (!line.visible || line.x === null) return;
            
            const colors = engine.config.colors;
            const yMid = engine.marginY + engine.H_TOP;
            const yBot = yMid + engine.H_MID;
            const botBase = yBot + engine.H_BOT - 16;
            
            ctx.save();
            ctx.strokeStyle = colors.botFill;
            ctx.lineWidth = 2;
            
            // Check for particle masking
            const maskedSegments = this.getParticleMaskedSegments(ctx, engine, line.x);
            
            // Draw sampling distribution mean line in bottom section
            this.drawLineWithMasking(ctx, line.x, yBot + 32, botBase - 8, colors.botFill, maskedSegments.bot);
            
            // Draw sampling mean label
            this.drawSamplingMeanLabel(ctx, engine, line);
            
            ctx.restore();
        },

        drawLineWithMasking: function(ctx, x, y1, y2, color, maskedSegments) {
            ctx.strokeStyle = color;
            
            if (!maskedSegments || maskedSegments.length === 0) {
                // No masking, draw complete line
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
                return;
            }
            
            // Draw line segments around masked areas
            let currentY = y1;
            
            for (const segment of maskedSegments) {
                // Draw line before masked segment
                if (currentY < segment.start) {
                    ctx.beginPath();
                    ctx.moveTo(x, currentY);
                    ctx.lineTo(x, segment.start);
                    ctx.stroke();
                }
                
                // Draw white line in masked area (shows in front of particles)
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 4; // Slightly thicker white line
                ctx.beginPath();
                ctx.moveTo(x, segment.start);
                ctx.lineTo(x, segment.end);
                ctx.stroke();
                
                // Reset color and width
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                
                currentY = segment.end;
            }
            
            // Draw remaining line after last masked segment
            if (currentY < y2) {
                ctx.beginPath();
                ctx.moveTo(x, currentY);
                ctx.lineTo(x, y2);
                ctx.stroke();
            }
        },

        getParticleMaskedSegments: function(ctx, engine, lineX) {
            const segments = { mid: [], bot: [] };
            const tolerance = engine.BOX / 2;
            
            // Check sample particles (middle section)
            for (const particle of engine.sampleParticles) {
                if (Math.abs(particle.x - lineX) <= tolerance) {
                    segments.mid.push({
                        start: particle.y - engine.BOX_MID_Y / 2,
                        end: particle.y + engine.BOX_MID_Y / 2
                    });
                }
            }
            
            // Check statistic particles (bottom section)
            for (const particle of engine.statParticles) {
                if (Math.abs(particle.x - lineX) <= tolerance) {
                    segments.bot.push({
                        start: particle.y - engine.BOX_BOT_Y / 2,
                        end: particle.y + engine.BOX_BOT_Y / 2
                    });
                }
            }
            
            // Check static stacks in middle section
            const col = Math.floor((lineX - engine.gridX0) / engine.BOX);
            if (col >= 0 && col < engine.config.cols) {
                const midBase = engine.marginY + engine.H_TOP + engine.H_MID - 16;
                const stack = engine.midCounts[col] || 0;
                for (let r = 0; r < stack; r++) {
                    const y = midBase - r * engine.BOX_MID_Y - engine.BOX_MID_Y / 2;
                    segments.mid.push({
                        start: y - engine.BOX_MID_Y / 2,
                        end: y + engine.BOX_MID_Y / 2
                    });
                }
            }
            
            // Check static stacks in bottom section
            const statBin = Math.floor((lineX - engine.gridX0) / engine.BOX);
            if (statBin >= 0 && statBin < engine.config.statBins) {
                const botBase = engine.marginY + engine.H_TOP + engine.H_MID + engine.H_BOT - 16;
                const stack = engine.botCounts[statBin] || 0;
                for (let r = 0; r < stack; r++) {
                    const y = botBase - r * engine.BOX_BOT_Y - engine.BOX_BOT_Y / 2;
                    segments.bot.push({
                        start: y - engine.BOX_BOT_Y / 2,
                        end: y + engine.BOX_BOT_Y / 2
                    });
                }
            }
            
            // Merge overlapping segments
            segments.mid = this.mergeSegments(segments.mid);
            segments.bot = this.mergeSegments(segments.bot);
            
            return segments;
        },

        mergeSegments: function(segments) {
            if (segments.length <= 1) return segments;
            
            segments.sort((a, b) => a.start - b.start);
            const merged = [segments[0]];
            
            for (let i = 1; i < segments.length; i++) {
                const current = segments[i];
                const last = merged[merged.length - 1];
                
                if (current.start <= last.end) {
                    last.end = Math.max(last.end, current.end);
                } else {
                    merged.push(current);
                }
            }
            
            return merged;
        },

        drawParameterLabel: function(ctx, engine, line) {
            const colors = engine.config.colors;
            const yMid = engine.marginY + engine.H_TOP;
            
            // Get parameter symbol
            let paramSymbol = "μ";
            if (engine.statistic === "median") paramSymbol = "μ̃";
            else if (engine.statistic === "sd") paramSymbol = "σ";
            else if (engine.statistic === "proportion") paramSymbol = "π";
            
            // Smart label positioning
            const labelPosition = this.getSmartLabelPosition(engine, line, 'parameter');
            
            ctx.fillStyle = colors.popFill;
            ctx.font = "600 12px Inter, system-ui, sans-serif";
            ctx.textAlign = labelPosition.align;
            ctx.fillText(paramSymbol, labelPosition.x, yMid + 46);
        },

        drawSampleStatLabel: function(ctx, engine, line) {
            const colors = engine.config.colors;
            const yMid = engine.marginY + engine.H_TOP;
            
            // Get sample statistic symbol
            let statSymbol = "x̄";
            if (engine.statistic === "median") statSymbol = "med";
            else if (engine.statistic === "sd") statSymbol = "s";
            else if (engine.statistic === "proportion") statSymbol = "p̂";
            
            // Smart label positioning
            const labelPosition = this.getSmartLabelPosition(engine, line, 'sample');
            
            ctx.fillStyle = colors.sampleMean;
            ctx.font = "600 12px Inter, system-ui, sans-serif";
            ctx.textAlign = labelPosition.align;
            ctx.fillText(statSymbol, labelPosition.x, yMid + 46);
        },

        drawSamplingMeanLabel: function(ctx, engine, line) {
            const colors = engine.config.colors;
            const yBot = engine.marginY + engine.H_TOP + engine.H_MID;
            
            // Get sampling distribution mean symbol
            let samplingSymbol = "E[x̄]";
            if (engine.statistic === "median") samplingSymbol = "E[med]";
            else if (engine.statistic === "sd") samplingSymbol = "E[s]";
            else if (engine.statistic === "proportion") samplingSymbol = "E[p̂]";
            
            // Smart label positioning
            const labelPosition = this.getSmartLabelPosition(engine, line, 'sampling');
            
            ctx.fillStyle = colors.botFill;
            ctx.font = "600 12px Inter, system-ui, sans-serif";
            ctx.textAlign = labelPosition.align;
            ctx.fillText(samplingSymbol, labelPosition.x, yBot + 46);
        },

        getSmartLabelPosition: function(engine, currentLine, lineType) {
            const lines = engine.lines;
            const padding = 8;
            
            // Determine which other lines are visible and their positions
            const visibleLines = [];
            if (lines.parameter.visible && lines.parameter.x !== null && lineType !== 'parameter') {
                visibleLines.push({ type: 'parameter', x: lines.parameter.x, value: lines.parameter.value });
            }
            if (lines.sampleStat.visible && lines.sampleStat.x !== null && lineType !== 'sample') {
                visibleLines.push({ type: 'sample', x: lines.sampleStat.x, value: lines.sampleStat.value });
            }
            if (lines.samplingMean.visible && lines.samplingMean.x !== null && lineType !== 'sampling') {
                visibleLines.push({ type: 'sampling', x: lines.samplingMean.x, value: lines.samplingMean.value });
            }
            
            // Default position: right of line
            let position = {
                x: currentLine.x + padding,
                align: 'left'
            };
            
            // Check for conflicts and apply smart positioning logic
            if (visibleLines.length > 0) {
                // Find if parameter line exists and compare values
                const paramLine = visibleLines.find(l => l.type === 'parameter');
                
                if (paramLine && lineType !== 'parameter') {
                    // Apply positioning logic based on parameter comparison
                    if (currentLine.value > paramLine.value) {
                        // Current line is to the right of parameter - put label on right
                        position = {
                            x: currentLine.x + padding,
                            align: 'left'
                        };
                    } else {
                        // Current line is to the left of parameter - put label on left
                        position = {
                            x: currentLine.x - padding,
                            align: 'right'
                        };
                    }
                } else if (lineType === 'parameter') {
                    // Parameter line positioning based on other visible lines
                    const rightLines = visibleLines.filter(l => l.value > currentLine.value);
                    if (rightLines.length > 0) {
                        // Other lines to the right, put parameter label on left
                        position = {
                            x: currentLine.x - padding,
                            align: 'right'
                        };
                    }
                }
            }
            
            // Ensure label stays within canvas bounds
            const minX = engine.gridX0;
            const maxX = engine.gridX0 + engine.gridW;
            
            if (position.align === 'left' && position.x > maxX - 30) {
                position = {
                    x: currentLine.x - padding,
                    align: 'right'
                };
            } else if (position.align === 'right' && position.x < minX + 30) {
                position = {
                    x: currentLine.x + padding,
                    align: 'left'
                };
            }
            
            return position;
        },

        // Standard drawing utilities
        drawTray: function(ctx, engine, y, h, title) {
            const colors = engine.config.colors;
            
            ctx.fillStyle = colors.band; 
            ctx.fillRect(0, y, engine.plotW, h);
            ctx.fillStyle = colors.text; 
            ctx.font = "600 18px Inter, system-ui, sans-serif"; 
            ctx.textAlign = "left"; 
            ctx.fillText(title, engine.gridX0, y + 22);
            ctx.fillStyle = colors.tick; 
            const x0 = engine.gridX0, effW = engine.BOX * engine.config.cols;
            
            for (let t = 0; t <= 10; t++) { 
                const xpx = x0 + effW * (t / 10); 
                ctx.fillRect(Math.round(xpx), y + h - 12, 1, 8); 
            }
            
            ctx.fillStyle = "#475569"; 
            ctx.font = "13px Inter, system-ui, sans-serif"; 
            ctx.textAlign = "center";
            ctx.fillText("0", x0, y + h - 2); 
            ctx.fillText("1", x0 + effW, y + h - 2); 
            ctx.textAlign = "left";
        },

        drawStacks: function(ctx, engine, counts, yBottom, boxH, fillColor, topColor) {
            for (let c = 0; c < engine.config.cols; c++) {
                const stack = counts[c] || 0; 
                if (!stack) continue; 
                const xL = engine.colLeft(c);
                
                for (let r = 0; r < stack; r++) {
                    const y = yBottom - r * boxH - boxH / 2;
                    ctx.fillStyle = fillColor; 
                    ctx.fillRect(Math.floor(xL), Math.floor(y - boxH / 2), Math.ceil(engine.BOX), Math.ceil(boxH));
                    ctx.fillStyle = topColor; 
                    ctx.fillRect(Math.floor(xL), Math.floor(y - boxH / 2), Math.ceil(engine.BOX), 1);
                }
            }
        },

        drawRect: function(ctx, x, y, w, h, fillColor, topColor) {
            ctx.fillStyle = fillColor; 
            ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - h / 2), Math.ceil(w), Math.ceil(h)); 
            ctx.fillStyle = topColor; 
            ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - h / 2), Math.ceil(w), 1);
        }
    };
})();