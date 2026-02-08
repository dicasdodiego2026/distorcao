import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Area
} from 'recharts';
import { Upload, FileText, AlertCircle, Activity, BarChart2, TrendingUp, Clock, CheckCircle, Lightbulb, BookOpen, Target, Shield, Zap, Layers } from 'lucide-react';
import { parseLogData, calculateSMA, calculateDistortions, generateStats, aggregateByTime, findOptimalStrategy, calculateGridStrategy } from '../utils/calculations';
import { FileUpload } from './FileUpload';
import { TradeHistoryModal } from './TradeHistoryModal';

const InsightCard = ({ title, icon: Icon, children }) => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold text-sm uppercase tracking-wider">
            <Icon className="w-4 h-4" />
            <span>{title}</span>
        </div>
        <div className="text-slate-400 text-sm leading-relaxed">
            {children}
        </div>
    </div>
);

export function AnalysisDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSMA, setSelectedSMA] = useState(10); // 10, 25, 50
    const [showTradeHistory, setShowTradeHistory] = useState(false);

    const handleDataLoaded = (content) => {
        setLoading(true);
        setError(null);

        // Simulating heavy processing delay for better UX
        setTimeout(() => {
            try {
                console.log("Iniciando processamento...");
                const parsed = parseLogData(content);
                console.log(`Dados parseados: ${parsed.length} barras.`);

                if (!parsed || parsed.length === 0) {
                    throw new Error("Nenhum dado válido encontrado. Verifique se o arquivo está no formato correto (.json).");
                }

                const sma10 = calculateSMA(parsed, 10);
                const sma25 = calculateSMA(parsed, 25);
                const sma50 = calculateSMA(parsed, 50);
                const enriched = calculateDistortions(parsed, sma10, sma25, sma50);

                setData(enriched);
            } catch (e) {
                console.error("Erro no processamento:", e);
                setError(e.message || "Ocorreu um erro desconhecido ao processar os dados.");
                setData([]);
            } finally {
                setLoading(false);
            }
        }, 100);
    };

    const stats = useMemo(() => generateStats(data, selectedSMA), [data, selectedSMA]);

    // Intraday Distortion Data: Aggregated by 30-min buckets
    const intradayData = useMemo(() => {
        return aggregateByTime(data, selectedSMA);
    }, [data, selectedSMA]);

    // Strategy Optimization
    const strategies = useMemo(() => {
        return findOptimalStrategy(data, selectedSMA);
    }, [data, selectedSMA]);

    // Grid Strategy Optimization
    const gridStrategy = useMemo(() => {
        return calculateGridStrategy(data, selectedSMA);
    }, [data, selectedSMA]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length || !payload[0]) return null;

        const data = payload[0].payload;

        // 1. Intraday Seasonality Chart (has avgDistortion)
        if (data.avgDistortion !== undefined) {
            return (
                <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                    <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
                        {`Horário: ${data.time}`}
                    </p>
                    <div className="space-y-1">
                        <p className="text-slate-300">
                            Média: <strong className="text-indigo-400">{data.avgDistortion.toFixed(2)} ticks</strong>
                        </p>
                        <p className="text-slate-300">
                            Máxima: <strong className="text-rose-400">{data.maxDistortion.toFixed(2)} ticks</strong>
                        </p>
                        <p className="text-slate-400 text-[10px]">
                            Amostras: {data.count}
                        </p>
                    </div>
                </div>
            );
        }

        // 2. Histogram (has bucket)
        if (data.bucket !== undefined) {
            return (
                <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                    <p className="font-semibold text-slate-200 mb-1">{`Distorção: ${data.bucket} ticks`}</p>
                    <p className="text-emerald-400">{`Ocorrências: ${data.count}`}</p>
                </div>
            );
        }

        // 3. Price/Time Series Chart (has close or timestamp)
        return (
            <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
                    {data.timestamp ? new Date(data.timestamp).toLocaleString() : label}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        <span className="text-slate-300">
                            {entry.name}: <strong style={{ color: entry.color }}>{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</strong>
                        </span>
                    </div>
                ))}
            </div>
        );
    };



    return (
        <div className="bg-slate-950 min-h-screen text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 shadow-lg backdrop-blur-md bg-opacity-80">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-500/20 shadow-lg">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            Distorção Analytics
                        </h1>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>v1.2.0 • Dark Mode</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* Upload Section */}
                {!data.length && !loading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold text-white">Comece sua Análise</h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                Importe seus logs de negociação do NinjaTrader para descobrir padrões de distorção de preço.
                            </p>
                        </div>
                        <div className="w-full max-w-2xl">
                            <FileUpload onDataLoaded={handleDataLoaded} />
                        </div>
                        {error && (
                            <div className="mt-4 p-4 bg-rose-950/50 border border-rose-900/50 rounded-lg text-rose-200 flex items-center gap-3 max-w-2xl w-full animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-indigo-500 animate-pulse" />
                            </div>
                        </div>
                        <p className="text-slate-400 font-medium animate-pulse">Processando milhões de ticks...</p>
                    </div>
                )}

                {/* Dashboard Content */}
                {data.length > 0 && !loading && (
                    <div className="space-y-8 animate-in run-in duration-500">

                        {/* Controls & Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                            {/* SMA Selector Card */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl col-span-1 md:col-span-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 block">Período da SMA</label>
                                <div className="flex gap-2">
                                    {[10, 25, 50].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setSelectedSMA(val)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 border ${selectedSMA === val
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                }`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stat Cards */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Barras Analisadas</span>
                                    <div className="text-2xl font-bold text-white">{stats?.count || 0}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Distorção Média</span>
                                    <div className="text-2xl font-bold text-emerald-400">{stats?.avgAbs.toFixed(2)} ticks</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Máx. Positiva</span>
                                    <div className="text-2xl font-bold text-indigo-400">+{stats?.max.toFixed(2)} ticks</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Máx. Negativa</span>
                                    <div className="text-2xl font-bold text-rose-400">{stats?.min.toFixed(2)} ticks</div>
                                </div>
                            </div>
                            <InsightCard title="Como usar esses dados" icon={BookOpen}>
                                <p>
                                    <strong className="text-emerald-400">Distorção Média:</strong> Use este valor como base para seu <strong>Take Profit</strong>. Se a média é 10 ticks, buscar 20 ticks pode ser arriscado.
                                </p>
                                <p className="mt-2">
                                    <strong className="text-rose-400">Máximas:</strong> Indicam pontos extremos. Se o preço atingir a Máx. Positiva (+{stats?.max.toFixed(0)}), a probabilidade de um pullback (retorno) aumenta drasticamente.
                                </p>
                            </InsightCard>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Histogram */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <BarChart2 className="w-5 h-5 text-emerald-500" />
                                        Distribuição de Frequência
                                    </h3>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats?.histogram || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis
                                                dataKey="bucket"
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Ocorrências" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <InsightCard title="Setup de Exaustão" icon={Lightbulb}>
                                    A "cauda" do gráfico (barras pequenas nas pontas) mostra onde o preço raramente vai.
                                    <br />
                                    <strong>Estratégia:</strong> Coloque ordens de <em>Reversão</em> nas faixas de preço onde a barra é quase invisível. Isso indica que o preço "esticou demais" e tende a voltar para a média (centro).
                                </InsightCard>
                            </div>

                            {/* Scatter Plot */}
                            {/* Intraday Distortion Chart */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-indigo-500" />
                                        Sazonalidade Intraday (30 min)
                                    </h3>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={intradayData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                label={{ value: 'Distorção (Ticks)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Legend />
                                            <Bar name="Distorção Média" dataKey="avgDistortion" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Line type="monotone" name="Distorção Máxima" dataKey="maxDistortion" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                                            {stats && (
                                                <ReferenceLine y={stats.avgAbs} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Média Geral', fill: '#10b981', fontSize: 10 }} />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                <InsightCard title="Horários de Oportunidade" icon={Clock}>
                                    Identifique os horários onde a barra azul (média) é maior.
                                    <br />
                                    Nestes horários, o mercado tem <strong>maior volatilidade/elasticidade</strong>, sendo ideal para buscar alvos maiores. Se a barra for pequena, o mercado está "travado" (evite operar distorção longa).
                                </InsightCard>
                            </div>

                            {/* Time Series Chart (Full Width) */}
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl lg:col-span-2">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-cyan-500" />
                                        Preço vs SMA {selectedSMA}
                                    </h3>
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.slice(-200)}> {/* Show last 200 bars for performance */}
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis
                                                dataKey="timestamp"
                                                tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                domain={['auto', 'auto']}
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="close"
                                                stroke="#22d3ee"
                                                dot={false}
                                                strokeWidth={2}
                                                name="Preço Fechamento"
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey={`sma${selectedSMA}`}
                                                stroke="#a78bfa"
                                                dot={false}
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                name={`SMA ${selectedSMA}`}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <InsightCard title="Identificando Regimes de Mercado" icon={TrendingUp}>
                                    Observe a linha roxa (SMA).
                                    <br />
                                    Se ela estiver <strong>Plana</strong>, setups de Distorção funcionam melhor (compre baixo, venda alto).
                                    <br />
                                    Se ela estiver <strong>Inclinada</strong>, opere apenas a favor da inclinação (pullbacks).
                                </InsightCard>
                            </div>
                        </div>

                        {/* Strategy Recommendations */}
                        {strategies && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 border-l-4 border-indigo-500 pl-4">
                                    <Target className="w-6 h-6 text-indigo-400" />
                                    Melhores Estratégias Encontradas
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    Com base na análise histórica de reversão à média, estas são as configurações sugeridas para maximizar seus ganhos.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Conservative */}
                                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Shield className="w-24 h-24 text-emerald-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-bold uppercase tracking-wider text-sm">
                                                <Shield className="w-4 h-4" />
                                                Conservador
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-slate-500 text-xs uppercase font-bold">Gatilho de Entrada</span>
                                                    <p className="text-2xl font-bold text-white">Distorção {strategies.conservative.threshold} ticks</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-slate-500 text-xs uppercase font-bold">Take Profit</span>
                                                        <p className="text-lg font-bold text-emerald-400">{strategies.conservative.profit} ticks</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 text-xs uppercase font-bold">Stop Loss</span>
                                                        <p className="text-lg font-bold text-rose-400">{strategies.conservative.suggestedStop} ticks</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-slate-800">
                                                    <p className="text-xs text-slate-400">
                                                        Taxa de acerto estimada alta, mas ocorre com menor frequência ({strategies.conservative.count} oportunidades).
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Balanced */}
                                    <div className="bg-slate-800 border-2 border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-indigo-900/20 transform scale-105 z-10">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Target className="w-24 h-24 text-indigo-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold uppercase tracking-wider text-sm">
                                                <Target className="w-4 h-4" />
                                                Equilibrado (Recomendado)
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-slate-400 text-xs uppercase font-bold">Gatilho de Entrada</span>
                                                    <p className="text-3xl font-bold text-white">Distorção {strategies.balanced.threshold} ticks</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-slate-400 text-xs uppercase font-bold">Take Profit</span>
                                                        <p className="text-xl font-bold text-emerald-400">{strategies.balanced.profit} ticks</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 text-xs uppercase font-bold">Stop Loss</span>
                                                        <p className="text-xl font-bold text-rose-400">{strategies.balanced.suggestedStop} ticks</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-slate-700">
                                                    <p className="text-xs text-slate-300">
                                                        Melhor equilíbrio entre risco e retorno. Ocorreu {strategies.balanced.count} vezes no período analisado.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aggressive */}
                                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Zap className="w-24 h-24 text-amber-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4 text-amber-400 font-bold uppercase tracking-wider text-sm">
                                                <Zap className="w-4 h-4" />
                                                Agressivo
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-slate-500 text-xs uppercase font-bold">Gatilho de Entrada</span>
                                                    <p className="text-2xl font-bold text-white">Distorção {strategies.aggressive.threshold} ticks</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-slate-500 text-xs uppercase font-bold">Take Profit</span>
                                                        <p className="text-lg font-bold text-emerald-400">{strategies.aggressive.profit} ticks</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 text-xs uppercase font-bold">Stop Loss</span>
                                                        <p className="text-lg font-bold text-rose-400">{strategies.aggressive.suggestedStop} ticks</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-slate-800">
                                                    <p className="text-xs text-slate-400">
                                                        Alta frequência ({strategies.aggressive.count} trades), mas exige stop loss maior devido à volatilidade nessa faixa.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Grid Intelligente Recommendation */}
                        {gridStrategy && (
                            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/30 rounded-2xl p-8 relative overflow-hidden shadow-2xl backdrop-blur-sm">
                                <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
                                    <Layers className="w-96 h-96 text-white" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-600/20 p-3 rounded-xl border border-indigo-500/30">
                                                <Layers className="w-8 h-8 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-white tracking-tight">Estratégia Global (Dia Inteiro)</h3>
                                                <p className="text-slate-400 text-sm">Parâmetros otimizados usando todos os horários do dia.</p>
                                            </div>
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg text-emerald-400 text-sm font-semibold animate-pulse">
                                            Recomendado para Alta Volatilidade
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 block">1. Entrada Inicial</span>
                                            <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.initialEntry}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Inicie a operação contra a tendência quando a distorção tocar este valor.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 block">2. Passo do Grid</span>
                                            <div className="text-4xl font-black text-indigo-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.step}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Adicione novos lotes a cada {gridStrategy.step} ticks contra sua posição. Max: {gridStrategy.maxLayers} camadas.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-rose-500/10 hover:border-rose-500/30 transition-colors group">
                                            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-2 block group-hover:text-rose-200 transition-colors">Proteção (Stop)</span>
                                            <div className="text-4xl font-black text-rose-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.stopFromLastGrid}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Coloque o Stop Loss {gridStrategy.stopFromLastGrid} ticks abaixo da sua última compra/venda.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group">
                                            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 block group-hover:text-emerald-200 transition-colors">Potencial de Lucro</span>
                                            <div className="text-4xl font-black text-emerald-400 tracking-tight flex items-baseline gap-1">
                                                +{gridStrategy.totalProfit.toFixed(0)}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Resultado acumulado em {gridStrategy.tradeCount} operações simuladas.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5 text-sm text-slate-300 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-emerald-400" />
                                            <span><strong>Alvo Dinâmico:</strong> Saia no Preço Médio + 5 ticks de lucro.</span>
                                        </div>
                                        <div className="hidden sm:block text-slate-700">|</div>
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-rose-400" />
                                            <span><strong>Drawdown Máx:</strong> {gridStrategy.maxDrawdown.toFixed(0)} ticks (pior às {gridStrategy.worstDrawdownHour}).</span>
                                        </div>
                                        <div className="hidden sm:block text-slate-700">|</div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-amber-400" />
                                            <span><strong>Melhor Horário:</strong> {gridStrategy.bestTimeWindow} (DD: {gridStrategy.bestTimeWindowDrawdown.toFixed(0)} ticks)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Time-Specific Strategy */}
                        {gridStrategy && gridStrategy.timeSpecificStrategy && (
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 border border-amber-500/20 shadow-2xl mt-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-amber-500/10 rounded-xl">
                                        <Clock className="w-8 h-8 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Estratégia para {gridStrategy.bestTimeWindow}</h3>
                                        <p className="text-sm text-slate-400 mt-1">Parâmetros otimizados especificamente para este horário</p>
                                    </div>
                                </div>

                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
                                    <div className="flex items-start gap-2">
                                        <Lightbulb className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            <strong className="text-amber-400">Use esta configuração</strong> quando operar no horário recomendado.
                                            Os parâmetros foram otimizados usando apenas dados deste período específico.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-amber-500/10 hover:border-amber-500/30 transition-colors">
                                            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 block">1. Entrada</span>
                                            <div className="text-4xl font-black text-amber-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.timeSpecificStrategy.initialEntry}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Abra posição quando distorção atingir {gridStrategy.timeSpecificStrategy.initialEntry} ticks.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 block">2. Passo do Grid</span>
                                            <div className="text-4xl font-black text-indigo-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.timeSpecificStrategy.step}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                Adicione novos lotes a cada {gridStrategy.timeSpecificStrategy.step} ticks. Max: {gridStrategy.timeSpecificStrategy.maxLayers} camadas.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-rose-500/10 hover:border-rose-500/30 transition-colors group">
                                            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-2 block group-hover:text-rose-200 transition-colors">Proteção (Stop)</span>
                                            <div className="text-4xl font-black text-rose-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.timeSpecificStrategy.stopFromLastGrid}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                <strong className="text-rose-300">Do ÚLTIMO grid:</strong> Coloque stop {gridStrategy.timeSpecificStrategy.stopFromLastGrid} ticks abaixo da última adição.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 p-6 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group">
                                            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 block group-hover:text-emerald-200 transition-colors">Alvo (Take Profit)</span>
                                            <div className="text-4xl font-black text-emerald-400 tracking-tight flex items-baseline gap-1">
                                                {gridStrategy.timeSpecificStrategy.targetProfitTicks}
                                                <span className="text-lg text-slate-500 font-medium">ticks</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                <strong className="text-emerald-300">Do Preço Médio:</strong> Saia quando preço atingir média - {gridStrategy.timeSpecificStrategy.targetProfitTicks} ticks.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div
                                            className="bg-slate-950/30 p-4 rounded-lg border border-slate-700/30 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900/50 transition-all group"
                                            onClick={() => {
                                                console.log('Card clicked! Opening modal...');
                                                console.log('Trade history:', gridStrategy.timeSpecificStrategy.tradeHistory);
                                                setShowTradeHistory(true);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Lucro Simulado</span>
                                                <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">Clique para detalhes →</span>
                                            </div>
                                            <div className="text-2xl font-bold text-emerald-400">+{gridStrategy.timeSpecificStrategy.totalProfit.toFixed(0)} ticks</div>
                                            <p className="text-xs text-slate-500 mt-1">Em {gridStrategy.timeSpecificStrategy.tradeCount} operações neste horário</p>
                                        </div>

                                        <div className="bg-slate-950/30 p-4 rounded-lg border border-slate-700/30">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Shield className="w-4 h-4 text-rose-400" />
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Drawdown Máximo</span>
                                            </div>
                                            <div className="text-2xl font-bold text-rose-400">{gridStrategy.timeSpecificStrategy.maxDrawdown.toFixed(0)} ticks</div>
                                            <p className="text-xs text-slate-500 mt-1">Pior caso observado neste horário</p>
                                        </div>

                                        <div className="bg-slate-950/30 p-4 rounded-lg border border-slate-700/30">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Layers className="w-4 h-4 text-indigo-400" />
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Camadas Máximas</span>
                                            </div>
                                            <div className="text-2xl font-bold text-indigo-400">{gridStrategy.timeSpecificStrategy.maxLayers}</div>
                                            <p className="text-xs text-slate-500 mt-1">Número máximo de adições permitidas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* New File Button */}
                        <div className="flex justify-center pt-8 pb-12">
                            <button
                                onClick={() => setData([])}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800"
                            >
                                <Upload className="w-4 h-4" />
                                Carregar novo arquivo
                            </button>
                        </div>

                    </div>
                )}
            </main>

            {/* Trade History Modal */}
            {gridStrategy && gridStrategy.timeSpecificStrategy && gridStrategy.timeSpecificStrategy.tradeHistory && (
                <TradeHistoryModal
                    isOpen={showTradeHistory}
                    onClose={() => setShowTradeHistory(false)}
                    tradeHistory={gridStrategy.timeSpecificStrategy.tradeHistory}
                    timeWindow={gridStrategy.bestTimeWindow}
                />
            )}
        </div>
    );
}
