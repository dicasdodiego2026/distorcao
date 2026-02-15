import React, { useState } from 'react';
import { Activity, Upload, AlertCircle, Clock } from 'lucide-react';
import { parseLogData } from '../utils/calculations';
import { FileUpload } from './FileUpload';
import RSIAnalysis from './RSIAnalysis';

export function AnalysisDashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timezoneOffset, setTimezoneOffset] = useState(0);

    const handleDataLoaded = async (content) => {
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

            // For RSI analysis, we just need the raw bar data
            // Tick size is handled inside RSIAnalysis or attached to bars by parseLogData
            setData(parsed);
            setLoading(false);
        } catch (e) {
            console.error("Erro no processamento:", e);
            setError(e.message || "Ocorreu um erro desconhecido ao processar os dados.");
            setData([]);
            setLoading(false);
        }
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
                            RSI Analytics
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

                {/* Upload Section */}
                {!data.length && !loading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold text-white">Comece sua Análise RSI</h2>
                            <p className="text-slate-400 max-w-md mx-auto">
                                Importe seus logs de negociação (MES/RTY/ES) do NinjaTrader.
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

                        {/* RSI Analysis Component Only */}
                        <RSIAnalysis data={data} filename={'Dados Carregados'} />

                    </div>
                )}
            </main>
        </div>
    );
}
