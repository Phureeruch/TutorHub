/**
 * Palette-matched geometric SVG marks & illustrations for TutorHub.
 * All fills and strokes consume CSS custom properties from client/src/index.css
 * (zero hardcoded hex values; decorative elements are aria-hidden).
 */

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="th-brand-mark"
    >
      <rect width="32" height="32" rx="9" fill="var(--th-navy)" />
      <rect x="6" y="7" width="20" height="5" rx="2.5" fill="var(--th-blue)" />
      <rect x="6" y="15" width="9" height="10" rx="2.5" fill="var(--th-cream)" />
      <rect x="18" y="15" width="8" height="4.5" rx="2" fill="var(--th-cream)" opacity="0.65" />
      <circle cx="22" cy="23" r="2.5" fill="var(--th-blue)" />
    </svg>
  )
}

export function IconArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function AuthHeroGraphic() {
  return (
    <svg
      viewBox="0 0 360 280"
      fill="none"
      aria-hidden="true"
      className="th-auth-art"
    >
      {/* Soft ambient glows */}
      <circle cx="290" cy="52" r="78" fill="var(--th-blue)" opacity="0.22" />
      <circle cx="62" cy="236" r="68" fill="var(--th-blue)" opacity="0.16" />

      {/* Main elevated schedule card */}
      <rect
        x="34"
        y="34"
        width="250"
        height="168"
        rx="16"
        fill="var(--th-cream-raised)"
      />
      {/* Card top header */}
      <rect x="52" y="54" width="34" height="34" rx="10" fill="var(--th-blue)" />
      <text
        x="69"
        y="76"
        textAnchor="middle"
        fill="var(--th-cream)"
        fontSize="13"
        fontWeight="700"
        fontFamily="var(--th-font-display)"
      >
        AL
      </text>
      <rect x="98" y="58" width="96" height="10" rx="5" fill="var(--th-navy)" />
      <rect x="98" y="75" width="66" height="7" rx="3.5" fill="var(--th-navy)" opacity="0.32" />
      <rect x="214" y="58" width="52" height="22" rx="11" fill="var(--th-blue-tint-strong)" />
      <rect x="225" y="66" width="30" height="6" rx="3" fill="var(--th-blue-button)" />

      {/* Hour slot track */}
      <rect x="52" y="106" width="214" height="28" rx="8" fill="var(--th-cream)" />
      <rect x="56" y="110" width="64" height="20" rx="6" fill="var(--th-blue-tint-strong)" />
      <rect x="124" y="110" width="68" height="20" rx="6" fill="var(--th-blue-button)" />
      <rect x="196" y="110" width="66" height="20" rx="6" fill="var(--th-blue-tint-strong)" />
      <rect x="139" y="117" width="38" height="6" rx="3" fill="var(--th-cream)" />

      {/* Subject pills */}
      <rect x="52" y="148" width="76" height="22" rx="11" fill="var(--th-cream-subtle)" />
      <rect x="64" y="156" width="52" height="6" rx="3" fill="var(--th-navy)" opacity="0.55" />
      <rect x="136" y="148" width="88" height="22" rx="11" fill="var(--th-cream-subtle)" />
      <rect x="148" y="156" width="64" height="6" rx="3" fill="var(--th-navy)" opacity="0.55" />

      {/* Floating confirmation badge card */}
      <rect
        x="166"
        y="174"
        width="162"
        height="72"
        rx="14"
        fill="var(--th-cream)"
        stroke="var(--th-blue)"
        strokeWidth="1.5"
      />
      <circle cx="194" cy="210" r="14" fill="var(--th-success-bg)" />
      <path
        d="M188 210.5L192.2 214.5L200.5 205.5"
        stroke="var(--th-success)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="218" y="197" width="88" height="9" rx="4.5" fill="var(--th-navy)" />
      <rect x="218" y="213" width="64" height="7" rx="3.5" fill="var(--th-blue-text)" opacity="0.7" />
    </svg>
  )
}

export function DiscoveryBannerArt() {
  return (
    <svg
      viewBox="0 0 220 92"
      fill="none"
      aria-hidden="true"
      className="th-banner-art"
    >
      <circle cx="176" cy="46" r="42" fill="var(--th-blue)" opacity="0.12" />
      <rect
        x="24"
        y="14"
        width="138"
        height="64"
        rx="12"
        fill="var(--th-raised)"
        stroke="var(--th-border-strong)"
        strokeWidth="1"
      />
      <rect x="38" y="27" width="24" height="24" rx="7" fill="var(--th-navy)" />
      <rect x="70" y="30" width="54" height="7" rx="3.5" fill="var(--th-navy)" />
      <rect x="70" y="42" width="38" height="5" rx="2.5" fill="var(--th-blue)" opacity="0.7" />
      <rect x="38" y="58" width="110" height="10" rx="5" fill="var(--th-blue-tint-strong)" />
      <rect x="68" y="58" width="44" height="10" rx="5" fill="var(--th-blue-button)" />

      {/* Accent calendar chip */}
      <rect
        x="146"
        y="26"
        width="54"
        height="46"
        rx="11"
        fill="var(--th-blue-button)"
      />
      <rect x="157" y="36" width="32" height="5" rx="2.5" fill="var(--th-cream)" opacity="0.7" />
      <rect x="157" y="47" width="22" height="14" rx="4" fill="var(--th-cream)" />
    </svg>
  )
}

export function EmptyStateArt({ kind }: { kind: 'search' | 'bookings' | 'schedule' }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="th-empty-art"
    >
      <rect width="48" height="48" rx="14" fill="var(--th-blue-tint)" />
      {kind === 'search' && (
        <>
          <circle cx="22" cy="22" r="8" stroke="var(--th-blue-text)" strokeWidth="2.2" />
          <line x1="28" y1="28" x2="34" y2="34" stroke="var(--th-navy)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {kind === 'bookings' && (
        <>
          <rect x="14" y="15" width="20" height="19" rx="4" stroke="var(--th-blue-text)" strokeWidth="2.2" />
          <line x1="14" y1="21" x2="34" y2="21" stroke="var(--th-blue-text)" strokeWidth="2" />
          <line x1="19" y1="12" x2="19" y2="17" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="29" y1="12" x2="29" y2="17" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {kind === 'schedule' && (
        <>
          <circle cx="24" cy="24" r="10" stroke="var(--th-blue-text)" strokeWidth="2.2" />
          <polyline
            points="24 18 24 24 28.5 26.5"
            stroke="var(--th-navy)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  )
}
