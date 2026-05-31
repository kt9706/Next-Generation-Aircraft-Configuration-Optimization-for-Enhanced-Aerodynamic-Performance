/**
 * Types and Interfaces for Next-Generation Aircraft Configuration Optimization Suite
 */

export interface AircraftGeometry {
  wingSpan: number;       // Wing span (b) [m]
  wingArea: number;       // Wing reference area (S) [m²]
  wingSweep: number;      // Quarter-chord sweep angle (Λ) [degrees]
  rootChord: number;      // Root chord length (c_root) [m]
  taperRatio: number;     // Taper ratio (λ = c_tip / c_root)
  dihedral: number;       // Dihedral angle (Γ) [degrees]
  wingletType: 'none' | 'blended' | 'wingtip_fence' | 'raked';
  fuselageLength: number; // Fuselage total length (L_fuse) [m]
  fuselageDiameter: number; // Fuselage maximum diameter (D_fuse) [m]
  tailplaneSpan: number;  // Horizontal stabilizer span [m]
  tailplaneArea: number;  // Horizontal stabilizer area [m²]
  cgPosition: number;     // Center of gravity location (% of Mean Aerodynamic Chord [MAC])
}

export interface MissionProfile {
  name: string;
  altitude: number;       // Cruise altitude [ft]
  mach: number;           // Cruise Mach number (M)
  payloadWeight: number;  // Payload mass [kg]
  fuelCapacity: number;   // Maximum fuel mass [kg]
  sfc: number;            // Specific Fuel Consumption [kg/(N·h) or 1/h for turbine]
  emptyWeightBaseline: number; // Empty weight of base structure [kg]
}

export type DesignObjective = 'max_ld' | 'max_range' | 'min_drag' | 'multi_objective';

export interface OptimizationConfig {
  objective: DesignObjective;
  optimizeSpan: boolean;
  optimizeSweep: boolean;
  optimizeTaper: boolean;
  optimizeChord: boolean;
  minSpan: number;
  maxSpan: number;
  minSweep: number;
  maxSweep: number;
  minTaper: number;
  maxTaper: number;
  minChord: number;
  maxChord: number;
}

export interface AtmosphereProperties {
  temperature: number;    // [K]
  pressure: number;       // [Pa]
  density: number;        // [kg/m³]
  speedOfSound: number;   // [m/s]
}

export interface AerodynamicCoefficients {
  aspectRatio: number;    // Aspect ratio (AR = b² / S)
  mac: number;            // Mean aerodynamic chord (c_bar) [m]
  cl: number;             // Lift coefficient (C_L)
  clAlpha: number;        // Lift curve slope (C_L_α) [per degree]
  cd0: number;            // Zero-lift (parasitic) drag coefficient (C_D_0)
  cdi: number;            // Induced drag coefficient (C_D_i)
  cdWave: number;         // Wave drag coefficient (C_D_wave)
  cd: number;             // Total drag coefficient (C_D)
  ldRatio: number;        // Lift-to-drag ratio (L/D)
  cm: number;             // Pitching moment coefficient about CG (C_M)
  staticMargin: number;   // Static stability margin (%)
  neutralPoint: number;   // Neutral point position (% MAC)
  oswaldEfficiency: number; // Oswald efficiency factor (e)
}

export interface PerformanceMetrics {
  totalMass: number;      // Actual takeoff/cruise mass [kg]
  stallSpeed: number;     // Stall speed [m/s]
  glideRatio: number;     // Maximum glide ratio
  breguetRange: number;   // Range calculated via Breguet equation [km]
  breguetEndurance: number; // Endurance calculated [hours]
  criticalMach: number;   // Estimating drag divergence Mach number
  climbRateMax: number;   // Calculated maximum rate of climb [m/s]
}

export interface OptimizationHistoryPoint {
  iteration: number;
  wingSpan: number;
  wingSweep: number;
  taperRatio: number;
  rootChord: number;
  ldRatio: number;
  range: number;
  cd: number;
  fitness: number;
}

export interface OptimizationResult {
  baselineGeometry: AircraftGeometry;
  optimizedGeometry: AircraftGeometry;
  baselineAero: AerodynamicCoefficients;
  optimizedAero: AerodynamicCoefficients;
  baselinePerformance: PerformanceMetrics;
  optimizedPerformance: PerformanceMetrics;
  history: OptimizationHistoryPoint[];
}

export interface StudentMetadata {
  studentName: string;
  university: string;
  internshipPeriod: string;
  mentorName: string;
  department: string;
}
