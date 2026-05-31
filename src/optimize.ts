/**
 * Automated Aircraft Configuration Multi-Variable Optimizer Engine
 * Synthesizes coordinate descent search algorithms to maximize aerodynamic indices.
 */

import { AircraftGeometry, MissionProfile, OptimizationConfig, OptimizationHistoryPoint, OptimizationResult } from './types';
import { solveAerodynamics, solvePerformance } from './physics';

/**
 * Calculates fitness value based on objective selection and physical constraints
 */
export function calculateFitness(
  geometry: AircraftGeometry,
  mission: MissionProfile,
  config: OptimizationConfig
): { fitness: number; ld: number; range: number; cd: number } {
  // Solve aerodynamics at cruise lift (assume an average angle of attack, say 2.5 degrees for cruise lift)
  const cruiseAoA = 2.5;
  const aero = solveAerodynamics(geometry, mission, cruiseAoA);
  const perf = solvePerformance(geometry, mission, aero);

  let fitness = 0;

  switch (config.objective) {
    case 'max_ld':
      fitness = aero.ldRatio;
      break;

    case 'max_range':
      // Range is in km, typically 1,000 to 15,000 km. Normalize to scale
      fitness = perf.breguetRange / 100;
      break;

    case 'min_drag':
      // Minimize Cd. Lower drag is better, so fitness is 1 / Cd (scaled)
      fitness = 1.0 / Math.max(0.001, aero.cd);
      break;

    case 'multi_objective':
      // Balancing Lift-to-Drag, Range, and Structural efficiency.
      // Penalize:
      // - Severe structural Empty Weight penalty (excessive area/span)
      // - Unstable static margin (require margin to be between +5% MAC and +25% MAC)
      const ldScore = aero.ldRatio;
      const rangeScore = perf.breguetRange / 1000; // e.g. 15 for 15,000km
      
      let stabilityPenalty = 0;
      if (aero.staticMargin < 5) {
        // Unstable or borderline unstable
        stabilityPenalty = (5 - aero.staticMargin) * 50; // Heavy penalty
      } else if (aero.staticMargin > 25) {
        // Excessive stability leads to trim drag
        stabilityPenalty = (aero.staticMargin - 25) * 10;
      }

      // Weight penalty if MTOW gets absurdly high relative to span load
      const structuralWeightTerm = perf.totalMass / 100000; // MTOW in tons

      fitness = (ldScore * 0.4) + (rangeScore * 0.5) - stabilityPenalty - (structuralWeightTerm * 0.2);
      break;
  }

  // Sane bounds checking and absolute physical range constraints
  if (aero.ldRatio < 2.0 || isNaN(fitness) || !isFinite(fitness)) {
    fitness = 0.1;
  }

  return {
    fitness: Math.max(0.1, fitness),
    ld: aero.ldRatio,
    range: perf.breguetRange,
    cd: aero.cd
  };
}

/**
 * Runs the optimization routine. Instead of running blockingly in one synchronous loop,
 * it returns a complete list of historical design states. This allows the React UI to
 * "replay" the search phase, showing iterations converging live on the dashboard.
 */
export function runAutomatedOptimization(
  baseGeometry: AircraftGeometry,
  mission: MissionProfile,
  config: OptimizationConfig,
  maxIterations: number = 25
): OptimizationResult {
  const history: OptimizationHistoryPoint[] = [];
  
  // Create current geometry state copy to modify
  let currentGeom = { ...baseGeometry };

  // Track the absolute best configuration
  let bestGeom = { ...baseGeometry };
  let bestResult = calculateFitness(bestGeom, mission, config);
  let bestFitness = bestResult.fitness;

  // Initial historic datapoint
  history.push({
    iteration: 0,
    wingSpan: currentGeom.wingSpan,
    wingSweep: currentGeom.wingSweep,
    taperRatio: currentGeom.taperRatio,
    rootChord: currentGeom.rootChord,
    ldRatio: bestResult.ld,
    range: bestResult.range,
    cd: bestResult.cd,
    fitness: bestFitness,
  });

  // Step parameters
  const stepScales = {
    span: (config.maxSpan - config.minSpan) * 0.08,
    sweep: (config.maxSweep - config.minSweep) * 0.08,
    taper: (config.maxTaper - config.minTaper) * 0.08,
    chord: (config.maxChord - config.minChord) * 0.08,
  };

  // Run iterations of Coordinate Descent with simulated Annealing relaxation
  for (let iter = 1; iter <= maxIterations; iter++) {
    // Temperature term decay for search radius narrowing
    const temp = Math.max(0.1, 1.0 - (iter / maxIterations));

    // Array of possible moves based on enabled features
    const candidateGeometries: AircraftGeometry[] = [];

    // Helper to clamp and queue geometry moves
    const addCandidate = (g: AircraftGeometry) => {
      // Retain geometric aspect ratio / constraints (chord vs span)
      // rootChord cannot be wider than 0.35 times wingSpan
      g.rootChord = Math.min(g.wingSpan * 0.35, Math.max(0.5, g.rootChord));
      // Taper ratio limits
      g.taperRatio = Math.min(1.0, Math.max(0.05, g.taperRatio));
      
      candidateGeometries.push(g);
    };

    // 1. Span adjustments
    if (config.optimizeSpan) {
      const step = stepScales.span * temp;
      
      const geomPlus = { ...currentGeom, wingSpan: Math.min(config.maxSpan, currentGeom.wingSpan + step) };
      const geomMinus = { ...currentGeom, wingSpan: Math.max(config.minSpan, currentGeom.wingSpan - step) };
      addCandidate(geomPlus);
      addCandidate(geomMinus);
    }

    // 2. Sweep adjustments
    if (config.optimizeSweep) {
      const step = stepScales.sweep * temp;
      const geomPlus = { ...currentGeom, wingSweep: Math.min(config.maxSweep, currentGeom.wingSweep + step) };
      const geomMinus = { ...currentGeom, wingSweep: Math.max(config.minSweep, currentGeom.wingSweep - step) };
      addCandidate(geomPlus);
      addCandidate(geomMinus);
    }

    // 3. Taper adjustments
    if (config.optimizeTaper) {
      const step = stepScales.taper * temp;
      const geomPlus = { ...currentGeom, taperRatio: Math.min(config.maxTaper, currentGeom.taperRatio + step) };
      const geomMinus = { ...currentGeom, taperRatio: Math.max(config.minTaper, currentGeom.taperRatio - step) };
      addCandidate(geomPlus);
      addCandidate(geomMinus);
    }

    // 4. Root chord adjustments
    if (config.optimizeChord) {
      const step = stepScales.chord * temp;
      const geomPlus = { ...currentGeom, rootChord: Math.min(config.maxChord, currentGeom.rootChord + step) };
      const geomMinus = { ...currentGeom, rootChord: Math.max(config.minChord, currentGeom.rootChord - step) };
      addCandidate(geomPlus);
      addCandidate(geomMinus);
    }

    // If no variables selected, add slightly random search shake
    if (!config.optimizeSpan && !config.optimizeSweep && !config.optimizeTaper && !config.optimizeChord) {
      const scale = 0.05;
      const shakeGeom = { 
        ...currentGeom,
        wingSweep: Math.min(config.maxSweep, Math.max(config.minSweep, currentGeom.wingSweep + (Math.random() - 0.5) * 5)),
        wingSpan: Math.min(config.maxSpan, Math.max(config.minSpan, currentGeom.wingSpan + (Math.random() - 0.5) * 2)),
      };
      addCandidate(shakeGeom);
    }

    // Evaluate all moves
    let bestLocalGeom = { ...currentGeom };
    let bestLocalFitness = calculateFitness(currentGeom, mission, config).fitness;

    for (const g of candidateGeometries) {
      const result = calculateFitness(g, mission, config);
      if (result.fitness > bestLocalFitness) {
        bestLocalFitness = result.fitness;
        bestLocalGeom = { ...g };
      }
    }

    // Step with some thermal random offset to bypass local minima
    if (bestLocalFitness > bestFitness || Math.random() < 0.12 * temp) {
      currentGeom = { ...bestLocalGeom };
      
      const evalBestLocal = calculateFitness(currentGeom, mission, config);
      if (evalBestLocal.fitness > bestFitness) {
        bestFitness = evalBestLocal.fitness;
        bestGeom = { ...currentGeom };
      }
    }

    // Cache historical point
    const stepEval = calculateFitness(currentGeom, mission, config);
    history.push({
      iteration: iter,
      wingSpan: currentGeom.wingSpan,
      wingSweep: currentGeom.wingSweep,
      taperRatio: currentGeom.taperRatio,
      rootChord: currentGeom.rootChord,
      ldRatio: stepEval.ld,
      range: stepEval.range,
      cd: stepEval.cd,
      fitness: stepEval.fitness
    });
  }

  // Compute final specifications
  const baselineAero = solveAerodynamics(baseGeometry, mission, 2.5);
  const baselinePerformance = solvePerformance(baseGeometry, mission, baselineAero);

  const optimizedAero = solveAerodynamics(bestGeom, mission, 2.5);
  const optimizedPerformance = solvePerformance(bestGeom, mission, optimizedAero);

  return {
    baselineGeometry: baseGeometry,
    optimizedGeometry: bestGeom,
    baselineAero,
    optimizedAero,
    baselinePerformance,
    optimizedPerformance,
    history
  };
}
