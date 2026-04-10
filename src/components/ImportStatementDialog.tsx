"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadForm } from "@/components/UploadForm";
import { ProductBadge, Surface } from "@/components/ledger/primitives";

export function ImportStatementDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-11 rounded-2xl bg-neutral-950 px-4 text-white shadow-xl shadow-neutral-950/15 hover:bg-neutral-800"
      >
        <FileUp className="mr-2 h-4 w-4" />
        Import statement
      </Button>

      {isOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-statement-title"
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            >
              <button
                type="button"
                aria-label="Close import dialog"
                className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />
              <Surface
                tone="dark"
                className="relative z-10 w-full max-w-lg rounded-[1.75rem] shadow-[0_30px_90px_rgba(0,0,0,0.36)]"
              >
                <div className="relative overflow-hidden p-5">
                  <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-teal-300/20 blur-3xl" />
                  <div className="absolute bottom-0 left-10 h-24 w-36 rounded-full bg-orange-300/15 blur-3xl" />
                  <div className="relative mb-5 flex items-start justify-between gap-4">
                    <div>
                      <ProductBadge icon={FileUp} tone="dark">
                        Statement import
                      </ProductBadge>
                      <h2
                        id="import-statement-title"
                        className="mt-4 text-2xl font-semibold tracking-[-0.04em]"
                      >
                        Add QFX / OFX data
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-neutral-300">
                        Drop a bank or card statement here. Existing accounts
                        and transactions are detected during ingestion.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
                      onClick={() => setIsOpen(false)}
                      aria-label="Close import dialog"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <UploadForm
                    variant="plain"
                    onUploaded={() => setIsOpen(false)}
                  />
                </div>
              </Surface>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
