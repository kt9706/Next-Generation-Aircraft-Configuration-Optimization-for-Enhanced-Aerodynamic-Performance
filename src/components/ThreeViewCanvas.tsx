import { useState } from 'react';
import { AircraftGeometry } from '../types';

interface ThreeViewCanvasProps {
  geometry: AircraftGeometry;
  highlightedParam?: string;
}

export default function ThreeViewCanvas({ geometry, highlightedParam }: ThreeViewCanvasProps) {
  const [activeView, setActiveView] = useState<'all' | 'top' | 'front' | 'side'>('all');

  const {
    wingSpan,
    wingArea,
    wingSweep,
    rootChord,
    taperRatio,
    dihedral,
    wingletType,
    fuselageLength,
    fuselageDiameter,
    tailplaneSpan,
    tailplaneArea,
    cgPosition
  } = geometry;

  // Compute tip chord from root chord and taper ratio
  const tipChord = rootChord * taperRatio;

  // Let's create some relative scale factors to render the aircraft properly inside SVG viewboxes
  // The center of gravity is represented as percentage of MAC, we can draw a professional dynamic CG/NP marker.

  // Reference dimensions to define bounds
  const maxSpan = 80;
  const maxFuse = 85;

  // Scaling factors to fit everything into a 300x200 panel viewBox
  const scale = 1.8;

  // Visual helper to check if a param is currently highlighted/edited
  const getHighlightColor = (param: string, defaultColor: string) => {
    return highlightedParam === param ? '#3b82f6' : defaultColor; // blue-500 for edited sliders
  };

  const getHighlightStrokeWeight = (param: string, defaultWeight: number) => {
    return highlightedParam === param ? 2.5 : defaultWeight;
  };

  /**
   * Top View Schematic (X-Y plane)
   */
  const renderTopView = (width: number, height: number) => {
    const cx = width / 2;
    const cy = height * 0.45;

    // Scale spans & lengths to pixel values
    const fLenPix = fuselageLength * scale * 1.5;
    const fDiaPix = fuselageDiameter * scale * 1.5;

    // Wing details
    const halfSpanPix = (wingSpan * scale * 1.5) / 2;
    const rootChordPix = rootChord * scale * 1.5;
    const tipChordPix = tipChord * scale * 1.5;

    // Quarter chord sweep offset calculation
    // sweep_offset = halfSpan * tan(Sweep)
    const sweepOffsetPix = halfSpanPix * Math.tan((wingSweep * Math.PI) / 180);

    // Quarter Chord is 25% from root leading edge
    const rLedge_y = cy - rootChordPix * 0.25;
    const tLedge_y = rLedge_y + sweepOffsetPix;

    // Define coordinates for wing panels
    // Root leading edge is at (cx, rLedge_y), trailing edge at (cx, rLedge_y + rootChordPix)

    // Left Wing Coordinates
    const lTipLeading = { x: cx - halfSpanPix, y: tLedge_y - tipChordPix * 0.25 };
    const lTipTrailing = { x: cx - halfSpanPix, y: tLedge_y + tipChordPix * 0.75 };
    const lRootLeading = { x: cx - fDiaPix / 2, y: rLedge_y };
    const lRootTrailing = { x: cx - fDiaPix / 2, y: rLedge_y + rootChordPix };

    // Right Wing Coordinates
    const rTipLeading = { x: cx + halfSpanPix, y: tLedge_y - tipChordPix * 0.25 };
    const rTipTrailing = { x: cx + halfSpanPix, y: tLedge_y + tipChordPix * 0.75 };
    const rRootLeading = { x: cx + fDiaPix / 2, y: rLedge_y };
    const rRootTrailing = { x: cx + fDiaPix / 2, y: rLedge_y + rootChordPix };

    // Tail plane dimensions
    const tailSpanPix = (tailplaneSpan * scale * 1.5) / 2;
    const tailChordPix = 12 * scale; // static stabilizer chord visualization
    const tailOffset = fLenPix * 0.45; // placed near the back
    const tailLeading_y = cy + tailOffset;

    // Fuselage Bounds
    // Nose is at (cx, cy - fLenPix * 0.4), Tail at (cx, cy + fLenPix * 0.6)
    const nose_y = cy - fLenPix * 0.4;
    const tail_y = cy + fLenPix * 0.65;

    // Mean Aerodynamic Chord (MAC) position for CG/Neutral Point
    const macX = cx + halfSpanPix * 0.4;
    const macY = rLedge_y + sweepOffsetPix * 0.4;

    // CG and NP markers on center axis
    const cgY = rLedge_y + rootChordPix * (cgPosition / 100);
    const npY = cgY + 12; // Static Margin offset

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-[#06080A] rounded-lg">
        {/* Engineering grid lines */}
        <defs>
          <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="#2563eb" strokeOpacity="0.06" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Outer Blueprint Border */}
        <rect x="5" y="5" width={width - 10} height={height - 10} fill="none" stroke="#1e293b" strokeWidth="1" />

        {/* Annotations & Text */}
        <text x="15" y="25" className="font-mono text-xs text-slate-400 font-bold tracking-widest">
          SECTION I: TOP PLAN VIEW (X-Y PLANE)
        </text>

        {/* Center line (Symmetric Axis) */}
        <line x1={cx} y1={cy - height * 0.4} x2={cx} y2={cy + height * 0.48} stroke="#ef4444" strokeDasharray="5,3" strokeOpacity="0.4" strokeWidth="0.8" />

        {/* LEFT WING LIFT PLANE */}
        <polygon
          points={`${cx},${rLedge_y} ${lRootLeading.x},${lRootLeading.y} ${lTipLeading.x},${lTipLeading.y} ${lTipTrailing.x},${lTipTrailing.y} ${lRootTrailing.x},${lRootTrailing.y} ${cx},${rLedge_y + rootChordPix}`}
          fill="#3b82f6"
          fillOpacity="0.12"
          stroke={getHighlightColor('wingSpan', '#3b82f6')}
          strokeWidth={getHighlightStrokeWeight('wingSpan', 1.5)}
        />

        {/* RIGHT WING LIFT PLANE */}
        <polygon
          points={`${cx},${rLedge_y} ${rRootLeading.x},${rRootLeading.y} ${rTipLeading.x},${rTipLeading.y} ${rTipTrailing.x},${rTipTrailing.y} ${rRootTrailing.x},${rRootTrailing.y} ${cx},${rLedge_y + rootChordPix}`}
          fill="#3b82f6"
          fillOpacity="0.12"
          stroke={getHighlightColor('wingSpan', '#3b82f6')}
          strokeWidth={getHighlightStrokeWeight('wingSpan', 1.5)}
        />

        {/* Wing flap / control surface dashed lines */}
        <line x1={lRootTrailing.x} y1={lRootTrailing.y - 6} x2={lTipTrailing.x} y2={lTipTrailing.y - 4} stroke="#1d4ed8" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={rRootTrailing.x} y1={rRootTrailing.y - 6} x2={rTipTrailing.x} y2={rTipTrailing.y - 4} stroke="#1d4ed8" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Winglets */}
        {wingletType !== 'none' && (
          <>
            {/* Left winglet */}
            <path
              d={`M ${lTipLeading.x} ${lTipLeading.y} L ${lTipLeading.x - 4} ${lTipLeading.y + 3} L ${lTipTrailing.x - 4} ${lTipTrailing.y + 2} L ${lTipTrailing.x} ${lTipTrailing.y} Z`}
              fill="#06b6d4"
              stroke={getHighlightColor('wingletType', '#06b6d4')}
              strokeWidth="1"
            />
            {/* Right winglet */}
            <path
              d={`M ${rTipLeading.x} ${rTipLeading.y} L ${rTipLeading.x + 4} ${rTipLeading.y + 3} L ${rTipTrailing.x + 4} ${rTipTrailing.y + 2} L ${rTipTrailing.x} ${rTipTrailing.y} Z`}
              fill="#06b6d4"
              stroke={getHighlightColor('wingletType', '#06b6d4')}
              strokeWidth="1"
            />
          </>
        )}

        {/* HORIZONTAL STABILIZER (TAILPLANE) */}
        <polygon
          points={`${cx},${tailLeading_y} ${cx - tailSpanPix},${tailLeading_y + tailChordPix * 0.4} ${cx - tailSpanPix},${tailLeading_y + tailChordPix} ${cx + tailSpanPix},${tailLeading_y + tailChordPix} ${cx + tailSpanPix},${tailLeading_y + tailChordPix * 0.4}`}
          fill="#475569"
          fillOpacity="0.25"
          stroke={getHighlightColor('tailplaneSpan', '#64748b')}
          strokeWidth="1.2"
        />

        {/* FUSELAGE STRUCTURE TUBE */}
        {/* We draw nose conic dome, cylindrical mid section, and tapered tail cone */}
        <path
          d={`M ${cx - fDiaPix / 2} ${nose_y + fDiaPix * 1.5}
              Q ${cx} ${nose_y} ${cx + fDiaPix / 2} ${nose_y + fDiaPix * 1.5}
              L ${cx + fDiaPix / 2} ${tail_y - fDiaPix * 2}
              L ${cx + 1.2} ${tail_y}
              L ${cx - 1.2} ${tail_y}
              L ${cx - fDiaPix / 2} ${tail_y - fDiaPix * 2}
              Z`}
          fill="#1e293b"
          fillOpacity="0.82"
          stroke={getHighlightColor('fuselageLength', '#94a3b8')}
          strokeWidth={getHighlightStrokeWeight('fuselageLength', 1.5)}
        />

        {/* Cockpit canopy glass representation */}
        <ellipse cx={cx} cy={nose_y + fDiaPix * 2.2} rx={fDiaPix * 0.28} ry={fDiaPix * 0.6} fill="#0284c7" fillOpacity="0.7" />

        {/* Center of Gravity (C.G.) Marker  */}
        <circle cx={cx} cy={cgY} r="4.5" fill="none" stroke="#22c55e" strokeWidth="1.5" />
        <path d={`M ${cx - 4.5} ${cgY} L ${cx + 4.5} ${cgY} M ${cx} ${cgY - 4.5} L ${cx} ${cgY + 4.5}`} stroke="#22c55e" strokeWidth="1" />
        <text x={cx + 7} y={cgY + 3} className="font-mono text-[9px] fill-emerald-400 font-bold">C.G.</text>

        {/* Neutral Point (N.P.) Indicator */}
        <circle cx={cx} cy={npY} r="4.5" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2,1" />
        <circle cx={cx} cy={npY} r="1.5" fill="#f43f5e" />
        <text x={cx + 7} y={npY + 3} className="font-mono text-[9px] fill-rose-400 font-bold">N.P.</text>

        {/* Dimension Lines (Aeronautical Standards) */}
        {/* Wing Span Dimension Indicator */}
        <line x1={cx - halfSpanPix} y1={cy - 40} x2={cx + halfSpanPix} y2={cy - 40} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
        <path d={`M ${cx - halfSpanPix} ${cy - 43} L ${cx - halfSpanPix} ${cy - 37} M ${cx + halfSpanPix} ${cy - 43} L ${cx + halfSpanPix} ${cy - 37}`} stroke="#38bdf8" strokeWidth="1" />
        <text x={cx} y={cy - 44} textAnchor="middle" className="font-mono text-[10px] fill-sky-400 font-bold">
          b = {wingSpan.toFixed(1)}m
        </text>

        {/* Fuselage Length Indicator */}
        <line x1={cx - halfSpanPix - 20} y1={nose_y} x2={cx - halfSpanPix - 20} y2={tail_y} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" />
        <path d={`M ${cx - halfSpanPix - 23} ${nose_y} L ${cx - halfSpanPix - 17} ${nose_y} M ${cx - halfSpanPix - 23} ${tail_y} L ${cx - halfSpanPix - 17} ${tail_y}`} stroke="#f59e0b" strokeWidth="1" />
        <text x={cx - halfSpanPix - 30} y={cy + 10} transform={`rotate(-90 ${cx - halfSpanPix - 30} ${cy + 10})`} textAnchor="middle" className="font-mono text-[10px] fill-amber-500 font-bold">
          L = {fuselageLength.toFixed(1)}m
        </text>

        {/* Aerodynamic Sweep Callout */}
        <path
          d={`M ${cx} ${rLedge_y} A ${halfSpanPix} ${halfSpanPix} 0 0 1 ${cx + halfSpanPix * 0.4} ${rLedge_y + sweepOffsetPix * 0.4}`}
          fill="none"
          stroke="#ef4444"
          strokeWidth="0.8"
          strokeDasharray="2,2"
        />
        <text x={cx + 25} y={rLedge_y + 14} className="font-mono text-[10px] fill-red-400 font-bold">
          Λ = {wingSweep}°
        </text>
      </svg>
    );
  };

  /**
   * Front View Schematic (Y-Z plane)
   */
  const renderFrontView = (width: number, height: number) => {
    const cx = width / 2;
    const cy = height * 0.58;

    const fDiaPix = fuselageDiameter * scale * 1.5;
    const halfSpanPix = (wingSpan * scale * 1.5) / 2;

    // Dihedral effect shifts the wingtip upwards
    // Y_offset_wingtip = halfSpan * sin(Dihedral)
    const dihedralOffsetPix = halfSpanPix * Math.atan((dihedral * Math.PI) / 180);

    const lWingtip = { x: cx - halfSpanPix, y: cy - dihedralOffsetPix };
    const rWingtip = { x: cx + halfSpanPix, y: cy - dihedralOffsetPix };

    // Stabilizers / tail
    const vTailHeightPix = (tailplaneSpan * 0.4) * scale * 1.5; // estimation of vertical tail

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-[#06080A] rounded-lg">
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect x="5" y="5" width={width - 10} height={height - 10} fill="none" stroke="#1e293b" strokeWidth="1" />

        <text x="15" y="25" className="font-mono text-xs text-slate-400 font-bold tracking-widest">
          SECTION II: FRONT PLAN VIEW (Y-Z PLANE)
        </text>

        {/* Ground line reference */}
        <line x1={10} y1={cy + fDiaPix * 1.4} x2={width - 10} y2={cy + fDiaPix * 1.4} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />

        {/* VERTICAL STABILIZER (TAIL) */}
        <polygon
          points={`${cx},${cy - fDiaPix / 2} ${cx - 3},${cy - fDiaPix / 2 - vTailHeightPix} ${cx + 3},${cy - fDiaPix / 2 - vTailHeightPix}`}
          fill="#64748b"
          stroke="#475569"
          strokeWidth="1.2"
        />

        {/* FUSELAGE SECTION */}
        <circle
          cx={cx}
          cy={cy}
          r={fDiaPix / 2}
          fill="#1e293b"
          stroke={getHighlightColor('fuselageDiameter', '#94a3b8')}
          strokeWidth={getHighlightStrokeWeight('fuselageDiameter', 1.5)}
        />

        {/* LEFT WING IN FRONT PROFILE (Including Dihedral angle) */}
        <line
          x1={cx - fDiaPix / 2}
          y1={cy}
          x2={lWingtip.x}
          y2={lWingtip.y}
          stroke={getHighlightColor('dihedral', '#3b82f6')}
          strokeWidth={getHighlightStrokeWeight('dihedral', 3)}
        />
        <polygon
          points={`${cx - fDiaPix / 2},${cy} ${lWingtip.x},${lWingtip.y} ${lWingtip.x},${lWingtip.y + 3} ${cx - fDiaPix / 2},${cy + 4}`}
          fill="#3b82f6"
          fillOpacity="0.25"
        />

        {/* RIGHT WING IN FRONT PROFILE */}
        <line
          x1={cx + fDiaPix / 2}
          y1={cy}
          x2={rWingtip.x}
          y2={rWingtip.y}
          stroke={getHighlightColor('dihedral', '#3b82f6')}
          strokeWidth={getHighlightStrokeWeight('dihedral', 3)}
        />
        <polygon
          points={`${cx + fDiaPix / 2},${cy} ${rWingtip.x},${rWingtip.y} ${rWingtip.x},${rWingtip.y + 3} ${cx + fDiaPix / 2},${cy + 4}`}
          fill="#3b82f6"
          fillOpacity="0.25"
        />

        {/* Front Winglets */}
        {wingletType !== 'none' && (
          <>
            {/* Left winglet */}
            <line x1={lWingtip.x} y1={lWingtip.y} x2={lWingtip.x - 2} y2={lWingtip.y - 12} stroke={getHighlightColor('wingletType', '#06b6d4')} strokeWidth="2.5" />
            {/* Right winglet */}
            <line x1={rWingtip.x} y1={rWingtip.y} x2={rWingtip.x + 2} y2={rWingtip.y - 12} stroke={getHighlightColor('wingletType', '#06b6d4')} strokeWidth="2.5" />
          </>
        )}

        {/* Horizontal stabilizer (Front View representation) */}
        <line x1={cx - fDiaPix * 1.5} y1={cy - fDiaPix * 0.4} x2={cx + fDiaPix * 1.5} y2={cy - fDiaPix * 0.4} stroke="#475569" strokeWidth="2" />

        {/* Landing Gear Visual representations */}
        <line x1={cx} y1={cy + fDiaPix / 2} x2={cx} y2={cy + fDiaPix * 1.2} stroke="#64748b" strokeWidth="2" />
        <circle cx={cx} cy={cy + fDiaPix * 1.2} r="3.5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        
        {/* Dihedral angle annotator */}
        <path d={`M ${cx - halfSpanPix * 0.5} ${cy} A ${halfSpanPix * 0.5} ${halfSpanPix * 0.5} 0 0 1 ${cx - halfSpanPix * 0.5} ${cy - dihedralOffsetPix * 0.5}`} fill="none" stroke="#22c55e" strokeWidth="0.8" />
        <text x={cx - halfSpanPix * 0.4} y={cy - 5} className="font-mono text-[9px] fill-emerald-400 font-bold">Γ = {dihedral}°</text>
      </svg>
    );
  };

  /**
   * Side View Schematic (X-Z plane)
   */
  const renderSideView = (width: number, height: number) => {
    const cx = width / 2;
    const cy = height * 0.5;

    const fLenPix = fuselageLength * scale * 1.5;
    const fDiaPix = fuselageDiameter * scale * 1.5;

    const startX = cx - fLenPix * 0.45;
    const endX = cx + fLenPix * 0.55;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-[#06080A] rounded-lg">
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect x="5" y="5" width={width - 10} height={height - 10} fill="none" stroke="#1e293b" strokeWidth="1" />

        <text x="15" y="25" className="font-mono text-xs text-slate-400 font-bold tracking-widest">
          SECTION III: SIDE PROFILE VIEW (X-Z PLANE)
        </text>

        {/* VERTICAL TAILFIN (STABILIZER) */}
        <polygon
          points={`${endX - 25},${cy - fDiaPix * 0.4} ${endX - 18},${cy - fDiaPix * 2.3} ${endX + 3},${cy - fDiaPix * 2.2} ${endX - 5},${cy - fDiaPix * 0.2}`}
          fill="#64748b"
          fillOpacity="0.4"
          stroke="#475569"
          strokeWidth="1.2"
        />

        {/* FUSELAGE SIDE PROFILE */}
        <path
          d={`M ${startX} ${cy}
              Q ${startX + 18} ${cy - fDiaPix * 0.65} ${startX + fLenPix * 0.3} ${cy - fDiaPix * 0.5}
              L ${endX - fLenPix * 0.15} ${cy - fDiaPix * 0.4}
              L ${endX} ${cy - 5}
              L ${endX} ${cy + 2}
              L ${endX - fLenPix * 0.1} ${cy + fDiaPix * 0.3}
              L ${startX + fLenPix * 0.3} ${cy + fDiaPix * 0.5}
              Q ${startX + 15} ${cy + fDiaPix * 0.5} ${startX} ${cy}
              Z`}
          fill="#1e293b"
          fillOpacity="0.82"
          stroke={getHighlightColor('fuselageLength', '#94a3b8')}
          strokeWidth={getHighlightStrokeWeight('fuselageLength', 1.5)}
        />

        {/* Canopy Window */}
        <path
          d={`M ${startX + 15} ${cy - fDiaPix * 0.2} Q ${startX + 25} ${cy - fDiaPix * 0.45} ${startX + 38} ${cy - fDiaPix * 0.4} Q ${startX + 42} ${cy - fDiaPix * 0.1} ${startX + 38} ${cy} Z`}
          fill="#38bdf8"
          fillOpacity="0.6"
        />

        {/* Wing intersection mount marking representing rootChord */}
        <polygon
          points={`${startX + fLenPix * 0.35},${cy} ${startX + fLenPix * 0.35 + rootChord * scale * 1.5},${cy + 4} ${startX + fLenPix * 0.35 + tipChord * scale * 1.3},${cy + 5} ${startX + fLenPix * 0.35},${cy + 2}`}
          fill="#3b82f6"
          fillOpacity="0.3"
          stroke={getHighlightColor('rootChord', '#3b82f6')}
          strokeWidth={getHighlightStrokeWeight('rootChord', 1.5)}
        />
        
        {/* Horizontal tail stabilizer mounting line */}
        <line x1={endX - 15} y1={cy - fDiaPix * 0.2} x2={endX} y2={cy - fDiaPix * 0.2} stroke="#475569" strokeWidth="2.5" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Visual Navigation Tabs */}
      <div className="flex px-1 py-1 bg-[#0D1117] rounded-lg justify-start items-center gap-1 border border-slate-800 self-start">
        <button
          onClick={() => setActiveView('all')}
          className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-all font-semibold cursor-pointer ${
            activeView === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-[#E2E8F0] hover:bg-slate-800/50'
          }`}
        >
          ANALYTICAL 3-VIEW
        </button>
        <button
          onClick={() => setActiveView('top')}
          className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-all font-semibold cursor-pointer ${
            activeView === 'top'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-[#E2E8F0] hover:bg-slate-800/50'
          }`}
        >
          TOP PLAN (X-Y)
        </button>
        <button
          onClick={() => setActiveView('front')}
          className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-all font-semibold cursor-pointer ${
            activeView === 'front'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-[#E2E8F0] hover:bg-slate-800/50'
          }`}
        >
          FRONT PROFILE (Y-Z)
        </button>
        <button
          onClick={() => setActiveView('side')}
          className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-all font-semibold cursor-pointer ${
            activeView === 'side'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-[#E2E8F0] hover:bg-slate-800/50'
          }`}
        >
          SIDE PROFILE (X-Z)
        </button>
      </div>

      {/* Grid Canvas Panels */}
      <div className="flex-1 min-h-[360px] h-full">
        {activeView === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
            <div className="h-[280px] md:h-full">{renderTopView(450, 380)}</div>
            <div className="h-[280px] md:h-full">{renderFrontView(450, 380)}</div>
            <div className="h-[280px] md:h-full">{renderSideView(450, 380)}</div>
          </div>
        )}

        {activeView === 'top' && <div className="w-full h-full min-h-[380px]">{renderTopView(800, 500)}</div>}

        {activeView === 'front' && <div className="w-full h-full min-h-[380px]">{renderFrontView(800, 500)}</div>}

        {activeView === 'side' && <div className="w-full h-full min-h-[380px]">{renderSideView(800, 500)}</div>}
      </div>
    </div>
  );
}
