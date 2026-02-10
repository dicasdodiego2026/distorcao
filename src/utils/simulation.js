
/**
 * Simulates a Grid Strategy on historical data
 * Uses TICK-LEVEL resolution simulated from High/Low distortions
 * Supports REVERSION and TREND strategies.
 * 
 * @param {Array} data - Array of bars with distortions (dist10, dist10_high, dist10_low, etc.)
 * @param {Object} config - Configuration object
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
        multiplier,
        timezoneOffset, // Shift in hours (e.g. -3, +0, +3)
        strategyType = 'REVERSION' // 'REVERSION' or 'TREND'
    } = config;

    const distKey = `dist${smaPeriod}`;
    const distHighKey = `dist${smaPeriod}_high`;
    const distLowKey = `dist${smaPeriod}_low`;

    // Parse Time Windows
    const [startH, startM] = startTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const [endH, endM] = endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    // Output Stats
    let equity = 0;
    const trades = [];

    // State
    let position = {
        active: false,
        direction: null, // 'BUY' or 'SELL'
        layers: 0,
        avgPrice: 0, // In ticks deviation
        initialEntryPrice: 0, // To track grid relative to first entry
        totalShares: 0,
        entryTime: null,
        maxAdverse: 0
    };

    let waitingForReset = false;

    // Helper to get time in minutes with offset
    const getMinutes = (dateStr) => {
        const date = new Date(dateStr);
        if (timezoneOffset) {
            date.setHours(date.getHours() + parseInt(timezoneOffset));
        }
        return date.getHours() * 60 + date.getMinutes();
    };

    for (let i = 0; i < data.length; i++) {
        const bar = data[i];

        const distClose = bar[distKey];
        const distHigh = bar[distHighKey] !== undefined ? bar[distHighKey] : distClose;
        const distLow = bar[distLowKey] !== undefined ? bar[distLowKey] : distClose;

        if (distClose === null) continue;

        const currentMinutes = getMinutes(bar.timestamp);

        // 0. Reset Condition
        if (waitingForReset) {
            if (distLow <= 0 && distHigh >= 0) {
                waitingForReset = false;
            } else if (Math.abs(distClose) <= 2) {
                waitingForReset = false;
            }
        }

        // 1. Manage Active Trade
        if (position.active) {
            let unrealizedPnl = 0;

            if (position.direction === 'SELL') {
                // Direction: SELL (Short)
                // Profit if price goes DOWN (Lower distortion)
                // Loss/Grid if price goes UP (Higher distortion)

                const currentBad = distHigh; // High is bad for Short
                const currentGood = distLow; // Low is good for Short

                // Max Adverse
                const adverse = currentBad - position.avgPrice;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // CHECK GRID (ADD TO SHORT)
                // We add if price moves AGAINST us (UP) by stepTicks from LAST LAYER? Or Initial?
                // Let's use Simple Grid from Initial Entry to keep logic robust.
                // Or better: From AvgPrice? No, martingale usually from entry steps.
                // Level 1: Entry + Step 1.
                // Level 2: Entry + Step 1 + Step 2? (Linear steps: Entry + N*Step)
                if (position.layers < maxLayers) {

                    // Determine trigger level for next layer
                    // If we are Short, we add higher.
                    // But if this is TREND strategy (Sell Low), "Higher" means closer to 0 (Pullback).
                    // If this is REVERSION strategy (Sell High), "Higher" means further from 0.
                    // Logic is strictly "Against Position".
                    // Sell Entry at P. Grid at P + Step.

                    const nextGridLevel = position.initialEntryPrice + (position.layers * stepTicks);

                    // Note: If we entered at -20 (Trend Sell), next level is -20 + 10 = -10.
                    // If we entered at +20 (Reversion Sell), next level is 20 + 10 = 30.
                    // Logic holds: We sell more if price rises.

                    if (currentBad >= nextGridLevel) {
                        const layerPrice = nextGridLevel;
                        const newShares = Math.pow(multiplier, position.layers);

                        const oldTotal = position.totalShares;
                        const totalNew = oldTotal + newShares;
                        position.avgPrice = ((position.avgPrice * oldTotal) + (layerPrice * newShares)) / totalNew;
                        position.totalShares = totalNew;
                        position.layers++;
                    }
                }

                // CHECK EXIT (PROFIT)
                // Target is AvgPrice - TargetTicks (Lower)
                const targetPrice = position.avgPrice - targetTicks;

                if (currentGood <= targetPrice) {
                    const pnlPerShare = targetTicks;
                    const totalPnl = pnlPerShare * position.totalShares;

                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'SELL',
                        type: strategyType,
                        profit: totalPnl,
                        layers: position.layers,
                        maxDrawdown: position.maxAdverse
                    });

                    equity += totalPnl;
                    position.active = false;
                    waitingForReset = requireTouchAndGo;
                }

            } else { // BUY
                // Direction: BUY (Long)
                // Profit if price goes UP (Higher)
                // Loss/Grid if price goes DOWN (Lower)

                const currentBad = distLow; // Low is bad for Long
                const currentGood = distHigh; // High is good for Long

                const adverse = position.avgPrice - currentBad;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Grid (Add to Long)
                // Add if price drops by Step
                if (position.layers < maxLayers) {
                    const nextGridLevel = position.initialEntryPrice - (position.layers * stepTicks);
                    // If entered at +20 (Trend Buy), next is 10.
                    // If entered at -20 (Reversion Buy), next is -30.
                    // Logic holds: We buy more if price drops.

                    if (currentBad <= nextGridLevel) {
                        const layerPrice = nextGridLevel;
                        const newShares = Math.pow(multiplier, position.layers);

                        const oldTotal = position.totalShares;
                        const totalNew = oldTotal + newShares;
                        position.avgPrice = ((position.avgPrice * oldTotal) + (layerPrice * newShares)) / totalNew;
                        position.totalShares = totalNew;
                        position.layers++;
                    }
                }

                // Exit
                const targetPrice = position.avgPrice + targetTicks;
                if (currentGood >= targetPrice) {
                    const pnlPerShare = targetTicks;
                    const totalPnl = pnlPerShare * position.totalShares;

                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'BUY',
                        type: strategyType,
                        profit: totalPnl,
                        layers: position.layers,
                        maxDrawdown: position.maxAdverse
                    });

                    equity += totalPnl;
                    position.active = false;
                    waitingForReset = requireTouchAndGo;
                }
            }

        } else {
            // 2. Check Entries
            if (waitingForReset) continue;

            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {

                // Signal Checks
                let signal = null; // 'BUY' or 'SELL'
                let entryPrice = 0;

                if (strategyType === 'REVERSION') {
                    // Reversion: Sell High, Buy Low
                    if (distHigh >= entryTicks) {
                        signal = 'SELL';
                        entryPrice = entryTicks;
                    } else if (distLow <= -entryTicks) {
                        signal = 'BUY';
                        entryPrice = -entryTicks;
                    }
                } else {
                    // Trend: Buy High (Breakout), Sell Low (Breakdown)
                    if (distHigh >= entryTicks) {
                        signal = 'BUY'; // BREAKOUT UP
                        entryPrice = entryTicks;
                    } else if (distLow <= -entryTicks) {
                        signal = 'SELL'; // BREAKDOWN DOWN
                        entryPrice = -entryTicks;
                    }
                }

                if (signal) {
                    position = {
                        active: true,
                        direction: signal,
                        layers: 1,
                        avgPrice: entryPrice,
                        initialEntryPrice: entryPrice,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                }
            }
        }
    }

    return {
        strategyType,
        totalTrades: trades.length,
        totalProfit: equity,
        winRate: trades.length > 0 ? trades.filter(t => t.profit > 0).length / trades.length : 0,
        maxDrawdown: Math.max(...trades.map(t => t.maxDrawdown), 0) || 0,
        trades
    };
};
