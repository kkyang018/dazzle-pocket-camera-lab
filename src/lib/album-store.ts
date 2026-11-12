import type { CameraCategory, Preset } from "@/lib/cameras";

// 相册持久化：用浏览器本地 IndexedDB 保存原图和显影参数（不上传、不用 localStorage）。
export type StoredItem = {
  id: number;
  blob: Blob;
  name: string;
  width: number;
  height: number;
  look: Preset | null;
  cameraName: string | null;
  category: CameraCategory | null;
  place: string | null;
  /** 用的哪台相机、暗房里的调整（回暗房重新冲洗时恢复）；旧记录没有 */
  cameraId?: string | null;
  edit?: unknown;
};

const DB = "dazz-lab";
const STORE = "album";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export const loadAll = () => tx<StoredItem[]>("readonly", (s) => s.getAll() as IDBRequest<StoredItem[]>).catch(() => []);
export const putItem = (i: StoredItem) => tx("readwrite", (s) => s.put(i)).catch(() => undefined);
export const deleteItem = (id: number) => tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
