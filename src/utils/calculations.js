
export const parseLogData = (fileContent) => {
    if (!fileContent) return [];

    // --- CSV/TSV Detection (e.g. MetaTrader RTY data) ---
    // Format: <DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>
    const trimmedRaw = fileContent.trim();
    if (trimmedRaw.startsWith('<DATE>') || trimmedRaw.startsWith('"<DATE>"')) {
        console.log('📊 Detected CSV/TSV format (MetaTrader)');
        return parseCSVData(trimmedRaw);
    }

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

/**
 * Parse CSV/TSV data from MetaTrader format (e.g. RTY futures)
 * Header: <DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>
 * Data:   2025.08.01\t00:00:00\t2219.6\t2220.0\t2219.2\t2219.3\t26\t26\t1
 */
const parseCSVData = (content) => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Detect separator: tab or semicolon
    const separator = lines[0].includes('\t') ? '\t' : ';';

    // Parse header to identify column positions
    const headerLine = lines[0];
    const headers = headerLine.split(separator).map(h => h.replace(/[<>"]/g, '').trim().toUpperCase());

    const dateIdx = headers.indexOf('DATE');
    const timeIdx = headers.indexOf('TIME');
    const openIdx = headers.indexOf('OPEN');
    const highIdx = headers.indexOf('HIGH');
    const lowIdx = headers.indexOf('LOW');
    const closeIdx = headers.indexOf('CLOSE');
    const volIdx = headers.indexOf('VOL') !== -1 ? headers.indexOf('VOL') : headers.indexOf('TICKVOL');

    if (dateIdx === -1 || closeIdx === -1) {
        console.warn('CSV header missing required columns (DATE, CLOSE)');
        return [];
    }

    const bars = [];

    for (let i = 1; i < lines.length; i++) {
        // Skip duplicate header lines from concatenated CSV files
        const trimmedLine = lines[i].trim();
        if (trimmedLine.startsWith('<DATE>') || trimmedLine.startsWith('"<DATE>"')) continue;

        const cols = lines[i].split(separator);
        if (cols.length < 6) continue;

        try {
            // Parse date: "2025.08.01" -> "2025-08-01"
            const dateStr = cols[dateIdx].trim().replace(/\./g, '-');
            const timeStr = timeIdx !== -1 ? cols[timeIdx].trim() : '00:00:00';
            const timestamp = new Date(`${dateStr}T${timeStr}`);

            if (isNaN(timestamp.getTime())) continue;

            bars.push({
                timestamp,
                open: Number(cols[openIdx]),
                high: Number(cols[highIdx]),
                low: Number(cols[lowIdx]),
                close: Number(cols[closeIdx]),
                volume: volIdx !== -1 ? Number(cols[volIdx]) : 0,
                tick_size: 0.1, // Defaulting to RTY 0.1 as per request for this parser
                direcao: undefined
            });
        } catch (e) {
            console.warn(`Failed to parse CSV line ${i}:`, e);
        }
    }

    console.log(`📊 Parsed ${bars.length} bars from CSV`);
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
    const maxDistortion = distortions.reduce((a, b) => Math.max(a, b), -Infinity);
    const minDistortion = distortions.reduce((a, b) => Math.min(a, b), Infinity);
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
        const max = dists.reduce((a, b) => Math.max(a, b), -Infinity);

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

    const maxVal = distortions.reduce((a, b) => Math.max(a, b), -Infinity);
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
        .map(d => ({ val: d[distKey], time: d.timestamp }));

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

    // Debug: Check distortion range
    const distValues = distortions.map(d => d.val);
    const minDist = distValues.reduce((a, b) => Math.min(a, b), Infinity);
    const maxDist = distValues.reduce((a, b) => Math.max(a, b), -Infinity);
    const negativeCount = distValues.filter(v => v < 0).length;
    const positiveCount = distValues.filter(v => v > 0).length;
    console.log(`📊 Distortion Analysis:`);
    console.log(`   Min: ${minDist.toFixed(1)} ticks | Max: ${maxDist.toFixed(1)} ticks`);
    console.log(`   Negative: ${negativeCount} (${(negativeCount / distValues.length * 100).toFixed(1)}%)`);
    console.log(`   Positive: ${positiveCount} (${(positiveCount / distValues.length * 100).toFixed(1)}%)`);
    console.log(`   Testing entries: ${entries.join(', ')} ticks`);

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
            let tradeDirection = null; // 'BUY' or 'SELL'

            for (let i = 0; i < distortions.length; i++) {
                const currentDist = distortions[i].val;

                // Ensure numeric types
                const distVal = Number(currentDist);
                const entryVal = Number(initialEntry);

                if (!inTrade) {
                    // DEBUG: Check why BUY is not triggering
                    if (distVal <= -20 && i % 100 === 0) { // Sample logs to avoid freezing
                        console.log(`[DEBUG] Potential BUY? Dist=${distVal}, EntryThreshold=${-entryVal}, Condition=${distVal <= -entryVal}`);
                    }

                    // Check for SELL entry (positive distortion)
                    if (distVal >= entryVal) {
                        inTrade = true;
                        tradeDirection = 'SELL';
                        currentLayers = 1;
                        avgPrice = entryVal;
                        peakAdverseTrade = 0;
                        peakAdverseFromLastTrade = 0;
                        tradeEntryTime = distortions[i].time;
                        tradeEntryPrice = entryVal;
                        // console.log(`SELL Entry: dist=${distVal}, entry=${entryVal}`);
                    }
                    // Check for BUY entry (negative distortion)
                    else if (distVal <= -entryVal) {
                        inTrade = true;
                        tradeDirection = 'BUY';
                        currentLayers = 1;
                        avgPrice = -entryVal;
                        peakAdverseTrade = 0;
                        peakAdverseFromLastTrade = 0;
                        tradeEntryTime = distortions[i].time;
                        tradeEntryPrice = -entryVal;
                        // console.log(`BUY Entry TRIGGERED: dist=${distVal}, entry=${-entryVal}, time=${distortions[i].time}`);
                    }
                } else {
                    // MANAGE TRADE
                    if (tradeDirection === 'SELL') {
                        // 1. Check for Additions (Grid)
                        const nextLevel = entryVal + (step * currentLayers);

                        if (currentLayers < maxLayers && distVal >= nextLevel) {
                            // ADD LAYER
                            currentLayers++;
                            avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                        }

                        // 2. Track Drawdown
                        const currentFloat = distVal - avgPrice;
                        if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                        // 3. Track Adverse from Last Grid
                        const currentAdverseFromLast = distVal - (entryVal + (step * (currentLayers - 1)));
                        if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                        // 4. Check for Exit
                        const targetExit = Math.max(0, avgPrice - targetProfitTicks);

                        if (distVal <= targetExit) {
                            // CLOSE TRADE (Conservative: Exit at Target)
                            const profitPerShare = avgPrice - targetExit;
                            const totalTradeProfit = profitPerShare * currentLayers;

                            tradeHistory.push({
                                entryTime: tradeEntryTime,
                                exitTime: distortions[i].time,
                                entryPrice: tradeEntryPrice,
                                exitPrice: targetExit, // Realized at Target
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
                    } else { // BUY
                        // 1. Check for Additions (Grid)
                        const nextLevel = -entryVal - (step * currentLayers);

                        if (currentLayers < maxLayers && distVal <= nextLevel) {
                            // ADD LAYER
                            currentLayers++;
                            avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                        }

                        // 2. Track Drawdown
                        const currentFloat = avgPrice - distVal;
                        if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                        // 3. Track Adverse from Last Grid
                        const currentAdverseFromLast = (-entryVal - (step * (currentLayers - 1))) - distVal;
                        if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                        // 4. Check for Exit
                        const targetExit = avgPrice + targetProfitTicks; // Exit is higher than avgPrice

                        if (distVal >= targetExit) {
                            // CLOSE TRADE (Conservative: Exit at Target)
                            const profitPerShare = targetExit - avgPrice;
                            const totalTradeProfit = profitPerShare * currentLayers;

                            tradeHistory.push({
                                entryTime: tradeEntryTime,
                                exitTime: distortions[i].time,
                                entryPrice: tradeEntryPrice,
                                exitPrice: targetExit, // Realized at Target
                                avgPrice: avgPrice,
                                layers: currentLayers,
                                profit: totalTradeProfit,
                                direction: 'BUY',
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
            }

            if (tradeCount > 5) {
                // Score = Profit / MaxDrawdown
                const score = totalProfit / (maxDrawdown || 1);

                // Recommended Stop: MaxAdverseFromLast + Buffer (e.g. 5 ticks)
                const recommendedStopFromLast = Math.ceil(maxAdverseFromLast + 5);

                // Count BUY vs SELL trades
                const buyCount = tradeHistory.filter(t => t.direction === 'BUY').length;
                const sellCount = tradeHistory.filter(t => t.direction === 'SELL').length;

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
                    tradeHistory: tradeHistory,
                    buyCount,
                    sellCount
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
                        let tradeDirection = null; // 'BUY' or 'SELL'

                        for (let i = 0; i < hourFilteredDistortions.length; i++) {
                            const currentDist = hourFilteredDistortions[i].val;
                            const distVal = Number(currentDist);
                            const entryVal = Number(initialEntry);

                            if (!inTrade) {
                                // Check for SELL entry (positive distortion)
                                if (distVal >= entryVal) {
                                    inTrade = true;
                                    tradeDirection = 'SELL';
                                    currentLayers = 1;
                                    avgPrice = entryVal;
                                    peakAdverseTrade = 0;
                                    peakAdverseFromLastTrade = 0;
                                    tradeEntryTime = hourFilteredDistortions[i].time;
                                    tradeEntryPrice = entryVal;
                                }
                                // Check for BUY entry (negative distortion)
                                else if (distVal <= -entryVal) {
                                    inTrade = true;
                                    tradeDirection = 'BUY';
                                    currentLayers = 1;
                                    avgPrice = -entryVal;
                                    peakAdverseTrade = 0;
                                    peakAdverseFromLastTrade = 0;
                                    tradeEntryTime = hourFilteredDistortions[i].time;
                                    tradeEntryPrice = -entryVal;
                                }
                            } else {
                                if (tradeDirection === 'SELL') {
                                    // 1. Check for Additions (Grid)
                                    const nextLevel = entryVal + (step * currentLayers);

                                    if (currentLayers < maxLayers && distVal >= nextLevel) {
                                        currentLayers++;
                                        avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                                    }

                                    // 2. Track Drawdown
                                    const currentFloat = distVal - avgPrice;
                                    if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                                    // 3. Track Adverse from Last Grid
                                    const currentAdverseFromLast = distVal - (entryVal + (step * (currentLayers - 1)));
                                    if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                                    // 4. Check for Exit
                                    const targetExit = Math.max(0, avgPrice - targetProfitTicks);

                                    if (distVal <= targetExit) {
                                        // Conservative: Exit at Target
                                        const profitPerShare = avgPrice - targetExit;
                                        const totalTradeProfit = profitPerShare * currentLayers;

                                        tradeHistory.push({
                                            entryTime: tradeEntryTime,
                                            exitTime: hourFilteredDistortions[i].time,
                                            entryPrice: tradeEntryPrice,
                                            exitPrice: targetExit,
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
                                } else { // BUY
                                    // 1. Check for Additions (Grid)
                                    const nextLevel = -entryVal - (step * currentLayers);

                                    if (currentLayers < maxLayers && distVal <= nextLevel) {
                                        currentLayers++;
                                        avgPrice = ((avgPrice * (currentLayers - 1)) + nextLevel) / currentLayers;
                                    }

                                    // 2. Track Drawdown
                                    const currentFloat = avgPrice - distVal;
                                    if (currentFloat > peakAdverseTrade) peakAdverseTrade = currentFloat;

                                    // 3. Track Adverse from Last Grid
                                    const currentAdverseFromLast = (-entryVal - (step * (currentLayers - 1))) - distVal;
                                    if (currentAdverseFromLast > peakAdverseFromLastTrade) peakAdverseFromLastTrade = currentAdverseFromLast;

                                    // 4. Check for Exit
                                    const targetExit = avgPrice + targetProfitTicks; // Exit higher than avg

                                    if (distVal >= targetExit) {
                                        // Conservative: Exit at Target
                                        const profitPerShare = targetExit - avgPrice;
                                        const totalTradeProfit = profitPerShare * currentLayers;

                                        tradeHistory.push({
                                            entryTime: tradeEntryTime,
                                            exitTime: hourFilteredDistortions[i].time,
                                            entryPrice: tradeEntryPrice,
                                            exitPrice: targetExit,
                                            avgPrice: avgPrice,
                                            layers: currentLayers,
                                            profit: totalTradeProfit,
                                            direction: 'BUY',
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

/**
 * Finds safe time intervals where distortion never exceeded the threshold
 * across ALL analyzed days.
 * 
 * @param {Array} data - The enriched bar data with distortions
 * @param {number} selectedSMA - The selected SMA period (10, 25, 50)
 * @param {number} maxDistortionThreshold - Max allowed distortion in ticks (default: 150)
 * @returns {Object} Safe interval info or null if not found
 */
// Re-export findSafeTimeInterval to match the new logic signature
export const findSafeTimeInterval = (data, selectedSMA, maxDistortionThreshold = 150, requireMeanReversion = false, meanReversionTolerance = 10) => {
    if (!data || data.length === 0) return { found: false, daysAnalyzed: 0, threshold: maxDistortionThreshold, tickSize: 0 };

    const distKey = `dist${selectedSMA}`;
    // Detect tick size from the first valid bar for display and validation
    const tickSize = data[0].tick_size || 0.5;

    // Step 1: Group data by date and by 10-minute interval
    const dateTimeMap = {}; // { date: { timeSlot: { max, min, count } } }
    const allDates = new Set();
    const allTimeSlots = new Set();

    data.forEach(bar => {
        const distortion = bar[distKey];
        if (distortion === null || distortion === undefined || !bar.timestamp) return;

        const date = new Date(bar.timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = Math.floor(date.getMinutes() / 10) * 10; // Round to 10-min intervals
        const timeSlot = `${hours}:${minutes.toString().padStart(2, '0')}`;

        allDates.add(dateStr);
        allTimeSlots.add(timeSlot);

        if (!dateTimeMap[dateStr]) dateTimeMap[dateStr] = {};
        if (!dateTimeMap[dateStr][timeSlot]) {
            dateTimeMap[dateStr][timeSlot] = {
                maxPositive: -Infinity, // Tracks highest distortion
                maxNegative: Infinity,  // Tracks lowest distortion (negative)
                sum: 0,
                count: 0
            };
        }

        // Validate strictly using Math.round to avoid float artifacts
        const roundedDistortion = Math.round(distortion * 10) / 10;

        const slot = dateTimeMap[dateStr][timeSlot];
        slot.maxPositive = Math.max(slot.maxPositive, roundedDistortion);
        slot.maxNegative = Math.min(slot.maxNegative, roundedDistortion);
        slot.sum += Math.abs(roundedDistortion);
        slot.count++;
    });

    const daysAnalyzed = allDates.size;
    if (daysAnalyzed === 0) return { found: false, daysAnalyzed: 0, threshold: maxDistortionThreshold, tickSize };

    // Step 2: For each time slot, check if ALL days respected the threshold
    const sortedTimeSlots = Array.from(allTimeSlots).sort();
    const safeSlots = [];

    sortedTimeSlots.forEach(timeSlot => {
        let isValidAcrossAllDays = true;
        let maxObservedInThisSlot = 0;
        let totalSum = 0;
        let totalCount = 0;
        let daysWithData = 0;

        allDates.forEach(dateStr => {
            const slotData = dateTimeMap[dateStr]?.[timeSlot];
            if (!slotData) return; // No data for this slot on this day

            daysWithData++;

            // Strict validation: Absolute distortion must NOT exceed threshold
            if (slotData.maxPositive > maxDistortionThreshold || Math.abs(slotData.maxNegative) > maxDistortionThreshold) {
                isValidAcrossAllDays = false;
            }

            const dailyMax = Math.max(Math.abs(slotData.maxPositive), Math.abs(slotData.maxNegative));
            maxObservedInThisSlot = Math.max(maxObservedInThisSlot, dailyMax);

            totalSum += slotData.sum;
            totalCount += slotData.count;
        });

        // Only consider slots that have data for at least 50% of days
        if (isValidAcrossAllDays && daysWithData >= Math.ceil(daysAnalyzed * 0.5)) {
            safeSlots.push({
                timeSlot,
                maxDistortion: maxObservedInThisSlot,
                avgDistortion: totalCount > 0 ? totalSum / totalCount : 0
            });
        }
    });

    // Step 3: Find the longest contiguous interval
    if (safeSlots.length === 0) return { found: false, daysAnalyzed, threshold: maxDistortionThreshold, tickSize };

    // Helper: Verify Mean Reversion for a candidate sequence (interval)
    const checkMeanReversion = (sequence) => {
        if (!requireMeanReversion) return true;

        // Check if across all days, the price effectively returns to the mean region within this interval
        // Logic: For each day, look at the combined maxPositive and maxNegative across all slots in the sequence.
        // If (GlobalMin > tolerance) OR (GlobalMax < -tolerance), it means price stayed away from mean all time.

        for (const dateStr of allDates) {
            let dayGlobalMax = -Infinity;
            let dayGlobalMin = Infinity;
            let hasDataForAnySlot = false;

            for (const slot of sequence) {
                const slotData = dateTimeMap[dateStr]?.[slot.timeSlot];
                if (slotData) {
                    hasDataForAnySlot = true;
                    dayGlobalMax = Math.max(dayGlobalMax, slotData.maxPositive);
                    dayGlobalMin = Math.min(dayGlobalMin, slotData.maxNegative);
                }
            }

            if (!hasDataForAnySlot) continue; // Skip day if no data in interval

            // Check if day strictly stayed above tolerance
            if (dayGlobalMin > meanReversionTolerance) return false;

            // Check if day strictly stayed below -tolerance
            if (dayGlobalMax < -meanReversionTolerance) return false;
        }

        return true;
    };


    let maxSequence = [];
    let currentSequence = [];

    const isNextSlot = (prev, curr) => {
        const [h1, m1] = prev.split(':').map(Number);
        const [h2, m2] = curr.split(':').map(Number);
        const t1 = h1 * 60 + m1;
        const t2 = h2 * 60 + m2;
        return t2 - t1 === 10;
    };

    // Modified algorithm: We need to find the longest sequence that satisfies BOTH continuity AND Mean Reversion.
    // Since Mean Reversion depends on the *entire* interval, we can't just greedily extend. 
    // However, if a sub-sequence fails mean reversion, a super-sequence *might* pass (if it includes the reversion point later). 
    // BUT usually if it stays away for 10 mins, it's bad.
    // Let's assume we want the longest Safe sequence, then validate it. If fails, try shorter?
    // Optimization: Just finding longest contiguous "Safe Slots" first (as calculated above) is not enough because the Mean Reversion check is a global constraint on the interval.
    // But since `safeSlots` are just candidates based on `maxDistortion`, we can iterate all contiguous chunks and check them.

    // Group safeSlots into contiguous chunks
    const chunks = [];
    if (safeSlots.length > 0) {
        let currentChunk = [safeSlots[0]];
        for (let i = 1; i < safeSlots.length; i++) {
            if (isNextSlot(currentChunk[currentChunk.length - 1].timeSlot, safeSlots[i].timeSlot)) {
                currentChunk.push(safeSlots[i]);
            } else {
                chunks.push(currentChunk);
                currentChunk = [safeSlots[i]];
            }
        }
        chunks.push(currentChunk);
    }

    // Filter chunks by Mean Reversion
    // If a chunk fails, we might technically be able to find a sub-chunk that passes, but simpler to just validate full chunks first. 
    // Wait, if 10:00-11:00 fails (trend), maybe 10:00-10:30 passes (reversion happened quickly) - Unlikely if check is "stayed away".
    // Actually, if it stayed away for 1 hour, it stayed away for 30 mins too.
    // So if full chunk fails, sub-chunks likely fail too unless the "bad part" is at the edges.
    // Let's just validate the longest chunks. Ideally, we return the longest VALID chunk.

    for (const chunk of chunks) {
        if (checkMeanReversion(chunk)) {
            if (chunk.length > maxSequence.length) {
                maxSequence = chunk;
            }
        } else {
            // Fallback: This chunk is safe by Threshold, but fails Mean Reversion (Trended without return).
            // We could try to split it? Too complex for now. User wants to AVOID these.
            // So simply discarding is correct behavior (it's not safe).
        }
    }

    if (maxSequence.length === 0) return { found: false, daysAnalyzed, threshold: maxDistortionThreshold, tickSize };

    // Aggregate stats for the best interval
    const startTime = maxSequence[0].timeSlot;
    const lastSlot = maxSequence[maxSequence.length - 1].timeSlot;
    const [h, m] = lastSlot.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(h, m + 10, 0, 0);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const maxDistortionObserved = Math.max(...maxSequence.map(s => s.maxDistortion));
    const avgDistortion = maxSequence.reduce((sum, s) => sum + s.avgDistortion, 0) / maxSequence.length;

    return {
        found: true,
        startTime,
        endTime,
        durationMinutes: maxSequence.length * 10,
        maxDistortionObserved: Math.round(maxDistortionObserved * 10) / 10,
        avgDistortion: Math.round(avgDistortion * 10) / 10,
        daysAnalyzed,
        threshold: maxDistortionThreshold,
        tickSize
    };
};
