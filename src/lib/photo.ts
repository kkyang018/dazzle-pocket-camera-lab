// 照片只在内存里：相册照片用 object URL，示例照片用打包好的图片地址。
export type Photo = {
  id: number;
  src: string;
  name: string;
  origin: "album" | "sample";
  /** 按原始方向（EXIF）校正后的像素尺寸 */
  width: number;
  height: number;
  /** 相册原图，导出时用它重新渲染 */
  file?: File;
};

function readSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    // 浏览器默认按 EXIF 方向显示，naturalWidth/Height 也是校正后的尺寸
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

export async function photoFromFile(file: File): Promise<Photo> {
  const src = URL.createObjectURL(file);
  try {
    const size = await readSize(src);
    return { id: Date.now(), src, name: file.name || "相册照片", origin: "album", file, ...size };
  } catch (e) {
    URL.revokeObjectURL(src);
    throw e;
  }
}

export async function photoFromSample(sample: { src: string; name: string }): Promise<Photo> {
  const size = await readSize(sample.src);
  return { id: Date.now(), src: sample.src, name: sample.name, origin: "sample", ...size };
}
