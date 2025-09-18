// Type declarations for modules without TypeScript definitions

declare module 'react' {
  export type FC<P = {}> = React.FunctionComponent<P>;
  export type RefObject<T> = { current: T | null };
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T) => void];
  export const StrictMode: React.FC<{ children: React.ReactNode }>;
  export type ReactNode = any;
}

declare module 'react-dom';
declare module 'react-dom/client';
declare module 'react/jsx-runtime';
declare module '@pushchain/ui-kit';
declare module '@pushchain/core';
declare module 'ethers';
declare module '*.css';
declare module 'buffer';
declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module '@vitejs/plugin-react' {
  const plugin: () => any;
  export default plugin;
}
