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
import { deleteItem, loadAll, putItem } from "./album-store";
import { placeName } from "./geo";
import { photoFromSample, type Photo } from "./photo";
import sampleStreet from "@/assets/sample-street.jpg";
import samplePortrait from "@/assets/sample-portrait.jpg";
import sampleCafe from "@/assets/sample-cafe.jpg";
import sampleSnow from "@/assets/sample-snow.jpg";

const SAMPLES = [
  { src: sampleSnow, name: "雪山小镇" },
  { src: sampleStreet, name: "海边小镇" },
  { src: samplePortrait, name: "公园" },
  { src: sampleCafe, name: "窗边咖啡" },
];

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
  addToAlbum: (item: Omit<AlbumItem, "id" | "place">) => number;
  removeFromAlbum: (ids: number[]) => void;
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
  /** 照片拍摄地（EXIF GPS 识别），样片用样片名 */
  place: string | null;
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

  const addToAlbum = useCallback((item: Omit<AlbumItem, "id" | "place">) => {
    const id = nextId.current++;
    albumSrcs.current.add(item.photo.src);
    const sample = item.photo.origin === "sample";
    setAlbum((a) => [{ ...item, id, place: sample ? item.photo.name : null }, ...a]);
    const file = item.photo.file;
    if (!sample && file) {
      const rec = { id, blob: file, name: item.photo.name, width: item.photo.width, height: item.photo.height,
        look: item.look, cameraName: item.cameraName, category: item.category, place: null as string | null };
      void putItem(rec);
      void placeName(file).then((place) => {
        if (!place) return;
        setAlbum((a) => a.map((x) => (x.id === id ? { ...x, place } : x)));
        void putItem({ ...rec, place });
      });
    } else if (sample) {
      // 样片显影后也要存下来，否则刷新就丢了：取回打包的样片图存成 blob
      void fetch(item.photo.src)
        .then((r) => r.blob())
        .then((blob) => putItem({ id, blob, name: item.photo.name, width: item.photo.width, height: item.photo.height,
          look: item.look, cameraName: item.cameraName, category: item.category, place: item.photo.name }))
        .catch(() => undefined);
    }
    return id;
  }, []);

  const removeFromAlbum = useCallback((ids: number[]) => {
    setAlbum((a) => a.filter((x) => !ids.includes(x.id)));
    setSelection((s) => s.filter((x) => !ids.includes(x)));
    ids.forEach((id) => void deleteItem(id));
  }, []);

  // 打开时读回本地保存的相册，再放样片（样片不保存）
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await loadAll();
      const samples: AlbumItem[] = [];
      for (const s of SAMPLES) {
        try { samples.push({ id: 0, photo: await photoFromSample(s), look: null, cameraName: null, category: null, place: s.name }); } catch { /* 跳过 */ }
      }
      if (!alive) return;
      samples.forEach((x, i) => (x.id = -1 - i));
      const restored: AlbumItem[] = stored.sort((a, b) => b.id - a.id).map((r) => {
        const file = new File([r.blob], r.name, { type: r.blob.type });
        const src = URL.createObjectURL(file);
        albumSrcs.current.add(src);
        return { id: r.id, photo: { id: r.id, src, name: r.name, origin: "album", width: r.width, height: r.height, file },
          look: r.look, cameraName: r.cameraName, category: r.category, place: r.place };
      });
      nextId.current = Math.max(nextId.current, ...stored.map((r) => r.id + 1));
      setAlbum((a) => [...a, ...restored, ...samples]);
    })();
    return () => { alive = false; };
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
        removeFromAlbum,
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
