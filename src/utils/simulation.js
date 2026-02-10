
/**
 * Simulates a Grid Strategy on historical data
 * 
 * @param {Array} data - Array of bars with distortions (dist10, dist25, etc.) and timestamps
 * @param {Object} config - Configuration object
 * @param {number} config.smaPeriod - Period of SMA (10, 25, 50)
 * @param {number} config.entryTicks - Distortion ticks to trigger entry
 * @param {number} config.stepTicks - Distortion ticks to add a layer
 * @param {number} config.maxLayers - Maximum number of layers (grid additions)
 * @param {number} config.targetTicks - Profit target in ticks from AVERAGE price
 * @param {string} config.startTime - "HH:MM" start time for entries
 * @param {string} config.endTime - "HH:MM" end time for entries (can force close after?)
 * @param {boolean} config.requireTouchAndGo - If true, requires price to touch SMA (dist=0) before next trade
 * @param {number} config.multiplier - Position multiplier (e.g. 1.0 = linear, 1.5, 2.0 = martingale-ish)
 */
export const simulateBacktest = (data, config) => {
    if (!data || data.length === 0) return null;

    const {
        smaPeriod,
        entryTicks,
        stepTicks,
        maxLayers,
        targetTicks,
        startTime,
        endTime,
        requireTouchAndGo,
        multiplier
    } = config;

    const distKey = `dist${smaPeriod}`;

    // Convert time strings to minutes for comparison
    const [startH, startM] = startTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const [endH, endM] = endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    let equity = 0;
    const equityCurve = [];
    const trades = [];

    // Simulation State
    let position = {
        active: false,
        direction: null, // 'BUY' or 'SELL'
        layers: 0,
        avgPrice: 0, // In terms of distortion ticks relative to SMA
        totalShares: 0,
        entryTime: null,
        maxAdverse: 0
    };

    let waitingForReset = false; // For requireTouchAndGo

    // Iterate bar by bar
    for (let i = 0; i < data.length; i++) {
        const bar = data[i];
        const dist = bar[distKey];
        if (dist === null || dist === undefined) continue;

        // Use rounded distortion for precision
        const currentDist = Math.round(dist * 10) / 10;
        const tickSize = bar.tick_size || 0.5; // Needed? dist is already in ticks.

        const date = new Date(bar.timestamp);
        const currentMinutes = date.getHours() * 60 + date.getMinutes();

        // 0. Check Reset Condition
        if (waitingForReset) {
            // Touch means distortion crosses 0 or is very close (e.g. <= 1 tick)
            if (Math.abs(currentDist) <= 2) {
                waitingForReset = false;
            }
        }

        // 1. Manage Active Trade
        if (position.active) {
            let unrealizedPnl = 0;

            if (position.direction === 'SELL') {
                // Sell: Profit if dist decreases (goes back to 0 or lower)
                // Entry was at +20. Current is +15. Profit = 5.
                // AvgPrice is theoretical distortion level.
                // PnL per share = AvgPrice - CurrentDist
                const diff = position.avgPrice - currentDist;
                unrealizedPnl = diff * position.totalShares;

                // Max Adverse: How much did it go AGAINST us? (Higher distortion)
                // Drawdown is max positive excursion from avgPrice
                const adverse = currentDist - position.avgPrice;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Check Exit (Take Profit)
                // Target is relative to AvgPrice. Target 5 ticks means we exit when dist = AvgPrice - 5
                if (diff >= targetTicks) {
                    // CLOSE TRADE
                    equity += unrealizedPnl;
                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'SELL',
                        profit: unrealizedPnl,
                        layers: position.layers,
                        maxDrawdown: position.maxAdverse
                    });
                    position.active = false;
                    waitingForReset = requireTouchAndGo;
                }
                // Check Grid Addition
                // If dist goes HIGHER than next level.
                // Next level = Entry + (Step * CurrentLayers) ? No, AvgPrice logic is complex with multiplier.
                // Simple logic: If dist > LastLayerEntry + Step
                else if (position.layers < maxLayers) {
                    // Logic for next grid level relative to INITIAL entry or LAST entry?
                    // Standard Grid: Initial + Step, Initial + 2*Step...
                    // Let's assume equidistant grid from Initial Entry
                    const nextLevel = config.entryTicks + (position.layers * stepTicks);

                    if (currentDist >= nextLevel) {
                        // Add Layer
                        const newShares = Math.pow(multiplier, position.layers); // 1, 1.5, 2.25... or 1, 2, 4 if multiplier 2
                        const layerPrice = currentDist; // Fill at current price

                        // Update Avg Price (Weighted)
                        // NewAvg = (OldAvg * OldShares + NewPrice * NewShares) / TotalShares
                        const oldTotal = position.totalShares;
                        const totalNew = oldTotal + newShares;
                        position.avgPrice = ((position.avgPrice * oldTotal) + (layerPrice * newShares)) / totalNew;
                        position.totalShares = totalNew;
                        position.layers++;
                    }
                }

            } else { // BUY
                // Buy: Profit if dist increases (goes back to 0 or higher)
                // Entry at -20. Current -15. Profit = (-15) - (-20) = 5.
                // PnL = CurrentDist - AvgPrice
                const diff = currentDist - position.avgPrice;
                unrealizedPnl = diff * position.totalShares;

                // Max Adverse: Lower distortion (more negative)
                const adverse = position.avgPrice - currentDist;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Check Exit
                if (diff >= targetTicks) {
                    equity += unrealizedPnl;
                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'BUY',
                        profit: unrealizedPnl,
                        layers: position.layers,
                        maxDrawdown: position.maxAdverse
                    });
                    position.active = false;
                    waitingForReset = requireTouchAndGo;
                }
                // Check Grid
                // If dist < LastLayerEntry - Step
                else if (position.layers < maxLayers) {
                    const nextLevel = -config.entryTicks - (position.layers * stepTicks);

                    if (currentDist <= nextLevel) {
                        const newShares = Math.pow(multiplier, position.layers);
                        const layerPrice = currentDist;

                        const oldTotal = position.totalShares;
                        const totalNew = oldTotal + newShares;
                        position.avgPrice = ((position.avgPrice * oldTotal) + (layerPrice * newShares)) / totalNew;
                        position.totalShares = totalNew;
                        position.layers++;
                    }
                }
            }

            // Force Close at End of Day? Or End of File?
            // For now, let it run. But maybe close at 17:00?
            // if (currentMinutes >= 17 * 60) ...

        } else {
            // 2. Check Valid Time Window
            // If waiting for reset, skip
            if (waitingForReset) continue;

            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                // Check Entry
                if (currentDist >= entryTicks) {
                    // SELL Entry
                    position = {
                        active: true,
                        direction: 'SELL',
                        layers: 1,
                        avgPrice: currentDist,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                } else if (currentDist <= -entryTicks) {
                    // BUY Entry
                    position = {
                        active: true,
                        direction: 'BUY',
                        layers: 1,
                        avgPrice: currentDist,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                }
            }
        }

        // Record Equity Curve (optional: only on trade close to save memory? or hourly?)
        // Recording every bar is too much. Record on trade close + daily EOD.
    }

    // Force close open trade at end of data for stats
    if (position.active) {
        // ... (Close logic similar to above but forced)
        // Ignoring for now to keep stats clean (only closed trades)
    }

    return {
        totalTrades: trades.length,
        totalProfit: equity,
        avgProfitPerTrade: trades.length > 0 ? equity / trades.length : 0,
        winRate: trades.filter(t => t.profit > 0).length / trades.length,
        maxDrawdown: Math.max(...trades.map(t => t.maxDrawdown), 0),
        trades: trades
    };
};
