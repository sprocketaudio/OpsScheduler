"use client";

import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type MuiCacheProviderProps = {
  children: ReactNode;
};

type CacheState = {
  cache: ReturnType<typeof createCache>;
  flush: () => string[];
};

function createMuiEmotionCache(): CacheState {
  const cache = createCache({ key: "mui" });
  cache.compat = true;

  const insertedNames: string[] = [];
  const originalInsert = cache.insert;

  cache.insert = (...args) => {
    const serialized = args[1];
    if (cache.inserted[serialized.name] === undefined) {
      insertedNames.push(serialized.name);
    }
    return originalInsert(...args);
  };

  return {
    cache,
    flush: () => {
      const names = [...insertedNames];
      insertedNames.length = 0;
      return names;
    },
  };
}

export function MuiCacheProvider({ children }: MuiCacheProviderProps) {
  const [cacheState] = useState<CacheState>(() => createMuiEmotionCache());

  useServerInsertedHTML(() => {
    const names = cacheState.flush();
    if (names.length === 0) {
      return null;
    }

    let styles = "";
    for (const name of names) {
      const style = cacheState.cache.inserted[name];
      if (typeof style === "string") {
        styles += style;
      }
    }

    return (
      <style
        data-emotion={`${cacheState.cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cacheState.cache}>{children}</CacheProvider>;
}
