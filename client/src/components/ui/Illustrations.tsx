/**
 * Study & learning SVG illustrations and marks for TutorHub.
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
      {/* Mortarboard graduation cap top */}
      <path
        d="M16 6.5L5.5 11.5L16 16.5L26.5 11.5L16 6.5Z"
        fill="var(--th-blue)"
      />
      {/* Cap skullcap / base */}
      <path
        d="M10 14.3V18.8C10 20.6 12.7 22 16 22C19.3 22 22 20.6 22 18.8V14.3L16 17.2L10 14.3Z"
        fill="var(--th-cream)"
      />
      {/* Tassel */}
      <path
        d="M24.8 12.3V18.5"
        stroke="var(--th-cream)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="24.8" cy="19.5" r="1.4" fill="var(--th-blue)" />
      {/* Open book pages curve at bottom */}
      <path
        d="M8.5 24.5C11 23.3 13.8 23.5 16 24.8C18.2 23.5 21 23.3 23.5 24.5"
        stroke="var(--th-blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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
      {/* Ambient backdrop circles */}
      <circle cx="288" cy="54" r="76" fill="var(--th-blue)" opacity="0.22" />
      <circle cx="66" cy="230" r="68" fill="var(--th-blue)" opacity="0.16" />

      {/* Chalkboard / study whiteboard frame */}
      <rect
        x="32"
        y="26"
        width="248"
        height="154"
        rx="16"
        fill="var(--th-cream-raised)"
        stroke="var(--th-blue-border)"
        strokeWidth="1.5"
      />
      {/* Whiteboard header bar */}
      <rect x="46" y="40" width="220" height="24" rx="7" fill="var(--th-blue-tint)" />
      <circle cx="58" cy="52" r="4" fill="var(--th-navy)" />
      <circle cx="70" cy="52" r="4" fill="var(--th-blue)" />
      <text
        x="84"
        y="56"
        fill="var(--th-navy)"
        fontSize="10.5"
        fontWeight="700"
        fontFamily="var(--th-font-display)"
      >
        1-ON-1 LESSON BOARD
      </text>

      {/* Left panel: Math graph & formula curve */}
      <rect x="46" y="74" width="102" height="90" rx="10" fill="var(--th-cream)" />
      <line x1="58" y1="148" x2="136" y2="148" stroke="var(--th-navy)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="62" y1="86" x2="62" y2="152" stroke="var(--th-navy)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M62 142Q84 138 96 114T132 88"
        stroke="var(--th-blue-button)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="96" cy="114" r="3.5" fill="var(--th-navy)" />
      <circle cx="132" cy="88" r="3.5" fill="var(--th-blue-button)" />
      <text
        x="68"
        y="99"
        fill="var(--th-blue-text)"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--th-font-display)"
      >
        f(x) = x²
      </text>

      {/* Right panel: Code & study notes */}
      <rect x="156" y="74" width="110" height="90" rx="10" fill="var(--th-cream)" />
      <text
        x="168"
        y="95"
        fill="var(--th-blue-button)"
        fontSize="11.5"
        fontWeight="800"
        fontFamily="var(--th-font-display)"
      >
        {'</> Python'}
      </text>
      <rect x="168" y="105" width="76" height="6" rx="3" fill="var(--th-navy)" opacity="0.7" />
      <rect x="176" y="117" width="64" height="6" rx="3" fill="var(--th-blue)" />
      <rect x="176" y="129" width="52" height="6" rx="3" fill="var(--th-navy)" opacity="0.45" />
      <rect x="168" y="141" width="44" height="6" rx="3" fill="var(--th-success)" />

      {/* Open Textbook & Bookmark in foreground (bottom-left) */}
      <g transform="translate(26, 162)">
        <path
          d="M12 24C12 19.6 15.6 16 20 16H64C70 16 74 19.5 76 23C78 19.5 82 16 88 16H132C136.4 16 140 19.6 140 24V86C140 89.3 137.3 92 134 92H86C81 92 77.5 94.5 76 97C74.5 94.5 71 92 66 92H18C14.7 92 12 89.3 12 86V24Z"
          fill="var(--th-navy)"
        />
        {/* Left page */}
        <path
          d="M18 22H63C69 22 73 25 74.5 28.5V88C72.5 85 68.5 83 63 83H18V22Z"
          fill="var(--th-cream)"
        />
        {/* Right page */}
        <path
          d="M134 22H89C83 22 79 25 77.5 28.5V88C79.5 85 83.5 83 89 83H134V22Z"
          fill="var(--th-cream-raised)"
        />
        {/* Bookmark ribbon */}
        <path d="M96 22V54L103 48L110 54V22H96Z" fill="var(--th-blue)" />
        {/* Book page text lines */}
        <line x1="27" y1="36" x2="62" y2="36" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
        <line x1="27" y1="47" x2="58" y2="47" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
        <line x1="27" y1="58" x2="64" y2="58" stroke="var(--th-blue)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="27" y1="69" x2="50" y2="69" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
        <line x1="88" y1="64" x2="123" y2="64" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
        <line x1="88" y1="73" x2="114" y2="73" stroke="var(--th-navy)" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
      </g>

      {/* Floating Graduation Cap & Session Badge (bottom-right) */}
      <rect
        x="184"
        y="186"
        width="150"
        height="68"
        rx="14"
        fill="var(--th-cream)"
        stroke="var(--th-blue)"
        strokeWidth="1.5"
      />
      <rect x="196" y="199" width="42" height="42" rx="11" fill="var(--th-blue-tint-strong)" />
      {/* Mini graduation cap inside badge */}
      <path d="M217 207L203 213.5L217 220L231 213.5L217 207Z" fill="var(--th-navy)" />
      <path
        d="M209 217.5V223.5C209 226 212.6 228 217 228C221.4 228 225 226 225 223.5V217.5L217 221.2L209 217.5Z"
        fill="var(--th-blue-button)"
      />
      <text
        x="248"
        y="217"
        fill="var(--th-navy)"
        fontSize="11.5"
        fontWeight="800"
        fontFamily="var(--th-font-display)"
      >
        Study Ready
      </text>
      <text
        x="248"
        y="233"
        fill="var(--th-blue-text)"
        fontSize="10"
        fontWeight="600"
        fontFamily="var(--th-font-body)"
      >
        1h Aligned Slots
      </text>
    </svg>
  )
}

export function DiscoveryBannerArt() {
  return (
    <svg
      viewBox="0 0 240 100"
      fill="none"
      aria-hidden="true"
      className="th-banner-art"
    >
      {/* Soft circular study halo */}
      <circle cx="174" cy="50" r="44" fill="var(--th-blue-tint-strong)" />
      <circle cx="72" cy="58" r="32" fill="var(--th-blue-tint)" />

      {/* Floating formula / subject badge (top-left) */}
      <rect
        x="18"
        y="14"
        width="54"
        height="26"
        rx="8"
        fill="var(--th-cream)"
        stroke="var(--th-blue-border)"
        strokeWidth="1.2"
      />
      <text
        x="45"
        y="31"
        textAnchor="middle"
        fill="var(--th-blue-text)"
        fontSize="11.5"
        fontWeight="800"
        fontFamily="var(--th-font-display)"
      >
        ∑ f(x)
      </text>

      {/* Stacked study textbooks (bottom-left) */}
      <rect x="28" y="70" width="76" height="14" rx="4" fill="var(--th-navy)" />
      <rect x="31" y="73" width="68" height="8" rx="2" fill="var(--th-cream)" />
      <rect x="44" y="70" width="8" height="14" fill="var(--th-blue)" />

      <rect x="34" y="55" width="72" height="15" rx="4" fill="var(--th-blue-button)" />
      <rect x="37" y="58" width="64" height="9" rx="2" fill="var(--th-cream-raised)" />
      <rect x="82" y="55" width="7" height="15" fill="var(--th-navy)" />

      {/* Open Textbook in center-right */}
      <path
        d="M108 36C108 32.7 110.7 30 114 30H146C150.5 30 153.5 32.5 155 35.5C156.5 32.5 159.5 30 164 30H196C199.3 30 202 32.7 202 36V78C202 80.8 199.8 83 197 83H163C159 83 156.5 85 155 87C153.5 85 151 83 147 83H113C110.2 83 108 80.8 108 78V36Z"
        fill="var(--th-navy)"
      />
      {/* Left open page */}
      <path
        d="M113 34H145C149.5 34 152.5 36.2 153.8 39V79C152 76.8 149 75.5 145 75.5H113V34Z"
        fill="var(--th-cream-raised)"
      />
      {/* Right open page */}
      <path
        d="M197 34H165C160.5 34 157.5 36.2 156.2 39V79C158 76.8 161 75.5 165 75.5H197V34Z"
        fill="var(--th-cream)"
      />
      {/* Blue bookmark ribbon */}
      <path d="M172 34V56L177 51.5L182 56V34H172Z" fill="var(--th-blue-button)" />
      {/* Page study lines */}
      <line x1="120" y1="45" x2="145" y2="45" stroke="var(--th-navy)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="120" y1="53" x2="142" y2="53" stroke="var(--th-blue)" strokeWidth="2" strokeLinecap="round" />
      <line x1="120" y1="61" x2="146" y2="61" stroke="var(--th-navy)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <line x1="164" y1="63" x2="189" y2="63" stroke="var(--th-navy)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />

      {/* Graduation Mortarboard Cap perched above the book */}
      <path
        d="M155 8L127 20L155 32L183 20L155 8Z"
        fill="var(--th-navy)"
      />
      <path
        d="M155 10.5L133 20L155 29.5L177 20L155 10.5Z"
        fill="var(--th-blue-button)"
      />
      {/* Tassel */}
      <path
        d="M177 21.5V33"
        stroke="var(--th-navy)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="177" cy="34.5" r="2.2" fill="var(--th-blue-button)" />

      {/* Floating code/spark pill (top-right) */}
      <rect
        x="194"
        y="12"
        width="36"
        height="22"
        rx="11"
        fill="var(--th-blue-button)"
      />
      <text
        x="212"
        y="26.5"
        textAnchor="middle"
        fill="var(--th-cream)"
        fontSize="10"
        fontWeight="800"
        fontFamily="var(--th-font-display)"
      >
        A+
      </text>
    </svg>
  )
}

export function EmptyStateArt({ kind }: { kind: 'search' | 'bookings' | 'schedule' }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="th-empty-art"
    >
      <rect width="48" height="48" rx="14" fill="var(--th-blue-tint)" />
      {kind === 'search' && (
        <>
          {/* Open study book with magnifying glass */}
          <path
            d="M12 17C14.5 15.8 18 16 21 17.8V31C18 29.4 14.5 29.2 12 30.4V17Z"
            stroke="var(--th-navy)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M30 17C27.5 15.8 24 16 21 17.8V31C24 29.4 27.5 29.2 30 30.4V17Z"
            stroke="var(--th-navy)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="30" cy="28" r="5.5" fill="var(--th-cream)" stroke="var(--th-blue-button)" strokeWidth="2.2" />
          <line x1="34" y1="32" x2="37.5" y2="35.5" stroke="var(--th-blue-button)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {kind === 'bookings' && (
        <>
          {/* Study notebook with bookmark ribbon */}
          <rect x="14" y="12" width="20" height="24" rx="3.5" stroke="var(--th-navy)" strokeWidth="2.1" />
          <path d="M26 12V21L28.5 19L31 21V12" fill="var(--th-blue-button)" />
          <line x1="18.5" y1="22" x2="24" y2="22" stroke="var(--th-blue-text)" strokeWidth="2" strokeLinecap="round" />
          <line x1="18.5" y1="27" x2="29" y2="27" stroke="var(--th-navy)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
      {kind === 'schedule' && (
        <>
          {/* Study clock & graduation cap accent */}
          <circle cx="24" cy="25" r="10" stroke="var(--th-navy)" strokeWidth="2.1" />
          <polyline
            points="24 19.5 24 25 28 27.5"
            stroke="var(--th-blue-button)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  )
}
