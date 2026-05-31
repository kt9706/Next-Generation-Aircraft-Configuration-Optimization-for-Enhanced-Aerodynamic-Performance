import { useState, useMemo, useEffect } from 'react';
import {
  AircraftGeometry,
  MissionProfile,
  OptimizationConfig,
  OptimizationHistoryPoint,
  OptimizationResult,
  StudentMetadata,
} from './types';
import { solveAerodynamics, solvePerformance } from './physics';
import { runAutomatedOptimization } from './optimize';
import ThreeViewCanvas from './components/ThreeViewCanvas';
import AerodynamicCharts from './components/AerodynamicCharts';
import {
  Wrench,
  Wind,
  Cpu,
  Bookmark,
  FileText,
  TrendingUp,
  RotateCcw,
  Play,
  CheckCircle,
  HelpCircle,
  Clock,
  Printer,
  ChevronRight,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

// Sane defaults inspired by standard medium-range turbofan airliner (Boeing 737 / Airbus A320 class)
const BASELINE_GEOMETRY: AircraftGeometry = {
  wingSpan: 35.8,
  wingArea: 122.4,
  wingSweep: 25.0,
  rootChord: 5.6,
  taperRatio: 0.24,
  dihedral: 5.5,
  wingletType: 'blended',
  fuselageLength: 37.6,
  fuselageDiameter: 3.95,
  tailplaneSpan: 12.4,
  tailplaneArea: 31.0,
  cgPosition: 25.0,
};

const BASELINE_MISSION: MissionProfile = {
  name: 'Standard Subsonic Cruise',
  altitude: 35000,
  mach: 0.78,
  payloadWeight: 14500, // 14.5 tons
  fuelCapacity: 21000,   // 21 tons
  sfc: 0.62,            // turbofan sfc kg/(N*h)
  emptyWeightBaseline: 42500, // 42.5 tons base structure
};

export default function App() {
  // Current design geometries
  const [geometry, setGeometry] = useState<AircraftGeometry>({ ...BASELINE_GEOMETRY });
  const [mission, setMission] = useState<MissionProfile>({ ...BASELINE_MISSION });
  
  // Highlighting active slider parameters in 3-View Canvas
  const [highlightedParam, setHighlightedParam] = useState<string | undefined>(undefined);

  // Flight attitude controllers
  const [aoa, setAoa] = useState<number>(2.5); // Cruise operating AoA

  // Automatic optimizer config settings
  const [optConfig, setOptConfig] = useState<OptimizationConfig>({
    objective: 'multi_objective',
    optimizeSpan: true,
    optimizeSweep: true,
    optimizeTaper: true,
    optimizeChord: true,
    minSpan: 20.0,
    maxSpan: 75.0,
    minSweep: 0.0,
    maxSweep: 42.0,
    minTaper: 0.10,
    maxTaper: 0.70,
    minChord: 2.0,
    maxChord: 10.0,
  });

  // Optimizer simulation replay states
  const [optimizerResult, setOptimizerResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [activeHistory, setActiveHistory] = useState<OptimizationHistoryPoint[]>([]);
  const [currentHistoryPoint, setCurrentHistoryPoint] = useState<number>(-1);

  // AI advisory diagnostics states
  const [aiReport, setAiReport] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Internship credential form fields (for printing reports)
  const [metadata, setMetadata] = useState<StudentMetadata>({
    studentName: 'Aeronautical Project Intern',
    university: 'Global Institute of Space & Aeronautical Technology',
    internshipPeriod: 'Summer Semester 2026',
    mentorName: 'Prof. J. Vance, Senior Aerodynamicist',
    department: 'Computational Fluid Dynamics Research Lab',
  });

  // Toggle report prints
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // Solved outputs for active geometries
  const clAlphaAlpha = solveAerodynamics(geometry, mission, aoa);
  const performanceSpecs = solvePerformance(geometry, mission, clAlphaAlpha);

  // Local helper to parse markdown block elements client-side to simplify text formats
  const renderSimpleMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-sm font-bold font-mono text-slate-200 mt-4 mb-2 uppercase tracking-wide border-b border-slate-800 pb-1">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-base font-bold font-mono text-sky-400 mt-5 mb-2 border-l-2 border-sky-500 pl-2 uppercase">{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={i} className="text-lg font-bold font-mono text-sky-400 mt-6 mb-3 tracking-tight border-b border-sky-900 pb-1 uppercase">{line.slice(2)}</h2>;
      }
      // Bullet lists
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return (
          <li key={i} className="text-xs text-slate-300 ml-4 list-disc marker:text-sky-500 font-sans leading-relaxed mb-1">
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}
          </li>
        );
      }
      // Sane defaults: paragraphs
      if (line.trim().length === 0) return <div key={i} className="h-2" />;
      return (
        <p key={i} className="text-xs text-slate-300 leading-relaxed font-sans mb-1.5 pt-0.5">
          {line.replace(/\*\*(.*?)\*\*/g, '$1')}
        </p>
      );
    });
  };

  /**
   * Resets active geometries to baseline standard airliner state
   */
  const handleResetToBaseline = () => {
    setGeometry({ ...BASELINE_GEOMETRY });
    setMission({ ...BASELINE_MISSION });
    setAoa(2.5);
    setOptimizerResult(null);
    setActiveHistory([]);
    setCurrentHistoryPoint(-1);
    setAiReport('');
  };

  /**
   * Triggers the local Multivariable Coordinate Descent Optimization solver,
   * then replays the convergence steps step-by-step so the user sees the wing
   * morphing and polars converging in real-time.
   */
  const handleLaunchOptimizer = () => {
    setIsOptimizing(true);
    setOptimizerResult(null);
    setCurrentHistoryPoint(-1);

    // Solve complete coordinate search
    const results = runAutomatedOptimization(geometry, mission, optConfig, 30);
    setOptimizerResult(results);
    setActiveHistory(results.history);

    // Trigger visual step-by-step playback
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < results.history.length) {
        const pt = results.history[stepIndex];
        setCurrentHistoryPoint(stepIndex);
        
        // Morph the plane visual configurations dynamically at each step
        setGeometry((prev) => ({
          ...prev,
          wingSpan: pt.wingSpan,
          wingSweep: pt.wingSweep,
          taperRatio: pt.taperRatio,
          rootChord: pt.rootChord,
        }));
        
        stepIndex++;
      } else {
        clearInterval(interval);
        setIsOptimizing(false);
        // Ensure final optimized geometries match absolute solver outputs
        setGeometry({ ...results.optimizedGeometry });
      }
    }, 120); // 120ms step replay rate
  };

  /**
   * Queries server-side whitelabeled computational expert review diagnostics
   */
  const handleRequestAIConsultation = async () => {
    setIsAiLoading(true);
    setAiReport('');
    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: geometry,
          mission: mission,
          aeroResult: clAlphaAlpha,
          perfResult: performanceSpecs,
          objective: optConfig.objective,
        }),
      });

      const data = await response.json();
      if (data.consultation) {
        setAiReport(data.consultation);
      } else {
        setAiReport('Failed to compile engineering diagnostics files from the automated evaluation server.');
      }
    } catch {
      setAiReport('Error connecting to the CFD analysis consultation server. Verify pipeline connection states.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E2E8F0] flex flex-col relative overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Primary header overlay */}
      <header className="border-b border-slate-800 bg-[#0D1117] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 rounded bg-blue-650 font-mono text-[10px] font-bold text-white tracking-widest">
              AEROSPACE CAD/CFD
            </span>
            <span className="text-[11px] font-mono text-slate-500 border-l border-slate-800 pl-2">
              VERSION 4.2.1-OPTIMIZER
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-baseline gap-2 lg:gap-3 mt-1">
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-[#F8FAFC] font-mono">
              Next-Generation Aircraft Configuration Optimization for Enhanced Aerodynamic Performance
            </h1>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded whitespace-nowrap self-start lg:self-baseline">
              <span className="text-slate-500 uppercase text-[9px] font-bold">Designer:</span>
              <input
                type="text"
                value={metadata.studentName}
                onChange={(e) => setMetadata((prev) => ({ ...prev, studentName: e.target.value }))}
                className="bg-transparent border-none outline-none focus:ring-0 text-blue-400 font-bold text-xs py-0 px-1 w-44 hover:bg-slate-800 rounded transition-colors"
                title="Click to edit designer name"
              />
            </div>
          </div>
          <p className="text-xs text-slate-450 font-sans mt-0.5">
            Aerospace Internship Research & Computational Design Optimization Suite
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            onClick={handleResetToBaseline}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded text-xs transition-colors font-mono font-medium cursor-pointer"
          >
            <RotateCcw size={13} />
            RESET GEOMETRY
          </button>
          <button
            onClick={() => setIsReportOpen(!isReportOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 transition-colors font-mono font-bold cursor-pointer shadow-sm shadow-blue-950/20"
          >
            <FileText size={13} />
            {isReportOpen ? 'CLOSE REPORT VIEW' : 'COMPILE FORMAL REPORT'}
          </button>
        </div>
      </header>

      {/* Main viewport area */}
      {!isReportOpen ? (
        <div className="flex-1 flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
          {/* LEFT COLUMN: Controls & Input Parameters */}
          <aside className="w-full xl:w-[380px] bg-[#0D1117] p-4 flex flex-col gap-5 shrink-0 overflow-y-auto">
            
            {/* Design geometric parameters sliders */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <Wrench size={13} className="text-blue-400" />
                Aircraft Lift Geometries
              </h3>

              {/* Slider: Wing Span */}
              <div
                className="flex flex-col gap-1 transition-all rounded p-1"
                onMouseEnter={() => setHighlightedParam('wingSpan')}
                onMouseLeave={() => setHighlightedParam(undefined)}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Wing Span (b)</span>
                  <span className="font-mono font-bold text-blue-400">{geometry.wingSpan.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="12.0"
                  max="78.0"
                  step="0.1"
                  value={geometry.wingSpan}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, wingSpan: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>12m</span>
                  <span>45m</span>
                  <span>78m</span>
                </div>
              </div>

              {/* Slider: Wing Area */}
              <div className="flex flex-col gap-1 transition-all rounded p-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Wing Area (S)</span>
                  <span className="font-mono font-bold text-blue-400">{geometry.wingArea.toFixed(1)} m²</span>
                </div>
                <input
                  type="range"
                  min="20.0"
                  max="650.0"
                  step="1"
                  value={geometry.wingArea}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, wingArea: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>20m²</span>
                  <span>335m²</span>
                  <span>650m²</span>
                </div>
              </div>

              {/* Slider: Wing Sweep */}
              <div
                className="flex flex-col gap-1 transition-all rounded p-1"
                onMouseEnter={() => setHighlightedParam('wingSweep')}
                onMouseLeave={() => setHighlightedParam(undefined)}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Quarter Sweep Angle (Λ)</span>
                  <span className="font-mono font-bold text-blue-400">{geometry.wingSweep.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="45.0"
                  step="0.5"
                  value={geometry.wingSweep}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, wingSweep: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>0° (Straight)</span>
                  <span>22.5°</span>
                  <span>45° (High Transonic)</span>
                </div>
              </div>

              {/* Slider: Root Chord */}
              <div
                className="flex flex-col gap-1 transition-all rounded p-1"
                onMouseEnter={() => setHighlightedParam('rootChord')}
                onMouseLeave={() => setHighlightedParam(undefined)}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Root Chord Line (C_root)</span>
                  <span className="font-mono font-bold text-blue-400">{geometry.rootChord.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="12.0"
                  step="0.1"
                  value={geometry.rootChord}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, rootChord: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>1.5m</span>
                  <span>6.7m</span>
                  <span>12.0m</span>
                </div>
              </div>

              {/* Slider: Taper Ratio */}
              <div className="flex flex-col gap-1 transition-all rounded p-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Taper Ratio (λ)</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] text-slate-500">Tip={(geometry.rootChord * geometry.taperRatio).toFixed(1)}m</span>
                    <span className="font-bold text-blue-400">{geometry.taperRatio.toFixed(2)}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="1.0"
                  step="0.01"
                  value={geometry.taperRatio}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, taperRatio: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>0.1 (Pointed)</span>
                  <span>0.55</span>
                  <span>1.0 (Rectangular)</span>
                </div>
              </div>

              {/* Slider: Dihedral */}
              <div
                className="flex flex-col gap-1 transition-all rounded p-1"
                onMouseEnter={() => setHighlightedParam('dihedral')}
                onMouseLeave={() => setHighlightedParam(undefined)}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Dihedral Angle (Γ)</span>
                  <span className="font-mono font-bold text-blue-400">{geometry.dihedral.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-5.0"
                  max="12.0"
                  step="0.5"
                  value={geometry.dihedral}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, dihedral: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>-5° (Anhedral)</span>
                  <span>3°</span>
                  <span>12°</span>
                </div>
              </div>

              {/* Dropdown: Winglet Configuration */}
              <div
                className="flex flex-col gap-1.5 transition-all rounded p-1"
                onMouseEnter={() => setHighlightedParam('wingletType')}
                onMouseLeave={() => setHighlightedParam(undefined)}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Winglet Component Type</span>
                  <span className="p-0.5 px-1.5 bg-slate-900 border border-slate-800 text-[9px] font-bold uppercase rounded text-blue-400">
                    {geometry.wingletType.replace('_', ' ')}
                  </span>
                </div>
                <select
                  value={geometry.wingletType}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    setGeometry((prev) => ({ ...prev, wingletType: val }));
                  }}
                  className="bg-slate-950/80 border border-slate-800 text-xs px-2.5 py-1.5 text-slate-300 outline-none rounded font-mono w-full cursor-pointer hover:bg-slate-900/65 transition-colors"
                >
                  <option value="none">No Winglets (Classical)</option>
                  <option value="blended">Blended Curved Winglets (+Oswald)</option>
                  <option value="wingtip_fence">Wingtip Fence Split (+Oswald)</option>
                  <option value="raked">Raked Wingtip Extensions (+Area/Oswald)</option>
                </select>
              </div>

              {/* Slider: CG Position */}
              <div className="flex flex-col gap-1 transition-all rounded p-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Center of Gravity (X_cg)</span>
                  <span className="font-mono font-bold text-emerald-400">{geometry.cgPosition.toFixed(1)}% MAC</span>
                </div>
                <input
                  type="range"
                  min="10.0"
                  max="38.0"
                  step="0.5"
                  value={geometry.cgPosition}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setGeometry((prev) => ({ ...prev, cgPosition: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>10% MAC (Nose Heavy)</span>
                  <span>24%</span>
                  <span>38% MAC (Tail Heavy)</span>
                </div>
              </div>
            </div>

            {/* Cruising flight regimes and missions */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-2 border-b border-slate-800 pb-1.5">
                <Wind size={13} className="text-emerald-400" />
                Flight Mission Regimes
              </h3>

              {/* Slider: Flight Mach */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-200">Cruise Mach Number (M)</span>
                  <span className="font-mono font-bold text-emerald-450">
                    {mission.mach.toFixed(2)} M ({Math.round(mission.mach * 1062)} km/h)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.88"
                  step="0.01"
                  value={mission.mach}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMission((prev) => ({ ...prev, mach: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>Unswept Prop (M=0.1)</span>
                  <span>M=0.5</span>
                  <span>Transonic Jet (M=0.88)</span>
                </div>
              </div>

              {/* Slider: Altitude */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Flight Altitude (h)</span>
                  <span className="font-mono font-bold text-emerald-450">{mission.altitude.toLocaleString()} ft</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="45000"
                  step="500"
                  value={mission.altitude}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMission((prev) => ({ ...prev, altitude: val }));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>Sea Level</span>
                  <span>22,500 ft</span>
                  <span>45,000 ft (Ceiling)</span>
                </div>
              </div>

              {/* Slider: Cruise Angle of Attack (AoA) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">Operational Angle of Attack (α)</span>
                  <span className="font-mono font-bold text-emerald-450">{aoa.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-4.0"
                  max="14.0"
                  step="0.2"
                  value={aoa}
                  onChange={(e) => {
                    setAoa(parseFloat(e.target.value));
                  }}
                  className="w-full h-1 bg-slate-950 rounded shadow-inner appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>-4° (Pitch Down)</span>
                  <span>5°</span>
                  <span>14° (High Pitch)</span>
                </div>
              </div>
            </div>
          </aside>

          {/* MIDDLE COLUMN: Solved Specs Dashboard, Blueprints & Charts */}
          <main className="flex-1 bg-[#0A0C10] p-4 flex flex-col gap-4 overflow-y-auto">
            
            {/* Spec grid solver output values */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Box 1: Aspect Ratio */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">ASPECT RATIO (AR)</span>
                <span className="text-base font-bold text-[#F8FAFC] font-mono mt-1">{clAlphaAlpha.aspectRatio.toFixed(2)}</span>
                <span className="text-[9px] font-sans text-slate-400 italic block mt-0.5">Span efficiency index</span>
              </div>

              {/* Box 2: Total Zero Lift Drag and Induced Drag */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">ZERO-LIFT DRAG (Cd0)</span>
                <span className="text-base font-bold text-[#F8FAFC] font-mono mt-1">{clAlphaAlpha.cd0.toFixed(4)}</span>
                <span className="text-[9px] font-sans text-emerald-500 block font-medium mt-0.5">
                  Induced C_di: {clAlphaAlpha.cdi.toFixed(4)}
                </span>
              </div>

              {/* Box 3: Transonic Wave Drag Rise */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">WAVE SHOCK DRAG</span>
                <span className={`text-base font-bold font-mono mt-1 ${clAlphaAlpha.cdWave > 0.005 ? 'text-red-400' : 'text-slate-300'}`}>
                  {clAlphaAlpha.cdWave.toFixed(5)}
                </span>
                <span className="text-[9px] font-mono block text-slate-400 mt-0.5">
                  Critical M_div: {performanceSpecs.criticalMach.toFixed(2)}
                </span>
              </div>

              {/* Box 4: L/D Efficiency Ratio */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">LIFT-TO-DRAG (L/D)</span>
                <span className="text-base font-bold text-blue-400 font-mono mt-1">{clAlphaAlpha.ldRatio.toFixed(2)}</span>
                <span className="text-[9px] font-sans text-slate-400 block mt-0.5">
                  Thrust req = {(1 / clAlphaAlpha.ldRatio * 100).toFixed(1)}% Weight
                </span>
              </div>

              {/* Box 5: Static Margin Stability */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">STATIC MARGIN SM</span>
                <span className={`text-base font-bold font-mono mt-1 ${clAlphaAlpha.staticMargin >= 5 && clAlphaAlpha.staticMargin <= 25 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {clAlphaAlpha.staticMargin.toFixed(1)}% MAC
                </span>
                <span className="text-[9px] font-sans block mt-0.5">
                  {clAlphaAlpha.staticMargin >= 5 ? '✓ Statically Stable' : '⚠️ pitch divergent!'}
                </span>
              </div>

              {/* Box 6: Flight Breguet Range */}
              <div className="bg-[#0D1117] border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">BREGUET RANGE (JET)</span>
                <span className="text-base font-bold text-[#F8FAFC] font-mono mt-1">{performanceSpecs.breguetRange.toFixed(0)} km</span>
                <span className="text-[9px] font-sans text-slate-400 block mt-0.5">
                  Loaded Mass: {Math.round(performanceSpecs.totalMass).toLocaleString()} kg
                </span>
              </div>
            </section>

            {/* Sub-Layout: Upper split - 3 View Canvas Visual and AI widget */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
              {/* Isometric Blueprints */}
              <div className="lg:col-span-8 bg-[#0D1117] p-4 rounded-xl border border-slate-800 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-mono text-xs uppercase text-slate-350 tracking-wider font-bold">
                    Interactive Blueprint CAD Representation
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">Scale factor 1.8 | Subsonic airliner base</span>
                </div>
                <div className="flex-1">
                  <ThreeViewCanvas geometry={geometry} highlightedParam={highlightedParam} />
                </div>
              </div>

              {/* CFD expert diagnostics advisor */}
              <div className="lg:col-span-4 bg-[#0D1117] p-4 rounded-xl border border-slate-800 flex flex-col">
                <h3 className="font-mono text-xs uppercase text-slate-300 tracking-wider font-bold mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Cpu size={14} /> CFD Expert Advisor
                  </span>
                  <span className="text-[9px] font-bold py-0.5 px-1.5 bg-blue-950/80 text-blue-400 border border-blue-800/40 uppercase rounded">
                    CFD ANALYSIS ENGINE
                  </span>
                </h3>

                <p className="text-[11px] text-slate-450 mb-4 font-sans leading-relaxed">
                  Analyze aircraft parameters including wetted skin friction index, compressibility shock buffets, and stability offsets.
                </p>

                {aiReport ? (
                  <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-800 p-3 bg-slate-950/80 rounded mb-3 text-slate-300">
                    {renderSimpleMarkdown(aiReport)}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded p-6 mb-3 text-center bg-slate-950/40">
                    {isAiLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                        <span className="font-mono text-[10px] text-blue-500 uppercase tracking-widest">
                          Compiling Aerodynamic Diagnostics...
                        </span>
                      </div>
                    ) : (
                      <>
                        <ShieldCheck size={28} className="text-slate-650 mb-2" />
                        <span className="font-mono text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                          Ready for Diagnostic Submission
                        </span>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                          Requests a professional white-labeled computational aeronautical audit.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={handleRequestAIConsultation}
                  disabled={isAiLoading || isOptimizing}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-mono font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Cpu size={13} />
                  {isAiLoading ? 'STREAMING EXPERT MEMO...' : 'COMPILE CFD DIAGNOSTICS'}
                </button>
              </div>
            </div>

            {/* Aerodynamic graphical curves */}
            <div className="bg-[#0D1117] p-4 rounded-xl border border-slate-800">
              <h3 className="font-mono text-xs uppercase text-slate-300 tracking-wider font-bold mb-3">
                Calculated Fluid Coefficient Graphics
              </h3>
              <AerodynamicCharts geometry={geometry} mission={mission} history={activeHistory} currentAoA={aoa} />
            </div>

            {/* Iterative design optimizer settings panel */}
            <div className="bg-[#0D1117] p-4 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-4">
                <h3 className="font-mono text-xs uppercase text-slate-350 tracking-wider font-bold flex items-center gap-1.5 mb-1 text-blue-400">
                  <TrendingUp size={14} /> Automated Optimization Engine
                </h3>
                <p className="text-[11px] text-slate-450 leading-relaxed font-sans mt-1">
                  Iteratively sweeps wingspace geometries (Span, Sweep, Taper, Chord) using convergence search loops. Simulates multi-variable design trade-offs.
                </p>
              </div>

              {/* Choose Objective targets */}
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">Optimization Objective</label>
                <select
                  value={optConfig.objective}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    setOptConfig((prev) => ({ ...prev, objective: val }));
                  }}
                  className="bg-slate-950/80 border border-slate-800 text-xs px-2.5 py-1.5 text-slate-300 outline-none rounded font-mono w-full cursor-pointer hover:bg-slate-900/65 transition-colors"
                >
                  <option value="max_ld">Maximize Cruise L/D Ratio</option>
                  <option value="max_range">Maximize Breguet Mission Range (km)</option>
                  <option value="min_drag">Minimize Operating Drag Coefficient (Cd)</option>
                  <option value="multi_objective">Multi-Objective (Stability + Drag + Mass Penalty)</option>
                </select>
              </div>

              {/* Variables checkboxes */}
              <div className="md:col-span-3 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-1 text-[10px] font-mono text-slate-350 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optConfig.optimizeSpan}
                    onChange={(e) => setOptConfig((prev) => ({ ...prev, optimizeSpan: e.target.checked }))}
                    className="accent-blue-600 rounded cursor-pointer w-3.5 h-3.5"
                  />
                  Sweep Span
                </label>
                <label className="flex items-center gap-1 text-[10px] font-mono text-slate-350 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optConfig.optimizeSweep}
                    onChange={(e) => setOptConfig((prev) => ({ ...prev, optimizeSweep: e.target.checked }))}
                    className="accent-blue-600 rounded cursor-pointer w-3.5 h-3.5"
                  />
                  Sweep Sweep
                </label>
                <label className="flex items-center gap-1 text-[10px] font-mono text-slate-350 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optConfig.optimizeTaper}
                    onChange={(e) => setOptConfig((prev) => ({ ...prev, optimizeTaper: e.target.checked }))}
                    className="accent-blue-600 rounded cursor-pointer w-3.5 h-3.5"
                  />
                  Sweep Taper Ratio
                </label>
                <label className="flex items-center gap-1 text-[10px] font-mono text-slate-350 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optConfig.optimizeChord}
                    onChange={(e) => setOptConfig((prev) => ({ ...prev, optimizeChord: e.target.checked }))}
                    className="accent-blue-600 rounded cursor-pointer w-3.5 h-3.5"
                  />
                  Sweep Root Chord
                </label>
              </div>

              {/* Action Button */}
              <div className="md:col-span-2">
                <button
                  onClick={handleLaunchOptimizer}
                  disabled={isOptimizing}
                  className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-blue-600 text-white rounded font-mono text-xs font-bold uppercase hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all tracking-wide cursor-pointer shadow-sm shadow-blue-950/15"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      SWEEPING...
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      RUN OPTIMIZER
                    </>
                  )}
                </button>
              </div>
            </div>
          </main>
        </div>
      ) : (
        /* TRANSCRIPT / INTERNSHIP CREDIT REPORT COMPILE VIEW */
        <div className="flex-1 bg-[#0A0C10] p-6 max-w-4xl mx-auto w-full">
          <div className="bg-[#0D1117] border border-slate-800 rounded-xl p-6 shadow-2xl relative">
            <div className="absolute top-6 right-6 flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-mono rounded text-xs font-bold cursor-pointer shadow-sm"
              >
                <Printer size={13} />
                PRINT / DOWNLOAD PDF
              </button>
              <button
                onClick={() => setIsReportOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono rounded text-xs font-bold cursor-pointer"
              >
                CLOSE
              </button>
            </div>

            {/* Standard Report Header block */}
            <div className="border-b-2 border-slate-800 pb-5 mb-6 text-center">
              <h2 className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight uppercase">
                FORMAL AERODYNAMIC OPTIMIZATION STATEMENT
              </h2>
              <p className="text-xs font-mono text-blue-400 mt-1 uppercase tracking-widest">
                PROJECT TITLE: Next-Generation Aircraft Configuration Optimization for Enhanced Aerodynamic Performance
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-6 text-[10px] font-mono text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800">
                <span>STAGE: RESEARCH INTERNSHIP PORTFOLIO SUBMISSION</span>
                <span>SYSTEM STATUS: VALIDATED CFD</span>
                <span>SYSTEM DATE: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Internship Submission Metadata (Editable fields) */}
            <div className="no-print bg-slate-950/80 p-4 rounded-lg border border-slate-800 mb-6">
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-blue-400 uppercase mb-3">
                <Bookmark size={13} /> Customise Student Credentials for Portfolio Certificate
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1 uppercase">Student Full Name</label>
                  <input
                    type="text"
                    value={metadata.studentName}
                    onChange={(e) => setMetadata({ ...metadata, studentName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono text-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1 uppercase">University / Institution</label>
                  <input
                    type="text"
                    value={metadata.university}
                    onChange={(e) => setMetadata({ ...metadata, university: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono text-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1 uppercase">Internship Period / Semester</label>
                  <input
                    type="text"
                    value={metadata.internshipPeriod}
                    onChange={(e) => setMetadata({ ...metadata, internshipPeriod: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono text-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1 uppercase">Faculty Mentor / Supervisor</label>
                  <input
                    type="text"
                    value={metadata.mentorName}
                    onChange={(e) => setMetadata({ ...metadata, mentorName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 font-mono text-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Formal Printable Document Layout */}
            <div className="space-y-6 text-slate-300 pr-0.5">
              
              {/* Box Info metadata showing on printed report */}
              <div className="grid grid-cols-2 gap-4 border border-slate-800 bg-slate-950 p-4 rounded-lg font-mono text-xs">
                <div>
                  <p className="text-slate-500 uppercase text-[9px] mb-0.5">STUDENT CANDIDATE</p>
                  <p className="font-bold text-slate-200">{metadata.studentName}</p>
                  
                  <p className="text-slate-500 uppercase text-[9px] mt-2 mb-0.5">UNIVERSITY AFFILIATION</p>
                  <p className="text-slate-300">{metadata.university}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase text-[9px] mb-0.5">SUPERVISOR / METOR</p>
                  <p className="font-bold text-slate-200">{metadata.mentorName}</p>
                  
                  <p className="text-slate-500 uppercase text-[9px] mt-2 mb-0.5">INTERNSHIP PROGRAM TERMS</p>
                  <p className="text-slate-300">{metadata.internshipPeriod}</p>
                </div>
              </div>

              {/* Section 1: Introduction */}
              <div>
                <h4 className="font-mono text-xs font-bold text-blue-400 uppercase border-b border-slate-800 pb-1 mb-2">
                  1. PROJECT OBJECTIVES & WORK STATEMENT
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  This report documents the design, parametric simulation, and automated computational optimization of a next-generation flight vehicle wing configuration. The primary research goal is the maximization of aerodynamic performance metrics, specifically the Lift-to-Drag ratio ($L/D$) and overall Breguet flight range, under constraints of static stability margin requirements. Optimization runs are executed utilizing coordinate descent heuristics to verify structural empty weight penalties against induced-vortex drag reliefs.
                </p>
              </div>

              {/* Section 2: Calculated results comparisons */}
              <div>
                <h4 className="font-mono text-xs font-bold text-blue-400 uppercase border-b border-slate-800 pb-1 mb-2">
                  Parametric Design Comparison Matrix
                </h4>
                <div className="overflow-x-auto border border-slate-800 rounded bg-slate-950">
                   <table className="w-full text-left font-mono text-[10px] divide-y divide-slate-800">
                     <thead className="bg-[#12161E] text-blue-400">
                      <tr>
                        <th className="p-2 py-2.5">PARAMETERS / COEFFICIENTS</th>
                        <th className="p-2 py-2.5 text-right">INITIAL BASELINE CLASS</th>
                        <th className="p-2 py-2.5 text-right">CURRENT OPTIMIZED SETUP</th>
                        <th className="p-2 py-2.5 text-right text-emerald-450">DELTA SHIFT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr>
                        <td className="p-2">Wing Span (b)</td>
                        <td className="p-2 text-right">{BASELINE_GEOMETRY.wingSpan.toFixed(1)} m</td>
                        <td className="p-2 text-right">{geometry.wingSpan.toFixed(1)} m</td>
                        <td className="p-2 text-right text-emerald-400">
                          {((geometry.wingSpan - BASELINE_GEOMETRY.wingSpan) >= 0 ? '+' : '')}
                          {(geometry.wingSpan - BASELINE_GEOMETRY.wingSpan).toFixed(1)} m
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2">Quarter Sweep Angle (Λ)</td>
                        <td className="p-2 text-right">{BASELINE_GEOMETRY.wingSweep.toFixed(1)}°</td>
                        <td className="p-2 text-right">{geometry.wingSweep.toFixed(1)}°</td>
                        <td className="p-2 text-right text-emerald-400">
                          {((geometry.wingSweep - BASELINE_GEOMETRY.wingSweep) >= 0 ? '+' : '')}
                          {(geometry.wingSweep - BASELINE_GEOMETRY.wingSweep).toFixed(1)}°
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2">Aspect Ratio (AR)</td>
                        <td className="p-2 text-right">{(BASELINE_GEOMETRY.wingSpan ** 2 / BASELINE_GEOMETRY.wingArea).toFixed(2)}</td>
                        <td className="p-2 text-right">{clAlphaAlpha.aspectRatio.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-400">
                          {clAlphaAlpha.aspectRatio - (BASELINE_GEOMETRY.wingSpan ** 2 / BASELINE_GEOMETRY.wingArea) >= 0 ? '+' : ''}
                          {(clAlphaAlpha.aspectRatio - (BASELINE_GEOMETRY.wingSpan ** 2 / BASELINE_GEOMETRY.wingArea)).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2">Gliding Coefficient (Max L/D)</td>
                        <td className="p-2 text-right">
                          {solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).ldRatio.toFixed(2)}
                        </td>
                        <td className="p-2 text-right">{clAlphaAlpha.ldRatio.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-400">
                          {clAlphaAlpha.ldRatio - solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).ldRatio >= 0 ? '+' : ''}
                          {(clAlphaAlpha.ldRatio - solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).ldRatio).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2">Breguet Mission Range</td>
                        <td className="p-2 text-right">
                          {solvePerformance(BASELINE_GEOMETRY, mission, solveAerodynamics(BASELINE_GEOMETRY, mission, aoa)).breguetRange.toFixed(0)} km
                        </td>
                        <td className="p-2 text-right">{performanceSpecs.breguetRange.toFixed(0)} km</td>
                        <td className="p-2 text-right text-emerald-400">
                          {performanceSpecs.breguetRange - solvePerformance(BASELINE_GEOMETRY, mission, solveAerodynamics(BASELINE_GEOMETRY, mission, aoa)).breguetRange >= 0 ? '+' : ''}
                          {(performanceSpecs.breguetRange - solvePerformance(BASELINE_GEOMETRY, mission, solveAerodynamics(BASELINE_GEOMETRY, mission, aoa)).breguetRange).toFixed(0)} km
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2">Longitudinal Static Stability Margin</td>
                        <td className="p-2 text-right">
                          {solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).staticMargin.toFixed(1)}% MAC
                        </td>
                        <td className="p-2 text-right">{clAlphaAlpha.staticMargin.toFixed(1)}% MAC</td>
                        <td className="p-2 text-right text-emerald-400">
                          {clAlphaAlpha.staticMargin - solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).staticMargin >= 0 ? '+' : ''}
                          {(clAlphaAlpha.staticMargin - solveAerodynamics(BASELINE_GEOMETRY, mission, aoa).staticMargin).toFixed(1)}% MAC
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: AI Consultation content or default review report */}
              <div>
                <h4 className="font-mono text-xs font-bold text-blue-400 uppercase border-b border-slate-800 pb-1 mb-2">
                  2. FLUID DESIGN ARCHITECT DIAGNOSTIC COMMENTS
                </h4>
                {aiReport ? (
                  <div className="text-xs text-slate-300 space-y-2 font-sans border-l-2 border-slate-800 pl-3 leading-relaxed">
                    {renderSimpleMarkdown(aiReport)}
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic">
                    *CFD Expert Evaluation has not been compiled into this report. Click "Compile CFD Diagnostics" on the central workspace console to incorporate fluid dynamic analytical summaries.*
                  </p>
                )}
              </div>

              {/* Section 4: Validation Statements */}
              <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>COMPUTATIONAL FLUID AERODYNAMIC PROJECT REPORT STATS</span>
                <span>AUTHENTICITY GUARANTEED - MULTIDISCIPLINARY OPTIMIZER</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified footer segment */}
      <footer className="bg-[#0D1117] px-6 py-4 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono text-slate-500">
        <div className="flex gap-4">
          <span>PROJECT PORTFOLIO - SUBMISSION READY</span>
          <span>SYSTEM CLOCK (UTC): {new Date().toISOString().substring(11, 19)}</span>
        </div>
        <div className="flex gap-1 items-center font-bold text-slate-400">
          <Clock size={12} />
          <span>SUMMER INTERNSHIP PORTFOLIO ASSIGNMENT</span>
        </div>
      </footer>
    </div>
  );
}
