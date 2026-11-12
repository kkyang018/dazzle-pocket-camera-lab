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
import { SAMPLES } from "./samples";
import { forgetDeveloped } from "./templates/sources";

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
  /** 重新冲洗后更新原来那张，而不是再加一张 */
  updateAlbumItem: (id: number, patch: Partial<Pick<AlbumItem, "look" | "cameraName" | "category" | "cameraId" | "edit">>) => void;
  /** 删除：先从印样台拿掉，几秒内可以撤销，之后才真正删掉 */
  removeFromAlbum: (ids: number[]) => AlbumItem[];
  undoRemove: (items: AlbumItem[]) => void;
  /** 暗房里每张照片 × 每台相机的调整，离开暗房再回来时恢复（只在内存里） */
  edits: Record<string, DarkroomEdit>;
  saveEdit: (key: string, edit: DarkroomEdit) => void;
  /** 正在从印样台回暗房重新冲洗的那张（显影后更新它） */
  rewashId: number | null;
  setRewashId: (id: number | null) => void;
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
  /** 显影用的相机和暗房调整（回暗房时恢复） */
  cameraId?: string | null;
  edit?: DarkroomEdit | null;
};

/** 暗房里的调整 */
export type DarkroomEdit = {
  adj: { ev: number; temp: number; tint: number };
  lookId: string | null;
  pro: { grain: number; fade: number; sharpen: number };
  crop: { x: number; y: number; z: number };
};
export const editKey = (photoSrc: string, cameraId: string) => `${photoSrc}|${cameraId}`;

const UNDO_MS = 6000;

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
  const [edits, setEdits] = useState<Record<string, DarkroomEdit>>({});
  const [rewashId, setRewashId] = useState<number | null>(null);
  const albumRef = useRef<AlbumItem[]>([]);
  albumRef.current = album;
  const pendingDelete = useRef(new Map<number, { item: AlbumItem; timer: ReturnType<typeof setTimeout> }>());
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

  /** 存进本机：原图 blob + 显影参数（样片取回打包的图存成 blob） */
  const persist = useCallback(async (item: AlbumItem) => {
    const blob = item.photo.file ?? (await fetch(item.photo.src).then((r) => r.blob()).catch(() => null));
    if (!blob) return;
    await putItem({ id: item.id, blob, name: item.photo.name, width: item.photo.width, height: item.photo.height,
      look: item.look, cameraName: item.cameraName, category: item.category, place: item.place,
      cameraId: item.cameraId ?? null, edit: item.edit ?? null });
  }, []);

  const addToAlbum = useCallback((item: Omit<AlbumItem, "id" | "place">) => {
    const id = nextId.current++;
    albumSrcs.current.add(item.photo.src);
    const sample = item.photo.origin === "sample";
    const full: AlbumItem = { ...item, id, place: sample ? item.photo.name : null };
    setAlbum((a) => [full, ...a]);
    void persist(full);
    const file = item.photo.file;
    if (!sample && file) {
      void placeName(file).then((place) => {
        if (!place) return;
        setAlbum((a) => a.map((x) => (x.id === id ? { ...x, place } : x)));
        void persist({ ...full, place });
      });
    }
    return id;
  }, [persist]);

  const updateAlbumItem = useCallback((id: number, patch: Partial<Pick<AlbumItem, "look" | "cameraName" | "category" | "cameraId" | "edit">>) => {
    const cur = albumRef.current.find((x) => x.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    forgetDeveloped(id); // 显影效果变了，缩略图和成品要重新渲染
    setAlbum((a) => a.map((x) => (x.id === id ? next : x)));
    void persist(next);
  }, [persist]);

  /** 真正删除：本机记录、显影缓存、图片地址（正在暗房里用的那张除外） */
  const finalizeDelete = useCallback((x: AlbumItem) => {
    pendingDelete.current.delete(x.id);
    forgetDeveloped(x.id);
    void deleteItem(x.id);
    if (x.photo.origin === "album" && photoRef.current?.src !== x.photo.src && !albumRef.current.some((y) => y.photo.src === x.photo.src)) {
      albumSrcs.current.delete(x.photo.src);
      URL.revokeObjectURL(x.photo.src);
    }
  }, []);

  const removeFromAlbum = useCallback((ids: number[]) => {
    const removed = albumRef.current.filter((x) => ids.includes(x.id));
    setAlbum((a) => a.filter((x) => !ids.includes(x.id)));
    setSelection((s) => s.filter((x) => !ids.includes(x)));
    removed.forEach((x) => pendingDelete.current.set(x.id, { item: x, timer: setTimeout(() => finalizeDelete(x), UNDO_MS) }));
    return removed;
  }, [finalizeDelete]);

  const undoRemove = useCallback((items: AlbumItem[]) => {
    items.forEach((x) => { const p = pendingDelete.current.get(x.id); if (p) clearTimeout(p.timer); pendingDelete.current.delete(x.id); });
    // 放回原来的位置：用户照片按 id 从新到旧，样片在最后
    setAlbum((a) => [...a, ...items].sort((p, q) => q.id - p.id));
  }, []);

  // 页面关掉前把还在"可撤销"的删除做完，免得刷新后照片又回来
  useEffect(() => {
    const flush = () => pendingDelete.current.forEach(({ item, timer: t }) => { clearTimeout(t); finalizeDelete(item); });
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [finalizeDelete]);

  const saveEdit = useCallback((key: string, edit: DarkroomEdit) => setEdits((m) => ({ ...m, [key]: edit })), []);

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
          look: r.look, cameraName: r.cameraName, category: r.category, place: r.place,
          cameraId: r.cameraId ?? null, edit: (r.edit as DarkroomEdit | null | undefined) ?? null };
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
        updateAlbumItem,
        removeFromAlbum,
        undoRemove,
        edits,
        saveEdit,
        rewashId,
        setRewashId,
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
