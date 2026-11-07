"use client";

import type { ComponentProps } from "react";

/** GET form that re-submits as soon as any field changes, so filters apply without a button. */
export function AutoSubmitForm(props: ComponentProps<"form">) {
  return <form method="get" {...props} onChange={(e) => e.currentTarget.requestSubmit()} />;
}
