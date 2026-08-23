/** Inline SVG icon set (no external deps, keeps $0 stack). 1.6 stroke, currentColor. */
import React from 'react';

type P = { size?: number };
const s = (n = 18) => ({ width: n, height: n, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IconLogo = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 20h18L12 2Z" /></svg>
);
export const IconTarget = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>);
export const IconInbox = ({ size }: P) => (<svg {...s(size)}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z" /></svg>);
export const IconFolder = ({ size }: P) => (<svg {...s(size)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>);
export const IconMop = ({ size }: P) => (<svg {...s(size)}><path d="M12 3v11" /><path d="M9 14h6" /><path d="M8 14c0 1.5-2 2.5-2 6h12c0-3.5-2-4.5-2-6H8Z" /><path d="M9 17v3M12 16v4M15 17v3" /></svg>);
export const IconShield = ({ size }: P) => (<svg {...s(size)}><path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" /></svg>);
export const IconClock = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconAlert = ({ size }: P) => (<svg {...s(size)}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>);
export const IconBookmark = ({ size }: P) => (<svg {...s(size)}><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>);
export const IconCheck = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>);
export const IconBell = ({ size }: P) => (<svg {...s(size)}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
export const IconPlus = ({ size }: P) => (<svg {...s(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconSearch = ({ size }: P) => (<svg {...s(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconChevron = ({ size }: P) => (<svg {...s(size)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconUser = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
export const IconExternal = ({ size }: P) => (<svg {...s(size)}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const IconArticle = ({ size }: P) => (<svg {...s(size)}><path d="M5 3h11l4 4v14H5V3Z" /><path d="M15 3v4h4" /><path d="M8 12h8M8 16h8M8 8h3" /></svg>);
export const IconGithub = ({ size }: P) => (<svg {...s(size)}><path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C7.3 3.1 6.3 3.4 6.3 3.4a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 5 9.8c0 4.6 2.7 5.7 5.5 6-.4.4-.5.9-.5 2V21" /></svg>);
export const IconVideo = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></svg>);
export const IconX = ({ size = 20 }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7 8 8.2 12h-6.6l-5-6.6L5.6 22H2.5l7.5-8.6L2 2h6.8l4.6 6.1L18.9 2Zm-1.1 18h1.8L7.3 4H5.4l12.4 16Z" /></svg>);

/* ---- Kind glyphs (mockup parity) ---- */
export const IconTrophy = ({ size }: P) => (<svg {...s(size)}><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /><path d="M12 13v4M9 21h6M10 17h4l-.5 4h-3L10 17Z" /></svg>);
export const IconRocket = ({ size }: P) => (<svg {...s(size)}><path d="M12 3c3.5 1.5 5 5 5 8l-3 2H10L7 11c0-3 1.5-6.5 5-8Z" /><circle cx="12" cy="9" r="1.6" /><path d="M10 15c-1.5 1-2 3-2 5 2 0 4-.5 5-2M14 15c1.5 1 2 3 2 5-2 0-4-.5-5-2" /></svg>);
export const IconGift = ({ size }: P) => (<svg {...s(size)}><rect x="3.5" y="8.5" width="17" height="5" rx="1" /><path d="M5 13.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5M12 8.5V21" /><path d="M12 8.5S10.5 4 8 4a2 2 0 0 0 0 4.5M12 8.5S13.5 4 16 4a2 2 0 0 1 0 4.5" /></svg>);
export const IconIdea = ({ size }: P) => (<svg {...s(size)}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3Z" /></svg>);
export const IconEvent = ({ size }: P) => (<svg {...s(size)}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>);

/* ---- Source / brand marks (color comes from the tile) ---- */
export const IconYoutube = ({ size }: P) => (<svg {...s(size)}><rect x="2.5" y="6" width="19" height="12" rx="3.5" /><path d="m10.5 9.2 4.3 2.8-4.3 2.8V9.2Z" fill="currentColor" stroke="none" /></svg>);
export const IconNotion = ({ size }: P) => (<svg {...s(size)}><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8.5 16V9l6 7V9" /></svg>);
export const IconStripe = ({ size }: P) => (<svg {...s(size)}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 10c0-.9 1-1.3 2-1.3 1 0 2 .3 2.8.7M14.5 14c0 .9-1 1.3-2 1.3-1 0-2-.3-2.8-.7" /></svg>);
export const IconGlobe = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>);
