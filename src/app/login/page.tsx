import { LoginForm } from "@/components/forms/login-form";
import { IconWallet } from "@/components/icons";

export const metadata = { title: "Sign in · Finance Tracker" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-ink"><IconWallet className="h-5 w-5" /></div>
          <h1 className="text-xl font-semibold">Finance Tracker</h1>
          <p className="mt-1 text-sm text-ink-2">Enter your password to continue.</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </div>
  );
}
