
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
