"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IconTile, Surface } from "@/components/ledger/primitives";
import { cn } from "@/lib/utils";

interface UploadFormProps {
  onUploaded?: () => void;
  variant?: "card" | "plain";
}

export function UploadForm({ onUploaded, variant = "card" }: UploadFormProps) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const showHeader = variant === "card";

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    const lowerName = nextFile.name.toLowerCase();
    if (!lowerName.endsWith(".qfx") && !lowerName.endsWith(".ofx")) {
      toast.error("Please choose a QFX or OFX file.");
      return;
    }
    setFile(nextFile);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        const uploadedBalance =
          data.ledgerBalance ?? data.availableBalance ?? null;

        if (data.errors?.length) {
          toast.warning(
            `Imported ${data.rowsInserted} transactions, but ${data.errors.length} warning(s) need review.`
          );
        } else {
          toast.success(
            `Mapped ${data.rowsInserted} new transactions to ${data.accountName}${
              uploadedBalance !== null ? ` with balance $${uploadedBalance}` : ""
            }.`
          );
        }
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
        onUploaded?.();
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const form = (
    <>
      {showHeader ? (
        <div className="space-y-4 p-4">
          <IconTile
            icon={FileUp}
            tone="light"
            className="h-9 w-9 rounded-xl shadow-none"
          />
          <div>
            <div className="text-sm font-semibold">Import a statement</div>
            <p className="mt-1 text-xs leading-5 text-neutral-300">
              QFX / OFX creates the account, dedupes transactions, and captures
              balances.
            </p>
          </div>
        </div>
      ) : null}
      <form onSubmit={handleUpload}>
        <div
          className={cn(
            "space-y-3 px-4 pb-4",
            variant === "plain" && "px-0 pb-0"
          )}
        >
          <div className="space-y-2">
            <Label htmlFor={inputId} className="text-xs text-neutral-300">
              Choose file
            </Label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".qfx,.ofx"
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            <label
              htmlFor={inputId}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "flex min-h-32 cursor-pointer flex-col justify-center gap-3 rounded-2xl border border-dashed px-4 text-sm text-white transition",
                isDragging
                  ? "border-teal-300 bg-teal-300/15"
                  : "border-white/15 bg-white/10 hover:bg-white/15"
              )}
            >
              <span className="font-semibold text-neutral-100">
                {isDragging ? "Drop statement here" : "Drop QFX / OFX here"}
              </span>
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-neutral-300">
                  {file?.name || "or browse from your computer"}
                </span>
                <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-neutral-300">
                  Browse
                </span>
              </span>
            </label>
          </div>
        </div>
        <div
          className={cn(
            "border-t border-white/10 bg-white/5 p-4",
            variant === "plain" && "mt-4 border-white/10 px-0 pb-0"
          )}
        >
          <Button
            type="submit"
            className="w-full bg-white text-xs text-neutral-950 hover:bg-neutral-200"
            disabled={isUploading || !file}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  );

  if (variant === "plain") {
    return form;
  }

  return (
    <Surface
      tone="dark"
      className="rounded-[1.5rem] shadow-2xl shadow-neutral-950/20"
    >
      {form}
    </Surface>
  );
}
