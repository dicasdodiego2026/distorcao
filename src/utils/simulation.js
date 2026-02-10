
/**
 * Simulates a Grid Strategy on historical data
 * Uses TICK-LEVEL resolution simulated from High/Low distortions
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
        totalShares: 0,
        entryTime: null,
        maxAdverse: 0
    };

    let waitingForReset = false;

    // Helper to get time in minutes with offset
    const getMinutes = (dateStr) => {
        const date = new Date(dateStr);
        // Apply offset if needed (assuming date is local, just shift hours)
        if (timezoneOffset) {
            date.setHours(date.getHours() + parseInt(timezoneOffset));
        }
        return date.getHours() * 60 + date.getMinutes();
    };

    for (let i = 0; i < data.length; i++) {
        const bar = data[i];

        // Use Intraday High/Low if available, else fallback to dist (Close)
        const distClose = bar[distKey];
        const distHigh = bar[distHighKey] !== undefined ? bar[distHighKey] : distClose;
        const distLow = bar[distLowKey] !== undefined ? bar[distLowKey] : distClose;

        if (distClose === null) continue;

        const currentMinutes = getMinutes(bar.timestamp);

        // 0. Reset Condition
        if (waitingForReset) {
            // Check if ANY part of the bar touched 0
            // If Low <= 0 <= High, true.
            if (distLow <= 0 && distHigh >= 0) {
                waitingForReset = false;
            } else if (Math.abs(distClose) <= 2) { // Fallback close proximity
                waitingForReset = false;
            }
        }

        // 1. Manage Active Trade
        if (position.active) {
            let unrealizedPnl = 0;

            if (position.direction === 'SELL') {
                // Short Logic
                // Stop/Grid Trigger: Did price go HIGHER?
                // Target Trigger: Did price go LOWER?

                // PESSIMISTIC: Check Adverse First in same bar
                const currentBad = distHigh;
                const currentGood = distLow;

                // Max Adverse Update
                const adverse = currentBad - position.avgPrice;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Check Grid Addition (Adverse Move)
                if (position.layers < maxLayers) {
                    const nextLevel = config.entryTicks + (position.layers * stepTicks);
                    // If High touched next level
                    if (currentBad >= nextLevel) {
                        const layerPrice = nextLevel; // Limit fill at level
                        const newShares = Math.pow(multiplier, position.layers);

                        const oldTotal = position.totalShares;
                        const totalNew = oldTotal + newShares;
                        position.avgPrice = ((position.avgPrice * oldTotal) + (layerPrice * newShares)) / totalNew;
                        position.totalShares = totalNew;
                        position.layers++;
                        // Continue logic in same bar? Yes, price could go up then down.
                        // But for simplicity, we process one event per bar priority.
                        // Improving: If grid added, check target with NEW avgPrice? 
                        // Unlikely to hit target same bar after huge adverse move, but possible.
                    }
                }

                // Check Exit (Profit) - Low touched target?
                // Target is AvgPrice - TargetTicks
                const targetPrice = position.avgPrice - targetTicks;

                if (currentGood <= targetPrice) {
                    // FILLED PROFIT
                    // PnL = (Entry - Exit) * Shares
                    // Here: (AvgPrice - TargetPrice) * Shares
                    // Since TargetPrice = AvgPrice - TargetTicks, Diff is TargetTicks.

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
                // Long Logic
                // Stop/Grid (Adverse): Price Lower (distLow)
                // Target (Profit): Price Higher (distHigh)

                const currentBad = distLow;
                const currentGood = distHigh;

                const adverse = position.avgPrice - currentBad;
                if (adverse > position.maxAdverse) position.maxAdverse = adverse;

                // Grid
                if (position.layers < maxLayers) {
                    const nextLevel = -config.entryTicks - (position.layers * stepTicks);
                    if (currentBad <= nextLevel) {
                        const layerPrice = nextLevel;
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

            // Time Filter
            // Handle simple case: Start < End (Day session)
            // If Start > End (Overnight), logic differs, but assuming Day trade for now
            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {

                // Check SELL Entry (Price High >= Entry)
                if (distHigh >= entryTicks) {
                    position = {
                        active: true,
                        direction: 'SELL',
                        layers: 1,
                        avgPrice: entryTicks, // Limit fill
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                    // Check if Target hit in same bar?
                    // If distLow <= Target...
                    // PESSIMISTIC: No, assume we entered at High and Close didn't hit target yet?
                    // Optimistic: Yes. 
                    // Let's stick to standard: Enter now, check exit NEXT bar.
                    // Exception: Huge bar that covers both.
                }
                // Check BUY Entry (Price Low <= -Entry)
                else if (distLow <= -entryTicks) {
                    position = {
                        active: true,
                        direction: 'BUY',
                        layers: 1,
                        avgPrice: -entryTicks,
                        totalShares: 1,
                        entryTime: bar.timestamp,
                        maxAdverse: 0
                    };
                }
            }
        }
    }

    return {
        totalTrades: trades.length,
        totalProfit: equity,
        winRate: trades.length > 0 ? trades.filter(t => t.profit > 0).length / trades.length : 0,
        maxDrawdown: Math.max(...trades.map(t => t.maxDrawdown), 0) || 0,
        trades
    };
};
