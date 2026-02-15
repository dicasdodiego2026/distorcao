import React, { useMemo } from 'react';
import { analyzeRSITrades } from '../utils/indicators';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const RSIAnalysis = ({ data, filename }) => {
    if (!data || data.length === 0) return <div>No data for RSI analysis</div>;

    // Detect Tick Size
    const tickSize = useMemo(() => {
        const name = (filename || '').toUpperCase();
        if (name.includes('MES') || name.includes('ES')) return 0.25;
        if (name.includes('RTY')) return 0.1;

        // Fallback: Check price level
        const firstPrice = data[0]?.close || 0;
        if (firstPrice > 4000) return 0.25;
        return 0.1;
    }, [filename, data]);

    const analysis = useMemo(() => analyzeRSITrades(data, tickSize), [data, tickSize]);
    const { trades, summary } = analysis;

    // Helper to format timestamps safely
    const formatTime = (dateObj) => {
        if (!dateObj) return '';
        if (typeof dateObj === 'string') return dateObj; // Should not happen with fix
        if (dateObj instanceof Date) {
            return dateObj.toLocaleString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit'
            });
        }
        return String(dateObj);
    };

    // Prepare Scatter Plot Data (MAE vs Time)
    const scatterData = useMemo(() => {
        return trades.map(t => {
            let date;
            if (t.signalTime instanceof Date) date = t.signalTime;
            else {
                // Fallback if string, though we fixed this
                date = new Date(t.signalTime);
            }

            const minutes = date.getHours() * 60 + date.getMinutes();
            const timeLabel = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return {
                x: minutes,
                y: t.maeTicks,
                timeLabel,
                signal: t.signal,
                fullDate: formatTime(date),
                rsi: t.rsi
            };
        });
    }, [trades]);

    // X-Axis Ticks (Every 30 mins)
    const xAxisTicks = useMemo(() => {
        const ticks = [];
        for (let i = 0; i <= 1440; i += 30) {
            ticks.push(i);
        }
        return ticks;
    }, []);

    const formatXAxis = (tickItem) => {
        const hours = Math.floor(tickItem / 60);
        const minutes = tickItem % 60;
        // Show label every hour to check overcrowding?
        // User asked for 30 min space. We can show all or filter.
        // Let's return formatted string
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs z-50 text-white">
                <p className="font-bold mb-1">{data.fullDate}</p>
                <div className="flex justify-between gap-4 mb-1">
                    <span>Sinal:</span>
                    <span className={`font-bold ${data.signal === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                        {data.signal}
                    </span>
                </div>
                <div className="flex justify-between gap-4 mb-1">
                    <span>RSI:</span>
                    <span>{data.rsi}</span>
                </div>
                <div className="border-t border-slate-600 my-1 pt-1">
                    <span className="block mb-1">Drawdown Máximo:</span>
                    <span className="text-xl font-bold text-red-400">-{data.y} ticks</span>
                </div>
            </div>
        );
    };

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
                        <h3 className="text-sm font-medium text-slate-500">Tick Size / Asset</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{tickSize}</div>
                        <p className="text-xs text-slate-400">
                            {tickSize === 0.25 ? 'Likely MES/ES' : 'Likely RTY'}
                        </p>
                    </div>
                </div>
            </div>

            {/* RSI Drawdown Scatter Chart */}
            <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                <div className="pb-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">
                        Dispersão de Drawdown por Horário (RSI Cross)
                    </h3>
                    <span className="text-xs text-slate-500">MAE Ticks vs Hora do Dia</span>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Horário"
                                domain={[0, 1440]}
                                ticks={xAxisTicks}
                                tickFormatter={formatXAxis}
                                stroke="#64748b"
                                fontSize={10}
                                tickLine={true}
                                axisLine={{ stroke: '#cbd5e1' }}
                                interval={1} // Try to show more labels, maybe every hour (interval 1 mean skip 1?) No in Recharts interval is index based or 'preserveStartEnd'
                                // If we pass ticks array, Recharts usually respects it.
                                // With 48 ticks (30 min), might be crowded. Let's rely on Recharts auto-hide if needed or rotate.
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Drawdown Ticks"
                                domain={[0, 500]}
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={{ stroke: '#cbd5e1' }}
                                label={{ value: 'Max Drawdown (Ticks)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} />
                            <Scatter name="Drawdowns" data={scatterData} shape="circle">
                                {scatterData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.signal === 'BUY' ? '#ef4444' : '#f97316'} fillOpacity={0.6} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 text-xs text-center text-slate-500">
                    Pontos representam o prejuízo máximo (em ticks) de cada trade iniciado neste horário.
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
                                    <td className="px-4 py-3 text-slate-600">{formatTime(trade.signalTime)}</td>
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
