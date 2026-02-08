import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine, ComposedChart, Area
} from 'recharts';
import { Upload, FileText, AlertCircle, Activity, BarChart2, TrendingUp, Clock, CheckCircle, Lightbulb, BookOpen } from 'lucide-react';
import { parseLogData, calculateSMA, calculateDistortions, generateStats, aggregateByTime } from '../utils/calculations';
import { FileUpload } from './FileUpload';

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

    const CustomTooltip = ({ active, payload, label }) => {
        // Strict safety checks to prevent crashes
        if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
            return null;
        }

        const dataPoint = payload[0].payload;

        // Ensure all required properties exist before rendering
        if (typeof dataPoint.distortion !== 'number' || typeof dataPoint.nextReturn !== 'number') {
            return null;
        }

        return (
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl text-xs max-w-xs z-50">
                <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-2">
                    {dataPoint.timestamp ? new Date(dataPoint.timestamp).toLocaleString() : 'Data desconhecida'}
                </p>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Distorção:</span>
                        <span className="font-mono text-indigo-400 font-bold">
                            {dataPoint.distortion.toFixed(2)} ticks
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Retorno:</span>
                        <span className={`font-mono font-bold ${dataPoint.nextReturn > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {dataPoint.nextReturn > 0 ? '+' : ''}{dataPoint.nextReturn.toFixed(2)} ticks
                        </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700">
                        <span className={`block text-center font-bold px-2 py-1 rounded ${dataPoint.status && dataPoint.status.includes('Reversão') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {dataPoint.status || 'Indefinido'}
                        </span>
                    </div>
                </div>
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
        </div>
    );
}
