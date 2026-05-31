# CFD Wing Configuration Optimizer

An interactive aerospace design and parametric flight configuration simulator. It features live multi-view CAD blueprint rendering, multi-discipline design optimization (MDO) solvers, Oswald efficiency drag-polar evaluations, and real-time longitudinal stability assessments.

---

## 🚀 Key Engineering Controls

* **Interactive SVG 3-View CAD Workspace**: Instantly updates planform (top-down), side profile, and front aspects as parametric parameters are adjusted.
* **Parametric Flight Config Variables**: Simulates aerodynamic responses for aspect ratio ($AR$), quarter-chord sweep ($\Lambda$), taper ratio ($\lambda$), dihedral ($\Gamma$), and twist angle ($\theta$).
* **Heuristics Solver (Coordinate-Descent)**: Iteratively morphs geometry to maximize lift-to-drag ($L/D$), maximize Breguet flight range, or minimize structural empty weights.
* **Analytical Flight Stability Evaluator**: Verifies pitching restoring moments ($C_{M,cg}$) and longitudinal static stability margins.

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
