import React, { useState, useMemo } from 'react';
import { analyzeRSITrades } from '../utils/indicators';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const RSIAnalysis = ({ data, filename }) => {
    if (!data || data.length === 0) return <div>No data for RSI analysis</div>;

    // Detect Tick Size based on filename or data
    const tickSize = filename.toUpperCase().includes('MES') ? 0.25 : 0.1;
    const pointValue = filename.toUpperCase().includes('MES') ? 5 : 50; // Example: $5 per point MES, $50 RTY (approx)

    const analysis = useMemo(() => analyzeRSITrades(data, tickSize), [data, tickSize]);
    const { trades, summary } = analysis;

    // Aggregate by Hour
    const hourlyStats = useMemo(() => {
        const buckets = {};
        trades.forEach(trade => {
            const hour = trade.signalTime.split(' ')[1].split(':')[0];
            if (!buckets[hour]) buckets[hour] = { total: 0, wins: 0, totalMae: 0, count: 0 };

            buckets[hour].count++;
            // Define "Win" as reaching 20 ticks (just for stats)
            if (trade.mfeTicks >= 20) buckets[hour].wins++;
            buckets[hour].totalMae += trade.maeTicks;
        });

        return Object.entries(buckets).map(([hour, stats]) => ({
            hour,
            winRate: (stats.wins / stats.count) * 100,
            avgMae: (stats.totalMae / stats.count).toFixed(1),
            count: stats.count
        })).sort((a, b) => a.hour.localeCompare(b.hour));
    }, [trades]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total RSI Signals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalTrades}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Avg MFE (Ticks)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">+{summary.avgMfe}</div>
                        <p className="text-xs text-muted-foreground">Max Favorable Excursion</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Avg MAE (Ticks)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{summary.avgMae}</div>
                        <p className="text-xs text-muted-foreground">Max Adverse Excursion</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Tick Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tickSize}</div>
                        <p className="text-xs text-muted-foreground">{filename}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Hourly Performance (Target 20 Ticks)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 w-full flex items-end gap-1">
                        {hourlyStats.map(stat => (
                            <div key={stat.hour} className="flex-1 flex flex-col items-center group relative">
                                <div
                                    className={`w-full rounded-t ${stat.winRate > 50 ? 'bg-green-500' : 'bg-red-400'}`}
                                    style={{ height: `${stat.winRate}%` }}
                                />
                                <span className="text-xs mt-1">{stat.hour}</span>
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs p-2 rounded z-10 w-32">
                                    Win Rate: {stat.winRate.toFixed(1)}%<br />
                                    Trades: {stat.count}<br />
                                    Avg MAE: {stat.avgMae}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Trade Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[500px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Signal Time</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>RSI</TableHead>
                                    <TableHead>Entry</TableHead>
                                    <TableHead>Max Gain</TableHead>
                                    <TableHead>Max Drawdown</TableHead>
                                    <TableHead>Status (20 Ticks)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trades.map((trade) => (
                                    <TableRow key={trade.id}>
                                        <TableCell>{trade.signalTime}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${trade.signal === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {trade.signal}
                                            </span>
                                        </TableCell>
                                        <TableCell>{trade.rsi}</TableCell>
                                        <TableCell>{trade.entryPrice}</TableCell>
                                        <TableCell className="text-green-600">+{trade.mfeTicks} tk</TableCell>
                                        <TableCell className="text-red-600">-{trade.maeTicks} tk</TableCell>
                                        <TableCell>
                                            {trade.mfeTicks >= 20 ?
                                                (trade.maeTicks === 0 ? '✅ PERFECT' : '✅ WIN') :
                                                '❌ FAIL'
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RSIAnalysis;
