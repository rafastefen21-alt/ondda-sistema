"use client";

// Each wave line definition
// top:      vertical position (% of screen)
// period:   horizontal cycle length in px (controls "zoom" of the wave)
// amp:      vertical amplitude in px
// speed:    scroll duration in seconds
// reverse:  direction
// color:    stroke color
// opacity:  stroke opacity
// width:    stroke width
const WAVES = [
  { top:  4, period: 900,  amp: 28, speed: 26, reverse: false, color: "#2563eb", opacity: 0.18, width: 1.4 },
  { top: 14, period: 1200, amp: 18, speed: 35, reverse: true,  color: "#06b6d4", opacity: 0.13, width: 1.0 },
  { top: 25, period: 720,  amp: 32, speed: 18, reverse: false, color: "#3b82f6", opacity: 0.22, width: 1.6 },
  { top: 36, period: 1440, amp: 14, speed: 42, reverse: true,  color: "#0891b2", opacity: 0.12, width: 0.9 },
  { top: 48, period: 960,  amp: 36, speed: 14, reverse: false, color: "#1d4ed8", opacity: 0.20, width: 1.5 },
  { top: 59, period: 1100, amp: 22, speed: 30, reverse: true,  color: "#0ea5e9", opacity: 0.15, width: 1.1 },
  { top: 70, period: 800,  amp: 30, speed: 20, reverse: false, color: "#2563eb", opacity: 0.18, width: 1.4 },
  { top: 80, period: 1300, amp: 16, speed: 38, reverse: true,  color: "#06b6d4", opacity: 0.13, width: 1.0 },
  { top: 90, period: 680,  amp: 24, speed: 16, reverse: false, color: "#60a5fa", opacity: 0.16, width: 1.2 },
];

/** Builds a seamless sinusoidal path for a given period, amplitude, and total width (2× viewport). */
function buildPath(period: number, amp: number, totalWidth = 5760): string {
  const cy = amp + 2; // center y with a little padding
  const cp1x = period / 4;
  const cp2x = (3 * period) / 4;
  const cycles = Math.ceil(totalWidth / period) + 1;

  let d = `M0,${cy}`;
  for (let i = 0; i < cycles; i++) {
    const x0 = i * period;
    d += ` C${x0 + cp1x},${cy - amp} ${x0 + cp2x},${cy + amp} ${x0 + period},${cy}`;
  }
  return d;
}

export function AnimatedWaves() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-cyan-50/40">
      <style>{`
        @keyframes waveLine {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        ${WAVES.map((_, i) => `
          .wl-${i} {
            animation: waveLine ${WAVES[i].speed}s linear infinite ${WAVES[i].reverse ? "reverse" : ""};
          }
        `).join("")}
      `}</style>

      {WAVES.map((w, i) => {
        const totalW = 5760; // 200% of 2880 (common screen width)
        const svgH   = w.amp * 2 + 4;
        const path   = buildPath(w.period, w.amp, totalW);

        return (
          <div
            key={i}
            className={`wl-${i} absolute`}
            style={{
              top:    `${w.top}%`,
              left:   0,
              width:  `${totalW}px`,
              height: `${svgH}px`,
              marginTop: `-${svgH / 2}px`, // center the line on the top% position
            }}
          >
            <svg
              viewBox={`0 0 ${totalW} ${svgH}`}
              preserveAspectRatio="none"
              width={totalW}
              height={svgH}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d={path}
                fill="none"
                stroke={w.color}
                strokeWidth={w.width}
                strokeOpacity={w.opacity}
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
