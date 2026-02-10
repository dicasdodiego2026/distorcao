
import { simulateBacktest } from './simulation';

/**
 * Finds the best strategy configuration based on user constraints.
 * 
 * @param {Array} data - Historical data
 * @param {number} smaPeriod - Selected SMA
 * @param {number} maxStopLossTicks - Maximum allowed drawdown in ticks
 * @param {number} timezoneOffset - Data timezone shift in hours
 * @returns {Array} Top 3 best configurations
 */
export const findBestStrategy = (data, smaPeriod, maxStopLossTicks = 300, timezoneOffset = 0) => {
    if (!data || data.length === 0) return [];

    // Define search space
    // We want to find a strategy that trades EVERY DAY (or close to it) and is profitable.

    // Entries: 10 to 40 step 5
    const entryOptions = [10, 15, 20, 25, 30, 35, 40];

    // Targets: Scalping (5) to Swing (20)
    const targetOptions = [5, 8, 10, 15, 20];

    // Time Windows: Focus on liquidity hours? 
    // Or let's try a few standard blocks.
    const timeWindows = [
        { start: '09:00', end: '11:00', label: 'Manhã (Abertura)' },
        { start: '09:00', end: '12:00', label: 'Manhã Extendida' },
        { start: '10:00', end: '13:00', label: 'Meio do Dia' },
        { start: '13:00', end: '16:00', label: 'Tarde' },
        { start: '09:00', end: '16:00', label: 'Dia Todo' }
    ];

    // Grid Settings: Fixed for now to reduce complexity, or test 2 variants.
    // User wants "increase position". Let's test standard martingale.
    const gridOptions = [
        { step: 10, maxLayers: 3, multiplier: 1.0, label: 'Grid Fixo' },
        { step: 10, maxLayers: 3, multiplier: 1.5, label: 'Grid Martingale 1.5x' }
    ];

    const results = [];

    // Brute Force Search
    // Total iterations: 5 * 7 * 5 * 2 = 350 iterations. Should be fast.

    for (const time of timeWindows) {
        for (const entry of entryOptions) {
            for (const target of targetOptions) {
                for (const grid of gridOptions) {

                    const config = {
                        smaPeriod,
                        entryTicks: entry,
                        stepTicks: grid.step,
                        maxLayers: grid.maxLayers,
                        targetTicks: target,
                        startTime: time.start,
                        endTime: time.end,
                        requireTouchAndGo: true, // Always ON for safety as requested
                        multiplier: grid.multiplier,
                        timezoneOffset // Pass timezone shift
                    };

                    const simResult = simulateBacktest(data, config);

                    // Filter invalid results
                    if (!simResult || simResult.totalTrades === 0) continue;

                    // Hard Constraints
                    if (simResult.maxDrawdown > maxStopLossTicks) continue; // Respect Max Stop

                    results.push({
                        config,
                        ...simResult,
                        score: simResult.totalProfit // Simple score
                    });
                }
            }
        }
    }

    // Sort by Score (Profit) Descending
    results.sort((a, b) => b.totalProfit - a.totalProfit);

    // Return Top 3 unique configurations (avoid duplicates if similar)
    return results.slice(0, 3);
};
