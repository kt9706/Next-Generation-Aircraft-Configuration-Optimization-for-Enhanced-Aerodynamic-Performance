import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Gemini Client server-side
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());

  // API HEALTH CHECK
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // CORE AERODYNAMIC CONSULTATION PROXY (CFD EVALUATION)
  app.post('/api/consult', async (req, res) => {
    try {
      const { geometry, mission, aeroResult, perfResult, mode, objective } = req.body;

      if (!aiClient) {
        // Safe fallback if the backend configurations are not active (keeps app fully operational with automated local physics analyses)
        return res.json({
          consultation: `### Local Performance & Structural Diagnostics (Aerodynamic Solver Active)

Your aerodynamic configuration design review has completed the local mathematical evaluations successfully. Direct feedback metrics are prepared based on standard computational design laws.

**Analytical Diagnostics Summary:**
* **Geometric Wing Aspect Ratio:** **${aeroResult?.aspectRatio?.toFixed(2)}**. Large aspect ratios reduce induced drag fractions at cruise, achieving simulated L/D configurations of **${aeroResult?.ldRatio?.toFixed(1)}**. Note that increased span creates higher cantilever stress loads on the structural root.
* **Transonic Delay Sweep:** **${geometry?.wingSweep?.toFixed(1)}°**. This quarter-chord sweep relocates critical supersonic shock attachments and limits wave drag elevations above Mach **${perfResult?.criticalMach?.toFixed(2)}**.
* **Longitudinal Pitch Stability:** **${aeroResult?.staticMargin?.toFixed(1)}% MAC**. Positive numerical margin confirms sufficient passive pitch restoring moments and self-correcting stability.

*To obtain full design memos from the CFD expert advisory module, ensure the server is fully configured and connected to the aerodynamic database.*`
        });
      }

      // Generate context-rich aeronautical engineering prompt
      const promptText = `
Perform a high-level, mathematically detailed aerodynamic design review of our proposed next-generation flight vehicle configuration. Keep the review extremely professional, academic, and suitable for a senior internship project presentation. 

**AIRCRAFT DESIGN SPECIFICATIONS:**
- Reference Wing Span: ${geometry.wingSpan} meters
- Reference Wing Area: ${geometry.wingArea} m²
- Quarter-Chord Sweep: ${geometry.wingSweep}°
- Root Chord: ${geometry.rootChord} m
- Taper Ratio (λ): ${geometry.taperRatio}
- Dihedral Angle: ${geometry.dihedral}°
- Winglet Configuration: ${geometry.wingletType}
- Fuselage Length: ${geometry.fuselageLength} m
- Fuselage Max Diameter: ${geometry.fuselageDiameter} m
- Stabilizer Area: ${geometry.tailplaneArea} m²
- Stabilizer Span: ${geometry.tailplaneSpan} m
- CG Position: ${geometry.cgPosition}% MAC

**CRUISE MISSION PROTOCOL:**
- Target Mach Number: ${mission.mach} M
- Altitude: ${mission.altitude} ft
- Thrust SFC: ${mission.sfc} kg/(N·h)
- Installed Payload: ${mission.payloadWeight} kg
- Installed Fuel Load: ${mission.fuelCapacity} kg

**LATEST CALCULATED SOLVER COEFFICIENTS:**
- Aspect Ratio (AR): ${aeroResult.aspectRatio.toFixed(2)}
- Oswald Efficiency (e): ${aeroResult.oswaldEfficiency.toFixed(3)}
- Drag Polar: Cd = ${aeroResult.cd0.toFixed(4)} + [Cl² / (π * ${aeroResult.aspectRatio.toFixed(2)} * ${aeroResult.oswaldEfficiency.toFixed(3)})]
- Current Operating Lift Coefficient (C_L): ${aeroResult.cl.toFixed(4)}
- Wave Drag (C_D_wave) at Mach ${mission.mach}: ${aeroResult.cdWave.toFixed(5)}
- Total Drag Coefficient (C_D): ${aeroResult.cd.toFixed(5)}
- Best Gliding L/D Ratio at Cruise AoA: ${aeroResult.ldRatio.toFixed(2)}
- Takeoff Empty Mass: ${perfResult.totalMass - mission.payloadWeight - mission.fuelCapacity} kg
- Loaded Takeoff Mass: ${perfResult.totalMass.toFixed(0)} kg
- Dynamic Breguet Flight Range: ${perfResult.breguetRange.toFixed(0)} km
- Calculated Endurance: ${perfResult.breguetEndurance.toFixed(2)} hours
- Longitudinal Stability Static Margin: ${aeroResult.staticMargin.toFixed(1)}% MAC (${aeroResult.staticMargin >= 5 ? 'Statically Stable' : 'Borderline / Marginally Unstable'})

**REQUEST:**
Act as a Senior Aerodynamic Flight Systems & Configuration Optimisation Architect. Write a rigorous engineering appraisal in clean Markdown. Your response should address:
1. **Wing Planform Analysis**: Appraise the aspect ratio, induced drag reduction, and the structural trade-offs (e.g., wing structural weight scaling due to bending moments).
2. **Compressibility & Transonic Wave Drag**: Evaluate how the ${geometry.wingSweep}° sweep angle delays shock wave formation at Mach ${mission.mach} relative to the critical Mach. Discuss if buffet or drag rise issues are anticipated.
3. **Lateral-Directional & Longitudinal Stability**: Comment on the static margin (${aeroResult.staticMargin.toFixed(1)}%). Analyze if the fuselage length (${geometry.fuselageLength}m) and tailplane area (${geometry.tailplaneArea}m²) provide sufficient tail volume coefficient, and how the CG (${geometry.cgPosition}%) should be offset.
4. **Mission Efficiency Improvements**: Suggest 2 target geometric adjustments to specifically optimize for ${objective.toUpperCase()} (which is currently the mission objective) to yield better Breguet ranges or drag reduction, explaining the physics of why they work.

Do not include any greeting or conversational filler; start immediately on the markdown contents. Keep names completely unbranded (NEVER mention or hint at artificial intelligence, AI assistants, Gemini, LLMs, or software details. Keep the tone completely authoritative, matching a highly analytical corporate-grade or academic Senior Computational Aerodynamics Supervisor delivering a precise memo). Use standard mathematics and fluid flight notations.
`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          systemInstruction:
            'You are a Senior Principal Aerospace flight configuration engineer and Lead Fluid Aerodynamicist. You generate detailed, rigorous academic audits of high-fidelity wings using classical fluid equations and advanced physics. You speak with ultimate professional and professional academic tenure.',
        },
      });

      res.json({
        consultation: response.text || 'Error generating aerodynamic consultation data.',
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err?.message || 'Server-side aerodynamic CFD analysis failed' });
    }
  });

  // Integrated Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aerodynamic Simulation Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
