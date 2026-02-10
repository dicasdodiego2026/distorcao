
import React, { useState } from 'react';
import { Target, TrendingUp, AlertTriangle, Play, CheckCircle, ArrowRight, Loader } from 'lucide-react';
import { findBestStrategy } from '../utils/optimizer';

export function AutoOptimizer({ data, selectedSMA, onApplyStrategy, timezoneOffset }) {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [bestStrategies, setBestStrategies] = useState(null);
    const [maxStopLoss, setMaxStopLoss] = useState(300);

    const handleOptimize = async () => {
        setIsOptimizing(true);
        // Use timeout to allow UI to update (show loader) before heavy calculation
        setTimeout(() => {
            const results = findBestStrategy(data, selectedSMA, maxStopLoss, timezoneOffset);
            setBestStrategies(results);
            setIsOptimizing(false);
        }, 100);
    };

    return (
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Target className="w-6 h-6 text-amber-400" />
                    <div>
                        <h2 className="text-xl font-bold text-white">Buscador de Estratégia Automático</h2>
                        <p className="text-sm text-slate-400">Encontre a melhor configuração sem tentativa e erro.</p>
                    </div>
                </div>
            </div>

            {/* Input & Action */}
            <div className="flex items-end gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex-1">
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-2 block">Limite de Stop Loss (Risco Máx)</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={maxStopLoss}
                            onChange={(e) => setMaxStopLoss(Number(e.target.value))}
                            className="bg-slate-800 border border-slate-700 text-white text-sm rounded p-2.5 w-full focus:ring-amber-500 focus:border-amber-500"
                            placeholder="300 ticks"
                        />
                    </div>
                </div>
                <button
                    onClick={handleOptimize}
                    disabled={isOptimizing || !data || data.length === 0}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isOptimizing ? <Loader className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    {isOptimizing ? 'Analisando...' : 'Encontrar Melhor Estratégia'}
                </button>
            </div>

            {/* Results */}
            {bestStrategies && bestStrategies.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Melhores Resultados Encontrados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {bestStrategies.map((strategy, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-colors relative overflow-hidden group">
                                {idx === 0 && <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg">RECOMENDADO</div>}

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-2xl font-bold text-emerald-400">+{strategy.score.toFixed(0)} <span className="text-sm">ticks</span></div>
                                        <div className="text-xs text-slate-500">Lucro Total</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-rose-400">-{strategy.maxDrawdown.toFixed(0)}</div>
                                        <div className="text-xs text-slate-500">Max DD</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4 border-t border-slate-800 pt-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Tipo:</span>
                                        <span className={`font-mono font-bold ${strategy.config.strategyType === 'TREND' ? 'text-cyan-400' : 'text-amber-400'}`}>
                                            {strategy.config.strategyType === 'TREND' ? 'TENDÊNCIA (Rompimento)' : 'REVERSÃO (Clássica)'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Entrada:</span>
                                        <span className="text-white font-mono">{strategy.config.entryTicks} ticks</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Alvo:</span>
                                        <span className="text-white font-mono">{strategy.config.targetTicks} ticks</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Horário:</span>
                                        <span className="text-white font-mono">{strategy.config.startTime} - {strategy.config.endTime}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Grid:</span>
                                        <span className="text-white font-mono">{strategy.config.maxLayers}x (Step {strategy.config.stepTicks})</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onApplyStrategy(strategy.config)}
                                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white"
                                >
                                    Carregar no Simulador <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {bestStrategies && bestStrategies.length === 0 && (
                <div className="p-4 bg-slate-800/50 rounded-xl text-center border border-slate-700">
                    <p className="text-slate-300">Nenhuma estratégia encontrada dentro do limite de risco.</p>
                    <p className="text-xs text-slate-500 mt-1">Tente aumentar o Stop Loss ou mudar a Média.</p>
                </div>
            )}
        </div>
    );
}
