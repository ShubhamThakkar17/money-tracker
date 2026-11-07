"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { IconAlert, IconRefresh } from "@/components/icons";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const notion = /sheets|google|fetch|network|timed? ?out|ECONN/i.test(error.message);
  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl border border-line bg-surface p-6 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-critical/12 text-critical-text">
        <IconAlert className="h-5 w-5" />
      </span>
      <h1 className="text-base font-semibold">Couldn&apos;t load this page</h1>
      <p className="mt-1 text-sm text-ink-2">
        {notion ? "Google Sheets didn't respond. Check your connection and try again." : "Something went wrong while loading. Try again in a moment."}
      </p>
      <Button className="mt-5" onClick={reset}><IconRefresh className="h-4 w-4" />Try again</Button>
    </div>
  );
}
