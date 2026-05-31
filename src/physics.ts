/**
 * Aerodynamics Physics Solver and Standard Atmosphere Calculations
 * for Next-Generation Aircraft Optimization project
 */

import { AircraftGeometry, MissionProfile, AtmosphereProperties, AerodynamicCoefficients, PerformanceMetrics } from './types';

// Constants
const G0 = 9.80665; // Gravity acceleration [m/s²]
const R_AIR = 287.0528; // Specific gas constant of air [J/(kg·K)]

/**
 * Calculates atmospheric properties based on 1976 US Standard Atmosphere Model
 */
export function getAtmosphereProperties(altitudeFt: number): AtmosphereProperties {
  const z = altitudeFt / 3.28084; // Convert Ft to Meters

  let temperature = 288.15; // Sea-level temperature [K]
  let pressure = 101325;     // Sea-level pressure [Pa]

  if (z <= 11000) {
    // Troposphere
    const lapseRate = -0.0065; // [K/m]
    temperature = 288.15 + lapseRate * z;
    pressure = 101325 * Math.pow(temperature / 288.15, -G0 / (lapseRate * R_AIR));
  } else if (z <= 20000) {
    // Stratosphere lower isothermal layer
    temperature = 216.65;
    const p11 = 101325 * Math.pow(216.65 / 288.15, -G0 / (-0.0065 * R_AIR));
    pressure = p11 * Math.exp(-G0 * (z - 11000) / (R_AIR * temperature));
  } else {
    // Upper stratosphere (simplified linear gradient)
    const lapseRate = 0.001; // [K/m]
    temperature = 216.65 + lapseRate * (z - 20000);
    const p20 = 22632.06; // Pressure at 20km [Pa]
    pressure = p20 * Math.pow(temperature / 216.65, -G0 / (lapseRate * R_AIR));
  }

  const density = pressure / (R_AIR * temperature);
  const speedOfSound = Math.sqrt(1.4 * R_AIR * temperature);

  return { temperature, pressure, density, speedOfSound };
}

/**
 * Computes structural empty weight as a function of the airplane sizes to simulate physical weight penalties
 */
export function estimateEmptyWeight(geometry: AircraftGeometry, baseline: MissionProfile): number {
  const S_base = 120; // Reference wing area
  const b_base = 35;  // Reference wing span
  const L_base = 38;  // Reference fuselage length

  const dS = geometry.wingArea - S_base;
  const db = geometry.wingSpan - b_base;
  const dL = geometry.fuselageLength - L_base;

  // Mass scale factors:
  // - Heavier wings with bigger span (aspect ratio load) & wetted area
  // - Fuselage structural additions
  const wingAreaPenalty = dS * 145; // 145 kg per extra sq meter of wing
  const spanStructuralPenalty = db * 210 * (geometry.wingSpan / b_base); // Non-linear wing-bending structural scale
  const fuselagePenalty = dL * 340; // 340 kg per extra meter of fuselage length
  const diameterPenalty = (geometry.fuselageDiameter - 4.5) * 4500; // Fuselage bulkiness penalty

  const calculatedEmptyWeight = baseline.emptyWeightBaseline + wingAreaPenalty + spanStructuralPenalty + fuselagePenalty + diameterPenalty;

  // Guarantee valid physical lower bounds:
  return Math.max(baseline.emptyWeightBaseline * 0.4, calculatedEmptyWeight);
}

/**
 * Aerodynamic Solver computes multi-discipline aircraft coefficients
 */
export function solveAerodynamics(
  geometry: AircraftGeometry,
  mission: MissionProfile,
  alphaDeg: number
): AerodynamicCoefficients {
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

  const Mach = mission.mach;
  const altFt = mission.altitude;

  // Aspect Ratio (AR)
  const AR = (wingSpan * wingSpan) / wingArea;

  // Mean Aerodynamic Chord (MAC)
  // c_bar = (2/3) * c_root * (1 + lambda + lambda^2) / (1 + lambda)
  const mac = (2 / 3) * rootChord * (1 + taperRatio + taperRatio * taperRatio) / (1 + taperRatio);

  // Sweep angle in radians for structural/lifting calcs
  const sweepRad = (wingSweep * Math.PI) / 180;

  // 1. Oswald Efficiency Factor (e) estimation
  // Basic model from Raymer: e = 1.78 * (1 - 0.045 * AR^0.68) - 0.64
  let e_base = 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64;
  e_base = Math.max(0.65, Math.min(0.85, e_base)); // Keep in realistic ranges

  // Correct for wing sweep (which reduces oswald efficiency slightly due to load distribution)
  let oswaldEfficiency = e_base * Math.cos(sweepRad);

  // Apply visual winglet structural/aerodynamic boost
  if (wingletType === 'blended') {
    oswaldEfficiency += 0.045; // Reductions in tip vortex / induced drag
  } else if (wingletType === 'raked') {
    oswaldEfficiency += 0.038;
  } else if (wingletType === 'wingtip_fence') {
    oswaldEfficiency += 0.030;
  }
  oswaldEfficiency = Math.min(0.92, oswaldEfficiency); // Cap maximum oswald efficiency

  // 2. Lift-Curve Slope (clAlpha) using Helmbold's compressible swept wing equation
  // clAlpha_3D = (2 * pi * AR) / (2 + sqrt(AR^2 * (1 + tan^2(Sweep)) * (1 - M^2) + 4))
  const pi = Math.PI;
  // Prandtl-Glauert compressibility term (capped close to subsonic speed of sound)
  const betaSq = Math.max(0.1, 1 - Mach * Mach);
  const tanSweep = Math.tan(sweepRad);
  const radical = Math.sqrt((AR * AR * (1 + tanSweep * tanSweep) * betaSq) + 4);
  const clAlphaRad = (2 * pi * AR) / (2 + radical);
  const clAlpha = clAlphaRad * (pi / 180); // Convert from [per radian] to [per degree]

  // Lift Coefficient (C_L)
  // Assume a default symmetric/slightly cambered airfoil with zero-lift AoA at -1.5 degrees
  const alpha0 = -1.5;
  let cl = clAlpha * (alphaDeg - alpha0);

  // Multi-Segment stall limits
  const clMax = 1.6 + (wingletType !== 'none' ? 0.05 : 0) - 0.005 * AR;
  if (cl > clMax) {
    // Post-stall lift decay
    const stallExcess = alphaDeg - (alpha0 + clMax / clAlpha);
    cl = clMax - 0.04 * stallExcess - 0.002 * stallExcess * stallExcess;
    cl = Math.max(0.2, cl);
  } else if (cl < -0.8) {
    cl = -0.8;
  }

  // 3. Zero-Lift Drag (C_D_0) estimation via Component Buildup method
  // Wetted Area approximation
  const S_wet_wing = 2.0 * wingArea * (1 + 0.2 * 0.12); // upper + lower surfaces + structural thickness of 12%
  const S_wet_fuse = pi * fuselageDiameter * fuselageLength * 0.85; // cylindrical body factor
  const S_wet_tail = 2.0 * (tailplaneSpan * (tailplaneArea / tailplaneSpan)) * 1.15; // horizontal/vertical stabilization
  const S_wet_total = S_wet_wing + S_wet_fuse + S_wet_tail;

  // Flow Conditions - Reynolds number estimate at flight conditions
  const atmosphere = getAtmosphereProperties(altFt);
  const V_cruise = Mach * atmosphere.speedOfSound; // Speed [m/s]
  const kinematicViscosity = 1.458e-6 * Math.pow(atmosphere.temperature, 1.5) / (atmosphere.temperature + 110.4) / atmosphere.density;
  const Re = (V_cruise * mac) / Math.max(1e-6, kinematicViscosity);

  // Turbulent Skin Friction Coefficient (Cf)
  // Cf = 0.074 / Re^0.2 for flat plate turbulent boundary layers
  const Cf = 0.074 / Math.pow(Math.max(100000, Re), 0.2);

  // Form Factors (FF)
  // Wing thickness / chord ratio (assume 11.5% for swept transonic, 13% for straight wing)
  const tcRatio = wingSweep > 20 ? 0.105 : 0.125;
  const FF_wing = 1.0 + 1.2 * tcRatio + 100 * Math.pow(tcRatio, 4);

  // Fuselage fineness ratio
  const f_fuse = fuselageLength / fuselageDiameter;
  const FF_fuse = 1.0 + (60 / Math.pow(f_fuse, 3)) + 0.0025 * f_fuse;

  // Tail form factor (similar to wing)
  const FF_tail = 1.0 + 1.2 * 0.10 + 100 * Math.pow(0.10, 4);

  // Interference factor (Q) & Component Zero Lift Drags
  const Q_wing = 1.0;
  const Q_fuse = 1.0;
  const Q_tail = 1.05; // Tail junction interference penalty

  const cd0_wing = (Cf * FF_wing * Q_wing * S_wet_wing) / wingArea;
  const cd0_fuse = (Cf * FF_fuse * Q_fuse * S_wet_fuse) / wingArea;
  const cd0_tail = (Cf * FF_tail * Q_tail * S_wet_tail) / wingArea;

  // Add excrescence (rivets, steps) and cooling vents (generally +10% of skin friction)
  const excrescencePenalty = 0.10 * (cd0_wing + cd0_fuse + cd0_tail);
  const cd0 = cd0_wing + cd0_fuse + cd0_tail + excrescencePenalty;

  // 4. Induced Drag (C_D_i)
  // C_D_i = C_L^2 / (pi * AR * e)
  const cdi = (cl * cl) / (pi * AR * oswaldEfficiency);

  // 5. Wave Drag (C_D_wave) transonic compressibility rise
  // Sweeping wings increases drag divergence Mach numbers!
  // M_div = 0.86 * cos(Sweep) - 0.1 * Cl - 0.05 * AR^(0.15)
  const clTerm = Math.max(0, cl);
  const mDiv = 0.88 * Math.cos(sweepRad) - 0.08 * clTerm - 0.03 * Math.pow(AR, 0.2);
  let cdWave = 0;
  if (Mach > mDiv) {
    // Sharp cubic drag rise above wave drag rise Mach number
    const machExcess = Mach - mDiv;
    cdWave = 2.4 * Math.pow(machExcess, 2.5); // Rapid compression shock wave drag penalty
  }

  // Total Drag (C_D)
  const cd = cd0 + cdi + cdWave;

  // Lift-to-Drag Ratio (L/D)
  const ldRatio = cl / Math.max(0.005, cd);

  // 6. Longitudinal Stability Analysis (Neutral Point & Pitching Moment)
  // Distance from wing aerodynamic center to horizontal stabilizer ac
  const tailMomentArm = fuselageLength * 0.42; // Tail chord arm estimation
  // Tail volume coefficient V_h = (S_tail * L_tail) / (S * MAC)
  const V_h = (tailplaneArea * tailMomentArm) / (wingArea * mac);

  // Horizontal tail plane contribution to aircraft neutral point (X_np as % of MAC)
  // X_np = X_ac_wing + eta * V_h * (dCL_tail/dalpha) / (dCL_wing/dalpha)
  // simplified empirical form:
  const tailEfficiency = 0.88; // downwash and boundary layer effects
  const neutralPoint = 0.26 + tailEfficiency * V_h * 0.85; // Neutral point as fraction of MAC
  const cgPositionFraction = cgPosition / 100; // static cg fraction (e.g. 0.25)

  // Static Margin S.M. = (X_np - X_cg) * 100 [%]
  const staticMargin = (neutralPoint - cgPositionFraction) * 100;

  // Pitching Moment Coefficient at aircraft center of gravity
  // Cm_cg = Cm_0 + CL * (X_cg - X_ac) - tail_forces
  // Cm_cg = Cm_0 - SM * CL
  const cm0 = -0.045 - 0.005 * (wingSweep / 10); // Wing camber pitching moment
  const cm = cm0 - (neutralPoint - cgPositionFraction) * cl;

  return {
    aspectRatio: AR,
    mac,
    cl,
    clAlpha,
    cd0,
    cdi,
    cdWave,
    cd,
    ldRatio,
    cm,
    staticMargin,
    neutralPoint: neutralPoint * 100,
    oswaldEfficiency
  };
}

/**
 * Solves absolute Performance Metrics (Stall, Climb, Fuel, Range and Endurance)
 */
export function solvePerformance(
  geometry: AircraftGeometry,
  mission: MissionProfile,
  aero: AerodynamicCoefficients
): PerformanceMetrics {
  const atmosphere = getAtmosphereProperties(mission.altitude);

  // 1. Calculate aircraft mass
  // Total Mass = Structural Empty Mass + Payload + Fuel Mass
  const emptyMass = estimateEmptyWeight(geometry, mission);
  const totalMass = emptyMass + mission.payloadWeight + mission.fuelCapacity;

  // 2. Stall Speed [m/s]
  // V_stall = sqrt(2 * Mass * g_0 / (rho * S * CL_max))
  const clMax = 1.55 + (geometry.wingletType !== 'none' ? 0.05 : 0);
  const stallSpeed = Math.sqrt((2 * totalMass * G0) / (atmosphere.density * geometry.wingArea * clMax));

  // 3. Glide Ratio (L/D_max)
  // Maximum theoretical L/D = 0.5 * sqrt(pi * AR * e / cd0)
  const maxGlideRatio = 0.5 * Math.sqrt(Math.PI * aero.aspectRatio * aero.oswaldEfficiency / aero.cd0);

  // 4. Transonic Drag Divergence Critical Mach
  const criticalMach = 0.89 * Math.cos((geometry.wingSweep * Math.PI) / 180) - 0.03 * aero.aspectRatio;

  // 5. Jet Range via Breguet Range Equation
  // R = (V / sfc) * (L/D) * ln( W_start / W_end )
  // Speeds in m/s, sfc in kg/(N·h)
  // Let's convert sfc from [kg/(N·h)] to fuel flow scale.
  // Standard turbofan sfc = 0.5 to 0.85 kg/(N·h) => Jet engine thrust fuel rate
  // W_start = total mass, W_end = total mass minus 94% of fuel (assuming 6% reserve)
  const usableFuelFraction = 0.94;
  const wStart = totalMass * G0; // Mass to Force [N]
  const wEnd = (emptyMass + mission.payloadWeight + (1 - usableFuelFraction) * mission.fuelCapacity) * G0;

  const V_cruise = mission.mach * atmosphere.speedOfSound; // Speed [m/s]

  // Breguet calculation: Range [m] = (V / sfc_sec) * (L/D) * ln(W_0 / W_1)
  // SFC of let's say 0.65 kg/(N·hr) = 0.65 / 3600 kg/(N·sec)
  const sfcN_sec = (mission.sfc / 3600); // converting hr to sec
  const velocity_ms = V_cruise;

  // Jet flight range
  let breguetRange = 0;
  if (aero.ldRatio > 0) {
    const rangeMeters = (velocity_ms / (sfcN_sec * G0)) * aero.ldRatio * Math.log(wStart / wEnd);
    breguetRange = rangeMeters / 1000; // Convert to km
  }

  // 6. Endurance [hours]
  // T = (1 / sfc_sec) * (L/D) * ln( W_start / W_end )
  let breguetEndurance = 0;
  if (aero.ldRatio > 0) {
    const enduranceSec = (1 / (sfcN_sec * G0)) * aero.ldRatio * Math.log(wStart / wEnd);
    breguetEndurance = enduranceSec / 3600; // Convert to hours
  }

  // 7. Maximum Rate of Climb (R.C.)
  // Thrust estimated based on Cruise thrust levels + excess capacity
  // R.C. = V * (Thrust - Drag) / Mass
  // Thrust estimated at 22% of Takeoff weight on cruise
  const thrustTOW = totalMass * G0 * 0.28; // T/W ratio 0.28 in standard climb
  const dragForce = 0.5 * atmosphere.density * V_cruise * V_cruise * geometry.wingArea * aero.cd;
  let climbRateMax = (V_cruise * (thrustTOW - dragForce)) / (totalMass * G0);
  climbRateMax = Math.max(0.5, Math.min(65, climbRateMax)); // Sane physics clamps

  return {
    totalMass,
    stallSpeed,
    glideRatio: maxGlideRatio,
    breguetRange,
    breguetEndurance,
    criticalMach,
    climbRateMax
  };
}
