import React, { useMemo } from 'react';
import { analyzeRSITrades } from '../utils/indicators';

const RSIAnalysis = ({ data, filename }) => {
    if (!data || data.length === 0) return <div>No data for RSI analysis</div>;

    // Detect Tick Size based on filename or data
    const tickSize = filename.toUpperCase().includes('MES') ? 0.25 : 0.1;

    const analysis = useMemo(() => analyzeRSITrades(data, tickSize), [data, tickSize]);
    const { trades, summary } = analysis;

    // Aggregate by Hour
    const hourlyStats = useMemo(() => {
        const buckets = {};
        trades.forEach(trade => {
            const hour = trade.signalTime.split(' ')[1].split(':')[0];
            if (!buckets[hour]) buckets[hour] = { total: 0, wins: 0, totalMae: 0, count: 0 };

            buckets[hour].count++;
            // Define "Win" as reaching 20 ticks (just for stats)
            if (trade.mfeTicks >= 20) buckets[hour].wins++;
            buckets[hour].totalMae += trade.maeTicks;
        });

        return Object.entries(buckets).map(([hour, stats]) => ({
            hour,
            winRate: (stats.wins / stats.count) * 100,
            avgMae: (stats.totalMae / stats.count).toFixed(1),
            count: stats.count
        })).sort((a, b) => a.hour.localeCompare(b.hour));
    }, [trades]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Summary Cards */}
                <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                    <div className="pb-2">
                        <h3 className="text-sm font-medium text-slate-500">Total RSI Signals</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{summary.totalTrades}</div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                    <div className="pb-2">
                        <h3 className="text-sm font-medium text-slate-500">Avg MFE (Ticks)</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-green-600">+{summary.avgMfe}</div>
                        <p className="text-xs text-slate-400">Max Favorable Excursion</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                    <div className="pb-2">
                        <h3 className="text-sm font-medium text-slate-500">Avg MAE (Ticks)</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-red-600">-{summary.avgMae}</div>
                        <p className="text-xs text-slate-400">Max Adverse Excursion</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                    <div className="pb-2">
                        <h3 className="text-sm font-medium text-slate-500">Tick Size</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{tickSize}</div>
                        <p className="text-xs text-slate-400">{filename}</p>
                    </div>
                </div>
            </div>

            {/* Hourly Performance Chart */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="pb-4">
                    <h3 className="font-bold text-lg text-slate-800">Hourly Performance (Target 20 Ticks)</h3>
                </div>
                <div className="h-64 w-full flex items-end gap-1">
                    {hourlyStats.map(stat => (
                        <div key={stat.hour} className="flex-1 flex flex-col items-center group relative">
                            <div
                                className={`w-full rounded-t ${stat.winRate > 50 ? 'bg-green-500' : 'bg-red-400'}`}
                                style={{ height: `${stat.winRate}%` }}
                            />
                            <span className="text-xs mt-1 text-slate-600">{stat.hour}</span>
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs p-2 rounded z-10 w-32 shadow-lg">
                                Win Rate: {stat.winRate.toFixed(1)}%<br />
                                Trades: {stat.count}<br />
                                Avg MAE: {stat.avgMae}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trade Log Table */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="pb-4">
                    <h3 className="font-bold text-lg text-slate-800">Trade Log</h3>
                </div>
                <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0">
                            <tr>
                                <th className="px-4 py-3 border-b">Signal Time</th>
                                <th className="px-4 py-3 border-b">Type</th>
                                <th className="px-4 py-3 border-b">RSI</th>
                                <th className="px-4 py-3 border-b">Entry</th>
                                <th className="px-4 py-3 border-b">Max Gain</th>
                                <th className="px-4 py-3 border-b">Max Drawdown</th>
                                <th className="px-4 py-3 border-b">Status (20 Ticks)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {trades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-slate-600">{trade.signalTime}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${trade.signal === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {trade.signal}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{trade.rsi}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{trade.entryPrice}</td>
                                    <td className="px-4 py-3 text-green-600 font-medium">+{trade.mfeTicks} tk</td>
                                    <td className="px-4 py-3 text-red-600 font-medium">-{trade.maeTicks} tk</td>
                                    <td className="px-4 py-3">
                                        {trade.mfeTicks >= 20 ?
                                            (trade.maeTicks === 0 ?
                                                <span className="text-emerald-600 font-bold text-xs">✅ PERFECT</span> :
                                                <span className="text-green-600 font-bold text-xs">✅ WIN</span>
                                            ) :
                                            <span className="text-red-500 font-bold text-xs">❌ FAIL</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RSIAnalysis;
