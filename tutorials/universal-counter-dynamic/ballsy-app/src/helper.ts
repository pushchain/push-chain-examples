import type { ChainData } from "./App";

const getMaxBallsForViewport = () => {
  if (typeof window === "undefined") return 800; // fallback for SSR

  const width = window.innerWidth;

  if (width >= 1024) {
    // Desktop
    return 800;
  } else if (width >= 768) {
    // Tablet
    return 600;
  } else {
    // Mobile
    return 400;
  }
};

export const getScaledUniqueCounts = (chains: ChainData[]): Record<string, number> => {
  const totalUnique = chains.reduce((sum, c) => sum + c.uniqueCount, 0);
  const limit = getMaxBallsForViewport();

  if (totalUnique === 0) return {};
  if (totalUnique <= limit) {
    // No need to scale, just return original unique counts
    return chains.reduce((acc, chain) => {
      acc[chain.chainHash] = chain.uniqueCount;
      return acc;
    }, {} as Record<string, number>);
  }

  const factor = limit / totalUnique;

  // First pass: floor scaled counts and track fractional remainders
  const scaled = chains.map((chain) => {
    const scaledValue = chain.uniqueCount * factor;
    const base = Math.floor(scaledValue);
    const frac = scaledValue - base;
    return {
      chainHash: chain.chainHash,
      base,
      frac,
    };
  });

  let allocated = scaled.reduce((sum, item) => sum + item.base, 0);
  let remaining = limit - allocated;

  // Distribute remaining balls to chains with largest fractional parts
  scaled.sort((a, b) => b.frac - a.frac);

  let i = 0;
  while (remaining > 0 && scaled.length > 0) {
    scaled[i].base += 1;
    remaining--;
    i = (i + 1) % scaled.length;
  }

  return scaled.reduce((acc, item) => {
    acc[item.chainHash] = item.base;
    return acc;
  }, {} as Record<string, number>);
};