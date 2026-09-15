/**
 * OptoPupil - Interactive PLR Bilateral Waveform Chart
 * High-performance dual-line time-series graph plotting left and right pupil
 * kinetic curves alongside the calibrated light stimulus interval and latency markers.
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type { ProcessedPLRSeries } from '../../plr/types';
import { Activity, Zap, TrendingDown } from 'lucide-react';

interface PLRWaveformChartProps {
  timeSeries: ProcessedPLRSeries;
  leftLatencyMs?: number;
  rightLatencyMs?: number;
}

export const PLRWaveformChart: React.FC<PLRWaveformChartProps> = ({
  timeSeries,
  leftLatencyMs,
  rightLatencyMs,
}) => {
  const [viewMode, setViewMode] = useState<'diameter' | 'velocity'>('diameter');

  // Align Left and Right points onto matching time array
  const chartData = useMemo(() => {
    const left = timeSeries.leftEye;
    const right = timeSeries.rightEye;

    if (!left.timeMs.length && !right.timeMs.length) {
      return [];
    }

    // Merge timestamps into a unified sorted array
    const allTimes = Array.from(new Set([...left.timeMs, ...right.timeMs])).sort((a, b) => a - b);

    // Map time to indices for fast lookup
    const leftMap = new Map<number, { cleanMm: number; rawMm: number; velocityMmS: number }>();
    left.timeMs.forEach((t, i) => {
      leftMap.set(t, {
        cleanMm: left.cleanMm[i],
        rawMm: left.rawMm[i],
        velocityMmS: left.velocityMmS[i],
      });
    });

    const rightMap = new Map<number, { cleanMm: number; rawMm: number; velocityMmS: number }>();
    right.timeMs.forEach((t, i) => {
      rightMap.set(t, {
        cleanMm: right.cleanMm[i],
        rawMm: right.rawMm[i],
        velocityMmS: right.velocityMmS[i],
      });
    });

    return allTimes.map((t) => {
      const l = leftMap.get(t);
      const r = rightMap.get(t);

      return {
        timeMs: t,
        timeSec: (t / 1000).toFixed(2),
        leftDiameterMm: l ? Number(l.cleanMm.toFixed(2)) : null,
        rightDiameterMm: r ? Number(r.cleanMm.toFixed(2)) : null,
        leftVelocityMmS: l ? Number(l.velocityMmS.toFixed(2)) : null,
        rightVelocityMmS: r ? Number(r.velocityMmS.toFixed(2)) : null,
      };
    });
  }, [timeSeries]);

  const hasData = chartData.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            Bilateral PLR Kinetics Waveform
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 p-1 font-mono text-xs">
          <button
            onClick={() => setViewMode('diameter')}
            className={`rounded px-2.5 py-1 transition ${
              viewMode === 'diameter'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Diameter (mm)
          </button>
          <button
            onClick={() => setViewMode('velocity')}
            className={`rounded px-2.5 py-1 transition ${
              viewMode === 'velocity'
                ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Velocity (mm/s)
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="mt-4 h-72 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timeMs"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                tickFormatter={(ms) => `${(ms / 1000).toFixed(1)}s`}
              />
              <YAxis
                stroke="#64748b"
                domain={viewMode === 'diameter' ? ['dataMin - 0.3', 'dataMax + 0.3'] : [-6, 3]}
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090d16',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
                labelFormatter={(ms) => `t = ${ms} ms (${(Number(ms) / 1000).toFixed(2)}s)`}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  paddingTop: '8px',
                }}
              />

              {/* Light Stimulus Active Zone Highlight (0 to 200ms) */}
              {React.createElement(ReferenceArea as any, {
                x1: 0,
                x2: 200,
                stroke: 'rgba(250, 204, 21, 0.4)',
                fill: 'rgba(250, 204, 21, 0.12)',
                label: {
                  value: 'LIGHT FLASH',
                  fill: '#facc15',
                  fontSize: 9,
                  position: 'insideTop',
                  fontFamily: 'monospace',
                },
              })}

              {/* Stimulus Onset Line (t = 0) */}
              <ReferenceLine
                x={0}
                stroke="#facc15"
                strokeDasharray="4 4"
                label={{
                  value: 't=0',
                  fill: '#facc15',
                  fontSize: 9,
                  position: 'bottom',
                  fontFamily: 'monospace',
                }}
              />

              {/* Latency Reference Markers */}
              {leftLatencyMs && viewMode === 'diameter' && (
                <ReferenceLine
                  x={leftLatencyMs}
                  stroke="#38bdf8"
                  strokeDasharray="2 2"
                  label={{
                    value: `L: ${leftLatencyMs}ms`,
                    fill: '#38bdf8',
                    fontSize: 8,
                    position: 'top',
                    fontFamily: 'monospace',
                  }}
                />
              )}
              {rightLatencyMs && viewMode === 'diameter' && (
                <ReferenceLine
                  x={rightLatencyMs}
                  stroke="#c084fc"
                  strokeDasharray="2 2"
                  label={{
                    value: `R: ${rightLatencyMs}ms`,
                    fill: '#c084fc',
                    fontSize: 8,
                    position: 'bottom',
                    fontFamily: 'monospace',
                  }}
                />
              )}

              {/* Data Lines */}
              {viewMode === 'diameter' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="leftDiameterMm"
                    name="Left Pupil (mm)"
                    stroke="#38bdf8"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#38bdf8', fill: '#0284c7' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rightDiameterMm"
                    name="Right Pupil (mm)"
                    stroke="#c084fc"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#c084fc', fill: '#9333ea' }}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="leftVelocityMmS"
                    name="Left Velocity (mm/s)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rightVelocityMmS"
                    name="Right Velocity (mm/s)"
                    stroke="#c084fc"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/30 text-center">
            <Zap className="h-8 w-8 text-slate-600 mb-2" />
            <p className="font-mono text-xs text-slate-400">
              No PLR kinetic recording session captured yet.
            </p>
            <p className="font-mono text-[11px] text-slate-600 mt-0.5">
              Click &quot;Start PLR Screening&quot; below to record bilateral response kinetics.
            </p>
          </div>
        )}
      </div>

      {/* Chart Footer Diagnostics */}
      {hasData && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span className="text-cyan-300">LEFT EYE</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              <span className="text-purple-300">RIGHT EYE</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingDown className="h-3 w-3 text-amber-400" />
            <span>Sampling: ~{timeSeries.averageFps} FPS | Savitzky-Golay SG-5 Filtered</span>
          </div>
        </div>
      )}
    </div>
  );
};
