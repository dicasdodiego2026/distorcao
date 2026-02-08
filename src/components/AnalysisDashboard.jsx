import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { FileUpload } from './FileUpload';
import { parseLogData, calculateSMA, calculateDistortions, generateStats } from '../utils/calculations';

export function AnalysisDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedSMA, setSelectedSMA] = useState(10); // 10, 25, 50

    const handleDataLoaded = (content) => {
        setLoading(true);
        setTimeout(() => {
            try {
                const parsed = parseLogData(content);
                const sma10 = calculateSMA(parsed, 10);
                const sma25 = calculateSMA(parsed, 25);
                const sma50 = calculateSMA(parsed, 50);
                const enriched = calculateDistortions(parsed, sma10, sma25, sma50);
                setData(enriched);
            } catch (e) {
                console.error("Error processing data", e);
                alert("Erro ao processar dados. Verifique o formato do arquivo.");
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
        // Map Distortion to Next Bar Return (Close[i+1] - Close[i]) / TickSize
        return data.map((d, i) => {
            if (i >= data.length - 1) return null;
            const nextBar = data[i + 1];
            const distortion = d[`dist${selectedSMA}`];
            if (distortion === null) return null;
            const returnTicks = (nextBar.close - d.close) / d.tick_size;
            return { x: Number(distortion.toFixed(0)), y: Number(returnTicks.toFixed(0)), fill: distortion > 0 ? '#ef4444' : '#22c55e' }; // Color by distortion direction
        }).filter(Boolean);
    }, [data, selectedSMA]);

    if (!data.length) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Análise de Distorção de Média</h1>
                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <FileUpload onDataLoaded={handleDataLoaded} />
                    {loading && <p className="text-center mt-4 text-blue-600">Processando arquivos...</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-800">Dashboard de Análise</h1>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {[10, 25, 50].map(period => (
                        <button
                            key={period}
                            onClick={() => setSelectedSMA(period)}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${selectedSMA === period ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Média {period}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow col-span-1">
                    <h2 className="text-lg font-semibold mb-4 text-gray-700">Estatísticas (SMA {selectedSMA})</h2>
                    {currentStats && (
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b pb-2"><span>Dias Analisados:</span> <span className="font-mono">{new Set(data.map(d => d.timestamp.toDateString())).size}</span></div>
                            <div className="flex justify-between border-b pb-2"><span>Barras Analisadas:</span> <span className="font-mono">{currentStats.count}</span></div>
                            <div className="flex justify-between border-b pb-2"><span>Distorção Máxima (+):</span> <span className="font-mono text-green-600">+{currentStats.max.toFixed(0)} ticks</span></div>
                            <div className="flex justify-between border-b pb-2"><span>Distorção Mínima (-):</span> <span className="font-mono text-red-600">{currentStats.min.toFixed(0)} ticks</span></div>
                            <div className="flex justify-between border-b pb-2"><span>Média Absoluta:</span> <span className="font-mono">{currentStats.avgAbs.toFixed(1)} ticks</span></div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-4 rounded-lg shadow col-span-2 h-64">
                    <h2 className="text-lg font-semibold mb-2 text-gray-700">Distribuição de Distorção (Ticks)</h2>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={currentStats?.histogram || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="bucket" label={{ value: 'Ticks de Distância', position: 'insideBottom', offset: -5 }} />
                            <YAxis />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="count" fill="#3b82f6" name="Frequência" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow h-[400px]">
                <h2 className="text-lg font-semibold mb-2 text-gray-700">Distorção vs Retorno Próxima Barra</h2>
                <p className="text-xs text-gray-500 mb-2">Eixo X: Distorção da Média (Ticks) | Eixo Y: Retorno Próxima Barra (Ticks)</p>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid />
                        <XAxis type="number" dataKey="x" name="Distorção" unit="t" />
                        <YAxis type="number" dataKey="y" name="Retorno" unit="t" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <ReferenceLine y={0} stroke="#000" />
                        <ReferenceLine x={0} stroke="#000" />
                        <Scatter name="Dados" data={scatterData} fill="#8884d8" shape="circle" />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white p-4 rounded-lg shadow h-[400px]">
                <h2 className="text-lg font-semibold mb-2 text-gray-700">Evolução no Tempo (Preço vs SMA)</h2>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.slice(-200)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip labelFormatter={(t) => new Date(t).toLocaleString()} />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#8884d8" dot={false} strokeWidth={2} name="Preço (Close)" />
                        <Line type="monotone" dataKey={`sma${selectedSMA}`} stroke="#ff7300" dot={false} strokeWidth={2} name={`SMA ${selectedSMA}`} />
                    </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 text-center mt-2">Mostrando as últimas 200 barras para performance</p>
            </div>
        </div>
    );
}
