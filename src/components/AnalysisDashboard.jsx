import React, { useState, useMemo } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity, Upload, AlertCircle, Clock } from 'lucide-react';
import { parseLogData, calculateSMA, calculateDistortions, generateScatterData, generateRangeScatterData } from '../utils/calculations';
import { FileUpload } from './FileUpload';


export function AnalysisDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedSMA, setSelectedSMA] = useState(25);
    const [timezoneOffset, setTimezoneOffset] = useState(0);

    const handleDataLoaded = async (content) => { // Changed back to content to match FileUpload
        setLoading(true);
        setError(null);

        try {
            // Simulate processing delay for UX
            await new Promise(resolve => setTimeout(resolve, 800));

            console.log("Iniciando processamento...");
            const parsed = parseLogData(content);
            console.log(`Dados parseados: ${parsed.length} barras.`);

            if (!parsed || parsed.length === 0) {
                throw new Error("Nenhum dado válido encontrado. Verifique se o arquivo está no formato correto (.json).");
            }

            // Calculate ALL SMAs (10, 25, 50) so switching works instantly without reprocessing
            const sma10 = calculateSMA(parsed, 10);
            const sma25 = calculateSMA(parsed, 25);
            const sma50 = calculateSMA(parsed, 50);

            const enrichedData = calculateDistortions(parsed, sma10, sma25, sma50);

            setData(enrichedData);
            setLoading(false);
        } catch (e) {
            console.error("Erro no processamento:", e);
            setError(e.message || "Ocorreu um erro desconhecido ao processar os dados.");
            setData([]);
            setLoading(false);
        }
    };

    // Scatter Plot Data
    const scatterData = useMemo(() => {
        // generateScatterData expects data to already have distortion values
        return generateScatterData(data, selectedSMA);
    }, [data, selectedSMA]);

    // Range Scatter Plot Data
    const rangeScatterData = useMemo(() => {
        return generateRangeScatterData(data, selectedSMA);
    }, [data, selectedSMA]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs z-50">
                <p className="font-bold text-slate-200 mb-1">{data.timeLabel}</p>
                <p className="text-emerald-400 font-bold text-lg">{data.y} ticks</p>
                <p className="text-slate-500">{data.fullDate}</p>
            </div>
        );
    };

    const RangeTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        const dataPoint = payload[0].payload;
        return (
            <div className="bg-slate-800 p-3 border border-slate-700 rounded shadow-lg text-sm">
                <p className="text-slate-300 mb-1">{dataPoint.fullDate}</p>
                <p className="font-bold text-white mb-1">
                    Início do Ciclo: <span className="text-emerald-400">{dataPoint.timeLabel}</span>
                </p>
                <p className="font-bold text-white mb-1">
                    Máx. Range: <span className="text-emerald-400">{dataPoint.y.toFixed(1)} ticks</span>
                </p>
                <p className="text-slate-400 text-xs">
                    Duração: {dataPoint.duration} barras
                </p>
            </div>
        );
    };

    // Generate X-Axis Ticks (every 10 minutes)
    const xAxisTicks = useMemo(() => {
        const ticks = [];
        for (let i = 0; i < 1440; i += 10) { // Labels every 10 minutes
            // To avoid overcrowding, maybe show label every hour but have ticks every 10 mins?
            // Recharts might hide overlapping labels automatically. 
            // User asked for "horizontal... intervalo de 10 minutos".
            ticks.push(i);
        }
        return ticks;
    }, []);

    const formatXAxis = (tickItem) => {
        const hours = Math.floor(tickItem / 60);
        const minutes = tickItem % 60;
        // Show label only for full hours to keep it clean, or every 30 mins?
        // If I return string for every 10 mins, it will be unreadable.
        // I will return formatted string. Recharts 'interval="preserveStartEnd"' might help.
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* Upload Section */}
                {!data.length && !loading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold text-white">Comece sua Análise</h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                Importe seus logs de negociação do NinjaTrader.
                            </p>
                        </div>
                        <div className="w-full max-w-2xl">
                            <FileUpload onDataLoaded={handleDataLoaded} />
                        </div>
                        {error && (
                            <div className="mt-4 p-4 bg-rose-950/50 border border-rose-900/50 rounded-lg text-rose-200 flex items-center gap-3 w-full animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium animate-pulse">Processando dados...</p>
                    </div>
                )}

                {/* Dashboard Content */}
                {data.length > 0 && !loading && (
                    <div className="space-y-6 animate-in run-in duration-500">

                        {/* Controls */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl flex flex-wrap items-center gap-6">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">Média (SMA)</label>
                                <div className="flex gap-2">
                                    {[10, 25, 50].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setSelectedSMA(val)}
                                            className={`py-1 px-3 rounded-md text-xs font-semibold transition-all duration-200 border ${selectedSMA === val
                                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            SMA {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">Fuso Horário</label>
                                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2 py-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <select
                                        value={timezoneOffset}
                                        onChange={(e) => setTimezoneOffset(Number(e.target.value))}
                                        className="bg-transparent text-slate-300 text-xs outline-none"
                                    >
                                        <option value="0">Original</option>
                                        <option value="-3">UTC-3 (Brasília)</option>
                                        <option value="-4">UTC-4 (NY)</option>
                                        <option value="-5">UTC-5 (Chicago)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={() => setData([])}
                                className="ml-auto flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-medium px-3 py-1 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700"
                            >
                                <Upload className="w-3 h-3" />
                                Novo Arquivo
                            </button>
                        </div>

                        {/* Main Scatter Chart */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl h-[85vh]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-indigo-500" />
                                    Dispersão de Distorção (Minuto a Minuto)
                                </h3>
                                <div className="text-xs text-slate-500">
                                    Total de Pontos: <strong className="text-indigo-400">{scatterData.length}</strong>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
                                        axisLine={{ stroke: '#334155' }}
                                        interval={5} // Show one label every 6 ticks (60 mins) approx if ticks is every 10 mins
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="Distorção"
                                        domain={[0, 800]}
                                        stroke="#64748b"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={{ stroke: '#334155' }}
                                        label={{ value: 'Ticks (Absoluto)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#ffffff30' }} />
                                    <Scatter name="Distorções" data={scatterData} fill="#818cf8" shape="circle" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Range Scatter Plot */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl h-[85vh]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-500" />
                                    Dispersão de Range (Máxima Excursão por Ciclo)
                                </h3>
                                <div className="text-xs text-slate-500">
                                    Total de Ciclos: <strong className="text-emerald-400">{rangeScatterData.length}</strong>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
                                        axisLine={{ stroke: '#334155' }}
                                        interval={5}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="Range Máximo"
                                        domain={[0, 800]}
                                        stroke="#64748b"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={{ stroke: '#334155' }}
                                        label={{ value: 'Range Ticks', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip content={<RangeTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#ffffff30' }} />
                                    <Scatter name="Ranges" data={rangeScatterData} fill="#34d399" shape="cross" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
