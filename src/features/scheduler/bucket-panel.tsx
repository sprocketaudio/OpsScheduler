"use client";

import { Draggable } from "@fullcalendar/interaction";
import { useEffect, useRef } from "react";
import { BucketQuickAdd } from "@/features/scheduler/bucket-quick-add";

export type BucketPanelItem = {
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
              className="cursor-grab rounded-md border p-3 active:cursor-grabbing"
            >
              <p className="text-sm font-medium">{item.title}</p>
              {item.customer ? (
                <p className="text-sm text-muted-foreground">Customer: {item.customer}</p>
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
    </div>
  );
}
