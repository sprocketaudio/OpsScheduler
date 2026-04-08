"use client";

import { Draggable } from "@fullcalendar/interaction";
import { PointerEvent, useEffect, useRef } from "react";
import { BucketQuickAdd } from "@/features/scheduler/bucket-quick-add";

export type BucketPanelItem = {
  assignee: {
    colour: string;
    email: string;
    name: string;
  } | null;
  cancelled: boolean;
  customer: string | null;
  defaultColour?: string;
  done: boolean;
  fixed: boolean;
  id: string;
  matchesMine?: boolean;
  matchesSearch?: boolean;
  onHold: boolean;
  title: string;
};

type BucketPanelProps = {
  items: BucketPanelItem[];
  mineActive?: boolean;
  onItemSelect?: (itemId: string) => void;
  searchActive?: boolean;
  targetWeekIso: string;
};

type BucketVisualStatus = "cancelled" | "done" | "fixed" | "none" | "onHold";

function resolveItemVisualStatus(item: {
  cancelled: boolean;
  done: boolean;
  fixed: boolean;
  onHold: boolean;
}): BucketVisualStatus {
  if (item.done) {
    return "done";
  }

  if (item.cancelled) {
    return "cancelled";
  }

  if (item.onHold) {
    return "onHold";
  }

  if (item.fixed) {
    return "fixed";
  }

  return "none";
}

function resolveItemOutlineClass(status: BucketVisualStatus): string {
  if (status === "done") {
    return "ring-2 ring-green-600 ring-offset-1 ring-offset-background";
  }

  if (status === "cancelled") {
    return "ring-[3px] ring-slate-700 ring-offset-2 ring-offset-background";
  }

  if (status === "onHold") {
    return "ring-[3px] ring-amber-500 ring-offset-2 ring-offset-background";
  }

  if (status === "fixed") {
    return "ring-2 ring-red-600 ring-offset-1 ring-offset-background";
  }

  return "";
}

function resolveItemOpacityClass(status: BucketVisualStatus): string {
  if (status === "cancelled") {
    return "opacity-70";
  }

  if (status === "onHold") {
    return "opacity-85";
  }

  return "";
}

export function BucketPanel({
  items,
  mineActive = false,
  onItemSelect,
  searchActive = false,
  targetWeekIso,
}: BucketPanelProps) {
  const draggableContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{
    itemId: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressClickItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = draggableContainerRef.current;
    if (!container) {
      return;
    }

    const draggable = new Draggable(container, {
      itemSelector: "[data-bucket-draggable='true']",
      eventData(eventElement) {
        const element = eventElement as HTMLElement;
        const itemId = element.dataset.itemId;
        const itemTitle = element.dataset.itemTitle;
        const itemCustomer = element.dataset.itemCustomer;
        const itemColour = element.dataset.itemColour;

        if (!itemId || !itemTitle) {
          return {};
        }

        return {
          id: itemId,
          title: itemTitle,
          backgroundColor: itemColour || undefined,
          borderColor: itemColour || undefined,
          extendedProps: {
            customer: itemCustomer || null,
          },
        };
      },
    });

    return () => {
      draggable.destroy();
    };
  }, [items]);

  function handlePointerDown(itemId: string, event: PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = {
      itemId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handlePointerUp(itemId: string, event: PointerEvent<HTMLDivElement>) {
    const pointerStart = pointerStartRef.current;
    if (!pointerStart || pointerStart.itemId !== itemId) {
      return;
    }

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    if (Math.hypot(deltaX, deltaY) > 6) {
      suppressClickItemIdRef.current = itemId;
    }

    pointerStartRef.current = null;
  }

  function handlePointerCancel(itemId: string) {
    if (pointerStartRef.current?.itemId === itemId) {
      pointerStartRef.current = null;
    }
  }

  function handleItemClick(itemId: string) {
    if (suppressClickItemIdRef.current === itemId) {
      suppressClickItemIdRef.current = null;
      return;
    }

    onItemSelect?.(itemId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <BucketQuickAdd targetWeekIso={targetWeekIso} />

      <div
        id="scheduler-bucket-drop-zone"
        className="flex min-h-[18rem] min-w-0 flex-1 flex-col rounded-md border p-3"
      >
        <div ref={draggableContainerRef} className="flex min-h-0 flex-1 flex-col gap-2">
        {items.length > 0 ? (
          items.map((item) => {
            const visualStatus = resolveItemVisualStatus(item);
            const itemDimmedBySearch = searchActive && item.matchesSearch === false;
            const itemDimmedByMine = mineActive && item.matchesMine === false;
            const itemIsDimmed = itemDimmedBySearch || itemDimmedByMine;
            const itemIsProminent = !itemIsDimmed && (searchActive || mineActive);
            const displayColour = item.assignee?.colour ?? item.defaultColour;
            return (
              <div
                key={item.id}
                data-bucket-draggable="true"
                data-item-id={item.id}
                data-item-title={item.title}
                data-item-customer={item.customer ?? ""}
                data-item-colour={displayColour ?? ""}
                onPointerDown={(event) => handlePointerDown(item.id, event)}
                onPointerUp={(event) => handlePointerUp(item.id, event)}
                onPointerCancel={() => handlePointerCancel(item.id)}
                onClick={() => handleItemClick(item.id)}
                className={[
                  "cursor-grab rounded-md border p-3 active:cursor-grabbing [&_*]:cursor-inherit",
                  itemIsDimmed ? "opacity-35 saturate-50" : "",
                  itemIsProminent ? "relative z-40 ring-1 ring-primary/30" : "",
                  resolveItemOutlineClass(visualStatus),
                  resolveItemOpacityClass(visualStatus),
                ].join(" ")}
              >
                <p className="text-sm font-medium">{item.title}</p>
                {item.customer ? (
                  <p className="text-sm text-muted-foreground">Customer: {item.customer}</p>
                ) : null}
                {displayColour ? (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: displayColour }}
                      aria-hidden="true"
                    />
                    <span>{item.assignee ? (item.assignee.name || item.assignee.email) : "Unassigned"}</span>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex-1 rounded-md border p-3">
            <p className="text-sm text-muted-foreground">
              No unscheduled items in the bucket for this week.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
