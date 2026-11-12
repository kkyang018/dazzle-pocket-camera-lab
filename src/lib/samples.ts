// 内置样片：首页"用示例试试"和印样台用同一份，名字保持一致
import sampleSnow from "@/assets/sample-snow.jpg";
import sampleStreet from "@/assets/sample-street.jpg";
import samplePortrait from "@/assets/sample-portrait.jpg";
import sampleCafe from "@/assets/sample-cafe.jpg";

export const SAMPLES = [
  { key: "snow", src: sampleSnow, name: "雪山小镇", nameEn: "Snow Village", tag: "01" },
  { key: "street", src: sampleStreet, name: "海边小镇", nameEn: "Seaside Town", tag: "02" },
  { key: "portrait", src: samplePortrait, name: "公园笑脸", nameEn: "Park Smile", tag: "03" },
  { key: "cafe", src: sampleCafe, name: "窗边咖啡", nameEn: "Window Café", tag: "04" },
] as const;

/** 样片中文名 → 英文名（印样台里的样片照片名用） */
export const sampleNameEn = (name: string) => SAMPLES.find((s) => s.name === name)?.nameEn ?? name;
