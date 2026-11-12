// 在浏览器里找出照片里的人（MediaPipe 人像分割 + 人脸检测），照片不上传。
// 运行库和两个小模型（各约 250KB）第一次用到手绘单张时才下载，之后浏览器会缓存。
import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";
import { maskToOutline } from "./outline";
import type { Outline } from "./types";

// 版本要和 package.json 里的 @mediapipe/tasks-vision 保持一致
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let tasks: Promise<{ seg: ImageSegmenter; face: FaceDetector }> | null = null;

async function create() {
  const { FilesetResolver, ImageSegmenter, FaceDetector } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks(WASM);
  const [seg, face] = await Promise.all([
    ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: SEG_MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
    FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.55,
    }),
  ]);
  return { seg, face };
}

/** 照片主体位置（最大那张脸的中心，0–1）；没有脸或模型加载失败时返回 null */
export async function faceCenter(img: HTMLCanvasElement): Promise<[number, number] | null> {
  return (await faceInfo(img))?.center ?? null;
}

/** 人脸信息：最大那张脸的中心 + 所有人脸占画面的面积比例（看"人有多大"）；没有脸返回 null */
export async function faceInfo(img: HTMLCanvasElement): Promise<{ center: [number, number]; area: number } | null> {
  try {
    const { face } = await (tasks ??= create());
    const k = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const boxes = face.detect(c).detections.flatMap((d) => (d.boundingBox ? [d.boundingBox] : []));
    if (!boxes.length) return null;
    const b = boxes.reduce((a, x) => (x.width * x.height > a.width * a.height ? x : a));
    const area = boxes.reduce((s, x) => s + x.width * x.height, 0) / (c.width * c.height);
    return { center: [(b.originX + b.width / 2) / c.width, (b.originY + b.height / 2) / c.height], area };
  } catch (e) {
    console.warn("faceInfo", e);
    tasks = null;
    return null;
  }
}

/** 返回人物描边；照片里没有人（找不到脸）、或模型加载失败时返回 null */
export async function personOutline(img: HTMLCanvasElement): Promise<Outline | null> {
  try {
    const { seg, face } = await (tasks ??= create());
    const k = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const faces = face.detect(c).detections.flatMap((d) => {
      const b = d.boundingBox;
      return b ? [[b.originX, b.originY, b.width, b.height] as [number, number, number, number]] : [];
    });
    if (!faces.length) return null;
    const res = seg.segment(c);
    try {
      const m = res.confidenceMasks?.[0];
      if (!m) return null;
      // 遮罩尺寸可能和输入不同，把脸框换算过去
      const sx = m.width / c.width, sy = m.height / c.height;
      const scaled = faces.map(([x, y, w, h]) => [x * sx, y * sy, w * sx, h * sy] as [number, number, number, number]);
      return maskToOutline(m.getAsFloat32Array(), m.width, m.height, 0.5, scaled);
    } finally {
      res.close();
    }
  } catch (e) {
    console.warn("personOutline", e);
    tasks = null;
    return null;
  }
}
