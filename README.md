# Computational Fluid Dynamics (CFD) Wing Configuration Optimizer

A high-fidelity computational design, simulation, and parametric optimization application for next-generation flight vehicles. This workspace is designed for aerospace researchers and CFD engineers to experiment with aerodynamic configurations, analyze transonic drag delay sweep equations, evaluate lateral-directional and longitudinal pitch stability, and run coordinate-descent optimizations.

---

## Technical Overview & Design Features

This simulation suite integrates classical aerodynamics, compressible fluid mechanics, and structural weight modeling to perform multi-disciplinary design optimization (MDO) on clean-sheet aircraft configurations.

### 1. Interactive 3-View Blueprint CAD Rendering
* **Modular Geometry Visualizations**: Generates dynamic orthographic (Top, Front, Side) projections using high-performance vector rendering.
* **Component-Level Highlight Indicators**: Selecting aircraft variables immediately illustrates corresponding scale factors on the interactive canvas.
* **Aspect Ratio & Sweep Interlocking**: Displays real-time chord decay rates, span lines, and quarter-chord sweep limits.

### 2. Multi-Objective Parametric Optimization Engine
* **Coordinate-Descent Solvers**: Solves multi-variable heuristics to locate optimal combinations of aspect ratio, wing taper, twist, and sweep.
* **Custom Mission Performance Targets**:
  * **Aerodynamic Efficiency ($L/D$) Max**: Prioritizes reducing induced-vortex drag fractions.
  * **Breguet Flight Range Max**: Factors in weight scaling constraints, cruise speed boundaries, and specific fuel consumption (SFC).
  * **Total Mass Minimization**: Targets structural empty weight limits and cabin envelope metrics.
* **Physical Constraints Gating**: Rejects mathematically unfeasible configurations using hardcoded aerodynamic limits.

### 3. High-Fidelity Physics Solver & Aerodynamics Model
* **Drag-Polar Decomposition**: Models total drag coefficient as:
  $$C_D = C_{D0} + \frac{C_L^2}{\pi \cdot e \cdot AR} + C_{D,\text{wave}}$$
* **Pitch Restoring Moments**: Checks longitudinal stability margins to ensure the neutral point resides behind the user's defined Center of Gravity (CG).
* **Transonic Compressibility Wave Drag**: Models drag divergence above critical Mach limits using swept-wing transonic delay scaling.

---

## Project Structure & Architecture

The system is organized to decouple core engineering solvers from the UI view rendering:

* `/src/types.ts`: Strongly-typed aerodynamic declarations, flight geometry models, and configuration states.
* `/src/physics.ts`: Core aerodynamics module. Computes lift coefficients ($C_L$), drag polar curves ($C_{D0}, C_{Di}$), structural weight estimates, and trim states.
* `/src/optimize.ts`: Coordinates parametric perturbation sweeps and fitness evaluation passes.
* `/src/components/ThreeViewCanvas.tsx`: High-contrast, responsive SVG aerospace workspace visualizer.
* `/src/components/AerodynamicCharts.tsx`: Renders high-precision charts for Lift-to-Drag poles, Flight Envelope altitude matrices, and historical Optimization Paths.
* `/server.ts`: Whitelabel consultation and analysis review protocol proxy server. Returns deep structural peer memos.

---

## Development & Deployment Quickstarts

To configure and run the aerodynamic workspace locally or within your continuous integration pipeline:

### 1. Setup Environment
Provide your credentials in a standard local configuration file:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The server will boot and serve the client on the standard port (e.g., http://localhost:3000).

### 4. Direct Production Compilation
To bundle the frontend application assets and compile the automated performance review backend:
```bash
npm run build
npm run start
```

---

*This fluid dynamics suite is validated using standard modern aerospace reference models.*
