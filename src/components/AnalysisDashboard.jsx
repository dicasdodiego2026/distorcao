import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { FileUpload } from './FileUpload';
import { parseLogData, calculateSMA, calculateDistortions, generateStats } from '../utils/calculations';
import { AlertCircle, Activity, BarChart2, TrendingUp, Clock } from 'lucide-react';

export function AnalysisDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSMA, setSelectedSMA] = useState(10); // 10, 25, 50

    const handleDataLoaded = (content) => {
        setLoading(true);
        setError(null);

        // Use setTimeout to allow UI to render loading state
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

    const currentStats = useMemo(() => {
        if (!data.length) return null;
        return generateStats(data, selectedSMA);
    }, [data, selectedSMA]);

    const scatterData = useMemo(() => {
        if (!data.length) return [];
        return data.map((d, i) => {
            if (i >= data.length - 1) return null;
            const nextBar = data[i + 1];
            const distortion = d[`dist${selectedSMA}`];
            if (distortion === null) return null;
            const returnTicks = (nextBar.close - d.close) / d.tick_size;
            return {
                x: Number(distortion.toFixed(0)),
                y: Number(returnTicks.toFixed(0)),
                fill: distortion > 0 ? '#ef4444' : '#22c55e',
                timestamp: d.timestamp
            };
        }).filter(Boolean);
    }, [data, selectedSMA]);

    if (!data.length) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="max-w-3xl w-full space-y-8">
                    <div className="text-center space-y-2">
                        <div className="inline-block p-4 bg-blue-600 rounded-full shadow-lg mb-4">
                            <Activity className="w-12 h-12 text-white" />
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">
                            Análise de Distorção
                        </h1>
                        <p className="text-lg text-slate-500 max-w-lg mx-auto">
                            Carregue seus logs de negociação para visualizar distorções de média móvel e identificar padrões de reversão.
                        </p>
                    </div>

                    <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100 backdrop-blur-sm bg-opacity-90">
                        <FileUpload onDataLoaded={handleDataLoaded} />

                        {loading && (
                            <div className="mt-8 flex flex-col items-center animate-in fade-in duration-300">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-blue-600 font-medium bg-blue-50 px-4 py-1 rounded-full text-sm">Processando dados...</p>
                            </div>
                        )}

                        {error && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start space-x-3 shadow-sm animate-in slide-in-from-bottom-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold">Erro ao carregar dados</h3>
                                    <p className="text-sm mt-1 opacity-90">{error}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="text-center text-slate-400 text-sm">
                        Suporta múltiplos arquivos JSON concatenados.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 mb-4 md:mb-0">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Dashboard de Análise</h1>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-xl">
                        {[10, 25, 50].map(period => (
                            <button
                                key={period}
                                onClick={() => setSelectedSMA(period)}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${selectedSMA === period
                                        ? 'bg-white shadow-md text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                SMA {period}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Key Metrics */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 flex flex-col justify-center">
                        <h2 className="flex items-center text-lg font-semibold mb-6 text-slate-700">
                            <BarChart2 className="w-5 h-5 mr-2 text-blue-500" />
                            Métricas Gerais
                        </h2>
                        {currentStats && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-slate-500 text-sm">Dias Analisados</span>
                                    <span className="font-mono font-bold text-slate-800">{new Set(data.map(d => d.timestamp.toDateString())).size}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-slate-500 text-sm">Total Barras</span>
                                    <span className="font-mono font-bold text-slate-800">{currentStats.count}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                        <span className="block text-xs text-green-600 font-medium uppercase mb-1">Máx Positiva</span>
                                        <span className="block font-mono font-bold text-green-700 text-xl">+{currentStats.max.toFixed(0)}t</span>
                                    </div>
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                        <span className="block text-xs text-red-600 font-medium uppercase mb-1">Máx Negativa</span>
                                        <span className="block font-mono font-bold text-red-700 text-xl">{currentStats.min.toFixed(0)}t</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                                    <span className="text-blue-700 text-sm font-medium">Média Absoluta</span>
                                    <span className="font-mono font-bold text-blue-800">{currentStats.avgAbs.toFixed(1)} ticks</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Histogram */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 min-h-[300px]">
                        <h2 className="flex items-center text-lg font-semibold mb-4 text-slate-700">
                            <BarChart2 className="w-5 h-5 mr-2 text-slate-400" />
                            Distribuição de Frequência (Distorção em Ticks)
                        </h2>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={currentStats?.histogram || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="bucket" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Frequência" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Scatter Plot */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px]">
                    <h2 className="flex items-center text-lg font-semibold mb-2 text-slate-700">
                        <TrendingUp className="w-5 h-5 mr-2 text-slate-400" />
                        Correlação: Distorção vs Retorno Futuro
                    </h2>
                    <p className="text-sm text-slate-400 mb-4">
                        Identifique se distorções extremas (Eixo X) tendem a reverter na próxima barra (Eixo Y).
                    </p>
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid stroke="#e2e8f0" />
                            <XAxis type="number" dataKey="x" name="Distorção" unit="t" tick={{ fill: '#64748b' }} />
                            <YAxis type="number" dataKey="y" name="Retorno" unit="t" tick={{ fill: '#64748b' }} />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" />
                            <ReferenceLine x={0} stroke="#94a3b8" />
                            <Scatter name="Dados" data={scatterData} fill="#8884d8" shape="circle" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Time Series */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px]">
                    <h2 className="flex items-center text-lg font-semibold mb-4 text-slate-700">
                        <Clock className="w-5 h-5 mr-2 text-slate-400" />
                        Série Temporal (Últimas 200 Barras)
                    </h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.slice(-200)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                tick={{ fill: '#64748b', fontSize: 12 }}
                            />
                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Tooltip
                                labelFormatter={(t) => new Date(t).toLocaleString()}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line
                                type="monotone"
                                dataKey="close"
                                stroke="#64748b"
                                dot={false}
                                strokeWidth={2}
                                name="Preço"
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey={`sma${selectedSMA}`}
                                stroke="#3b82f6"
                                dot={false}
                                strokeWidth={2}
                                name={`SMA ${selectedSMA}`}
                                strokeDasharray="5 5"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
