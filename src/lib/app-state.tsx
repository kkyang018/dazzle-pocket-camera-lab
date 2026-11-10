import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// 全局原型状态：只存在内存里（不使用 localStorage）。
type AppState = {
  quietMode: boolean;
  setQuietMode: (v: boolean) => void;
  hint: { id: number; text: string } | null;
  showHint: (text: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [quietMode, setQuietMode] = useState(false);
  const [hint, setHint] = useState<AppState["hint"]>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHint = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setHint({ id: Date.now(), text });
    timer.current = setTimeout(() => setHint(null), 1600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <AppContext.Provider value={{ quietMode, setQuietMode, hint, showHint }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
