
export const aggregateByTime = (data, selectedSMA) => {
    if (!data || data.length === 0) return [];

    const buckets = {};

    data.forEach(bar => {
        if (!bar.timestamp || bar[`dist${selectedSMA}`] === null) return;

        const date = new Date(bar.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes();
        const interval = minutes < 30 ? '00' : '30';
        const timeLabel = `${hours}:${interval}`;

        if (!buckets[timeLabel]) {
            buckets[timeLabel] = {
                time: timeLabel,
                distortions: [],
                count: 0
            };
        }

        buckets[timeLabel].distortions.push(Math.abs(bar[`dist${selectedSMA}`]));
        buckets[timeLabel].count++;
    });

    return Object.values(buckets)
        .map(bucket => {
            const sum = bucket.distortions.reduce((a, b) => a + b, 0);
            const avg = sum / bucket.count;
            const max = Math.max(...bucket.distortions);

            return {
                time: bucket.time,
                avgDistortion: avg,
                maxDistortion: max,
                count: bucket.count
            };
        })
        .sort((a, b) => a.time.localeCompare(b.time));
};
