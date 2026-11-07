import type { ReactNode, SVGProps } from "react";

/** Stroke icons on a 24px grid; they inherit size from className (default 16px) and color from text. */
function icon(paths: ReactNode) {
  return function Icon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={className}
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const IconDashboard = icon(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const IconCalendar = icon(<><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" /></>);
export const IconTransactions = icon(<><path d="M4 8h14M14 4l4 4-4 4" /><path d="M20 16H6M10 12l-4 4 4 4" /></>);
export const IconAnalytics = icon(<><path d="M3 21h18" /><rect x="5" y="11" width="3.5" height="7" rx="1" /><rect x="10.25" y="6" width="3.5" height="12" rx="1" /><rect x="15.5" y="13" width="3.5" height="5" rx="1" /></>);
export const IconDebts = icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 7.5h4M19 5.5v4" /><path d="M17 14.5h4" /></>);
export const IconRepeat = icon(<><path d="M17 2.5l3.5 3.5L17 9.5" /><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13" /><path d="M7 21.5L3.5 18 7 14.5" /><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13" /></>);
export const IconTag = icon(<><path d="M3 12.2V4a1 1 0 0 1 1-1h8.2a1 1 0 0 1 .7.3l8.2 8.2a1 1 0 0 1 0 1.4l-8.2 8.2a1 1 0 0 1-1.4 0L3.3 12.9a1 1 0 0 1-.3-.7Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" /></>);
export const IconWallet = icon(<><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /><path d="M3 6.5A2.5 2.5 0 0 0 5.5 9h14A1.5 1.5 0 0 1 21 10.5v4a1.5 1.5 0 0 1-1.5 1.5H16a3 3 0 0 1 0-6" /><circle cx="16.5" cy="13" r="0.6" fill="currentColor" /></>);
export const IconGift = icon(<><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12M12 8v13" /><path d="M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8Zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8Z" /></>);
export const IconLogout = icon(<><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="M10 16.5L14.5 12 10 7.5M14.5 12H4" /></>);

export const IconMenu = icon(<path d="M4 6.5h16M4 12h16M4 17.5h16" />);
export const IconX = icon(<path d="M6 6l12 12M18 6L6 18" />);

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconChevronDown = icon(<path d="M6 9l6 6 6-6" />);
export const IconSearch = icon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconRefresh = icon(<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20.5V16h-4.5" /></>);

// status
export const IconAlert = icon(<><path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></>);
export const IconCheck = icon(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>);
export const IconHalf = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></>);
export const IconCircle = icon(<circle cx="12" cy="12" r="9" />);
export const IconClock = icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>);
export const IconSparkle = icon(<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9Z" />);
export const IconArrowUp = icon(<path d="M12 19V5M6 11l6-6 6 6" />);
export const IconArrowDown = icon(<path d="M12 5v14M6 13l6 6 6-6" />);
