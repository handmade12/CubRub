export function OctopusMark() {
  return (
    <svg
      class="octopus-mark"
      viewBox="0 0 220 180"
      role="img"
      aria-label="Умный осьминог CubRub"
    >
      <defs>
        <linearGradient id="octopus-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9d8cff" />
          <stop offset="1" stop-color="#5c6cff" />
        </linearGradient>
        <filter id="octopus-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        class="octopus-tentacle"
        d="M68 103C38 108 37 137 16 143c-8 2-12-3-9-9"
      />
      <path
        class="octopus-tentacle"
        d="M83 112c-22 15-7 45-27 56-9 5-18 0-16-9"
      />
      <path
        class="octopus-tentacle"
        d="M137 112c22 15 7 45 27 56 9 5 18 0 16-9"
      />
      <path
        class="octopus-tentacle"
        d="M152 103c30 5 31 34 52 40 8 2 12-3 9-9"
      />
      <path
        d="M58 82c0-38 21-65 52-65s52 27 52 65c0 29-19 45-52 45S58 111 58 82Z"
        fill="url(#octopus-body)"
        filter="url(#octopus-glow)"
      />
      <path d="M83 61c9-11 45-11 54 0" fill="none" stroke="#dcd7ff" stroke-width="4" />
      <circle cx="91" cy="78" r="7" fill="#0a1020" />
      <circle cx="129" cy="78" r="7" fill="#0a1020" />
      <circle cx="93" cy="75" r="2" fill="#fff" />
      <circle cx="131" cy="75" r="2" fill="#fff" />
      <path
        d="M98 98c7 5 17 5 24 0"
        fill="none"
        stroke="#0a1020"
        stroke-width="4"
        stroke-linecap="round"
      />
      <path
        d="M110 17V5m-12 15-5-11m29 11 5-11"
        stroke="#b9b0ff"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle cx="110" cy="4" r="3" fill="#73e6cf" />
    </svg>
  );
}
