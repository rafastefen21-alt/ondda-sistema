"use client";

const WAVES = [
  { top:  8,  period: 1100, amp: 20, speed: 28, reverse: false, color: "#2563eb", opacity: 0.12, width: 1.3 },
  { top: 22,  period: 800,  amp: 28, speed: 18, reverse: true,  color: "#06b6d4", opacity: 0.10, width: 1.1 },
  { top: 40,  period: 1400, amp: 14, speed: 38, reverse: false, color: "#3b82f6", opacity: 0.14, width: 1.0 },
  { top: 58,  period: 950,  amp: 24, speed: 22, reverse: true,  color: "#0891b2", opacity: 0.11, width: 1.2 },
  { top: 76,  period: 700,  amp: 18, speed: 15, reverse: false, color: "#1d4ed8", opacity: 0.13, width: 1.0 },
  { top: 90,  period: 1200, amp: 12, speed: 32, reverse: true,  color: "#60a5fa", opacity: 0.09, width: 0.9 },
];

function buildPath(period: number, amp: number, totalWidth = 5760): string {
  const cy   = amp + 2;
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

export function HeroWaves() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes heroWaveLine {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        ${WAVES.map((w, i) => `
          .hw-${i} {
            animation: heroWaveLine ${w.speed}s linear infinite ${w.reverse ? "reverse" : ""};
          }
        `).join("")}
      `}</style>

      {WAVES.map((w, i) => {
        const totalW = 5760;
        const svgH   = w.amp * 2 + 4;
        const path   = buildPath(w.period, w.amp, totalW);

        return (
          <div
            key={i}
            className={`hw-${i} absolute`}
            style={{
              top:       `${w.top}%`,
              left:      0,
              width:     `${totalW}px`,
              height:    `${svgH}px`,
              marginTop: `-${svgH / 2}px`,
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
