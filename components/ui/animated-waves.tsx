"use client";

export function AnimatedWaves() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/60 to-cyan-50/50">
      <style>{`
        @keyframes ondaScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .onda-slow  { animation: ondaScroll 20s linear infinite; }
        .onda-med   { animation: ondaScroll 13s linear infinite; }
        .onda-fast  { animation: ondaScroll 8s linear infinite; }
        .onda-rev   { animation: ondaScroll 16s linear infinite reverse; }
      `}</style>

      {/* ── Ondas no topo (invertidas) ── */}
      <div className="absolute top-0 left-0 right-0 h-36 rotate-180 opacity-70">
        <div className="onda-rev absolute inset-0 w-[200%]">
          <svg viewBox="0 0 2880 144" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="gt" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path
              d="M0,72 C240,144 480,0 720,72 C960,144 1200,0 1440,72
                 C1680,144 1920,0 2160,72 C2400,144 2640,0 2880,72
                 L2880,144 L0,144 Z"
              fill="url(#gt)"
            />
          </svg>
        </div>
      </div>

      {/* ── Ondas na base — camada de trás ── */}
      <div className="absolute bottom-0 left-0 right-0 h-72">
        <div className="onda-slow absolute inset-0 w-[200%]">
          <svg viewBox="0 0 2880 288" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="gb" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.14" />
              </linearGradient>
            </defs>
            <path
              d="M0,144 C360,0 720,288 1080,144 C1440,0 1800,288 2160,144
                 C2520,0 2880,288 2880,144 L2880,288 L0,288 Z"
              fill="url(#gb)"
            />
          </svg>
        </div>

        {/* Camada do meio */}
        <div className="onda-med absolute w-[200%]" style={{ top: "25%", bottom: 0 }}>
          <svg viewBox="0 0 2880 220" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="gm" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor="#0891b2" stopOpacity="0.13" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.13" />
              </linearGradient>
            </defs>
            <path
              d="M0,110 C480,220 960,0 1440,110 C1920,220 2400,0 2880,110
                 L2880,220 L0,220 Z"
              fill="url(#gm)"
            />
          </svg>
        </div>

        {/* Camada da frente */}
        <div className="onda-fast absolute w-[200%]" style={{ top: "48%", bottom: 0 }}>
          <svg viewBox="0 0 2880 160" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="gf" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C320,160 640,0 960,80 C1280,160 1600,0 1920,80
                 C2240,160 2560,0 2880,80 L2880,160 L0,160 Z"
              fill="url(#gf)"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
