import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/nav";
import { Toaster } from "@/components/toaster";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE, parseTheme } from "@/lib/constants";
import { logout } from "./actions";
import { SESSION_COOKIE } from "@/lib/session";
import "./globals.css";
import { IconLogout } from "@/components/icons";

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "Personal + Infinity Linkage finances, backed by Google Sheets",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const signedIn = !!jar.get(SESSION_COOKIE);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-full">
        {signedIn || !process.env.APP_PASSWORD ? (
          <>
            <Sidebar
              footer={
                <>
                  <ThemeToggle initial={theme} />
                  {process.env.APP_PASSWORD && (
                    <form action={logout}>
                      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                        <IconLogout className="h-[18px] w-[18px]" />Log out
                      </button>
                    </form>
                  )}
                </>
              }
            />
            <div className="lg:pl-60">
              <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 lg:px-8">{children}</main>
            </div>
          </>
        ) : (
          <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
        )}
        <Toaster />
      </body>
    </html>
  );
}
