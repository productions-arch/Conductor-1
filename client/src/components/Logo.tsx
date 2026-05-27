interface LogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

/**
 * Conductor mark: three interlocking arrows forming a triangle,
 * suggesting orchestration of three agents.
 */
export function Logo({ size = 24, className = "", showWordmark = false }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Conductor logo"
      >
        {/* Three interlocking arrows forming a rotational triangle */}
        <path d="M16 4 L26 22 L6 22 Z" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
        <path d="M16 4 L21 13" />
        <path d="M18.5 8.5 L21 13 L16.5 13.5" />
        <path d="M26 22 L16 22" />
        <path d="M21.5 19.5 L16 22 L18.5 26.5" />
        <path d="M6 22 L11 13" />
        <path d="M8.5 17 L11 13 L13.5 17.5" />
        <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
      </svg>
      {showWordmark && (
        <span className="font-semibold tracking-tight text-foreground">Conductor</span>
      )}
    </div>
  );
}
