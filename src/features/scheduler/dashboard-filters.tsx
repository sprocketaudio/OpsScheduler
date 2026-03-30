"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DashboardFiltersProps = {
  initialSearch: string;
  myItemsOnly: boolean;
};

function buildHref(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function DashboardFilters({ initialSearch, myItemsOnly }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(initialSearch);

  useEffect(() => {
    setSearchDraft(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const normalizedSearch = searchDraft.trim();
    if (normalizedSearch === initialSearch) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (normalizedSearch) {
        nextParams.set("q", normalizedSearch);
      } else {
        nextParams.delete("q");
      }

      router.replace(buildHref(pathname, nextParams), {
        scroll: false,
      });
    }, 220);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [initialSearch, pathname, router, searchDraft, searchParams]);

  const isMyItemsOnly = useMemo(() => {
    const mineParam = searchParams.get("mine");
    if (mineParam === null) {
      return myItemsOnly;
    }
    return mineParam === "1";
  }, [myItemsOnly, searchParams]);
  const hasSearchText = searchDraft.trim().length > 0;

  function handleMyItemsToggle() {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (isMyItemsOnly) {
      nextParams.delete("mine");
    } else {
      nextParams.set("mine", "1");
    }

    router.replace(buildHref(pathname, nextParams), {
      scroll: false,
    });
  }

  return (
    <>
      <Input
        type="search"
        placeholder="Search title, customer, notes"
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        className={cn(
          "min-w-[260px] flex-1",
          hasSearchText
            ? "border-amber-400 bg-amber-100/90 text-amber-950 placeholder:text-amber-700/80 focus-visible:ring-amber-400/40"
            : "",
        )}
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleMyItemsToggle}
        className={cn(
          isMyItemsOnly
            ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200"
            : "",
        )}
      >
        My Items
      </Button>
    </>
  );
}
