import { useMemo } from 'react';
import { AircraftGeometry, MissionProfile, OptimizationHistoryPoint } from '../types';
import { solveAerodynamics } from '../physics';

interface AerodynamicChartsProps {
  geometry: AircraftGeometry;
  mission: MissionProfile;
  history?: OptimizationHistoryPoint[];
  currentAoA?: number;
}

export default function AerodynamicCharts({ geometry, mission, history, currentAoA = 2.5 }: AerodynamicChartsProps) {
  // Generate curve series
  const dataSeries = useMemo(() => {
    const series = [];
    // alpha from -4 to 12
    for (let currentAlpha = -4; currentAlpha <= 14; currentAlpha += 1) {
      const aero = solveAerodynamics(geometry, mission, currentAlpha);
      series.push({
        alpha: currentAlpha,
        cl: aero.cl,
        cd: aero.cd,
        ld: aero.ldRatio,
      });
    }
    return series;
  }, [geometry, mission]);

  // Dimensions of plots
  const w = 360;
  const h = 210;
  const paddingLeft = 38;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const graphW = w - paddingLeft - paddingRight;
  const graphH = h - paddingTop - paddingBottom;

  /**
   * Generates polyline or path coordinates for given x, y variables in arrays
   */
  const makePathData = (
    pts: Array<{ x: number; y: number }>,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ) => {
    return pts
      .map((pt, index) => {
        const px = paddingLeft + ((pt.x - minX) / (maxX - minX)) * graphW;
        const py = paddingTop + (1.0 - (pt.y - minY) / (maxY - minY)) * graphH;
        return `${index === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ');
  };

  /**
   * Chart 1: CL vs CD (Aerodynamic Lift-Drag Polar)
   */
  const renderPolarPlot = () => {
    const pts = dataSeries.map((d) => ({ x: d.cd, y: d.cl }));
    // Sane bounds for Polar Plot
    const minCd = 0.0;
    const maxCd = 0.14;
    const minCl = -0.5;
    const maxCl = 1.8;

    const pathString = makePathData(pts, minCd, maxCd, minCl, maxCl);

    // Current operating point
    const currentAero = solveAerodynamics(geometry, mission, currentAoA);
    const currX = paddingLeft + ((currentAero.cd - minCd) / (maxCd - minCd)) * graphW;
    const currY = paddingTop + (1.0 - (currentAero.cl - minCl) / (maxCl - minCl)) * graphH;

    return (
      <div className="bg-[#06080A] p-3 rounded-lg border border-slate-800 flex flex-col h-full justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-mono font-bold flex justify-between">
          <span>Lift-Drag Drag Polar (C_L vs C_D)</span>
          <span className="text-[10px] text-blue-400 capitalize">Subsonic Aerodynamic Polar</span>
        </h4>
        <div className="relative flex-1 mt-2">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
            {/* Horizontal and vertical axes/grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const gy = paddingTop + t * graphH;
              const valY = maxCl - t * (maxCl - minCl);
              const gx = paddingLeft + t * graphW;
              const valX = minCd + t * (maxCd - minCd);
              return (
                <g key={t}>
                  {/* Grid Y */}
                  <line x1={paddingLeft} y1={gy} x2={w - paddingRight} y2={gy} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={paddingLeft - 6} y={gy + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    {valY.toFixed(1)}
                  </text>

                  {/* Grid X */}
                  <line x1={gx} y1={paddingTop} x2={gx} y2={h - paddingBottom} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={gx} y={h - paddingBottom + 12} textAnchor="middle" className="text-[8px] fill-slate-500 font-mono">
                    {valX.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* Zero-lift reference line inside plot if within limits */}
            {minCl < 0 && (
              <line
                x1={paddingLeft}
                y1={paddingTop + (1.0 - (0.0 - minCl) / (maxCl - minCl)) * graphH}
                x2={w - paddingRight}
                y2={paddingTop + (1.0 - (0.0 - minCl) / (maxCl - minCl)) * graphH}
                stroke="#475569"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />
            )}

            {/* Main Polar Curve */}
            <path d={pathString} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />

            {/* Highlight Selected/Current flight point */}
            {currX >= paddingLeft && currX <= w - paddingRight && currY >= paddingTop && currY <= h - paddingBottom && (
              <g>
                <circle cx={currX} cy={currY} r="4.5" fill="#f59e0b" className="animate-pulse" />
                <circle cx={currX} cy={currY} r="2" fill="#ffffff" />
                {/* Horizontal reference indicator */}
                <line x1={paddingLeft} y1={currY} x2={currX} y2={currY} stroke="#f59e0b" strokeWidth="0.6" strokeDasharray="2,2" />
                <line x1={currX} y1={currY} x2={currX} y2={h - paddingBottom} stroke="#f59e0b" strokeWidth="0.6" strokeDasharray="2,2" />
                {/* Float label overlay */}
                <rect x={currX + 6} y={currY - 14} width="75" height="15" rx="3" fill="#0f172a" fillOpacity="0.85" stroke="#f59e0b" strokeWidth="0.5" />
                <text x={currX + 10} y={currY - 3} className="text-[8px] font-bold font-mono fill-white">
                  C_L={currentAero.cl.toFixed(2)}, C_D={currentAero.cd.toFixed(4)}
                </text>
              </g>
            )}

            {/* Labels */}
            <text x={w / 2 + 10} y={h - 1} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Total Drag Coefficient (C_D)
            </text>
            <text x={10} y={h / 2} transform={`rotate(-90 10 ${h / 2})`} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Lift Coefficient (C_L)
            </text>
          </svg>
        </div>
      </div>
    );
  };

  /**
   * Chart 2: Lift curve slope CL vs AoA
   */
  const renderLiftSlopePlot = () => {
    const pts = dataSeries.map((d) => ({ x: d.alpha, y: d.cl }));
    const minAlpha = -4;
    const maxAlpha = 14;
    const minCl = -0.5;
    const maxCl = 1.8;

    const pathString = makePathData(pts, minAlpha, maxAlpha, minCl, maxCl);

    // Current AoA point
    const currentAero = solveAerodynamics(geometry, mission, currentAoA);
    const currX = paddingLeft + ((currentAoA - minAlpha) / (maxAlpha - minAlpha)) * graphW;
    const currY = paddingTop + (1.0 - (currentAero.cl - minCl) / (maxCl - minCl)) * graphH;

    return (
      <div className="bg-[#06080A] p-3 rounded-lg border border-slate-800 flex flex-col h-full justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-mono font-bold flex justify-between">
          <span>Lift Curve (C_L vs α)</span>
          <span className="text-[10px] text-emerald-400 capitalize">Lift Gradient dC_L/dα</span>
        </h4>
        <div className="relative flex-1 mt-2">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const gy = paddingTop + t * graphH;
              const valY = maxCl - t * (maxCl - minCl);
              const gx = paddingLeft + t * graphW;
              const valX = minAlpha + t * (maxAlpha - minAlpha);
              return (
                <g key={t}>
                  <line x1={paddingLeft} y1={gy} x2={w - paddingRight} y2={gy} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={paddingLeft - 6} y={gy + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    {valY.toFixed(1)}
                  </text>

                  <line x1={gx} y1={paddingTop} x2={gx} y2={h - paddingBottom} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={gx} y={h - paddingBottom + 12} textAnchor="middle" className="text-[8px] fill-slate-500 font-mono">
                    {valX.toFixed(0)}°
                  </text>
                </g>
              );
            })}

            {/* Grid references */}
            <line
              x1={paddingLeft}
              y1={paddingTop + (1.0 - (0.0 - minCl) / (maxCl - minCl)) * graphH}
              x2={w - paddingRight}
              y2={paddingTop + (1.0 - (0.0 - minCl) / (maxCl - minCl)) * graphH}
              stroke="#475569"
              strokeWidth="0.8"
            />
            <line
              x1={paddingLeft + ((0.0 - minAlpha) / (maxAlpha - minAlpha)) * graphW}
              y1={paddingTop}
              x2={paddingLeft + ((0.0 - minAlpha) / (maxAlpha - minAlpha)) * graphW}
              y2={h - paddingBottom}
              stroke="#475569"
              strokeWidth="0.8"
            />

            <path d={pathString} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

            {currX >= paddingLeft && currX <= w - paddingRight && currY >= paddingTop && currY <= h - paddingBottom && (
              <g>
                <circle cx={currX} cy={currY} r="4.5" fill="#f59e0b" className="animate-pulse" />
                <circle cx={currX} cy={currY} r="2" fill="#ffffff" />
                <rect x={currX + 6} y={currY - 14} width="70" height="15" rx="3" fill="#0f172a" fillOpacity="0.85" stroke="#f59e0b" strokeWidth="0.5" />
                <text x={currX + 10} y={currY - 3} className="text-[8px] font-bold font-mono fill-white">
                  α={currentAoA.toFixed(1)}° C_L={currentAero.cl.toFixed(2)}
                </text>
              </g>
            )}

            <text x={w / 2 + 10} y={h - 1} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Angle of Attack α (degrees)
            </text>
            <text x={10} y={h / 2} transform={`rotate(-90 10 ${h / 2})`} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Lift Coefficient (C_L)
            </text>
          </svg>
        </div>
      </div>
    );
  };

  /**
   * Chart 3: Aerodynamic efficiency L/D vs Angle of Attack
   */
  const renderLDEfficiencyPlot = () => {
    const pts = dataSeries.map((d) => ({ x: d.alpha, y: d.ld }));
    const minAlpha = -4;
    const maxAlpha = 14;
    const minLd = -6;
    const maxLd = 26;

    const pathString = makePathData(pts, minAlpha, maxAlpha, minLd, maxLd);

    // Current AoA point
    const currentAero = solveAerodynamics(geometry, mission, currentAoA);
    const currX = paddingLeft + ((currentAoA - minAlpha) / (maxAlpha - minAlpha)) * graphW;
    const currY = paddingTop + (1.0 - (currentAero.ldRatio - minLd) / (maxLd - minLd)) * graphH;

    return (
      <div className="bg-[#06080A] p-3 rounded-lg border border-slate-800 flex flex-col h-full justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-mono font-bold flex justify-between">
          <span>Glide Efficiency (L/D vs α)</span>
          <span className="text-[10px] text-blue-400 capitalize">Aerodynamic L/D Curve</span>
        </h4>
        <div className="relative flex-1 mt-2">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const gy = paddingTop + t * graphH;
              const valY = maxLd - t * (maxLd - minLd);
              const gx = paddingLeft + t * graphW;
              const valX = minAlpha + t * (maxAlpha - minAlpha);
              return (
                <g key={t}>
                  <line x1={paddingLeft} y1={gy} x2={w - paddingRight} y2={gy} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={paddingLeft - 6} y={gy + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    {valY.toFixed(0)}
                  </text>

                  <line x1={gx} y1={paddingTop} x2={gx} y2={h - paddingBottom} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={gx} y={h - paddingBottom + 12} textAnchor="middle" className="text-[8px] fill-slate-500 font-mono">
                    {valX.toFixed(0)}°
                  </text>
                </g>
              );
            })}

            {/* Zero glide line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + (1.0 - (0.0 - minLd) / (maxLd - minLd)) * graphH}
              x2={w - paddingRight}
              y2={paddingTop + (1.0 - (0.0 - minLd) / (maxLd - minLd)) * graphH}
              stroke="#475569"
              strokeWidth="0.8"
            />

            <path d={pathString} fill="none" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" />

            {currX >= paddingLeft && currX <= w - paddingRight && currY >= paddingTop && currY <= h - paddingBottom && (
              <g>
                <circle cx={currX} cy={currY} r="4.5" fill="#f59e0b" className="animate-pulse" />
                <circle cx={currX} cy={currY} r="2" fill="#ffffff" />
                <rect x={currX + 6} y={currY - 14} width="70" height="15" rx="3" fill="#0f172a" fillOpacity="0.85" stroke="#f59e0b" strokeWidth="0.5" />
                <text x={currX + 10} y={currY - 3} className="text-[8px] font-bold font-mono fill-white">
                  L/D={currentAero.ldRatio.toFixed(2)}
                </text>
              </g>
            )}

            <text x={w / 2 + 10} y={h - 1} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Angle of Attack α (degrees)
            </text>
            <text x={10} y={h / 2} transform={`rotate(-90 10 ${h / 2})`} textAnchor="middle" className="text-[9px] fill-slate-400 font-mono font-semibold">
              Lift-over-Drag Ratio (L/D)
            </text>
          </svg>
        </div>
      </div>
    );
  };

  /**
   * Chart 4: Optimization convergence history (Only if history points exist)
   */
  const renderConvergencePlot = () => {
    if (!history || history.length === 0) return null;

    const pts = history.map((pt) => ({ x: pt.iteration, y: pt.fitness }));
    const maxIterInput = history[history.length - 1].iteration;

    const minX = 0;
    const maxX = Math.max(1, maxIterInput);
    
    const fitnessValues = history.map(h => h.fitness);
    const minY = Math.min(...fitnessValues) * 0.95;
    const maxY = Math.max(...fitnessValues) * 1.05;

    const pathString = makePathData(pts, minX, maxX, minY, maxY);

    return (
      <div className="bg-[#06080A] p-3 rounded-lg border border-slate-800 flex flex-col h-full justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-300 font-mono font-bold flex justify-between">
          <span>Convergence History</span>
          <span className="text-[10px] text-blue-400 capitalize">Algorithmic Optimiser Trend</span>
        </h4>
        <div className="relative flex-1 mt-2">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
              const gy = paddingTop + t * graphH;
              const valY = maxY - t * (maxY - minY);
              const gx = paddingLeft + t * graphW;
              const valX = minX + t * (maxX - minX);
              return (
                <g key={t}>
                  <line x1={paddingLeft} y1={gy} x2={w - paddingRight} y2={gy} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={paddingLeft - 6} y={gy + 3} textAnchor="end" className="text-[8px] fill-slate-500 font-mono">
                    {valY.toFixed(1)}
                  </text>

                  <line x1={gx} y1={paddingTop} x2={gx} y2={h - paddingBottom} stroke="#1e293b" strokeWidth="0.8" />
                  <text x={gx} y={h - paddingBottom + 12} textAnchor="middle" className="text-[8px] fill-slate-500 font-mono">
                    {valX.toFixed(0)}
                  </text>
                </g>
              );
            })}

            <path d={pathString} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {history.map((pt, index) => {
              const px = paddingLeft + ((pt.iteration - minX) / (maxX - minX)) * graphW;
              const py = paddingTop + (1.0 - (pt.fitness - minY) / (maxY - minY)) * graphH;
              return (
                <circle
                  key={index}
                  cx={px}
                  cy={py}
                  r="3"
                  className="fill-amber-400 stroke-slate-950 stroke-[1.2] hover:r-5 cursor-pointer"
                />
              );
            })}

            <text x={w / 2 + 10} y={h - 1} textAnchor="middle" className="text-[9px] fill-slate-500 font-mono font-semibold">
              Aerodynamic Optimization Iteration
            </text>
            <text x={10} y={h / 2} transform={`rotate(-90 10 ${h / 2})`} textAnchor="middle" className="text-[9px] fill-slate-500 font-mono font-semibold">
              Fitness Index
            </text>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {renderPolarPlot()}
      {renderLiftSlopePlot()}
      {renderLDEfficiencyPlot()}
      {history && history.length > 0 ? (
        renderConvergencePlot()
      ) : (
        <div className="bg-[#06080A] p-6 rounded-lg border border-slate-800 flex flex-col items-center justify-center h-full text-center">
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">Algorithmic Optimiser Graph</p>
          <span className="text-slate-600 text-xs mt-2 italic px-3">
            Trigger the "Automate Optimization Search" engine below to generate convergence histories and optimization logs.
          </span>
        </div>
      )}
    </div>
  );
}
