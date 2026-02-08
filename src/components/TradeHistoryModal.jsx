import React from 'react';
import { X, TrendingDown, Calendar, Clock, DollarSign, Layers, BarChart3 } from 'lucide-react';

export const TradeHistoryModal = ({ isOpen, onClose, tradeHistory, timeWindow }) => {
    if (!isOpen || !tradeHistory || !Array.isArray(tradeHistory) || tradeHistory.length === 0) return null;

    // Group trades by day
    const tradesByDay = {};
    tradeHistory.forEach(trade => {
        const date = new Date(trade.entryTime);
        const dayKey = date.toLocaleDateString('pt-BR');

        if (!tradesByDay[dayKey]) {
            tradesByDay[dayKey] = [];
        }
        tradesByDay[dayKey].push(trade);
    });

    const days = Object.keys(tradesByDay).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateB - dateA; // Most recent first
    });

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const totalProfit = tradeHistory.reduce((sum, t) => sum + t.profit, 0);
    const winningTrades = tradeHistory.filter(t => t.profit > 0).length;
    const winRate = ((winningTrades / tradeHistory.length) * 100).toFixed(1);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-7 h-7" />
                            Histórico de Operações - {timeWindow}
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1">Backtest simulado com parâmetros otimizados</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="bg-slate-800/50 p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-700">
                    <div className="text-center">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total de Operações</div>
                        <div className="text-2xl font-bold text-white">{tradeHistory.length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Taxa de Acerto</div>
                        <div className="text-2xl font-bold text-emerald-400">{winRate}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Lucro Total</div>
                        <div className="text-2xl font-bold text-emerald-400">+{totalProfit.toFixed(0)} ticks</div>
                    </div>
                    <div className="text-center">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Dias Operados</div>
                        <div className="text-2xl font-bold text-indigo-400">{days.length}</div>
                    </div>
                </div>

                {/* Trade List */}
                <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-6">
                    {days.map((day, dayIndex) => {
                        const dayTrades = tradesByDay[day];
                        const dayProfit = dayTrades.reduce((sum, t) => sum + t.profit, 0);
                        const dayWins = dayTrades.filter(t => t.profit > 0).length;

                        return (
                            <div key={dayIndex} className="mb-6">
                                {/* Day Header */}
                                <div className="bg-slate-800/50 rounded-lg p-4 mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-indigo-400" />
                                        <span className="text-lg font-bold text-white">{day}</span>
                                        <span className="text-sm text-slate-400">({dayTrades.length} operações)</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-slate-400">
                                            Acertos: <span className="text-emerald-400 font-semibold">{dayWins}/{dayTrades.length}</span>
                                        </span>
                                        <span className={`text-lg font-bold ${dayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {dayProfit >= 0 ? '+' : ''}{dayProfit.toFixed(0)} ticks
                                        </span>
                                    </div>
                                </div>

                                {/* Trades for this day */}
                                <div className="space-y-2">
                                    {dayTrades.map((trade, tradeIndex) => (
                                        <div
                                            key={tradeIndex}
                                            className={`bg-slate-800/30 border rounded-lg p-4 hover:bg-slate-800/50 transition-colors ${trade.profit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'
                                                }`}
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                                                {/* Entry Time */}
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Entrada</div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-sm font-mono text-white">{formatTime(trade.entryTime)}</span>
                                                    </div>
                                                </div>

                                                {/* Exit Time */}
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saída</div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-purple-400" />
                                                        <span className="text-sm font-mono text-white">{formatTime(trade.exitTime)}</span>
                                                    </div>
                                                </div>

                                                {/* Direction */}
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Direção</div>
                                                    <div className="flex items-center gap-2">
                                                        <TrendingDown className="w-4 h-4 text-rose-400" />
                                                        <span className="text-sm font-semibold text-rose-400">{trade.direction}</span>
                                                    </div>
                                                </div>

                                                {/* Layers */}
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Camadas</div>
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-amber-400" />
                                                        <span className="text-sm font-mono text-white">{trade.layers}x</span>
                                                    </div>
                                                </div>

                                                {/* Drawdown */}
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawdown</div>
                                                    <span className="text-sm font-mono text-orange-400">{trade.drawdown.toFixed(0)} ticks</span>
                                                </div>

                                                {/* Profit */}
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Resultado</div>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <DollarSign className={`w-4 h-4 ${trade.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                                                        <span className={`text-lg font-bold ${trade.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(1)} ticks
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
