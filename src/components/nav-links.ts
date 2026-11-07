import { IconAnalytics, IconCalendar, IconDashboard, IconDebts, IconGift, IconRepeat, IconTag, IconTransactions } from "./icons";

export const links = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/upcoming", label: "Upcoming", icon: IconCalendar },
  { href: "/transactions", label: "Transactions", icon: IconTransactions },
  { href: "/analytics", label: "Analytics", icon: IconAnalytics },
  { href: "/debts", label: "Debts", icon: IconDebts },
  { href: "/referrals", label: "Referrals", icon: IconGift },
  { href: "/subscriptions", label: "Subscriptions", icon: IconRepeat },
  { href: "/categories", label: "Categories", icon: IconTag },
];

/** Shortcuts to the "add" forms, used by the command palette. */
export const addActions = [
  { href: "/transactions?add=1#add", label: "Add expense or income", hint: "Log money in or out", keywords: "new transaction spend earn" },
  { href: "/upcoming", label: "Add upcoming payment", hint: "A bill or expected payment", keywords: "new bill due" },
  { href: "/debts", label: "Add debt or loan", hint: "Money lent or borrowed", keywords: "new lend borrow person" },
  { href: "/subscriptions", label: "Add subscription", hint: "A recurring service", keywords: "new recurring renewal" },
  { href: "/referrals", label: "Add referral", hint: "Referral payout", keywords: "new referral" },
];
