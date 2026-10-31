import React from 'react';

export function Icon({ name, size = 18, className = '', strokeWidth = 1.7 }) {
  const icons = {
    orbit: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-28 12 12)" /><circle cx="20" cy="6" r="1" fill="currentColor" stroke="none" /></>,
    play: <path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M9 7v10M15 7v10" strokeWidth="2.4" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 2 7" /><path d="M4 4v6h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 21 10v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
    rocket: <><path d="M14 5c3-3 6-2 6-2s1 3-2 6l-5 5-4-4Z" /><path d="m9 10-4 1-2 3 6 1M13 14l-1 4-3 2-1-6M14 8l-4 4" /><circle cx="16.5" cy="6.5" r="1" /></>,
    blackhole: <><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-18 12 12)" /><path d="M5 5c2-2 5-3 8-2M19 19c-2 2-5 3-8 2" /></>,
    music: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    mute: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><path d="m16 14 5 5m0-5-5 5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    navigation: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="18" r="1" fill="currentColor" stroke="none" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    mouse: <><rect x="7" y="3" width="10" height="18" rx="5" /><path d="M12 3v6" /></>,
    drag: <><path d="M9 6h-4m0 0 2-2M5 6l2 2M15 6h4m0 0-2-2m2 2-2 2M9 18H5m0 0 2-2m-2 2 2 2M15 18h4m0 0-2 2m2-2-2-2" /><circle cx="12" cy="12" r="2.5" /></>,
    fullscreen: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
    gauge: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 4-4M7 17h10" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    check: <path d="m5 12 4 4L19 6" />,
    sparkles: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" /></>
  };

  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.orbit}
    </svg>
  );
}
