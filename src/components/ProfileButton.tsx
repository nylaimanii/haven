"use client";

import { useEffect, useState } from "react";

import { User, X } from "lucide-react";

import ProfilePanel from "./ProfilePanel";

export default function ProfileButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open profile"
        className="fixed right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-haven-hairline bg-haven-surface/80 text-muted-foreground shadow-xl backdrop-blur-md transition-colors hover:text-foreground"
      >
        <User className="size-4" />
      </button>

      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your profile"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 h-full w-full max-w-sm border-l border-haven-hairline bg-haven-surface shadow-2xl backdrop-blur-md transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-haven-hairline px-6 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Your profile</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <ProfilePanel />
      </aside>
    </>
  );
}
