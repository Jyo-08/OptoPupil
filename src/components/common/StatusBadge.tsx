import React from 'react';
import type { TrackingStatus, PupilDetectionStatus } from '../../types/vision';

interface StatusBadgeProps {
  status: TrackingStatus | PupilDetectionStatus | 'ACTIVE' | 'CONNECTING' | 'READY' | 'FINALIZED';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const displayLabel = label || status;

  let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-300';
  let dotClass = 'bg-slate-400';

  if (
    status === 'GOOD' ||
    status === 'DETECTED' ||
    status === 'ACTIVE' ||
    status === 'READY' ||
    status === 'FINALIZED'
  ) {
    bgClass = 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300';
    dotClass = 'bg-emerald-400 animate-pulse';
  } else if (status === 'DEGRADED' || status === 'UNCERTAIN' || status === 'CONNECTING') {
    bgClass = 'bg-amber-950/60 border-amber-600/40 text-amber-300';
    dotClass = 'bg-amber-400 animate-ping';
  } else if (status === 'LOST') {
    bgClass = 'bg-rose-950/60 border-rose-600/40 text-rose-300';
    dotClass = 'bg-rose-500';
  }

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono tracking-wider transition-colors ${bgClass} ${sizeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {displayLabel}
    </span>
  );
};
