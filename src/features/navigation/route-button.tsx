"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RouteButtonProps = {
  href: string;
  label: string;
};

export function RouteButton({ href, label }: RouteButtonProps) {
  const router = useRouter();

  return (
    <Button type="button" variant="outline" onClick={() => router.push(href)}>
      {label}
    </Button>
  );
}
