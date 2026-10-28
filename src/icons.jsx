// Small line icons used across Nom in place of emoji and text symbols.
// They draw in `currentColor`, so they pick up the color of the text or button around them.

function Svg({ size = 14, style, children, strokeWidth = 2 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconCheck = (p) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IconX = (p) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconChevronRight = (p) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
export const IconChevronLeft = (p) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
export const IconHeart = (p) => <Svg {...p}><path d="M12 20s-7-4.35-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.2 1.1 3.9 2.2h3.6C14.5 6.1 15.7 5 17.7 5 21 5 22.7 8.4 21.2 11.4 19 15.65 12 20 12 20z" /></Svg>
export const IconComment = (p) => <Svg {...p}><path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1121 12z" /></Svg>
export const IconBookmark = (p) => <Svg {...p}><path d="M6 3.5h12a1 1 0 011 1V21l-7-4.5L5 21V4.5a1 1 0 011-1z" /></Svg>
export const IconUserPlus = (p) => <Svg {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6" /></Svg>
export const IconUserCheck = (p) => <Svg {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M16 11l2 2 4-4" /></Svg>
export const IconAt = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.9 7.9" /></Svg>
export const IconBell = (p) => <Svg {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></Svg>
export const IconPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IconLock = (p) => <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 018 0V11" /></Svg>
export const IconLockOpen = (p) => <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 017.7-1.5" /></Svg>
export const IconBook = (p) => <Svg {...p}><path d="M4 19V6a2 2 0 012-2h13v14H6a2 2 0 00-2 2zm0 0a2 2 0 002 2h13M9 8h6M9 12h4" /></Svg>
// A pot with steam, for logging a cook
export const IconPot = (p) => <Svg {...p}><path d="M4 11h16v5a4 4 0 01-4 4H8a4 4 0 01-4-4v-5zM2 11h2M20 11h2M9 7.5c0-1 1-1.5 1-2.5M14 7.5c0-1 1-1.5 1-2.5" /></Svg>
export const IconFeed = (p) => <Svg {...p}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></Svg>
export const IconCamera =(p) => <Svg {...p}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></Svg>
