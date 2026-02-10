
/**
 * Simulates a Grid Strategy on historical data
 * Uses TICK-LEVEL resolution simulated from High/Low distortions
 * EXCLUSIVELY MEAN REVERSION (Sell High, Buy Low).
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
        timezoneOffset // Shift in hours (e.g. -3, +0, +3)
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
        initialEntryPrice: 0,
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
                // Direction: SELL (Short) - Bet on price going DOWN (Reversion from High)

                const currentBad = distHigh; // High is bad for Short
                const currentGood = distLow; // Low is good for Short (Profit)

                // Max Adverse
                const adverse = currentBad - position.avgPrice;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // CHECK GRID (ADD TO SHORT) - If price goes HIGHER (Against us)
                if (position.layers < maxLayers) {
                    // Reversion Sell: We entered at +20.
                    // Grid Add: We add at +30 (Entry + Step).
                    const nextGridLevel = position.initialEntryPrice + (position.layers * stepTicks);

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

                // CHECK EXIT (PROFIT) - If price goes LOWER (With us)
                const targetPrice = position.avgPrice - targetTicks;

                if (currentGood <= targetPrice) {
                    const pnlPerShare = targetTicks;
                    const totalPnl = pnlPerShare * position.totalShares;

                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'SELL',
                        profit: totalPnl,
                        layers: position.layers,
                        maxDrawdown: position.maxAdverse
                    });

                    equity += totalPnl;
                    position.active = false;
                    waitingForReset = requireTouchAndGo;
                }

            } else { // BUY
                // Direction: BUY (Long) - Bet on price going UP (Reversion from Low)

                const currentBad = distLow; // Low is bad for Long
                const currentGood = distHigh; // High is good for Long (Profit)

                const adverse = position.avgPrice - currentBad;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Grid (Add to Long) - If price goes LOWER (Against us)
                if (position.layers < maxLayers) {
                    // Reversion Buy: We entered at -20.
                    // Grid Add: We add at -30 (Entry - Step).
                    const nextGridLevel = position.initialEntryPrice - (position.layers * stepTicks);

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

                // Exit (Profit) - If price goes HIGHER (With us)
                const targetPrice = position.avgPrice + targetTicks;
                if (currentGood >= targetPrice) {
                    const pnlPerShare = targetTicks;
                    const totalPnl = pnlPerShare * position.totalShares;

                    trades.push({
                        entryTime: position.entryTime,
                        exitTime: bar.timestamp,
                        direction: 'BUY',
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

                // MEAN REVERSION LOGIC ONLY
                // Sell High, Buy Low

                if (distHigh >= entryTicks) {
                    position = {
                        active: true,
                        direction: 'SELL',
                        layers: 1,
                        avgPrice: entryTicks,
                        initialEntryPrice: entryTicks,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                } else if (distLow <= -entryTicks) {
                    position = {
                        active: true,
                        direction: 'BUY',
                        layers: 1,
                        avgPrice: -entryTicks,
                        initialEntryPrice: -entryTicks,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                }
            }
        }
    }

    return {
        strategyType: 'REVERSION',
        totalTrades: trades.length,
        totalProfit: equity,
        winRate: trades.length > 0 ? trades.filter(t => t.profit > 0).length / trades.length : 0,
        maxDrawdown: Math.max(...trades.map(t => t.maxDrawdown), 0) || 0,
        trades
    };
};
