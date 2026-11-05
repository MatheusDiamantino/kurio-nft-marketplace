export function ThankYouIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 68 82" width="68" height="82" fill="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M30 6 34 2l4 4" />
        <rect x="8" y="6" width="52" height="40" rx="3" />
        <path d="M2 34v42a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V34" />
        <path d="M2 34l6-5M66 34l-6-5" />
        <path d="M2 78l24-24M66 78 42 54" />
        <path d="M2 36l32 26 32-26" />
      </g>
      <text x="34" y="22" textAnchor="middle" fontFamily="Roboto Mono, monospace" fontWeight="700" fontSize="11" fill="currentColor">
        THANK
      </text>
      <text x="34" y="35" textAnchor="middle" fontFamily="Roboto Mono, monospace" fontWeight="700" fontSize="11" fill="currentColor">
        YOU
      </text>
    </svg>
  )
}
