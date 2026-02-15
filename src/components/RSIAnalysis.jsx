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

    // --- Analytical Metrics Calculation ---
    const analyticalMetrics = useMemo(() => {
        const totalSignals = trades.length;
        if (totalSignals === 0) return null;

        const targetHit = trades.filter(t => t.mfeTicks >= 20);
        const zeroDrawdown = trades.filter(t => t.maeTicks === 0);
        const minDrawdown = trades.filter(t => t.maeTicks <= 2);

        // Best Time Window Analysis (30 min buckets)
        const timeBuckets = {};
        trades.forEach(t => {
            if (t.mfeTicks < 20) return; // Consider only WINNING trades for "Best Window" to filter out noise, or all? 
            // User said "melhor intervalo... com menor recuo antes de atingir os 20 ticks". 
            // Matches implies we check trades that DID hit 20 ticks.

            let date = t.signalTime instanceof Date ? t.signalTime : new Date(t.signalTime);
            const hour = date.getHours();
            const minute = date.getMinutes();
            // Bucket: 09:00, 09:30, 10:00...
            const bucketStartMinute = minute < 30 ? 0 : 30;
            const label = `${String(hour).padStart(2, '0')}:${String(bucketStartMinute).padStart(2, '0')} - ${String(hour).padStart(2, '0')}:${String(bucketStartMinute + 29).padStart(2, '0')}`;

            if (!timeBuckets[label]) timeBuckets[label] = { totalMae: 0, count: 0, positions: [] };
            timeBuckets[label].totalMae += t.maeTicks;
            timeBuckets[label].count++;
            timeBuckets[label].positions.push(t.maeTicks);
        });

        let bestWindow = { label: 'N/A', avgMae: 999, count: 0 };
        Object.entries(timeBuckets).forEach(([label, stats]) => {
            const avg = stats.totalMae / stats.count;
            if (stats.count >= 5 && avg < bestWindow.avgMae) { // Min 5 trades to be significant
                bestWindow = { label, avgMae: avg, count: stats.count };
            }
        });
        // Fallback if no window has 5 trades
        if (bestWindow.label === 'N/A' && Object.keys(timeBuckets).length > 0) {
            Object.entries(timeBuckets).forEach(([label, stats]) => {
                const avg = stats.totalMae / stats.count;
                if (avg < bestWindow.avgMae) {
                    bestWindow = { label, avgMae: avg, count: stats.count };
                }
            });
        }

        return {
            total: totalSignals,
            targetHit: { count: targetHit.length, perc: (targetHit.length / totalSignals * 100).toFixed(2) },
            zeroDrawdown: { count: zeroDrawdown.length, perc: (zeroDrawdown.length / totalSignals * 100).toFixed(2) },
            minDrawdown: { count: minDrawdown.length, perc: (minDrawdown.length / totalSignals * 100).toFixed(2) },
            bestWindow
        };
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
                                interval={1}
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
            </div>

            {/* Analytical Summary Table */}
            {analyticalMetrics && (
                <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
                    <div className="pb-4">
                        <h3 className="font-bold text-lg text-slate-800">Resultados Gerais</h3>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-semibold">
                                <tr>
                                    <th className="px-6 py-4 border-b">Métrica</th>
                                    <th className="px-6 py-4 border-b">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">Total de Sinais Identificados</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{analyticalMetrics.total}</td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">Sinais que atingiram o alvo (eventualmente)</td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-green-600">{analyticalMetrics.targetHit.count}</span>
                                        <span className="text-slate-500 ml-2">({analyticalMetrics.targetHit.perc}%)</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">Sinais com ZERO retorno (0 ticks drawdown)</td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-emerald-600">{analyticalMetrics.zeroDrawdown.count}</span>
                                        <span className="text-slate-500 ml-2">({analyticalMetrics.zeroDrawdown.perc}%)</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">Sinais com retorno MÍNIMO (&lt;= 2 ticks)</td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-indigo-600">{analyticalMetrics.minDrawdown.count}</span>
                                        <span className="text-slate-500 ml-2">({analyticalMetrics.minDrawdown.perc}%)</span>
                                    </td>
                                </tr>
                                <tr className="bg-indigo-50/50 hover:bg-indigo-50">
                                    <td className="px-6 py-4 font-medium text-indigo-900">Melhor Intervalo (Menor Recuo)</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-indigo-700">{analyticalMetrics.bestWindow.label}</span>
                                            <span className="text-xs text-indigo-600">
                                                Média de {analyticalMetrics.bestWindow.avgMae.toFixed(1)} ticks de recuo
                                                (baseado em {analyticalMetrics.bestWindow.count} trades vencedores)
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RSIAnalysis;
