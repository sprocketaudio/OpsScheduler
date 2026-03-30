"use client";

import { Draggable } from "@fullcalendar/interaction";
import { PointerEvent, useEffect, useRef, useState } from "react";
import { BucketQuickAdd } from "@/features/scheduler/bucket-quick-add";
import { ItemDetailPanel } from "@/features/scheduler/item-detail-panel";

export type BucketPanelItem = {
  assignee: {
    colour: string;
    email: string;
    name: string;
  } | null;
  customer: string | null;
  done: boolean;
  fixed: boolean;
  id: string;
  title: string;
};

type BucketPanelProps = {
  items: BucketPanelItem[];
  targetWeekIso: string;
};

export function BucketPanel({ items, targetWeekIso }: BucketPanelProps) {
  const draggableContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{
    itemId: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressClickItemIdRef = useRef<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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

        if (!itemId || !itemTitle) {
          return {};
        }

        const title = itemCustomer ? `${itemTitle} - ${itemCustomer}` : itemTitle;

        return {
          id: itemId,
          title,
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

    setSelectedItemId(itemId);
  }

  return (
    <div id="scheduler-bucket-drop-zone" className="space-y-3 rounded-md border p-3">
      <BucketQuickAdd targetWeekIso={targetWeekIso} />

      <div ref={draggableContainerRef} className="space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              data-bucket-draggable="true"
              data-item-id={item.id}
              data-item-title={item.title}
              data-item-customer={item.customer ?? ""}
              onPointerDown={(event) => handlePointerDown(item.id, event)}
              onPointerUp={(event) => handlePointerUp(item.id, event)}
              onPointerCancel={() => handlePointerCancel(item.id)}
              onClick={() => handleItemClick(item.id)}
              className={[
                "cursor-grab rounded-md border p-3 active:cursor-grabbing",
                item.done ? "opacity-60" : "",
                item.fixed ? "ring-1 ring-red-500/70" : "",
              ].join(" ")}
            >
              <p className="text-sm font-medium">{item.title}</p>
              {item.customer ? (
                <p className="text-sm text-muted-foreground">Customer: {item.customer}</p>
              ) : null}
              {item.assignee ? (
                <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: item.assignee.colour }}
                    aria-hidden="true"
                  />
                  <span>{item.assignee.name || item.assignee.email}</span>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {item.fixed ? <span>Fixed</span> : null}
                {item.done ? <span>Done</span> : null}
                {!item.fixed && !item.done ? <span>Open</span> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border p-3">
            <p className="text-sm text-muted-foreground">
              No unscheduled items in the bucket for this week.
            </p>
          </div>
        )}
      </div>

      <ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
    </div>
  );
}
