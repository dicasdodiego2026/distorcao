
export const parseLogData = (fileContent) => {
    const bars = [];
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < fileContent.length; i++) {
        const char = fileContent[i];

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
                const jsonStr = fileContent.substring(startIndex, i + 1);
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.barra) {
                        bars.push({
                            timestamp: new Date(data.timestamp_barra),
                            open: data.barra.open,
                            high: data.barra.high,
                            low: data.barra.low,
                            close: data.barra.close,
                            volume: data.barra.volume,
                            tick_size: data.barra.tick_size,
                            direcao: data.barra.direcao
                        });
                    }
                } catch (e) {
                    console.warn("Failed to parse JSON chunk", e);
                }
                startIndex = -1;
            }
        }
    }

    return bars.sort((a, b) => a.timestamp - b.timestamp);
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
            // Per user request:
            // If Close > SMA (Price above average) -> Distortion based on High
            // If Close < SMA (Price below average) -> Distortion based on Low

            // Let's use signed distortion:
            // Positive = Price Above SMA (High - SMA)
            // Negative = Price Below SMA (Low - SMA)

            // Wait, standard reversion trade logic: if price is very HIGH above SMA, getting ready to short. 
            // So dist is positive. If price is very LOW below SMA, getting ready to buy. Dist is negative.

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
    // Filter valid data
    const validData = data.filter(d => d[`dist${selectedSMA}`] !== null);

    if (validData.length === 0) return null;

    const distortions = validData.map(d => d[`dist${selectedSMA}`]);
    const maxDistortion = Math.max(...distortions);
    const minDistortion = Math.min(...distortions);
    const avgDistortion = distortions.reduce((a, b) => a + Math.abs(b), 0) / distortions.length; // Mean Absolute Deviation

    // Histogram
    const histogram = {};
    distortions.forEach(d => {
        const bucket = Math.floor(d / 5) * 5; // Bucket size 5 ticks
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
