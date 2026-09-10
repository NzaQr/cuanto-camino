/**
 * Original bus model. Coordinates are pixels: x across, -y forward, z up.
 * Each surface has a 3D frame and SVG paint. Orthographic projection keeps
 * the marker sharp at any pixel density, without a WebGL context on the map.
 */
type Vec3 = [number, number, number];
interface Surface {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
  center: Vec3;
  paint: string;
}

export const BUS_ICON_SIZE = 72;
export const BUS_ICON_ANCHOR: [number, number] = [36, 44];

const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;

function sidePaint(doors: boolean): string {
  const windows = [-19, -11.5, -4, 3.5, 11].map((y) =>
    rect(y, 2, 6.5, 7.8, '#18354c', 0.8) +
    rect(y + 0.6, 2.5, 5.3, 1.4, '#507186', 0.3),
  ).join('');
  const door = (y: number) =>
    rect(y, 1.8, 5.8, 16, '#102b40', 0.5) +
    rect(y + 0.6, 2.6, 1.9, 10.8, '#3a6075', 0.25) +
    rect(y + 3.1, 2.6, 1.9, 10.8, '#3a6075', 0.25) +
    rect(y + 0.6, 14.5, 4.4, 0.5, '#89a0ac');
  return rect(-22, 0, 44, 18, '#edf4f5') +
    rect(-22, 10.8, 44, 7.2, '#2879cc') +
    rect(-22, 11, 44, 1.1, '#60bbef') +
    rect(-22, 16.7, 44, 1.3, '#16548d') + windows +
    (doors ? door(-21) + door(2.8) : '') +
    rect(-21, 14.5, 1.2, 0.8, '#ffbf64', 0.2) +
    rect(20, 14.5, 1.2, 0.8, '#ed755f', 0.2);
}

const frontPaint = rect(-8, 0, 16, 18, '#eef5f7') +
  rect(-7.4, 0.7, 14.8, 11, '#112c41', 1.2) +
  rect(-4.8, 1.5, 9.6, 1.1, '#ffd888', 0.3) +
  rect(-6.6, 3.5, 13.2, 6.8, '#365e77', 0.65) +
  '<path d="M-6 4H5L-3 7H-6Z" fill="#709aaf" opacity=".6"/>' +
  '<path d="M0 3.5V10 M-5 9.7L-1.5 9 M1.5 9.7L5 9" stroke="#142f42" stroke-width=".5"/>' +
  rect(-8, 12, 16, 6, '#2879cc') +
  rect(-8, 12, 16, 0.9, '#62bdf0') +
  rect(-7.1, 13.8, 3.6, 1.7, '#fff8d9', 0.5) +
  rect(3.5, 13.8, 3.6, 1.7, '#fff8d9', 0.5) +
  rect(-2.1, 14.2, 4.2, 0.6, '#154974', 0.2) +
  rect(-7.8, 16.5, 15.6, 1.2, '#163f5e', 0.4);

const rearPaint = rect(-8, 0, 16, 18, '#e2edf0') +
  rect(-6.9, 1.6, 13.8, 7, '#18354c', 1) +
  rect(-6.2, 2.2, 12.4, 1.2, '#507186', 0.3) +
  rect(-8, 10.8, 16, 7.2, '#2268ad') +
  rect(-8, 10.8, 16, 1, '#62bdf0') +
  rect(-7.2, 12.5, 1.7, 3.2, '#fa6c59', 0.5) +
  rect(5.5, 12.5, 1.7, 3.2, '#fa6c59', 0.5) +
  [12.8, 14, 15.2].map(y => rect(-3.8, y, 7.6, 0.5, '#17486f')).join('') +
  rect(-7.8, 16.5, 15.6, 1.2, '#163f5e', 0.4);

function buildBus(): Surface[] {
  const surfaces: Surface[] = [];
  function surface(origin: Vec3, u: Vec3, v: Vec3, normal: Vec3, center: Vec3, paint: string) {
    surfaces.push({ origin, u, v, normal, center, paint });
  }

  // Flat body faces. Windows and doors belong to their face, so they cannot
  // pass through another surface when the travel direction changes.
  for (const side of [-1, 1]) {
    surface([side * 11, 0, 23], [0, 1, 0], [0, 0, -1], [side, 0, 0],
      [side * 11, 0, 14], sidePaint(side === 1));
    surface([0, side * 25, 23], [1, 0, 0], [0, 0, -1], [0, side, 0],
      [0, side * 25, 14], side === -1 ? frontPaint : rearPaint);
  }

  // Rounded plan corners, with a separate blue skirt and cream upper body.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 12;
      const b = (i + 1) * Math.PI / 12;
      const x = sx * (8 + 3 * Math.cos(a));
      const y = sy * (22 + 3 * Math.sin(a));
      const dx = sx * 3 * (Math.cos(b) - Math.cos(a));
      const dy = sy * 3 * (Math.sin(b) - Math.sin(a));
      surface([x, y, 23], [dx, dy, 0], [0, 0, -1],
        [sx * Math.cos((a + b) / 2), sy * Math.sin((a + b) / 2), 0],
        [x + dx / 2, y + dy / 2, 14],
        rect(0, 0, 1, 18, '#e8f1f3') + rect(0, 10.8, 1, 7.2, '#2879cc') +
        rect(0, 10.8, 1, 1, '#60bbef') + rect(0, 16.7, 1, 1.3, '#16548d'));
    }
  }

  // A rounded roof, a raised air conditioner, and two roof seams.
  surface([0, 0, 23], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 23],
    rect(-11, -25, 22, 50, '#d3e3e9', 3) +
    rect(-10.2, -24.2, 20.4, 48.4, '#f4f8f8', 3) +
    rect(-8.8, -22.8, 1.1, 44, '#fff', 0.5) +
    rect(-8.8, -16.5, 17.6, 0.5, '#cedee4') +
    rect(-8.8, 17, 17.6, 0.5, '#cedee4') +
    rect(-6, -7, 12, 18, '#afc5d0', 2));
  surface([0, 0, 24.5], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 24.5],
    rect(-5.5, -7.5, 11, 17, '#e5eef1', 1.8) +
    rect(-4.8, -6.8, 9.6, 8, '#f9fbfb', 1) +
    [3, 4.5, 6, 7.5].map(y => rect(-3.8, y, 7.6, 0.55, '#9bb3c1', 0.2)).join(''));

  // Four solid tires with inset metal hubs. Their circular faces stay in
  // the wheel plane; a heading change exposes the correct side of the bus.
  for (const side of [-1, 1]) for (const y of [-15, 15]) {
    surface([side * 11.4, y, 4.6], [0, 1, 0], [0, 0, -1], [side, 0, 0],
      [side * 11.4, y, 4.6],
      '<circle r="4.6" fill="#102536"/><circle r="3.5" fill="#243b4a"/>' +
      '<circle r="2.3" fill="#c6d4da"/><circle r="1.5" fill="#7f99a8"/>' +
      '<circle r=".65" fill="#dce7ea"/>');
  }

  // Mirror housings project beyond the front corners.
  for (const side of [-1, 1]) {
    surface([side * 12.2, -22.5, 19.5], [1, 0, 0], [0, 0, -1], [0, -1, 0],
      [side * 12.2, -22.5, 18],
      rect(side === 1 ? -1.5 : 0, 0, 1.5, 0.8, '#244255') +
      rect(-1.2, -0.6, 2.4, 3.8, '#244255', 0.7) +
      rect(-0.7, 0, 1.4, 2.5, '#8eb2c5', 0.4));
    surface([side * 12.2, -22.5, 19.5], [1, 0, 0], [0, 0, -1], [0, 1, 0],
      [side * 12.2, -22.5, 18], rect(-1.2, -0.6, 2.4, 3.8, '#244255', 0.7));
  }
  return surfaces;
}

const BUS_SURFACES = buildBus();
const TILT = 42 * Math.PI / 180;

/** Render only when the rounded heading changes, not on a frame loop. */
export function renderBusModel(heading: number): string {
  const degrees = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0;
  const angle = degrees * Math.PI / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  function rotate([x, y, z]: Vec3): Vec3 {
    return [x * cos - y * sin, x * sin + y * cos, z];
  }
  function project(point: Vec3): Vec3 {
    const [x, y, z] = rotate(point);
    return [x, y * Math.cos(TILT) - z * Math.sin(TILT),
      y * Math.sin(TILT) + z * Math.cos(TILT)];
  }
  const n = (value: number) => Number(value.toFixed(3));
  function matrix(origin: Vec3, u: Vec3, v: Vec3): string {
    const p = project(origin), a = project(u), b = project(v);
    return `matrix(${[a[0], a[1], b[0], b[1], p[0], p[1]].map(n).join(' ')})`;
  }
  const faces = BUS_SURFACES.filter(face => project(face.normal)[2] > 0.001)
    .sort((a, b) => project(a.center)[2] - project(b.center)[2])
    .map(face => {
      const normal = rotate(face.normal);
      const shade = Math.max(0, 0.15 + normal[0] * 0.1 + normal[1] * 0.05 - normal[2] * 0.2);
      const paint = face.paint.replace(/#[a-f\d]{6}/gi, color => '#' +
        [1, 3, 5].map(start => Math.round(parseInt(color.slice(start, start + 2), 16) *
          (1 - shade)).toString(16).padStart(2, '0')).join(''));
      return `<g transform="${matrix(face.origin, face.u, face.v)}">${paint}</g>`;
    }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="-36 -44 72 72" class="user-bus-model" aria-hidden="true" focusable="false">` +
    `<g transform="${matrix([0, 1, 0], [1, 0, 0], [0, 1, 0])}" fill="#142f43">` +
    '<rect x="-14" y="-27" width="28" height="54" rx="10" opacity=".05"/>' +
    '<rect x="-12" y="-25" width="24" height="50" rx="8" opacity=".08"/>' +
    '<rect x="-10" y="-23" width="20" height="46" rx="6" opacity=".12"/></g>' +
    faces + '</svg>';
}
