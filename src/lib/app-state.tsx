import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Photo } from "./photo";

// 全局原型状态：只存在内存里（不使用 localStorage）。
type AppState = {
  quietMode: boolean;
  setQuietMode: (v: boolean) => void;
  hint: { id: number; text: string } | null;
  showHint: (text: string) => void;
  photo: Photo | null;
  setPhoto: (p: Photo | null) => void;
};

const AppContext = createContext<AppState | null>(null);

function release(p: Photo | null) {
  if (p?.origin === "album") URL.revokeObjectURL(p.src);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [quietMode, setQuietMode] = useState(false);
  const [hint, setHint] = useState<AppState["hint"]>(null);
  const [photo, setPhotoState] = useState<Photo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoRef = useRef<Photo | null>(null);

  const showHint = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setHint({ id: Date.now(), text });
    timer.current = setTimeout(() => setHint(null), 1600);
  }, []);

  const setPhoto = useCallback((p: Photo | null) => {
    if (photoRef.current && photoRef.current.src !== p?.src) release(photoRef.current);
    photoRef.current = p;
    setPhotoState(p);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      release(photoRef.current);
    },
    [],
  );

  return (
    <AppContext.Provider value={{ quietMode, setQuietMode, hint, showHint, photo, setPhoto }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
