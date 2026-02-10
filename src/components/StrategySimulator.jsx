import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import { Play, Settings, TrendingUp, AlertTriangle, DollarSign, Activity, RefreshCw } from 'lucide-react';
import { simulateBacktest } from '../utils/simulation';

export function StrategySimulator({ data, selectedSMA, strategyToLoad, timezoneOffset }) {
    // Config State
    const [config, setConfig] = useState({
        smaPeriod: selectedSMA || 25,
        entryTicks: 20,
        stepTicks: 10,
        maxLayers: 3,
        targetTicks: 5,
        startTime: '09:00',
        endTime: '16:00',
        requireTouchAndGo: true,
        multiplier: 1.0
    });

    // Load external strategy configuration (from Auto-Optimizer)
    useEffect(() => {
        if (strategyToLoad) {
            setConfig(prev => ({
                ...prev,
                ...strategyToLoad
            }));
        }
    }, [strategyToLoad]);

    const [results, setResults] = useState(null);

    // Run Simulation
    const handleSimulate = () => {
        if (!data || data.length === 0) return;
        const simResults = simulateBacktest(data, {
            ...config,
            smaPeriod: selectedSMA,
            timezoneOffset // Pass timezone shift
        });
        setResults(simResults);
    };

    // Calculate chart data from results
    const equityData = useMemo(() => {
        if (!results || !results.trades) return [];
        let runningBalance = 0;
        return results.trades.map((t, index) => {
            runningBalance += t.profit;
            return {
                i: index + 1,
                balance: runningBalance,
                drawdown: -t.maxDrawdown, // Invert for visualization
                date: new Date(t.exitTime).toLocaleDateString()
            };
        });
    }, [results]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">Simulador de Estratégia (Backtest)</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                {/* Configuration Panel */}
                <div className="lg:col-span-3 bg-slate-900/50 p-5 rounded-xl border border-slate-800 h-fit space-y-5">

                    <div className="space-y-3">
                        <h3 className="text-sm text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                            <Settings className="w-3 h-3" /> Entrada
                        </h3>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Distorção (Ticks)</label>
                            <input
                                type="number"
                                value={config.entryTicks}
                                onChange={(e) => setConfig({ ...config, entryTicks: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Início</label>
                                <input
                                    type="time"
                                    value={config.startTime}
                                    onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Fim</label>
                                <input
                                    type="time"
                                    value={config.endTime}
                                    onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-4 space-y-3">
                        <h3 className="text-sm text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" /> Grid & Alvo
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Passo (Ticks)</label>
                                <input
                                    type="number"
                                    value={config.stepTicks}
                                    onChange={(e) => setConfig({ ...config, stepTicks: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Max Camadas</label>
                                <input
                                    type="number"
                                    value={config.maxLayers}
                                    onChange={(e) => setConfig({ ...config, maxLayers: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Multiplicador (Martingale)</label>
                            <select
                                value={config.multiplier}
                                onChange={(e) => setConfig({ ...config, multiplier: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                            >
                                <option value="1">1.0x (Fixed)</option>
                                <option value="1.5">1.5x</option>
                                <option value="2">2.0x</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Alvo (Ticks sobre Médio)</label>
                            <input
                                type="number"
                                value={config.targetTicks}
                                onChange={(e) => setConfig({ ...config, targetTicks: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white font-bold"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-500 font-semibold">Reset na Média</label>
                            <input
                                type="checkbox"
                                checked={config.requireTouchAndGo}
                                onChange={(e) => setConfig({ ...config, requireTouchAndGo: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                        <p className="text-[10px] text-slate-600">
                            Se ativo, só entra em nova operação após o preço tocar na média (evita entrar contra tendência forte consecutivamente).
                        </p>
                    </div>

                    <button
                        onClick={handleSimulate}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4" /> Simular Agora
                    </button>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-9 space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-500 uppercase">Resultado Total</div>
                            <div className={`text-2xl font-bold ${results?.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {results ? results.totalProfit.toFixed(1) : '-'} <span className="text-sm">ticks</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-500 uppercase">Total Trades</div>
                            <div className="text-2xl font-bold text-white">
                                {results ? results.totalTrades : '-'}
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-500 uppercase">Taxa de Acerto</div>
                            <div className="text-2xl font-bold text-indigo-400">
                                {results ? `${(results.winRate * 100).toFixed(1)}%` : '-'}
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-500 uppercase">Max Drawdown</div>
                            <div className="text-2xl font-bold text-rose-400">
                                {results ? results.maxDrawdown.toFixed(1) : '-'} <span className="text-sm">ticks</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
                        {/* Equity Curve */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl flex flex-col">
                            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Curva de Patrimônio (Ticks)
                            </h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={equityData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="i" hide />
                                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                            labelFormatter={(l) => `Trade #${l}`}
                                        />
                                        <Line type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Drawdown Chart */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl flex flex-col">
                            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Drawdown por Trade
                            </h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={equityData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="i" hide />
                                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                            cursor={{ fill: '#334155', opacity: 0.2 }}
                                        />
                                        <Bar dataKey="drawdown" fill="#f43f5e" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
