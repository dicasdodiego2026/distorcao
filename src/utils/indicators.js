/**
 * Calculates RSI (Relative Strength Index)
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - RSI period (default 14)
 * @returns {number[]} Array of RSI values matching the length of closes (null for initial periods)
 */
export const calculateRSI = (closes, period = 14) => {
    if (!closes || closes.length < period + 1) return [];

    let gains = 0;
    let losses = 0;

    // First average (Simple Moving Average)
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const rsiArray = new Array(closes.length).fill(null);

    // First RSI
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArray[period] = 100 - (100 / (1 + rs));

    // Subsequent values (Smoothed / Wilder's)
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        // Wilder's Smoothing: (PreviousAvg * (n-1) + Current) / n
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiArray[i] = 100 - (100 / (1 + rs));
    }

    return rsiArray;
};

/**
 * Analyzes RSI Trades based on signals
 * Signal: Close of Bar N triggers signal.
 * Entry: Open of Bar N+1.
 * @param {Array} bars - Array of bar objects {timestamp, open, high, low, close}
 * @param {number} tickSize - Tick size (e.g., 0.1 for RTY, 0.25 for MES)
 * @returns {Object} Analysis results { trades, summary }
 */
export const analyzeRSITrades = (bars, tickSize = 0.1) => {
    if (!bars || bars.length < 20) return { trades: [], summary: {} };

    const closes = bars.map(b => b.close);
    const rsiValues = calculateRSI(closes, 14);
    const trades = [];

    // Iterate to find signals
    // Start after RSI stabilizes
    for (let i = 15; i < bars.length - 1; i++) {
        const prevRsi = rsiValues[i - 1];
        const currRsi = rsiValues[i];

        if (prevRsi === null || currRsi === null) continue;

        let signal = null; // 'BUY' or 'SELL'

        // Sell Signal: Cross Below 70
        if (prevRsi > 70 && currRsi <= 70) {
            signal = 'SELL';
        }
        // Buy Signal: Cross Above 30
        else if (prevRsi < 30 && currRsi >= 30) {
            signal = 'BUY';
        }

        if (signal) {
            // ENTRY is on the NEXT bar (i + 1)
            const entryBarIndex = i + 1;
            const entryBar = bars[entryBarIndex];
            const entryPrice = entryBar.open;
            const signalTime = bars[i].timestamp;
            const entryTime = entryBar.timestamp;

            // Simulate Outcome
            // Search forward for Max Gain (MFE) and Max Drawdown (MAE)
            // Limit search to end of day or max 120 bars (2 hours)
            let maxMfe = 0;
            let maxMae = 0;
            const entryIndex = entryBarIndex;
            const maxLookahead = Math.min(bars.length, entryIndex + 120);

            for (let j = entryIndex; j < maxLookahead; j++) {
                const bar = bars[j];

                // Stop if day changes (intraday only)
                const currentDay = bar.timestamp instanceof Date ? bar.timestamp.getDate() : new Date(bar.timestamp).getDate();
                const entryDay = entryBar.timestamp instanceof Date ? entryBar.timestamp.getDate() : new Date(entryBar.timestamp).getDate();

                if (j > entryIndex && currentDay !== entryDay) {
                    break;
                }

                if (signal === 'BUY') {
                    // Long: MFE = High - Entry, MAE = Entry - Low
                    const mfe = bar.high - entryPrice;
                    const mae = entryPrice - bar.low;
                    if (mfe > maxMfe) maxMfe = mfe;
                    if (mae > maxMae) maxMae = mae;
                } else {
                    // Short: MFE = Entry - Low, MAE = High - Entry
                    const mfe = entryPrice - bar.low;
                    const mae = bar.high - entryPrice;
                    if (mfe > maxMfe) maxMfe = mfe;
                    if (mae > maxMae) maxMae = mae;
                }
            }

            trades.push({
                id: i,
                signal,
                signalTime,
                entryTime,
                entryPrice,
                rsi: currRsi.toFixed(2),
                mfeTicks: Math.round(maxMfe / tickSize),
                maeTicks: Math.round(maxMae / tickSize),
                mfePoints: maxMfe,
                maePoints: maxMae
            });
        }
    }

    return {
        trades,
        summary: {
            totalTrades: trades.length,
            avgMfe: trades.length > 0 ? (trades.reduce((sum, t) => sum + t.mfeTicks, 0) / trades.length).toFixed(1) : 0,
            avgMae: trades.length > 0 ? (trades.reduce((sum, t) => sum + t.maeTicks, 0) / trades.length).toFixed(1) : 0
        }
    };
};
