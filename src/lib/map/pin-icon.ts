// 직급 모양(shape) + 정당 색(color) DivIcon 생성.
// SVG inline HTML — 흰 stroke + 옅은 그림자로 가독성.

import type { LayerShape } from "@/lib/map/layers";

// 지점 배열을 SVG points 문자열로
function pts(arr: Array<[number, number]>): string {
  return arr.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function shapeSvg(shape: LayerShape, size: number, color: string): string {
  const half = size / 2;
  const stroke = `stroke="#ffffff" stroke-width="2" stroke-linejoin="round"`;
  const filter = `style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))"`;

  if (shape === "pentagon") {
    const r = size * 0.45;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      points.push([half + r * Math.cos(a), half + r * Math.sin(a)]);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><polygon points="${pts(points)}" fill="${color}" ${stroke}/></svg>`;
  }

  if (shape === "star") {
    const rOuter = size * 0.48;
    const rInner = size * 0.21;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? rOuter : rInner;
      points.push([half + r * Math.cos(a), half + r * Math.sin(a)]);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><polygon points="${pts(points)}" fill="${color}" ${stroke}/></svg>`;
  }

  if (shape === "triangle") {
    // 정삼각형 (위 정점)
    const r = size * 0.46;
    const cos30 = Math.cos(Math.PI / 6);
    const top: [number, number] = [half, half - r];
    const bl: [number, number] = [half - r * cos30, half + r * 0.5];
    const br: [number, number] = [half + r * cos30, half + r * 0.5];
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><polygon points="${pts([top, br, bl])}" fill="${color}" ${stroke}/></svg>`;
  }

  if (shape === "diamond") {
    // 45° 회전한 정사각형
    const r = size * 0.44;
    const top: [number, number] = [half, half - r];
    const right: [number, number] = [half + r, half];
    const bottom: [number, number] = [half, half + r];
    const left: [number, number] = [half - r, half];
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><polygon points="${pts([top, right, bottom, left])}" fill="${color}" ${stroke}/></svg>`;
  }

  if (shape === "square") {
    const r = size * 0.36;
    const x = half - r;
    const w = r * 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><rect x="${x.toFixed(2)}" y="${x.toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" rx="2" fill="${color}" ${stroke}/></svg>`;
  }

  // circle
  const rCircle = size * 0.4;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${filter}><circle cx="${half}" cy="${half}" r="${rCircle}" fill="${color}" ${stroke}/></svg>`;
}

// 모양 SVG (LayerControl용 16px small icon, stroke 얇게)
export function smallShapeSvg(shape: LayerShape, color: string): string {
  const size = 16;
  const half = size / 2;
  const stroke = `stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"`;

  if (shape === "pentagon") {
    const r = size * 0.45;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      points.push([half + r * Math.cos(a), half + r * Math.sin(a)]);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><polygon points="${pts(points)}" fill="${color}" ${stroke}/></svg>`;
  }
  if (shape === "star") {
    const rOuter = size * 0.48, rInner = size * 0.21;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? rOuter : rInner;
      points.push([half + r * Math.cos(a), half + r * Math.sin(a)]);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><polygon points="${pts(points)}" fill="${color}" ${stroke}/></svg>`;
  }
  if (shape === "triangle") {
    const r = size * 0.46;
    const cos30 = Math.cos(Math.PI / 6);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><polygon points="${pts([[half, half - r], [half + r * cos30, half + r * 0.5], [half - r * cos30, half + r * 0.5]])}" fill="${color}" ${stroke}/></svg>`;
  }
  if (shape === "diamond") {
    const r = size * 0.44;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><polygon points="${pts([[half, half - r], [half + r, half], [half, half + r], [half - r, half]])}" fill="${color}" ${stroke}/></svg>`;
  }
  if (shape === "square") {
    const r = size * 0.36;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect x="${half - r}" y="${half - r}" width="${r * 2}" height="${r * 2}" rx="1.5" fill="${color}" ${stroke}/></svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${half}" cy="${half}" r="${size * 0.4}" fill="${color}" ${stroke}/></svg>`;
}

// Leaflet DivIcon용 HTML (래퍼 + filter)
export function makePinHtml(shape: LayerShape, size: number, color: string): string {
  return shapeSvg(shape, size, color);
}
