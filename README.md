# Aerodynamic Wing Configuration & Design Optimizer

An interactive aerospace design and parametric flight configuration simulator. This workstation provides interactive 3-View CAD blueprint visuals, automatic multivariable geometry optimization, and instant flight-stability diagnostics by leveraging fast, low-fidelity analytical and empirical aerodynamic formulations.

---

## 🚀 Key Engineering Controls

* **Interactive SVG 3-View CAD Workspace**: Instantly updates planform (top-down), side profile, and front aspects as parametric parameters are adjusted.
* **Parametric Flight Config Variables**: Simulates aerodynamic responses for aspect ratio ($AR$), quarter-chord sweep ($\Lambda$), taper ratio ($\lambda$), dihedral ($\Gamma$), and twist angle ($\theta$).
* **Heuristics Solver (Coordinate-Descent)**: Iteratively morphs geometry to maximize lift-to-drag ($L/D$), maximize Breguet flight range, or minimize structural empty weights.
* **Analytical Flight Stability Evaluator**: Verifies pitching restoring moments ($C_{M,cg}$) and longitudinal static stability margins.

---

## ✈️ Numerical & Physical Methodology: Analytical Approximations vs. Mesh-Based CFD

To enable real-time, instantaneous visual feedbacks and robust automated optimization replays inside a web environment, this tool utilizes **classical analytical and empirical formulations** rather than high-fidelity, mesh-based numerical solvers (such as finite-volume Navier-Stokes CFD or panel method boundary-element meshes). 

The physics engine (`src/physics.ts`) models swept three-dimensional wings using the following established aerospace methodologies:

1. **Lift-Curve Slope ($C_{L_\alpha}$)**: Estimated using **Helmbold's compressible swept-wing equation** which adapts 2D thin-airfoil slopes for 3D sweep, Aspect Ratio limitations, and Prandtl-Glauert compressibility terms ($\sqrt{1 - M^2}$).
2. **Parasitic Aerodynamic Drag ($C_{D_0}$)**: Solved using the **Component Buildup Method**, calculating flat-plate turbulent skin friction coefficients ($C_f$) based on flight Reynolds numbers ($Re$), combined with specific Form Factors ($FF$) for the wing, fuselage, and tail components.
3. **Induced Drag ($C_{D_i}$)**: Solved utilizing **Oswald Efficiency Factor ($e$) estimations** adapted from Raymer's swept-wing models, plus visual winglet aerodynamic enhancements.
4. **Cubic Wave Drag rise ($C_{D_{wave}}$)**: Captures compression wave shock divergence characteristics once local flight speed exceeds the sweep-enhanced critical Mach number.
5. **Pitching Stability ($C_{M,cg}$)**: Computes aircraft longitudinal static stability margin ($SM$) via horizontal tail plane efficiency offsets and neutral point ($NP$) approximations.

---

## 🛠 Tech Stack & Architecture

Built with a modular TypeScript full-stack structure for decoupled physics evaluations:

```
[Client Front-End] ───► Express Server ───► Aerodynamic Solvers ───► Core Analysis Reports
```

* **Core Aerodynamic Model** (`/src/physics.ts`): Evaluates Oswald efficiency factors, drag-polar decompositions, compressibility drag divergence ($M_{crit}$), and total operating mass.
* **Parameter Optimizer** (`/src/optimize.ts`): Coordinates candidate geometry sweeps, fitness scores, and parameter convergence trends.
* **Vector Render Viewport** (`/src/components/ThreeViewCanvas.tsx`): Renders clean orthographic projections using high-contrast vector drawing.
* **Dynamic Charting Suite** (`/src/components/AerodynamicCharts.tsx`): Displays high-precision graphical charts for Lift-to-Drag poles, flight envelope altitude tables, and optimization sweeps.

---

## ⚙️ Quickstart Guide

Ensure you have [Node.js](https://nodejs.org/) installed on your workspace.

### 1. Initialize environment properties
```bash
cp .env.example .env
```

### 2. Install package manifests
```bash
npm install
```

### 3. Run localized development server
```bash
npm run dev
```

### 4. Build and run production build
```bash
npm run build
npm run start
```

---

*This application is verified against standard transonic swept flight models.*
