
export const parseLogData = (fileContent) => {
    if (!fileContent) return [];

    // Pre-process: Fix locale issues (comma decimals) -> "123,45" to "123.45"
    // valid JSON numbers cannot have commas.
    const processedContent = fileContent.replace(/(\d+),(\d+)/g, '$1.$2');

    const bars = [];
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let escape = false;

    // Pre-process: sometimes files have weird characters or are just array of objects without comma
    // If it starts with [, it might be a valid JSON array
    const trimmed = processedContent.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const validJson = JSON.parse(trimmed);
            return validJson.map(mapBarData).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
        } catch (e) {
            console.warn("Array parsing failed, falling back to stream parsing", e);
        }
    }

    // Stream parser for concatenated JSON objects
    for (let i = 0; i < processedContent.length; i++) {
        const char = processedContent[i];

        if (inString) {
            if (escape) {
                escape = false;
            } else if (char === '\\') {
                escape = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                const jsonStr = processedContent.substring(startIndex, i + 1);
                try {
                    const data = JSON.parse(jsonStr);
                    const mapped = mapBarData(data);
                    if (mapped) bars.push(mapped);
                } catch (e) {
                    console.warn("Failed to parse JSON chunk", e);
                }
                startIndex = -1;
            }
        }
    }

    return bars.sort((a, b) => a.timestamp - b.timestamp);
};

const mapBarData = (data) => {
    // Handle both direct object (if log is just bar) or nested {barra: ...}
    const bar = data.barra || data;

    if (!bar || typeof bar.close === 'undefined') return null;

    // Handle timestamp: might be directly on data, or inside bar, or specific fields
    const ts = data.timestamp_barra || bar.timestamp || data.timestamp;
    if (!ts) return null;

    return {
        timestamp: new Date(ts),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume),
        tick_size: Number(bar.tick_size || data.tick_size || 0.5), // fallback
        direcao: bar.direcao
    };
};

export const calculateSMA = (data, period) => {
    const smaData = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            smaData.push(null);
            continue;
        }

        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        smaData.push(sum / period);
    }
    return smaData;
};

export const calculateDistortions = (bars, smaPer10, smaPer25, smaPer50) => {
    return bars.map((bar, index) => {
        const sma10 = smaPer10[index];
        const sma25 = smaPer25[index];
        const sma50 = smaPer50[index];

        const getDistortion = (sma, priceBar) => {
            if (sma === null) return null;
            // Distortion = Price - SMA
            // We use High if above SMA, Low if below SMA
            if (priceBar.close >= sma) {
                return (priceBar.high - sma) / priceBar.tick_size;
            } else {
                return (priceBar.low - sma) / priceBar.tick_size;
            }
        };

        return {
            ...bar,
            sma10,
            sma25,
            sma50,
            dist10: getDistortion(sma10, bar),
            dist25: getDistortion(sma25, bar),
            dist50: getDistortion(sma50, bar),
        };
    });
};

export const generateStats = (data, selectedSMA) => {
    const validData = data.filter(d => d[`dist${selectedSMA}`] !== null);

    if (validData.length === 0) return null;

    const distortions = validData.map(d => d[`dist${selectedSMA}`]);
    const maxDistortion = Math.max(...distortions);
    const minDistortion = Math.min(...distortions);
    const avgDistortion = distortions.reduce((a, b) => a + Math.abs(b), 0) / distortions.length;

    const histogram = {};
    distortions.forEach(d => {
        const bucket = Math.floor(d / 5) * 5;
        histogram[bucket] = (histogram[bucket] || 0) + 1;
    });

    const histogramData = Object.keys(histogram).map(k => ({
        bucket: Number(k),
        count: histogram[k]
    })).sort((a, b) => a.bucket - b.bucket);

    return {
        count: validData.length,
        max: maxDistortion,
        min: minDistortion,
        avgAbs: avgDistortion,
        histogram: histogramData
    };
};

export const aggregateByTime = (data, selectedSMA) => {
    if (!data || data.length === 0) return [];

    const buckets = {};

    data.forEach(bar => {
        // Ensure we have valid distortion data
        const distKey = `dist${selectedSMA}`;
        if (!bar.timestamp || bar[distKey] === null || bar[distKey] === undefined) return;

        const date = new Date(bar.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes();

        // Bucket by 30 minutes: 00-29 -> '00', 30-59 -> '30'
        const interval = minutes < 30 ? '00' : '30';
        const timeLabel = `${hours}:${interval}`;

        if (!buckets[timeLabel]) {
            buckets[timeLabel] = {
                distortions: [],
            };
        }

        // We are interested in absolute distortion for magnitude analysis
        buckets[timeLabel].distortions.push(Math.abs(bar[distKey]));
    });

    return Object.keys(buckets).sort().map(timeLabel => {
        const dists = buckets[timeLabel].distortions;
        const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
        const max = Math.max(...dists);

        return {
            time: timeLabel,
            avgDistortion: avg,
            maxDistortion: max,
            count: dists.length
        };
    });
};

export const findOptimalStrategy = (data, selectedSMA) => {
    if (!data || data.length === 0) return null;

    const distKey = `dist${selectedSMA}`;
    const distortions = data
        .filter(d => d[distKey] !== null)
        .map(d => Math.abs(d[distKey]));

    if (distortions.length === 0) return null;

    const maxVal = Math.max(...distortions);
    // Generate thresholds every 5 ticks
    const thresholds = [];
    for (let t = 5; t < maxVal; t += 5) thresholds.push(t);

    const results = [];

    thresholds.forEach(threshold => {
        let count = 0;
        let totalMAE = 0; // Max Adverse Excursion (drawdown)

        let inTrade = false;
        let entryPrice = 0; // Conceptual 'distortion' level
        let peakDistortion = 0;

        // Iterate through time series to simulate trades
        for (let i = 0; i < data.length; i++) {
            const val = Math.abs(data[i][distKey]);
            if (!val && val !== 0) continue;

            if (!inTrade && val >= threshold) {
                // Enter Reward: Reversion to 0 (Profit = threshold)
                inTrade = true;
                peakDistortion = val;
                count++;
            }

            if (inTrade) {
                if (val > peakDistortion) peakDistortion = val;

                // Exit: Reversion near 0 (e.g. < 20% of threshold or < 2 ticks)
                if (val < 2) {
                    inTrade = false;
                    // Drawdown = Peak - Entry
                    totalMAE += (peakDistortion - threshold);
                }
            }
        }

        if (count >= 5) {
            const avgMAE = totalMAE / count;
            const suggestedStop = Math.ceil(avgMAE + (avgMAE * 0.5) + 5);
            const score = (threshold / suggestedStop) * Math.log(count); // Weight profit vs risk vs frequency

            results.push({
                threshold,
                count,
                avgMAE,
                suggestedStop,
                profit: threshold,
                score
            });
        }
    });

    if (results.length === 0) return null;
    results.sort((a, b) => b.score - a.score);

    // Defensive selection
    const balanced = results[0];
    const conservative = results.filter(r => r.threshold > balanced.threshold)[0] || balanced;
    const aggressive = results.filter(r => r.count > balanced.count * 1.5)[0] || results[results.length - 1];

    return { balanced, conservative, aggressive };
};

export const calculateGridStrategy = (data, selectedSMA) => {
    if (!data || data.length === 0) return null;

    const distKey = `dist${selectedSMA}`;
    // Map with Time preserved
    const distortions = data
        .filter(d => d[distKey] !== null)
        .map(d => ({ val: Math.abs(d[distKey]), time: d.timestamp }));

    if (distortions.length === 0) return null;



    // We will test several grid configurations
    // Initial Entry: 5, 10, 15, 20
    // Step: 5, 8, 10, 12, 15
    // Max Layers: Fixed at 3 (Entry + 2 additions) for safety
    // Exit Target: Breakeven + X ticks (e.g. 5 ticks gain on average price)

    const entries = [10, 15, 20];
    const steps = [5, 8, 10, 12, 15];
    const maxLayers = 3;
    const targetProfitTicks = 5;

    const results = [];

    entries.forEach(initialEntry => {
        steps.forEach(step => {
            let totalProfit = 0;
            let maxDrawdown = 0; // relative to Avg Price
            let maxAdverseFromLast = 0; // relative to Last Grid Level
            let tradeCount = 0;
            let tradeHistory = []; // Track individual trades

            // Simulation State
            let inTrade = false;
            let currentLayers = 0;
            let avgPrice = 0;
            let peakAdverseTrade = 0;
            let peakAdverseFromLastTrade = 0;
            let tradeEntryTime = null;
            let tradeEntryPrice = 0;

            for (let i = 0; i < distortions.length; i++) {
                const currentDist = distortions[i].val;

                if (!inTrade) {
                    if (currentDist >= initialEntry) {
                        // OPEN TRADE
                        inTrade = true;
                        currentLayers = 1;
                        avgPrice = initialEntry;
                        peakAdverseTrade = 0;
                        peakAdverseFromLastTrade = 0;
                        tradeEntryTime = distortions[i].time;
                        tradeEntryPrice = initialEntry;
                    }
                } else {
                    // MANAGE TRADE

                    const lastGridLevel = initialEntry + (step * (currentLayers - 1));

                    // 1. Check for Additions (Grid)
                    const nextLevel = initialEntry + (step * currentLayers);

                    if (currentLayers < maxLayers && currentDist >= nextLevel) {
                        // ADD LAYER
                        currentLayers++;
                        // New Avg = ((OldAvg * OldCount) + NewPrice) / CurrentCount
                        // Assume fill at exactly nextLevel
                        avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                    }

                    // 2. Track Drawdown (Float)
                    // Current Price (Distortion) - Avg Price
                    const currentFloat = currentDist - avgPrice;
                    if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                    // 3. Track Adverse from Last Grid (for Stop calculation)
                    // How far did it go BEYOND the last addition?
                    const currentAdverseFromLast = currentDist - (initialEntry + (step * (currentLayers - 1)));
                    if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                    // 4. Check for Exit
                    const targetExit = Math.max(0, avgPrice - targetProfitTicks);

                    if (currentDist <= targetExit) {
                        // CLOSE TRADE
                        const profitPerShare = avgPrice - currentDist;
                        const totalTradeProfit = profitPerShare * currentLayers;

                        // Log trade to history
                        tradeHistory.push({
                            entryTime: tradeEntryTime,
                            exitTime: distortions[i].time,
                            entryPrice: tradeEntryPrice,
                            exitPrice: currentDist,
                            avgPrice: avgPrice,
                            layers: currentLayers,
                            profit: totalTradeProfit,
                            direction: 'SELL',
                            drawdown: peakAdverseTrade
                        });

                        totalProfit += totalTradeProfit;
                        tradeCount++;

                        // Update Maxes
                        if (peakAdverseTrade > maxDrawdown) maxDrawdown = peakAdverseTrade;
                        if (peakAdverseFromLastTrade > maxAdverseFromLast) maxAdverseFromLast = peakAdverseFromLastTrade;

                        // Reset
                        inTrade = false;
                        currentLayers = 0;
                        avgPrice = 0;
                    }
                }
            }

            if (tradeCount > 3) {
                // Score = Profit / MaxDrawdown
                const score = totalProfit / (maxDrawdown || 1);

                // Recommended Stop: MaxAdverseFromLast + Buffer (e.g. 5 ticks)
                const recommendedStopFromLast = Math.ceil(maxAdverseFromLast + 5);

                results.push({
                    initialEntry,
                    step,
                    maxLayers,
                    avgPrice,
                    totalProfit,
                    maxDrawdown, // from AvgPrice
                    stopFromLastGrid: recommendedStopFromLast, // relative to last entry
                    tradeCount,
                    score,
                    tradeHistory: tradeHistory
                });
            }
        });
    });

    results.sort((a, b) => b.score - a.score);
    const bestConfig = results[0];

    if (!bestConfig) return null;

    // --- TIME WINDOW ANALYSIS ---
    // Re-run simulation with best config to map performance AND RISK by Hour
    const hourStats = {}; // { hour: { profit: 0, maxDrawdown: 0, count: 0 } }

    let inTrade = false;
    let currentLayers = 0;
    let avgPrice = 0;
    let tradeStartTime = "";
    let tradeStartHour = 0;
    let peakAdverseThisTrade = 0;

    for (let i = 0; i < distortions.length; i++) {
        const currentDist = distortions[i].val;
        const currentTime = distortions[i].time;

        if (!inTrade) {
            if (currentDist >= bestConfig.initialEntry) {
                inTrade = true;
                currentLayers = 1;
                avgPrice = bestConfig.initialEntry;
                tradeStartTime = currentTime;
                peakAdverseThisTrade = 0;

                const date = new Date(tradeStartTime);
                tradeStartHour = date.getHours();
            }
        } else {
            const nextLevel = bestConfig.initialEntry + (bestConfig.step * currentLayers);
            if (currentLayers < maxLayers && currentDist >= nextLevel) {
                currentLayers++;
                avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
            }

            // Track Drawdown during trade
            const currentFloat = currentDist - avgPrice;
            if (currentFloat > peakAdverseThisTrade) peakAdverseThisTrade = currentFloat;

            const targetExit = Math.max(0, avgPrice - targetProfitTicks);
            if (currentDist <= targetExit) {
                // Trade Closed
                // Log result to the hour of Start Time
                // currentTime format "HH:mm:ss" or Date object?
                // Assuming format "2024-01-01T09:00..." or similar standard. 
                // Let's check `parseLogData` in view_file 953: `timestamp: new Date(ts)` 
                // Wait, mapBarData creates a Date object.
                // But my `distortions` array mapped `d.time`.
                // In `calculateDistortions`, I return `...bar`. Let's check `aggregateByTime`.
                // `aggregateByTime` uses `bar.timestamp`.
                // `calculateDistortions` returns `...bar`.
                // So `d.time` might not exist on the object unless `bar` had it.
                // `mapBarData` creates `timestamp` (Date object). It does NOT create a `time` string property.
                // So `d.time` in line 285 replacement was likely WRONG if `d` comes from `calculateDistortions`.
                // `calculateDistortions` returns objects with `timestamp`.
                // I need to fix my map above first, to use `d.timestamp` instead of `d.time`.
                // And here use `d.timestamp`.

                // Let's assume I fix the map in next step.
                // Here I will use .timestamp (Date object)

                const date = new Date(tradeStartTime);
                const hour = date.getHours(); // 0-23 (number)

                if (!hourStats[hour]) hourStats[hour] = { profit: 0, maxDrawdown: 0, count: 0 };

                const profitPerShare = avgPrice - currentDist;
                const totalTradeProfit = profitPerShare * currentLayers;

                hourStats[hour].profit += totalTradeProfit;
                hourStats[hour].count += 1;

                // Update max drawdown for this hour
                if (peakAdverseThisTrade > hourStats[hour].maxDrawdown) {
                    hourStats[hour].maxDrawdown = peakAdverseThisTrade;
                }

                inTrade = false;
                currentLayers = 0;
            }
        }
    }

    // Find Best Window (Safety Score = Profit / Drawdown)
    // Also find Worst Drawdown Hour
    let bestWindow = { label: "Dia Todo" };
    let worstDrawdownHour = { hour: "N/A", value: 0 };
    const hours = Object.keys(hourStats).filter(h => hourStats[h].profit > 0);

    if (hours.length > 0) {
        // Calculate safety scores
        const hourScores = hours.map(h => {
            const stats = hourStats[h];
            const safetyScore = stats.profit / (stats.maxDrawdown + 1);
            return {
                hour: parseInt(h),
                profit: stats.profit,
                drawdown: stats.maxDrawdown,
                safetyScore,
                count: stats.count
            };
        });

        // Sort by safety score (best risk-adjusted performance)
        hourScores.sort((a, b) => b.safetyScore - a.safetyScore);

        const bestHour = hourScores[0].hour;
        const bestHourDrawdown = hourScores[0].drawdown; // Drawdown of recommended hour
        const endHour = bestHour + 1;

        const formatH = (h) => h < 10 ? `0${h}` : `${h}`;
        bestWindow = { label: `${formatH(bestHour)}:00 às ${formatH(endHour)}:00`, drawdown: bestHourDrawdown };

        // Find worst drawdown
        hourScores.sort((a, b) => b.drawdown - a.drawdown);
        const worstHour = hourScores[0].hour;
        worstDrawdownHour = {
            hour: `${formatH(worstHour)}:00`,
            value: hourScores[0].drawdown
        };
    }

    // --- TIME-SPECIFIC STRATEGY OPTIMIZATION ---
    // Re-optimize parameters using ONLY data from the recommended hour
    let timeSpecificStrategy = null;

    if (bestWindow.label !== "Dia Todo" && hours.length > 0) {
        // Extract the recommended hour
        const bestHourMatch = bestWindow.label.match(/(\d+):00/);
        if (bestHourMatch) {
            const recommendedHour = parseInt(bestHourMatch[1]);

            // Filter distortions to only include the recommended hour
            const hourFilteredDistortions = distortions.filter(d => {
                const date = new Date(d.time);
                return date.getHours() === recommendedHour;
            });

            if (hourFilteredDistortions.length > 20) { // Need minimum data
                // Re-run optimization with filtered data
                const timeResults = [];

                entries.forEach(initialEntry => {
                    steps.forEach(step => {
                        let totalProfit = 0;
                        let maxDrawdown = 0;
                        let maxAdverseFromLast = 0;
                        let tradeCount = 0;
                        let tradeHistory = []; // Track individual trades

                        let inTrade = false;
                        let currentLayers = 0;
                        let avgPrice = 0;
                        let peakAdverseTrade = 0;
                        let peakAdverseFromLastTrade = 0;
                        let tradeEntryTime = null;
                        let tradeEntryPrice = 0;

                        for (let i = 0; i < hourFilteredDistortions.length; i++) {
                            const currentDist = hourFilteredDistortions[i].val;

                            if (!inTrade) {
                                if (currentDist >= initialEntry) {
                                    inTrade = true;
                                    currentLayers = 1;
                                    avgPrice = initialEntry;
                                    peakAdverseTrade = 0;
                                    peakAdverseFromLastTrade = 0;
                                    tradeEntryTime = hourFilteredDistortions[i].time;
                                    tradeEntryPrice = initialEntry;
                                }
                            } else {
                                const lastGridLevel = initialEntry + (step * (currentLayers - 1));
                                const nextLevel = initialEntry + (step * currentLayers);

                                if (currentLayers < maxLayers && currentDist >= nextLevel) {
                                    currentLayers++;
                                    avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                                }

                                const currentFloat = currentDist - avgPrice;
                                if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                                const currentAdverseFromLast = currentDist - (initialEntry + (step * (currentLayers - 1)));
                                if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                                const targetExit = Math.max(0, avgPrice - targetProfitTicks);

                                if (currentDist <= targetExit) {
                                    const profitPerShare = avgPrice - currentDist;
                                    const totalTradeProfit = profitPerShare * currentLayers;

                                    // Log trade to history
                                    tradeHistory.push({
                                        entryTime: tradeEntryTime,
                                        exitTime: hourFilteredDistortions[i].time,
                                        entryPrice: tradeEntryPrice,
                                        exitPrice: currentDist,
                                        avgPrice: avgPrice,
                                        layers: currentLayers,
                                        profit: totalTradeProfit,
                                        direction: 'SELL',
                                        drawdown: peakAdverseTrade
                                    });

                                    totalProfit += totalTradeProfit;
                                    tradeCount++;

                                    if (peakAdverseTrade > maxDrawdown) maxDrawdown = peakAdverseTrade;
                                    if (peakAdverseFromLastTrade > maxAdverseFromLast) maxAdverseFromLast = peakAdverseFromLastTrade;

                                    inTrade = false;
                                    currentLayers = 0;
                                    avgPrice = 0;
                                }
                            }
                        }

                        if (tradeCount > 2) { // Lower threshold for time-specific
                            const score = totalProfit / (maxDrawdown || 1);
                            const recommendedStopFromLast = Math.ceil(maxAdverseFromLast + 5);

                            timeResults.push({
                                initialEntry,
                                step,
                                maxLayers,
                                totalProfit,
                                maxDrawdown,
                                stopFromLastGrid: recommendedStopFromLast,
                                tradeCount,
                                score,
                                targetProfitTicks,
                                tradeHistory: tradeHistory
                            });
                        }
                    });
                });

                if (timeResults.length > 0) {
                    timeResults.sort((a, b) => b.score - a.score);
                    timeSpecificStrategy = timeResults[0];
                }
            }
        }
    }

    return {
        ...bestConfig,
        bestTimeWindow: bestWindow.label,
        bestTimeWindowDrawdown: bestWindow.drawdown || 0,
        worstDrawdownHour: worstDrawdownHour.hour,
        timeSpecificStrategy: timeSpecificStrategy // New: strategy optimized for recommended hour
    };
};
