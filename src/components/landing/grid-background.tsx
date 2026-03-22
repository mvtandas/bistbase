export function GridBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ animation: "gridPulse 4s ease-in-out infinite" }}
      >
        <defs>
          <pattern id="grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1" fill="currentColor" />
          </pattern>
          <radialGradient id="grid-mask" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" />
            <stop offset="70%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-fade">
            <rect width="100%" height="100%" fill="url(#grid-mask)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#grid-dots)"
          className="text-foreground/[0.04]"
          mask="url(#grid-fade)"
        />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.673_0.182_276.935/0.08),transparent_70%)]" />
    </div>
  );
}
