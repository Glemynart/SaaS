import type { LoteProgress } from '../services/lotes-api';

export function LoteProgressBar({ progress }: { progress: LoteProgress }) {
  const pct = progress.porcentaje;
  const isActive = progress.estado === 'EN_PROCESO';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {progress.procesados + progress.fallidos} / {progress.total} procesados
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress.fallidos > 0 ? 'bg-orange-500' : 'bg-emerald-500'
          } ${isActive ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.fallidos > 0 && (
        <p className="text-xs text-red-600">
          {progress.fallidos} contrato{progress.fallidos !== 1 ? 's' : ''} fallido
          {progress.fallidos !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
