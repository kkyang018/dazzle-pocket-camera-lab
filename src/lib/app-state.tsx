import type { CameraCategory, Preset } from "@/lib/cameras";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";
import type { Photo } from "./photo";

// 全局原型状态：只存在内存里（不使用 localStorage）。
type AppState = {
  quietMode: boolean;
  setQuietMode: (v: boolean) => void;
  hint: { id: number; text: string; kind: HintKind } | null;
  showHint: (text: string, kind?: HintKind) => void;
  photo: Photo | null;
  setPhoto: (p: Photo | null) => void;
  cameraId: string | null;
  setCameraId: (id: string | null) => void;
  /** 置顶的相机，最近置顶的在前 */
  pinned: string[];
  /** 暗房显影后的最终效果（含用户微调） */
  look: Preset | null;
  setLook: (p: Preset | null) => void;
  togglePin: (id: string) => boolean;
  /** 相册：暗房显影后的照片 + 样片，只在内存里 */
  album: AlbumItem[];
  addToAlbum: (item: Omit<AlbumItem, "id">) => number;
  /** 相册里选中、要做成成品的照片 id（按选择顺序） */
  selection: number[];
  setSelection: (ids: number[]) => void;
};

export type AlbumItem = {
  id: number;
  photo: Photo;
  /** 显影效果；样片为 null（原样） */
  look: Preset | null;
  cameraName: string | null;
  category: CameraCategory | null;
};

export type HintKind = "pro" | "info";

// Keep one context object across hot reloads: when this file is edited, a fresh
// createContext() would no longer match the provider already mounted in the page.
const CONTEXT_KEY = Symbol.for("dazz-lab.app-context");
const store = globalThis as typeof globalThis & { [CONTEXT_KEY]?: Context<AppState | null> };
const AppContext = (store[CONTEXT_KEY] ??= createContext<AppState | null>(null));

function release(p: Photo | null) {
  if (p?.origin === "album") URL.revokeObjectURL(p.src);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [quietMode, setQuietMode] = useState(false);
  const [hint, setHint] = useState<AppState["hint"]>(null);
  const [photo, setPhotoState] = useState<Photo | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [look, setLook] = useState<Preset | null>(null);
  const [album, setAlbum] = useState<AlbumItem[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const albumSrcs = useRef(new Set<string>());
  const nextId = useRef(1);
  const pinnedRef = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoRef = useRef<Photo | null>(null);

  const showHint = useCallback((text: string, kind: HintKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setHint({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setHint(null), 1600);
  }, []);

  const setPhoto = useCallback((p: Photo | null) => {
    // 已归档到相册的照片还在用，不能释放
    if (photoRef.current && photoRef.current.src !== p?.src && !albumSrcs.current.has(photoRef.current.src)) release(photoRef.current);
    photoRef.current = p;
    setPhotoState(p);
  }, []);

  const addToAlbum = useCallback((item: Omit<AlbumItem, "id">) => {
    const id = nextId.current++;
    albumSrcs.current.add(item.photo.src);
    setAlbum((a) => [{ ...item, id }, ...a]);
    return id;
  }, []);

  const togglePin = useCallback((id: string) => {
    const was = pinnedRef.current.includes(id);
    const next = was ? pinnedRef.current.filter((x) => x !== id) : [id, ...pinnedRef.current];
    pinnedRef.current = next;
    setPinned(next);
    return !was;
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      release(photoRef.current);
    },
    [],
  );

  return (
    <AppContext.Provider value={{
        quietMode,
        setQuietMode,
        hint,
        showHint,
        photo,
        setPhoto,
        cameraId,
        setCameraId,
        pinned,
        togglePin,
        look,
        setLook,
        album,
        addToAlbum,
        selection,
        setSelection,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
