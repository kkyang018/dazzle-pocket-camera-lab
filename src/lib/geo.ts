// 从照片 EXIF 读 GPS（本地解析），再只用经纬度查一次地名。
export async function readGps(file: Blob): Promise<{ lat: number; lon: number } | null> {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      o += 2 + len;
    }
  } catch { /* 读不出就算了 */ }
  return null;
}

function parseTiff(v: DataView, t: number) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (p: number) => v.getUint16(p, le), u32 = (p: number) => v.getUint32(p, le);
  const entries = (ifd: number) => {
    const n = u16(ifd), out = new Map<number, number>();
    for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; out.set(u16(e), e); }
    return out;
  };
  const gpsEntry = entries(t + u32(t + 4)).get(0x8825);
  if (gpsEntry == null) return null;
  const g = entries(t + u32(gpsEntry + 8));
  const coord = (tag: number) => {
    const e = g.get(tag); if (e == null) return null;
    const p = t + u32(e + 8);
    const r = (k: number) => u32(p + k * 8) / (u32(p + k * 8 + 4) || 1);
    return r(0) + r(1) / 60 + r(2) / 3600;
  };
  const ref = (tag: number) => { const e = g.get(tag); return e == null ? "" : String.fromCharCode(v.getUint8(e + 8)); };
  const lat = coord(2), lon = coord(4);
  if (lat == null || lon == null || (lat === 0 && lon === 0)) return null;
  return { lat: ref(1) === "S" ? -lat : lat, lon: ref(3) === "W" ? -lon : lon };
}

export async function placeName(file: Blob): Promise<string | null> {
  const gps = await readGps(file);
  if (!gps) return null;
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.lat}&longitude=${gps.lon}&localityLanguage=zh`);
    const j = (await r.json()) as { locality?: string; city?: string; principalSubdivision?: string; countryName?: string };
    return j.city || j.locality || j.principalSubdivision || j.countryName || null;
  } catch {
    return `${gps.lat.toFixed(2)}°, ${gps.lon.toFixed(2)}°`;
  }
}
