"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaginationState } from "@/lib/ledger";

interface PaginationProps {
  pagination: PaginationState;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  pagination,
  isLoading = false,
  onPageChange,
  className,
}: PaginationProps) {
  const pages = getVisiblePages(
    pagination.currentPage,
    pagination.totalPages
  );

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        Showing {getStartItem(pagination).toLocaleString()}-
        {getEndItem(pagination).toLocaleString()} of{" "}
        {pagination.totalItems.toLocaleString()} transactions
        {isLoading ? " · Loading..." : ""}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!pagination.hasPreviousPage || isLoading}
          onClick={() => onPageChange(pagination.currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-xs text-neutral-400"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === pagination.currentPage ? "default" : "outline"}
                disabled={isLoading}
                onClick={() => onPageChange(page)}
                aria-current={page === pagination.currentPage ? "page" : undefined}
                className="min-w-9"
              >
                {page}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          disabled={!pagination.hasNextPage || isLoading}
          onClick={() => onPageChange(pagination.currentPage + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

function getStartItem(pagination: PaginationState): number {
  if (pagination.totalItems === 0) return 0;
  return (pagination.currentPage - 1) * pagination.pageSize + 1;
}

function getEndItem(pagination: PaginationState): number {
  return Math.min(
    pagination.currentPage * pagination.pageSize,
    pagination.totalItems
  );
}

function getVisiblePages(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const visible: Array<number | "ellipsis"> = [];

  for (const page of sortedPages) {
    const previous = visible.at(-1);
    if (typeof previous === "number" && page - previous > 1) {
      visible.push("ellipsis");
    }
    visible.push(page);
  }

  return visible;
}
