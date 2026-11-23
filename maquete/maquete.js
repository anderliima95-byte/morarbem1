/* Morar Bem 1 · Mapa de disponibilidade 3D
   Coordenadas: plantas do 1º andar (px de uma imagem 1808x2000) convertidas para metros.
   Mundo: x = leste, z = sul, y = altura. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const CFG = {
  whatsapp: "5593981307082",
  lat: -2.4637, lon: -54.7521, tz: -3,
  tTerreo: 4.0, tAndar: 3.0, andares: 3,
};
const $ = s => document.querySelector(s);
const isMobile = matchMedia("(max-width: 900px)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const brl = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const m2 = n => n.toFixed(2).replace(".", ",") + " m²";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------- Dados: posições + tabela viva ---------- */
const BASE = Object.fromEntries((window.UNIDADES || []).map(u => [u.u, u]));
const UNITS = (window.UNIDADES_MAQUETE || []).map(m => {
  const b = BASE[m.u] || {};
  return { ...m, m2: m.m2Planta ?? m.m2, preco: b.p ?? m.preco, vendida: b.v != null ? !!b.v : m.vendida, m2Garagem: b.g ?? m.m2Garagem, windows: [], hits: [], glows: [] };
});

/* ---------- Planta -> mundo ---------- */
const PX = 0.05232, O = [1100, 1000], EV = [0.2779, -0.9606], NV = [-0.9606, -0.2779];
const W = (px, py) => { const dx = (px - O[0]) * PX, dy = (py - O[1]) * PX; return new THREE.Vector2(dx * EV[0] + dy * EV[1], -(dx * NV[0] + dy * NV[1])); };
const Wd = (vx, vy) => new THREE.Vector2(vx * EV[0] + vy * EV[1], -(vx * NV[0] + vy * NV[1])).normalize();
const V3 = (v2, y = 0) => new THREE.Vector3(v2.x, y, v2.y);

/* ---------- Renderer / cena ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
catch (e) { $("#fallback").style.display = "grid"; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("#app").appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer({ element: $("#labels") });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3f2, 280, 900);
const camera = new THREE.PerspectiveCamera(isMobile ? 52 : 42, innerWidth / innerHeight, 0.5, 2500);
camera.position.set(-260, 160, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 10; controls.maxDistance = 360;
controls.maxPolarAngle = Math.PI * 0.47;
controls.autoRotateSpeed = 0.35;

/* ---------- Texturas desenhadas ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const texRoof = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#3d4249"; g.fillRect(0, 0, w, h); g.fillStyle = "#4b5159"; g.fillRect(0, 0, 6, h); g.fillStyle = "#30343a"; g.fillRect(6, 0, 3, h); }, true);
const texWood = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#3c2a1e"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? "#7a5236" : "#8a5f3f"; g.fillRect(x, 0, 5, h); } }, true);
const texShop = canvasTex(256, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#fff1d6"); gr.addColorStop(1, "#e9b878"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(90,60,30,.35)"; for (let x = 10; x < w; x += 46) g.fillRect(x, 70, 30, 40);
  g.fillStyle = "#1d1f22"; for (let x = 0; x <= w; x += 64) g.fillRect(x - 3, 0, 6, h); g.fillRect(0, 0, w, 8); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 40, w, 3);
}, true);
const texGlow = canvasTex(64, 64, (g, w, h) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,210,140,1)"); r.addColorStop(.35, "rgba(255,180,90,.45)"); r.addColorStop(1, "rgba(255,160,60,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); });
const texRoad = canvasTex(128, 64, (g, w, h) => { g.fillStyle = "#3b3e44"; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.fillStyle = "#e9e3d3"; g.fillRect(0, 31, 64, 2); }, true);
function signTex(text, bg, fg, w = 512, h = 96, extra) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `800 ${h * .46}px Manrope, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 2); if (extra) extra(g, w, h); });
}
const texLogo = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = "#5b3fa0"; g.fillStyle = "#5b3fa0"; g.lineWidth = 16; g.lineJoin = "round";
  g.beginPath(); g.moveTo(128, 30); g.lineTo(220, 200); g.lineTo(36, 200); g.closePath(); g.stroke();
  g.font = "900 92px Manrope, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("3A", 128, 150);
});

/* janelas: interior aceso (cortina, persiana, pessoa, abajur) e vidro escuro */
function frameWin(g, w, h) {
  g.fillStyle = "#2a2d31"; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); g.fillRect(w / 2 - 2, 0, 4, h);
}
function curtains(g, w, h, cw, c1, c2) {
  for (const side of [0, 1]) for (let i = 0; i < cw; i += 6) {
    const x = side ? w - 5 - cw + i : 5 + i; const gr = g.createLinearGradient(x, 0, x + 6, 0);
    gr.addColorStop(0, c1); gr.addColorStop(.5, c2); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(x, 5, 6, h - 11);
  }
}
const WIN_KINDS = ["curtains", "person", "blinds", "lamp", "person2"];
const winTex = WIN_KINDS.map(kind => canvasTex(128, 96, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffe7b4"); gr.addColorStop(1, "#f2a75a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(150,90,40,.25)"; g.fillRect(5, h * .72, w - 10, h * .28);
  if (kind === "blinds") { for (let y = 8; y < h - 6; y += 7) { g.fillStyle = "rgba(140,85,35,.42)"; g.fillRect(5, y, w - 10, 3); } }
  if (kind === "curtains") curtains(g, w, h, 34, "#d99a52", "#f6c98a");
  if (kind === "person" || kind === "person2") {
    curtains(g, w, h, kind === "person" ? 22 : 16, "#c98a48", "#efbd7d");
    const x = kind === "person" ? 80 : 46;
    g.fillStyle = "rgba(55,32,14,.6)"; g.beginPath(); g.arc(x, 38, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - 17, h - 6); g.quadraticCurveTo(x - 16, 52, x, 50); g.quadraticCurveTo(x + 16, 52, x + 17, h - 6); g.fill();
  }
  if (kind === "lamp") {
    const r = g.createRadialGradient(92, 40, 2, 92, 40, 34); r.addColorStop(0, "rgba(255,250,220,.95)"); r.addColorStop(1, "rgba(255,220,150,0)"); g.fillStyle = r; g.fillRect(50, 5, 75, 80);
    g.fillStyle = "rgba(70,40,18,.55)"; g.beginPath(); g.moveTo(84, 32); g.lineTo(100, 32); g.lineTo(104, 46); g.lineTo(80, 46); g.fill(); g.fillRect(91, 46, 2, 30);
    g.fillStyle = "rgba(40,60,25,.55)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(26 + Math.sin(i) * 6, 70 - i * 7, 9, 4, i * .7, 0, Math.PI * 2); g.fill(); } g.fillRect(22, 74, 10, 16);
  }
  frameWin(g, w, h);
}));
const texGlass = canvasTex(128, 96, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#5a7896"); gr.addColorStop(.45, "#203247"); gr.addColorStop(1, "#142336"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(255,255,255,.13)"; g.beginPath(); g.moveTo(20, 0); g.lineTo(48, 0); g.lineTo(14, h); g.lineTo(-14, h); g.fill();
  g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.moveTo(70, 0); g.lineTo(82, 0); g.lineTo(60, h); g.lineTo(48, h); g.fill();
  frameWin(g, w, h);
});
const texDoor = canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#6e4a30"; g.fillRect(0, 0, w, h); for (let x = 4; x < w; x += 8) { g.fillStyle = "#83593a"; g.fillRect(x, 0, 4, h); } g.fillStyle = "#2a2d31"; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); g.fillStyle = "#d8d2c4"; g.fillRect(w - 14, h * .52, 6, 3); });

/* textos fixos (asfalto, telhado, fachada) */
function textTex(text, o = {}) {
  const h = o.h || 128, c = document.createElement("canvas"), g = c.getContext("2d");
  const font = `${o.weight || 800} ${h * .58}px Manrope, Arial, sans-serif`;
  g.font = font; const pad = o.pad ?? h * .35; const w = Math.ceil(g.measureText(text).width + pad * 2);
  c.width = w; c.height = h; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
  if (o.bg) { g.fillStyle = o.bg; const r = h * .22; g.beginPath(); g.roundRect ? g.roundRect(2, 2, w - 4, h - 4, r) : g.rect(2, 2, w - 4, h - 4); g.fill(); }
  if (o.stroke) { g.lineWidth = h * .07; g.strokeStyle = o.stroke; g.strokeText(text, w / 2, h / 2 + h * .04); }
  g.fillStyle = o.fg || "#fff"; g.fillText(text, w / 2, h / 2 + h * .04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, aspect: w / h };
}
// texto deitado no chão/telhado, alinhado à direção dir2 (Vector2 no plano x,z)
function flatText(text, p2, dir2, height, y, o = {}) {
  const { tex, aspect } = textTex(text, o);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .9, polygonOffset: true, polygonOffsetFactor: -4, opacity: o.opacity ?? 1 });
  if (o.emissive) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = tex; mat.emissiveIntensity = 0; (M.nightText ||= []).push(mat); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
  m.rotation.order = "YXZ"; m.rotation.y = Math.atan2(-dir2.y, dir2.x); m.rotation.x = -Math.PI / 2;
  m.position.set(p2.x, y, p2.y); m.receiveShadow = true; scene.add(m); return m;
}
// letreiro na fachada (plano vertical virado para a normal)
function wallText(text, p2, n2, width, height, y, o = {}) {
  const { tex, aspect } = textTex(text, o);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: !o.bg || o.transparent, roughness: .6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .05 });
  (M.signs ||= []).push(mat);
  const w = width || height * aspect, hh = width ? width / aspect : height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
  m.position.copy(V3(p2, y)); m.lookAt(m.position.clone().add(V3(n2))); scene.add(m); return m;
}

/* ---------- Materiais ---------- */
const M = {
  wall: new THREE.MeshStandardMaterial({ color: 0xecebe6, roughness: .88 }),
  band: new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: .8 }),
  roof: new THREE.MeshStandardMaterial({ map: texRoof, roughness: .7, metalness: .2 }),
  core: new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: .9 }),
  burg: new THREE.MeshStandardMaterial({ color: 0x6b2a2a, roughness: .7 }),
  wood: new THREE.MeshStandardMaterial({ map: texWood, roughness: .8 }),
  col: new THREE.MeshStandardMaterial({ color: 0xdedbd3, roughness: .9 }),
  glassRail: new THREE.MeshStandardMaterial({ color: 0xbfe3f2, transparent: true, opacity: .28, roughness: .1, metalness: .1, depthWrite: false }),
  rail: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .5 }),
  led: new THREE.MeshStandardMaterial({ color: 0x7a6a50, emissive: 0xffd6a0, emissiveIntensity: .2 }),
  shop: new THREE.MeshStandardMaterial({ map: texShop, emissive: 0xffffff, emissiveMap: texShop, emissiveIntensity: .35, roughness: .2 }),
  shopCore: new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: .9 }),
  pharm: new THREE.MeshStandardMaterial({ color: 0x21372c, roughness: .6 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xb6aea2, roughness: .95 }),
  parking: new THREE.MeshStandardMaterial({ color: 0x8f8a84, roughness: .95 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x6f9a4c, roughness: 1 }),
  ground: new THREE.MeshStandardMaterial({ color: 0xc2b896, roughness: 1 }),
  earth: new THREE.MeshStandardMaterial({ color: 0xc58a5c, roughness: 1 }),
  side: new THREE.MeshStandardMaterial({ color: 0xcdc7bb, roughness: .95 }),
  road: new THREE.MeshStandardMaterial({ map: texRoad, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 }),
  zebra: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }),
  wallSite: new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: .9 }),
  // janelas das unidades
  winOff: new THREE.MeshStandardMaterial({ map: texGlass, roughness: .15, metalness: .35 }),
  winOnVar: winTex.map(t => new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1, roughness: .5 })),
  door: new THREE.MeshStandardMaterial({ map: texDoor, roughness: .8 }),
  winSmall: new THREE.MeshStandardMaterial({ map: texGlass, roughness: .2, metalness: .3 }),
  winSel: new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xe3c995, emissiveIntensity: 2.4, roughness: .3 }),
  winDim: new THREE.MeshStandardMaterial({ color: 0x8c8f94, roughness: .6, transparent: true, opacity: .55 }),
  hit: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  outline: new THREE.LineBasicMaterial({ color: 0xe3c995, transparent: true, opacity: 1 }),
  glow: new THREE.SpriteMaterial({ map: texGlow, color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  lampHead: new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffe2b0, emissiveIntensity: 0 }),
  houseWin: new THREE.MeshStandardMaterial({ color: 0x2a2f38, emissive: 0xffc98a, emissiveIntensity: 0, roughness: .5 }),
};

/* ---------- Geometria utilitária ---------- */
function prism(pts, y0, h, mat, opt = {}) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, -p.y)));
  if (opt.hole) shape.holes.push(new THREE.Path(opt.hole.map(p => new THREE.Vector2(p.x, -p.y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = opt.cast !== false; m.receiveShadow = true;
  scene.add(m); return m;
}
function quadMesh(c /*4 Vector3 em ordem*/, mat, uvScale = [1, 1]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...c[0].toArray(), ...c[1].toArray(), ...c[2].toArray(), ...c[3].toArray()], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, uvScale[0], 0, uvScale[0], uvScale[1], 0, uvScale[1]], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
function orientedBox(center, tangent2, normal2, len, h, depth, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, depth), mat);
  const x = V3(tangent2).normalize(), y = new THREE.Vector3(0, 1, 0); let z = new THREE.Vector3().crossVectors(x, y);
  if (z.dot(V3(normal2)) < 0) { x.negate(); z.negate(); }
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  m.position.copy(center); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
}
function facePlane(p0, p1, normal2, y0, y1, off, mat, uvx = 1, uvy = 1) {
  const n = V3(normal2).multiplyScalar(off);
  return quadMesh([V3(p0, y0).add(n), V3(p1, y0).add(n), V3(p1, y1).add(n), V3(p0, y1).add(n)], mat, [uvx, uvy]);
}
function label(html, cls, pos) { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; const o = new CSS2DObject(d); o.position.copy(pos); scene.add(o); return o; }

/* ---------- Blocos (planta do 1º andar) ---------- */
const BOXES = [
  { id: "B2", q: [[772, 1560], [778, 1705], [948, 1700], [938, 1555]], win: ["ab", "dc"], gal: "dc" },
  { id: "D2", q: [[1268, 1535], [1272, 1678], [1438, 1672], [1432, 1530]], win: ["ab", "dc"], gal: "dc", portal: true },
  { id: "T", q: [[1414, 1716], [1530, 1750], [1482, 1914], [1366, 1880]], win: ["ab", "dc"], gal: null, shop: "pharm", wood: true },
  { id: "A", q: [[825, 1554], [1390, 1717], [1340, 1890], [775, 1727]], win: ["ab", "dc"], gal: "dc", shop: "row", wood: true },
  { id: "G1", q: [[687, 57], [1090, 57], [1090, 222], [690, 224]], win: ["ab", "dc"], gal: "dc", wood: true },
  { id: "G2", q: [[1135, 55], [1355, 55], [1352, 220], [1135, 220]], win: ["ab", "dc"], gal: "dc", wood: true },
  { id: "F", q: [[692, 255], [697, 705], [866, 705], [862, 255]], win: ["ab", "dc"], gal: "dc" },
  { id: "H", q: [[1162, 243], [1168, 690], [1340, 690], [1335, 243]], win: ["ab", "dc"], gal: "dc" },
  { id: "E", q: [[722, 742], [1400, 728], [1405, 912], [728, 922]], win: ["ab"], gal: "ab" },
  { id: "C", q: [[738, 1090], [1415, 1083], [1408, 912], [732, 922]], win: ["ab"], gal: "ab" },
  { id: "B", q: [[740, 1115], [760, 1530], [928, 1525], [905, 1112]], win: ["ab", "dc"], gal: "dc" },
  { id: "D", q: [[1248, 1092], [1262, 1505], [1432, 1500], [1412, 1088]], win: ["ab", "dc"], gal: "dc" },
];
const STAIRS = [
  { q: [[1090, 62], [1135, 62], [1135, 215], [1090, 215]], logo: "ab" },
  { q: [[1125, 733], [1170, 732], [1172, 912], [1127, 913]] },
  { q: [[1135, 935], [1180, 934], [1182, 1062], [1137, 1063]] },
  { q: [[760, 1528], [928, 1523], [938, 1558], [772, 1561]] },
  { q: [[1262, 1503], [1432, 1498], [1432, 1532], [1268, 1537]], logo: "cd" },
  { q: [[1362, 1745], [1405, 1735], [1395, 1860], [1350, 1865]], logo: "da" },
];
const SITE = [[683, 43], [1360, 50], [1520, 1955], [780, 1740]];
const sitePts = SITE.map(p => W(...p));

function frame(box) {
  const [a, b, c, d] = box.q.map(p => W(...p));
  const bil = (s, t) => { const top = a.clone().lerp(b, s), bot = d.clone().lerp(c, s); return top.lerp(bot, t); };
  const center = bil(.5, .5);
  const L = a.distanceTo(b), D = a.distanceTo(d);
  const u = b.clone().sub(a).normalize();
  const faceInfo = f => {
    const [p0, p1] = f === "ab" ? [a, b] : [d, c];
    const tan = p1.clone().sub(p0).normalize();
    let n = new THREE.Vector2(-tan.y, tan.x);
    const mid = p0.clone().lerp(p1, .5);
    if (n.dot(mid.clone().sub(center)) < 0) n.negate();
    return { p0, p1, tan, n, t: f === "ab" ? 0 : 1, len: p0.distanceTo(p1) };
  };
  return { a, b, c, d, bil, center, L, D, u, face: faceInfo, contains(p) { const P = [a, b, c, d]; let sgn = 0; for (let i = 0; i < 4; i++) { const p0 = P[i], p1 = P[(i + 1) % 4]; const cr = (p1.x - p0.x) * (p.y - p0.y) - (p1.y - p0.y) * (p.x - p0.x); if (cr !== 0) { if (sgn && Math.sign(cr) !== sgn) return false; sgn = Math.sign(cr); } } return true; } };
}

/* ---------- Atribui unidades aos blocos ---------- */
BOXES.forEach(b => { b.F = frame(b); b.units = []; });
const orphans = [];
UNITS.forEach(u => {
  u.p = W(u.planta1[0] * 1808, u.planta1[1] * 2000);
  const box = BOXES.find(b => b.F.contains(u.p));
  if (!box) { orphans.push(u.u); return; }
  u.box = box; u.s = clamp(u.p.clone().sub(box.F.a).dot(box.F.u) / box.F.L, 0, 1); box.units.push(u);
});
if (orphans.length) console.warn("Unidades sem bloco:", orphans);

/* ---------- Construção ---------- */
const occluders = [], hitPanels = [];
const yAndar = f => CFG.tTerreo + (f - 1) * CFG.tAndar;
const yTopo = CFG.tTerreo + CFG.andares * CFG.tAndar;

function buildBox(box) {
  const F = box.F, P = [F.a, F.b, F.c, F.d];
  // térreo
  if (box.shop) {
    const inner = [F.bil(.01, .03), F.bil(.99, .03), F.bil(.99, .97), F.bil(.01, .97)];
    occluders.push(prism(inner, 0, CFG.tTerreo - .15, box.shop === "pharm" ? M.pharm : M.shopCore));
    const faces = box.shop === "pharm" ? ["ab", "dc"] : ["dc", "ab"];
    faces.forEach(f => { const fi = F.face(f); facePlane(fi.p0, fi.p1, fi.n, .15, CFG.tTerreo - .55, F.D * .02 + .06, M.shop, fi.len / 4, 1); });
  } else {
    const cols = [];
    for (const t of [.04, .96]) for (let s = 0; s <= 1.0001; s += 1 / Math.max(1, Math.round(F.L / 5))) cols.push(F.bil(clamp(s, .02, .98), t));
    cols.forEach(c => { const m = new THREE.Mesh(new THREE.BoxGeometry(.38, CFG.tTerreo, .38), M.col); m.position.copy(V3(c, CFG.tTerreo / 2)); m.castShadow = true; scene.add(m); });
    prism(P, CFG.tTerreo - .35, .35, M.band); // laje
  }
  // corpo
  occluders.push(prism(P, CFG.tTerreo, yTopo - CFG.tTerreo, M.wall));
  // faixas horizontais
  const exp = [F.bil(-.012, -.03), F.bil(1.012, -.03), F.bil(1.012, 1.03), F.bil(-.012, 1.03)];
  for (let f = 1; f <= CFG.andares + 1; f++) prism(exp, yAndar(f) - .14, .28, M.band, { cast: false });
  // platibanda e telhado
  const inner = [F.bil(.012, .04), F.bil(.988, .04), F.bil(.988, .96), F.bil(.012, .96)];
  prism(P, yTopo, .9, M.band, { hole: inner });
  quadMesh([V3(inner[0], yTopo + .35), V3(inner[1], yTopo + .35), V3(inner[2], yTopo + .35), V3(inner[3], yTopo + .35)], M.roof, [F.L / 1.1, 1]);
  orientedBox(V3(F.bil(.5, .5), yTopo + .45), F.u, new THREE.Vector2(-F.u.y, F.u.x), F.L * .97, .12, .25, M.band, false);
  // corredores (galerias)
  if (box.gal) {
    const fi = F.face(box.gal), gw = 1.75;
    for (let f = 1; f <= CFG.andares; f++) {
      const y = yAndar(f);
      const mid = fi.p0.clone().lerp(fi.p1, .5).add(fi.n.clone().multiplyScalar(gw / 2));
      orientedBox(V3(mid, y - .11), fi.tan, fi.n, fi.len, .22, gw, M.band);
      const edge = fi.p0.clone().lerp(fi.p1, .5).add(fi.n.clone().multiplyScalar(gw - .05));
      orientedBox(V3(edge, y + .62), fi.tan, fi.n, fi.len, 1.05, .03, M.glassRail, false);
      orientedBox(V3(edge, y + 1.16), fi.tan, fi.n, fi.len, .05, .06, M.rail, false);
      orientedBox(V3(edge, y - .24), fi.tan, fi.n, fi.len, .04, .06, M.led, false);
    }
    const mid = fi.p0.clone().lerp(fi.p1, .5).add(fi.n.clone().multiplyScalar(gw / 2));
    orientedBox(V3(mid, yTopo + .1), fi.tan, fi.n, fi.len, .2, gw, M.band);
  }
  // fachada de lojas: letreiros
  if (box.shop === "row") {
    const fi = F.face("dc"), n = fi.n;
    // faixa escura sob a marquise + letreiros fixos
    const off = F.D * .02 + 1.86;
    const pA = fi.p0.clone().lerp(fi.p1, .55), pB = fi.p0.clone().lerp(fi.p1, .985);
    facePlane(pA, pB, n, CFG.tTerreo - 1.05, CFG.tTerreo - .2, off, new THREE.MeshStandardMaterial({ color: 0x23282a, roughness: .6 }));
    wallText("ACADEMIA · FITNESS", pA.clone().lerp(pB, .5).add(n.clone().multiplyScalar(off + .03)), n, null, .62, CFG.tTerreo - .62, { fg: "#f4efe6", pad: 30 });
    const pC = fi.p0.clone().lerp(fi.p1, .05), pD = fi.p0.clone().lerp(fi.p1, .42);
    facePlane(pC, pD, n, CFG.tTerreo - 1.05, CFG.tTerreo - .2, off, new THREE.MeshStandardMaterial({ color: 0x23282a, roughness: .6 }));
    wallText("PONTO COMERCIAL", pC.clone().lerp(pD, .5).add(n.clone().multiplyScalar(off + .03)), n, null, .62, CFG.tTerreo - .62, { fg: "#e3c995", pad: 30 });
  }
  if (box.shop === "pharm") {
    const tex = signTex("3A FARMÁCIA", "#21372c", "#ffffff", 640, 110, (g, w, h) => { g.fillStyle = "#c0392b"; g.fillRect(w - 70, h / 2 - 8, 44, 16); g.fillRect(w - 56, h / 2 - 22, 16, 44); });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .15 });
    M.pharmSign = mat;
    ["dc"].forEach(f => { const fi = F.face(f); facePlane(fi.p0, fi.p1, fi.n, CFG.tTerreo - 1.0, CFG.tTerreo - .1, F.D * .02 + .1, mat); });
    const sc = { p0: F.c, p1: F.b }; const tan = sc.p1.clone().sub(sc.p0).normalize(); let n = new THREE.Vector2(-tan.y, tan.x); if (n.dot(sc.p0.clone().lerp(sc.p1, .5).sub(F.center)) < 0) n.negate();
    facePlane(sc.p0, sc.p1, n, CFG.tTerreo - 1.0, CFG.tTerreo - .1, .1, mat);
    // aleta bordô na esquina
    orientedBox(V3(F.a.clone().lerp(F.d, .5), (yTopo + 2.4) / 2), F.u, new THREE.Vector2(-F.u.y, F.u.x), .7, yTopo + 2.4, 1.4, M.burg);
  }
  if (box.portal) {
    const fi = F.face("dc"), pm = fi.p0.clone().lerp(fi.p1, .5), off = fi.n.clone().multiplyScalar(2.2);
    orientedBox(V3(pm.clone().add(off).add(fi.tan.clone().multiplyScalar(-2)), 1.9), fi.tan, fi.n, .5, 3.8, .7, M.burg);
    orientedBox(V3(pm.clone().add(off).add(fi.tan.clone().multiplyScalar(2)), 1.9), fi.tan, fi.n, .5, 3.8, .7, M.burg);
    orientedBox(V3(pm.clone().add(off), 3.95), fi.tan, fi.n, 4.5, .45, .8, M.burg);
    wallText("PORTARIA", pm.clone().add(off).add(fi.n.clone().multiplyScalar(.42)), fi.n, null, .38, 3.95, { fg: "#f4efe6", pad: 18 });
    wallText("MORAR BEM 1", pm.clone().add(fi.n.clone().multiplyScalar(.06)).add(fi.tan.clone().multiplyScalar(4.6)), fi.n, null, .55, 3.1, { fg: "#6b2a2a", pad: 10 });
  }
}

/* janelas por unidade */
function buildUnitWindows(box) {
  const F = box.F;
  for (let f = 1; f <= CFG.andares; f++) {
    const us = box.units.filter(u => u.andar === f).sort((a, b) => a.s - b.s);
    us.forEach((u, i) => {
      const s0 = i === 0 ? 0 : (us[i - 1].s + u.s) / 2, s1 = i === us.length - 1 ? 1 : (u.s + us[i + 1].s) / 2;
      u.s0 = s0; u.s1 = s1;
      const y = yAndar(f);
      box.win.forEach(fname => {
        const fi = F.face(fname);
        const span = (s1 - s0) * fi.len, sm = (s0 + s1) / 2;
        const c = fi.p0.clone().lerp(fi.p1, sm);
        const ww = clamp(span * .58, 1.4, 3.2), wh = 1.5;
        const isGal = fname === box.gal;
        if (!u.litMat) { let hsh = 0; for (const ch of u.u) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; u.litMat = M.winOnVar[hsh % M.winOnVar.length]; }
        const win = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), u.vendida ? u.litMat : M.winOff);
        const pos = V3(c.clone().add(fi.n.clone().multiplyScalar(.06)), y + 1.55);
        win.position.copy(pos); win.lookAt(pos.clone().add(V3(fi.n))); scene.add(win);
        // peitoril e verga
        orientedBox(V3(c.clone().add(fi.n.clone().multiplyScalar(.12)), y + 1.55 - wh / 2 - .05), fi.tan, fi.n, ww + .3, .09, .24, M.band, false);
        orientedBox(V3(c.clone().add(fi.n.clone().multiplyScalar(.08)), y + 1.55 + wh / 2 + .05), fi.tan, fi.n, ww + .16, .07, .16, M.band, false);
        if (isGal && span > ww + 2.1) { // porta de entrada no corredor
          const dp = c.clone().add(fi.tan.clone().multiplyScalar(ww / 2 + .75)).add(fi.n.clone().multiplyScalar(.05));
          const door = new THREE.Mesh(new THREE.PlaneGeometry(.9, 2.15), M.door); door.position.copy(V3(dp, y + 1.08)); door.lookAt(door.position.clone().add(V3(fi.n))); scene.add(door);
        } else if (!isGal && span > ww + 1.9) { // janelinha do banheiro
          const sp = c.clone().add(fi.tan.clone().multiplyScalar(ww / 2 + .8)).add(fi.n.clone().multiplyScalar(.05));
          const sw = new THREE.Mesh(new THREE.PlaneGeometry(.7, .45), M.winSmall); sw.position.copy(V3(sp, y + 2.05)); sw.lookAt(sw.position.clone().add(V3(fi.n))); scene.add(sw);
        }
        const ol = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(ww + .3, wh + .3)), M.outline);
        ol.position.copy(pos).add(V3(fi.n).multiplyScalar(.03)); ol.quaternion.copy(win.quaternion); ol.visible = false; scene.add(ol);
        u.windows.push({ mesh: win, outline: ol, normal: V3(fi.n), pos, gallery: isGal, face: fname });
        if (u.vendida) { const gl = new THREE.Sprite(M.glow.clone()); gl.scale.set(ww * 2.4, wh * 2.6, 1); gl.position.copy(pos).add(V3(fi.n).multiplyScalar(.4)); scene.add(gl); u.glows.push(gl); }
        const hit = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(span * .96, 1.6), CFG.tAndar * .92), M.hit);
        const hp = V3(c.clone().add(fi.n.clone().multiplyScalar(isGal ? 1.9 : .14)), y + CFG.tAndar / 2);
        hit.position.copy(hp); hit.lookAt(hp.clone().add(V3(fi.n))); hit.userData.unit = u; scene.add(hit); hitPanels.push(hit); u.hits.push(hit);
        if (box.wood && !isGal && span > 3.4) {
          const pw = c.clone().add(fi.tan.clone().multiplyScalar(-(ww / 2 + .75)));
          const wp = pw.clone().add(fi.n.clone().multiplyScalar(.18));
          orientedBox(V3(wp, y + 1.45), fi.tan, fi.n, .9, 2.65, .12, M.wood, false);
        }
      });
      // janela principal: face sem galeria, se houver
      const prim = u.windows.find(w => !w.gallery) || u.windows[0];
      u.primary = prim;
      const az = (Math.atan2(prim.normal.x, -prim.normal.z) * 180 / Math.PI + 360) % 360;
      u.sol = az >= 45 && az < 135 ? "Nascente · sol da manhã" : az >= 225 && az < 315 ? "Poente · sol da tarde" : az >= 315 || az < 45 ? "Face norte" : "Face sul";
    });
  }
}

function buildStairs() {
  STAIRS.forEach(st => {
    const P = st.q.map(p => W(...p)), top = yTopo + 2.6;
    occluders.push(prism(P, 0, top, M.core));
    prism(P.map(p => p), top, .25, M.roof, { cast: false });
    if (st.logo) {
      const idx = { ab: [0, 1], cd: [2, 3], da: [3, 0] }[st.logo];
      const p0 = P[idx[0]], p1 = P[idx[1]], ctr = P.reduce((a, b) => a.clone().add(b)).multiplyScalar(.25);
      const tan = p1.clone().sub(p0).normalize(); let n = new THREE.Vector2(-tan.y, tan.x); if (n.dot(p0.clone().lerp(p1, .5).sub(ctr)) < 0) n.negate();
      const mid = p0.clone().lerp(p1, .5), size = Math.min(2.2, p0.distanceTo(p1) * .8);
      const lp = mid.clone().add(n.clone().multiplyScalar(.05));
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: texLogo, transparent: true, emissive: 0x6a4fb0, emissiveMap: texLogo, emissiveIntensity: 0 }));
      lg.position.copy(V3(lp, top - 1.5)); lg.lookAt(lg.position.clone().add(V3(n))); scene.add(lg); (M.logos ||= []).push(lg.material);
    }
  });
}

/* ---------- Terreno, pátios, carros, árvores ---------- */
function buildSite() {
  prism(sitePts, 0, .12, M.paving, { cast: false });
  const court = (pts, y = .13) => prism(pts.map(p => W(...p)), 0, y, M.parking, { cast: false });
  court([[935, 1112], [1245, 1095], [1262, 1590], [960, 1600]]);
  court([[905, 250], [1160, 245], [1165, 705], [905, 705]]);
  const grass1 = [[1010, 1385], [1180, 1375], [1186, 1525], [1015, 1535]], grass2 = [[955, 430], [1110, 428], [1112, 560], [957, 562]];
  [grass1, grass2].forEach(g => {
    prism(g.map(p => W(...p)), 0, .2, M.grass, { cast: false });
    const c = g.map(p => W(...p)).reduce((a, b) => a.clone().add(b)).multiplyScalar(.25);
    playground(c);
  });
  // muro do terreno (laterais sem prédio)
  const wallEdge = (i, j, from = 0, to = 1) => { const a = sitePts[i].clone().lerp(sitePts[j], from), b = sitePts[i].clone().lerp(sitePts[j], to); const tan = b.clone().sub(a); const len = tan.length(); tan.normalize(); orientedBox(V3(a.clone().lerp(b, .5), 1.1), tan, new THREE.Vector2(-tan.y, tan.x), len, 2.2, .25, M.wallSite); };
  wallEdge(3, 0); wallEdge(0, 1); wallEdge(1, 2, 0, .78);
  // carros
  const cars = [[970, 1180], [1010, 1182], [1050, 1180], [1090, 1178], [1130, 1176], [1170, 1172], [1210, 1170], [975, 1290], [1015, 1288], [1055, 1286], [1095, 1284], [1205, 1282],
    [935, 310], [975, 308], [1015, 306], [1055, 304], [1095, 302], [1135, 300], [930, 640], [970, 640], [1010, 640], [1050, 640], [1090, 638], [1130, 636], [820, 1300], [820, 1420], [1340, 1250], [1340, 1380], [780, 470], [1250, 470]];
  const colors = [0xe8d34a, 0x3a3d42, 0xe9e9e9, 0xa7abb1, 0x2b4a7a, 0x8c2f2f];
  const ang = Math.atan2(-Wd(1, 0).y, Wd(1, 0).x);
  cars.forEach(([x, y]) => { if (rnd() < .2) return; car(W(x, y), ang + Math.PI / 2, colors[Math.floor(rnd() * colors.length)]); });
  // palmeiras e árvores do condomínio
  [[1020, 1370], [1170, 1540], [960, 420], [1105, 575]].forEach(p => palm(W(...p), 9 + rnd() * 2));
  const fA = BOXES.find(b => b.id === "A").F.face("dc"), fT = BOXES.find(b => b.id === "T").F.face("dc");
  for (let s = .08; s < .98; s += .13) palm(fA.p0.clone().lerp(fA.p1, s).add(fA.n.clone().multiplyScalar(5.2)), 6 + rnd() * 3);
  palm(fT.p0.clone().lerp(fT.p1, .5).add(fT.n.clone().multiplyScalar(5.5)), 7);
}
function car(p, ang, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, .75, 1.8), new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .4 }));
  body.position.y = .55; body.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, .6, 1.6), new THREE.MeshStandardMaterial({ color: 0x1f2a36, roughness: .2, metalness: .6 }));
  cab.position.set(-.2, 1.2, 0); cab.castShadow = true;
  g.add(body, cab); g.position.copy(V3(p, .12)); g.rotation.y = ang; scene.add(g);
}
function playground(c) {
  const parts = [[0, 0, 2.6, 1.6, 2.6, 0xc0392b], [2.4, .5, 1.2, 2.4, 1.2, 0x2e86c1], [-2.2, .3, 1.4, 2.0, 1.4, 0xf1c40f], [.8, -1.8, 3.2, .3, .6, 0x27ae60]];
  parts.forEach(([dx, dz, w, h, d, col]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: .6 })); m.position.set(c.x + dx, .2 + h / 2, c.y + dz); m.castShadow = true; scene.add(m); });
  const roofC = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x2e7d4f })); roofC.position.set(c.x, 2.45, c.y); roofC.rotation.y = Math.PI / 4; roofC.castShadow = true; scene.add(roofC);
}
const palmGeo = { trunk: new THREE.CylinderGeometry(.16, .26, 1, 6), leaf: new THREE.ConeGeometry(1.9, .7, 8, 1, true) };
const palmMat = { trunk: new THREE.MeshStandardMaterial({ color: 0x8a6e4f, roughness: 1 }), leaf: new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: .9, side: THREE.DoubleSide }) };
function palm(p, h) {
  const t = new THREE.Mesh(palmGeo.trunk, palmMat.trunk); t.scale.y = h; t.position.copy(V3(p, h / 2)); t.castShadow = true; scene.add(t);
  const l = new THREE.Mesh(palmGeo.leaf, palmMat.leaf); l.position.copy(V3(p, h + .1)); l.rotation.x = Math.PI; l.castShadow = true; scene.add(l);
}

/* ---------- Ruas e entorno ---------- */
const STREETS = [];
function street(name, p0, dir, len, width = 8, start = 0) {
  const d = dir.clone().normalize(), n = new THREE.Vector2(-d.y, d.x);
  const a = p0.clone().add(d.clone().multiplyScalar(start)), b = p0.clone().add(d.clone().multiplyScalar(len));
  const mid = a.clone().lerp(b, .5), L = a.distanceTo(b), ang = Math.atan2(-d.y, d.x);
  const add = (w, mat, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w), mat); m.rotation.x = -Math.PI / 2; const g = new THREE.Group(); g.add(m); g.position.set(mid.x, y, mid.y); g.rotation.y = ang; m.receiveShadow = true; scene.add(g); return m; };
  add(width + 5.2, M.side, .05);
  const r = add(width, M.road.clone(), .07); r.material.map = texRoad.clone(); r.material.map.needsUpdate = true; r.material.map.repeat.set(L / 12, 1);
  const s = { name, a, b, d, n, half: width / 2 + 2.6, len: L };
  STREETS.push(s); return s;
}
function distToStreet(p, s) { const ap = p.clone().sub(s.a); const t = clamp(ap.dot(s.d), 0, s.len); return ap.sub(s.d.clone().multiplyScalar(t)).length(); }

function buildSurroundings() {
  const g = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), M.ground); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  // ruas
  const NW = W(780, 1740), SWc = W(1520, 1955), NE = W(1360, 50);
  const tvDir = SWc.clone().sub(NW).normalize(), tvOut = Wd(-.278, .961);
  const tv = street("Tv. Resistência", NW.clone().add(tvOut.clone().multiplyScalar(7.5)), tvDir, 340, 8.5, -340);
  const seDir = NE.clone().sub(SWc).normalize(), seOut = Wd(.996, -.084);
  const se = street("R. Santo Expedito", SWc.clone().add(seOut.clone().multiplyScalar(7.5)), seDir, 430, 8, -4);
  const north = new THREE.Vector2(0, -1);
  const arStart = tv.a.clone().add(tv.d.clone().multiplyScalar(340 - 92));
  const ar = street("R. Visc. de Aracaju", arStart, seDir, 420, 7.5, 0);
  const ge = street("R. Gênesis", arStart, new THREE.Vector2(-.998, .06), 340, 7.5, 0);
  const jqStart = tv.a.clone().add(tv.d.clone().multiplyScalar(340 - 215));
  const jq = street("R. João Queirós", jqStart, new THREE.Vector2(-.976, .218), 340, 7.5, 0);
  const jq2 = street("R. João Queirós", jqStart, seDir.clone().rotateAround(new THREE.Vector2(), .12), 260, 7.5, 0);
  // faixas de pedestre na esquina
  const zebra = (s, at) => { for (let i = -3; i <= 3; i++) { const p = s.a.clone().add(s.d.clone().multiplyScalar(at)).add(s.n.clone().multiplyScalar(i * 1.15)); orientedBox(V3(p, .09), s.d, s.n, 3.2, .02, .55, M.zebra, false); } };
  zebra(tv, 340 + 12); zebra(se, 12);
  // nomes das ruas pintados no asfalto
  const STREET_TXT = [[tv, "TRAVESSA RESISTÊNCIA", [340 - 40, 340 + 80, 340 - 170]], [se, "RUA SANTO EXPEDITO", [55, 165, 290]], [ar, "RUA VISCONDE DE ARACAJU", [65, 190]], [ge, "RUA GÊNESIS", [50, 160]], [jq, "RUA JOÃO QUEIRÓS", [70, 190]], [jq2, "RUA JOÃO QUEIRÓS", [80]]];
  const txtSpots = [];
  STREET_TXT.forEach(([s, txt, ts]) => ts.forEach(t => { if (t > s.len - 15) return; txtSpots.push(s.a.clone().add(s.d.clone().multiplyScalar(t))); flatText(txt, s.a.clone().add(s.d.clone().multiplyScalar(t)), s.d, 2.6, .095, { fg: "rgba(246,242,232,.9)", pad: 20, emissive: true }); }));
  // áreas abertas (terra) ao sul
  const openSE = p => p.clone().sub(se.a).dot(seOut) > se.half && p.clone().sub(tv.a).dot(tvOut.clone().negate()) > 0;
  const openSW = p => p.clone().sub(tv.a).dot(tvOut) > tv.half && p.clone().sub(ge.a).dot(new THREE.Vector2(0, 1)) > 12;
  const earthPatch = (pts) => { const m = prism(pts, 0, .03, M.earth, { cast: false }); m.receiveShadow = true; };
  earthPatch([se.a.clone().add(seOut.clone().multiplyScalar(9)), se.b.clone().add(seOut.clone().multiplyScalar(9)), se.b.clone().add(seOut.clone().multiplyScalar(260)), se.a.clone().add(seOut.clone().multiplyScalar(260)).add(tv.d.clone().multiplyScalar(-40))]);
  const gS = ge.a.clone().add(new THREE.Vector2(0, 14));
  earthPatch([gS.clone().add(tvOut.clone().multiplyScalar(9)), gS.clone().add(new THREE.Vector2(-320, 0)), gS.clone().add(new THREE.Vector2(-320, 330)), gS.clone().add(tvOut.clone().multiplyScalar(9)).add(tv.d.clone().multiplyScalar(320))]);
  // casas e pequenos prédios ao longo das ruas
  const inSite = p => { const c = sitePts.reduce((a, b) => a.clone().add(b)).multiplyScalar(.25); const P = sitePts.map(q => q.clone().add(q.clone().sub(c).normalize().multiplyScalar(8))); let inside = false; for (let i = 0, j = 3; i < 4; j = i++) { if (((P[i].y > p.y) !== (P[j].y > p.y)) && (p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x)) inside = !inside; } return inside; };
  const church = new THREE.Vector2(36, -58);
  const placed = [], houses = [];
  // distância até o contorno do terreno: nada do entorno pode encostar nos blocos
  const distToSite = p => { let m = Infinity; for (let i = 0; i < 4; i++) { const a = sitePts[i], b = sitePts[(i + 1) % 4], ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); m = Math.min(m, p.distanceTo(a.clone().add(ab.multiplyScalar(t)))); } return m; };
  const ok = (p, r) => {
    if (inSite(p) || distToSite(p) < r + 10 || p.distanceTo(church) < 16) return false;
    for (const s of STREETS) if (distToStreet(p, s) < s.half + r * .7) return false;
    for (const q of placed) if (q.p.distanceTo(p) < (q.r + r) * .8) return false;
    return true;
  };
  const maxR = isMobile ? 270 : 340;
  STREETS.forEach(s => {
    for (const side of [1, -1]) for (let row = 0; row < 4; row++) {
      for (let t = 5; t < s.len - 5; t += 8.5 + rnd() * 4) {
        const tall = rnd() < .09;
        const w = tall ? 10 + rnd() * 5 : 6 + rnd() * 3.5, d = tall ? 10 + rnd() * 4 : 8 + rnd() * 5;
        const floors = tall ? 2 + Math.floor(rnd() * 2) : (rnd() < .12 ? 2 : 1);
        const h = floors * 3 + rnd() * .4;
        const off = s.half + 2 + d / 2 + row * (d + 4.5) + rnd() * 2;
        const p = s.a.clone().add(s.d.clone().multiplyScalar(t)).add(s.n.clone().multiplyScalar(side * off));
        if (p.length() > maxR) continue;
        const open = openSE(p) || openSW(p);
        if (open ? rnd() > .07 : rnd() > (row === 0 ? .96 : row === 1 ? .82 : .62)) continue;
        const r = Math.max(w, d) * .55;
        if (!ok(p, r)) continue;
        placed.push({ p, r }); houses.push({ p, w, d, h, floors, tall, along: s.d.clone(), face: s.n.clone().multiplyScalar(-side) });
      }
    }
  });
  const hCols = [0xf3efe6, 0xe9dcc8, 0xd9e3e6, 0xf0d9c2, 0xe4e8d8, 0xd8cdbf, 0xc9d6df, 0xf2e4c4, 0xe7cfc0, 0xd4e0cc];
  const rCols = [0xa4533a, 0x8b4a35, 0x6f7377, 0xb06a49, 0x7d8085];
  const box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .95 }), houses.length);
  const roofG = new THREE.ConeGeometry(.7071, 1, 4); roofG.rotateY(Math.PI / 4);
  const roof = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ roughness: .9 }), houses.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const winLit = [], winDark = [], doors = [];
  const o3 = new THREE.Object3D();
  const putPlane = (list, p3, n3, sx, sy) => { o3.position.copy(p3); o3.scale.set(sx, sy, 1); o3.lookAt(p3.clone().add(n3)); o3.updateMatrix(); list.push(o3.matrix.clone()); };
  houses.forEach((hs, i) => {
    const ang = Math.atan2(-hs.along.y, hs.along.x);
    q.setFromAxisAngle(up, ang);
    mtx.compose(V3(hs.p, hs.h / 2), q, new THREE.Vector3(hs.w, hs.h, hs.d)); box.setMatrixAt(i, mtx); box.setColorAt(i, col.setHex(hCols[i % hCols.length]));
    const rh = hs.tall ? .35 : 1.7;
    mtx.compose(V3(hs.p, hs.h + rh / 2), q, new THREE.Vector3(hs.w * (hs.tall ? 1 : 1.08), rh, hs.d * (hs.tall ? 1 : 1.08))); roof.setMatrixAt(i, mtx); roof.setColorAt(i, col.setHex(hs.tall ? 0x6f7377 : rCols[Math.floor(rnd() * rCols.length)]));
    // janelas e porta: frente (para a rua) e laterais
    const fN = V3(hs.face), sN = V3(hs.along), front = hs.p.clone().add(hs.face.clone().multiplyScalar(hs.d / 2 + .03));
    for (let f = 0; f < hs.floors; f++) {
      const y = f * 3 + 1.6, nW = Math.max(1, Math.floor(hs.w / 3.2));
      for (let k = 0; k < nW; k++) {
        const along = (k + .5) / nW - .5;
        if (f === 0 && k === Math.floor(nW / 2) && !hs.tall) { putPlane(doors, V3(front.clone().add(hs.along.clone().multiplyScalar(along * hs.w)), 1.05), fN, .95, 2.1); continue; }
        putPlane(rnd() < .38 ? winLit : winDark, V3(front.clone().add(hs.along.clone().multiplyScalar(along * hs.w)), y), fN, 1.2, 1.0);
      }
      for (const sd of [1, -1]) {
        const sideP = hs.p.clone().add(hs.along.clone().multiplyScalar(sd * (hs.w / 2 + .03)));
        const nS = Math.max(1, Math.floor(hs.d / 4));
        for (let k = 0; k < nS; k++) { if (rnd() < .3) continue; const a = (k + .5) / nS - .5; putPlane(rnd() < .3 ? winLit : winDark, V3(sideP.clone().add(hs.face.clone().multiplyScalar(a * hs.d)), y), sN.clone().multiplyScalar(sd), 1.0, .9); }
      }
    }
  });
  box.castShadow = true; box.receiveShadow = true; roof.castShadow = true;
  scene.add(box, roof);
  const planeG = new THREE.PlaneGeometry(1, 1);
  M.houseWinLit = new THREE.MeshStandardMaterial({ color: 0x3a3226, emissive: 0xffc98a, emissiveIntensity: 0, roughness: .5 });
  const glassH = new THREE.MeshStandardMaterial({ color: 0x2c3c4f, roughness: .25, metalness: .3 });
  const doorH = new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: .8 });
  [[winLit, M.houseWinLit], [winDark, glassH], [doors, doorH]].forEach(([list, mat]) => { const im = new THREE.InstancedMesh(planeG, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); scene.add(im); });
  // igreja vizinha
  const ch = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 20), new THREE.MeshStandardMaterial({ color: 0xf1efe9 })); ch.position.set(church.x, 3, church.y); ch.castShadow = true; scene.add(ch);
  const chR = new THREE.Mesh(new THREE.ConeGeometry(9, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x6f7377 })); chR.rotation.y = Math.PI / 4; chR.scale.z = 1.6; chR.position.set(church.x, 7.6, church.y); scene.add(chR);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(.25, 2.2, .25), new THREE.MeshStandardMaterial({ color: 0x4a4d52 })); cross.position.set(church.x, 7.4, church.y + 10.2); scene.add(cross);
  const crossB = new THREE.Mesh(new THREE.BoxGeometry(1.2, .25, .25), cross.material); crossB.position.set(church.x, 7.9, church.y + 10.2); scene.add(crossB);
  wallText("IGREJA IDPB AMPARO", new THREE.Vector2(church.x, church.y + 10.04), new THREE.Vector2(0, 1), null, .85, 4.6, { fg: "#2a2f35", pad: 16 });
  // árvores (instanciadas: muitas árvores com poucas chamadas de desenho)
  const trees = [];
  for (let i = 0; i < (isMobile ? 700 : 1200); i++) {
    const a = rnd() * Math.PI * 2, rr = 30 + Math.sqrt(rnd()) * (maxR - 10);
    const p = new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr);
    const open = openSE(p) || openSW(p);
    if (open && rnd() > .3) continue;
    if (p.length() < 72) continue; // deixa livre a vista do condomínio
    if (!ok(p, 2.2)) continue;
    placed.push({ p, r: 2.2 }); trees.push({ p, s: 1.8 + rnd() * 2.8 });
  }
  // árvores nas calçadas
  STREETS.forEach(s => { if (s === tv) return; for (let t = 8; t < s.len; t += 13 + rnd() * 10) for (const sd of [1, -1]) { if (rnd() < .45) continue; const p = s.a.clone().add(s.d.clone().multiplyScalar(t)).add(s.n.clone().multiplyScalar(sd * (s.half - .9))); if (p.length() > maxR || p.length() < 75 || inSite(p) || txtSpots.some(q => q.distanceTo(p) < 22)) continue; trees.push({ p, s: 1.6 + rnd() * 1.4 }); } });
  const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .28, 1, 5), palmMat.trunk, trees.length);
  const cr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), trees.length);
  const tc = [0x5d8a3f, 0x4c7a35, 0x6e9a48, 0x3f6b30, 0x7aa352];
  trees.forEach((t, i) => {
    mtx.compose(V3(t.p, t.s * .7), new THREE.Quaternion(), new THREE.Vector3(1, t.s * 1.4, 1)); tr.setMatrixAt(i, mtx);
    mtx.compose(V3(t.p, t.s * 1.75), new THREE.Quaternion().setFromAxisAngle(up, rnd() * 3), new THREE.Vector3(t.s * 1.15, t.s * (.85 + rnd() * .3), t.s * 1.15)); cr.setMatrixAt(i, mtx); cr.setColorAt(i, col.setHex(tc[i % tc.length]));
  });
  tr.castShadow = cr.castShadow = true; scene.add(tr, cr);
  // árvores pequenas de copa redonda ao longo da Travessa Resistência (acesso principal)
  const small = [];
  const frontA = 340 - 6, frontB = 340 + 52; // trecho em frente ao condomínio (lado do terreno já tem palmeiras)
  for (let t = 150; t < tv.len - 120; t += 8 + rnd() * 1.5) for (const sd of [1, -1]) {
    if (sd === -1 && t > frontA && t < frontB) continue;
    const p = tv.a.clone().add(tv.d.clone().multiplyScalar(t)).add(tv.n.clone().multiplyScalar(sd * (tv.half - 1.1)));
    if (txtSpots.some(q => q.distanceTo(p) < 9) || STREETS.some(s => s !== tv && distToStreet(p, s) < s.half + 1)) continue;
    small.push({ p, s: .9 + rnd() * .35 });
  }
  const st = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .13, 1, 6), palmMat.trunk, small.length);
  const sc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ roughness: .85 }), small.length);
  const scol = [0x5f9442, 0x6ea34c, 0x568a3c, 0x78ad52];
  small.forEach((t, i) => {
    mtx.compose(V3(t.p, 1.0 * t.s), new THREE.Quaternion(), new THREE.Vector3(1, 2.0 * t.s, 1)); st.setMatrixAt(i, mtx);
    mtx.compose(V3(t.p, 2.75 * t.s), new THREE.Quaternion(), new THREE.Vector3(1.25 * t.s, 1.15 * t.s, 1.25 * t.s)); sc.setMatrixAt(i, mtx); sc.setColorAt(i, col.setHex(scol[i % scol.length]));
  });
  st.castShadow = sc.castShadow = true; scene.add(st, sc);
  // postes
  const lampPos = [];
  [tv, se].forEach(s => { const L = s === tv ? [300, 320, 340, 360, 380, 400] : [10, 32, 54, 76, 98, 120]; L.forEach(t => lampPos.push({ p: s.a.clone().add(s.d.clone().multiplyScalar(t)).add(s.n.clone().multiplyScalar(s === tv ? s.half - 1 : -(s.half - 1))) })); });
  lampPos.forEach(({ p }) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x4a4d52 })); pole.position.copy(V3(p, 3.25)); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.6, .18, .3), M.lampHead); head.position.copy(V3(p, 6.5)); scene.add(head);
    const gl = new THREE.Sprite(M.glow.clone()); gl.scale.set(6, 6, 1); gl.position.copy(V3(p, 6.3)); scene.add(gl); (M.lampGlows ||= []).push(gl);
  });
  // pontos de referência: placa no chão + marcador fixo no local (dentro do mapa, com a distância real)
  const REFS = [
    { n: "MADRUGA MÓVEIS", e: 323, s: 83 }, { n: "AZULINO STORE", e: 469, s: -54 },
    { n: "RESIDENCIAL RESERVA ALVORADA", e: -355, s: -43 }, { n: "BOTÂNICA PLANTAS", e: -367, s: -104 }, { n: "IGREJA SANTA LUZIA", e: -564, s: 47 },
  ];
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x2d6cdf, roughness: .4, emissive: 0x2d6cdf, emissiveIntensity: .2 });
  REFS.forEach(r => {
    const p = new THREE.Vector2(r.e, r.s), dist = Math.round(p.length() / 10) * 10;
    const pos = p.clone().normalize().multiplyScalar(Math.min(p.length(), maxR - 35));
    const u = pos.clone().normalize(), dir = new THREE.Vector2(-u.y, u.x);
    flatText(`${r.n} · ${dist} m`, pos, dir, 3.6, .14, { bg: "rgba(255,253,249,.95)", fg: "#1b2433", pad: 26 });
    const pinP = pos.clone().add(u.clone().multiplyScalar(5));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 6, 6), pinMat); pole.position.copy(V3(pinP, 3)); scene.add(pole);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pinMat); ball.position.copy(V3(pinP, 6.6)); scene.add(ball);
  });
  return { tv, se };
}

/* ---------- Céu, luz e sol ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color(0x9a8f7c) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 1 } },
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
  fragmentShader: "uniform vec3 top,hor,bot,sunCol,sunDir; uniform float glow; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0. ? mix(hor, top, pow(h, .55)) : mix(hor, bot, clamp(-h*6.,0.,1.)); float s=max(dot(vP,sunDir),0.); c += sunCol*(pow(s,600.)*3.+pow(s,24.)*.35+pow(s,4.)*.12)*glow; gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}"
}));
scene.add(sky);
const stars = (() => { const g = new THREE.BufferGeometry(), p = []; for (let i = 0; i < 1400; i++) { const a = Math.random() * Math.PI * 2, y = Math.random() * .95 + .05, r = Math.sqrt(1 - y * y); p.push(Math.cos(a) * r * 1500, y * 1500, Math.sin(a) * r * 1500); } g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(s); return s; })();
const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, fog: false })); moon.position.set(-600, 900, -700); scene.add(moon);

const hemi = new THREE.HemisphereLight(0xbcd6ef, 0xb49a7a, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 520 });
sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const moonLight = new THREE.DirectionalLight(0x8fa8ff, 0); moonLight.position.set(-300, 400, -300); scene.add(moonLight);

const today = (() => { const d = new Date(Date.now() + CFG.tz * 3600e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
function sunAt(hour) {
  const D = Math.PI / 180, ms = today + (hour - CFG.tz) * 3600e3, d = ms / 864e5 + 2440587.5 - 2451545;
  const g = (357.529 + .98560028 * d) * D, q = 280.459 + .98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * D, e = (23.439 - 3.6e-7 * d) * D;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = (gmst * 15 + CFG.lon) * D - ra, lat = CFG.lat * D;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  return { el: el / D, az: (az / D + 360) % 360 };
}
const fmtH = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh + (mm === 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`; };
const SUNRISE = (() => { for (let h = 4; h < 12; h += 1 / 60) if (sunAt(h).el > -.833) return h; return 6; })();
const SUNSET = (() => { for (let h = 20; h > 12; h -= 1 / 60) if (sunAt(h).el > -.833) return h; return 18; })();

const C = (h) => new THREE.Color(h);
const SKY = { dayTop: C(0x4a8fdc), dayHor: C(0xd3e7f5), twTop: C(0x3b4f8f), twHor: C(0xf4a261), nTop: C(0x060c1d), nHor: C(0x16213f) };
let nightK = 0;
function setTime(h) {
  const { el, az } = sunAt(h), D = Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az * D) * Math.cos(el * D), Math.sin(el * D), -Math.cos(az * D) * Math.cos(el * D));
  const n = smooth(3, -8, el); nightK = n;
  const tw = clamp(1 - Math.abs(el - 2) / 12, 0, 1) * (1 - n * .6);
  sun.position.copy(dir).multiplyScalar(260); sun.target.position.set(0, 0, 0);
  const dayK = smooth(-1, 10, el);
  sun.intensity = 2.8 * dayK;
  sun.color.copy(C(0xff9a4d)).lerp(C(0xfff4e2), smooth(2, 28, el));
  hemi.intensity = lerp(1.15, .32, n) * lerp(1, .8, tw);
  hemi.color.copy(C(0xbcd6ef)).lerp(C(0x2a3a66), n);
  hemi.groundColor.copy(C(0xb49a7a)).lerp(C(0x1a1a24), n);
  moonLight.intensity = .45 * n;
  const top = SKY.dayTop.clone().lerp(SKY.twTop, tw).lerp(SKY.nTop, n), hor = SKY.dayHor.clone().lerp(SKY.twHor, tw).lerp(SKY.nHor, n);
  sky.material.uniforms.top.value.copy(top); sky.material.uniforms.hor.value.copy(hor);
  sky.material.uniforms.bot.value.copy(C(0x9a8f7c).lerp(C(0x0b1020), n));
  sky.material.uniforms.sunDir.value.copy(dir); sky.material.uniforms.sunCol.value.copy(C(0xffd2a0).lerp(C(0xfff8ec), smooth(5, 30, el)));
  sky.material.uniforms.glow.value = smooth(-6, 2, el);
  scene.fog.color.copy(hor);
  stars.material.opacity = n * .95; moon.material.opacity = n;
  M.winOnVar.forEach(m => m.emissiveIntensity = .55 + 1.25 * n);
  (M.nightText || []).forEach(m => m.emissiveIntensity = .35 * n);
  (M.signs || []).forEach(m => m.emissiveIntensity = .05 + .75 * n);
  M.houseWinLit && (M.houseWinLit.emissiveIntensity = 1.6 * n);
  M.led.emissiveIntensity = .1 + 2.6 * n;
  M.shop.emissiveIntensity = .35 + 1.3 * n;
  M.houseWin.emissiveIntensity = 1.8 * n;
  M.lampHead.emissiveIntensity = 3 * n;
  if (M.pharmSign) M.pharmSign.emissiveIntensity = .15 + .9 * n;
  (M.logos || []).forEach(m => m.emissiveIntensity = .9 * n);
  UNITS.forEach(u => u.glows.forEach(g => g.material.opacity = .85 * n));
  (M.lampGlows || []).forEach(g => g.material.opacity = .9 * n);
  renderer.toneMappingExposure = lerp(1, 1.12, n);
  // UI
  $("#tTxt").textContent = fmtH(h);
  $("#tIcon").innerHTML = el > -2 ? '<circle cx="12" cy="12" r="5" fill="#ffd27a"/><g stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></g>' : '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="#cdd6f4"/>';
}

/* ---------- Interação ---------- */
const state = { etapa: 0, tipo: "", hi: false, sel: null, intro: true };
const matches = u => (!state.etapa || u.etapa === state.etapa) && (!state.tipo || u.u[0] === state.tipo);
function refreshUnits() {
  UNITS.forEach(u => {
    const ok = matches(u), sel = state.sel === u;
    u.windows.forEach(w => {
      w.mesh.material = sel ? M.winSel : !ok ? M.winDim : u.vendida ? u.litMat : M.winOff;
      w.outline.visible = ok && (sel || (state.hi && !u.vendida));
    });
    u.glows.forEach(g => g.visible = ok);
    u.hits.forEach(h => h.userData.enabled = ok);
  });
  renderMirror();
}
let selLabel = null;
function select(u, fly = true) {
  state.sel = u;
  if (selLabel) { scene.remove(selLabel); selLabel = null; }
  if (!u) { $("#card").hidden = true; document.body.classList.remove("card-open"); applyViewOffset(); refreshUnits(); return; }
  selLabel = label(u.u, "lbl-sel", u.primary.pos.clone().add(new THREE.Vector3(0, .9, 0)));
  refreshUnits(); showCard(u);
  if (fly) {
    // câmera elevada: enxerga por cima do bloco vizinho quando a janela dá para um pátio
    const w = u.primary, k = isMobile ? 1.25 : 1;
    const camPos = w.pos.clone().add(w.normal.clone().multiplyScalar(30 * k)).add(new THREE.Vector3(0, 21 * k, 0)).add(new THREE.Vector3(w.normal.z, 0, -w.normal.x).multiplyScalar(7));
    const target = w.pos.clone().add(new THREE.Vector3(0, -1, 0));
    $("#hint").classList.add("off");
    flyTo(camPos, target);
  }
  try { history.replaceState(null, "", `?unidade=${u.u}`); } catch (e) {}
}
// no celular, a ficha cobre a parte de baixo: desloca a imagem para a unidade ficar visível acima dela
function applyViewOffset() {
  const card = $("#card");
  if (matchMedia("(max-width: 900px)").matches && !card.hidden) {
    const free = innerHeight - card.offsetHeight - 10, targetY = 64 + (free - 64) * .55;
    const d = clamp(innerHeight / 2 - targetY, 0, innerHeight * .4);
    camera.setViewOffset(innerWidth, innerHeight, 0, d, innerWidth, innerHeight);
  } else camera.clearViewOffset();
}
const order = () => UNITS.filter(u => u.box).sort((a, b) => a.bloco.localeCompare(b.bloco) || a.andar - b.andar || a.s - b.s);
function step(dir) {
  const list = order().filter(u => !u.vendida && matches(u)); if (!list.length) return;
  const cur = state.sel; let i = cur ? list.findIndex(u => u === cur) : -1;
  if (i < 0 && cur) { const all = order(); const ci = all.indexOf(cur); i = dir > 0 ? list.findIndex(u => all.indexOf(u) > ci) - 1 : list.findIndex(u => all.indexOf(u) >= ci); if (i < -1) i = -1; }
  const next = list[(i + dir + list.length) % list.length]; select(next);
}
const waIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
function showCard(u) {
  const est = u.u[0] === "E", tipo = est ? "Estúdio" : "Apartamento 2 quartos";
  const sub = `Bloco ${u.bloco} · ${u.andar}º andar · ${u.etapa}ª etapa`;
  const waTxt = u.vendida
    ? `Olá, Anderson! Vi a maquete 3D do Morar Bem 1 e quero conhecer as unidades disponíveis parecidas com a ${u.u}.`
    : `Olá, Anderson! Vi a maquete 3D do Morar Bem 1 e tenho interesse no ${tipo.toLowerCase()} ${u.u} (Bloco ${u.bloco}, ${u.andar}º andar, ${m2(u.m2)}). Pode me passar mais informações?`;
  const wa = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(waTxt)}`;
  $("#card").innerHTML = `
    <button class="x" aria-label="Fechar">×</button>
    <span class="ctype ${est ? "est" : "apt"}">${est ? "ESTÚDIO" : "APARTAMENTO · 2 QUARTOS"}</span>
    <div class="chead"><b>${u.u}</b><span class="cst ${u.vendida ? "so" : "av"}">${u.vendida ? "Vendida" : "Disponível"}</span></div>
    <div class="csub">${sub}</div>
    ${u.vendida ? `<p class="cnote" style="margin-top:14px">Esta unidade já foi vendida (a luz acesa indica um novo morador). Veja abaixo as opções ainda disponíveis.</p>` : `
    <dl class="cgrid">
      <div><dt>Área privativa</dt><dd>${m2(u.m2)}</dd></div>
      <div><dt>${est ? "Garagem" : "Com garagem"}</dt><dd>${est ? "Vaga avulsa<small>opcional, 13,5 m²</small>" : m2(u.m2Garagem || 0) + "<small>vaga inclusa</small>"}</dd></div>
      <div><dt>Entrega</dt><dd>${u.entrega}<small>${u.etapa}ª etapa</small></dd></div>
      <div><dt>Posição solar</dt><dd>${u.sol.split(" · ")[0]}<small>${u.sol.split(" · ")[1] || "luz natural"}</small></dd></div>
      <div class="price"><dt>Valor de tabela</dt><dd>${brl(u.preco)}</dd></div>
    </dl>
    <p class="cnote">Tabela de novembro/2026. Desconto progressivo de até 5% na entrada e financiamento pelo Minha Casa Minha Vida (Caixa).</p>`}
    <a class="cbtn wa" href="${wa}" target="_blank" rel="noopener">${waIcon}${u.vendida ? "Falar com o Anderson" : `Tenho interesse no ${u.u}`}</a>
    ${u.vendida ? "" : `<a class="cbtn gh" href="../?unidade=${u.u}#simular">Simular esta unidade</a>`}
    <div class="cnav"><button data-step="-1">‹ Disponível anterior</button><button data-step="1">Próxima disponível ›</button></div>`;
  $("#card").hidden = false; document.body.classList.add("card-open");
  requestAnimationFrame(applyViewOffset);
  $("#card .x").onclick = () => select(null);
  $("#card").querySelectorAll("[data-step]").forEach(b => b.onclick = () => step(+b.dataset.step));
}

/* espelho */
let mBlock = "A";
function renderMirror() {
  const blocks = "ABCDEFGH".split("");
  $("#btabs").innerHTML = blocks.map(b => `<button class="${b === mBlock ? "on" : ""}" data-b="${b}">${b}</button>`).join("");
  const us = UNITS.filter(u => u.bloco === mBlock && u.box);
  let html = "";
  for (let f = 3; f >= 1; f--) {
    const row = us.filter(u => u.andar === f).sort((a, b) => a.s - b.s);
    html += `<div class="frow"><b>${f}º</b><div class="chips">${row.map(u => `<button class="chip ${u.vendida ? "sold" : ""} ${matches(u) ? "" : "dim"} ${state.sel === u ? "sel" : ""}" data-u="${u.u}" title="${u.u}">${u.u}</button>`).join("")}</div></div>`;
  }
  $("#mgrid").innerHTML = html;
  const e = "ABCD".includes(mBlock) ? "1ª etapa · entrega março/2028" : "2ª etapa · entrega março/2029";
  const livres = us.filter(u => !u.vendida).length;
  $("#mnote").textContent = `Bloco ${mBlock} · ${e} · ${livres} de ${us.length} disponíveis`;
}
$("#btabs").addEventListener("click", e => { const b = e.target.closest("[data-b]"); if (!b) return; mBlock = b.dataset.b; renderMirror(); flyToBlock(mBlock); });
$("#mgrid").addEventListener("click", e => { const c = e.target.closest("[data-u]"); if (!c) return; const u = UNITS.find(x => x.u === c.dataset.u); if (u && matches(u)) select(u); });
$("#mToggle").addEventListener("click", () => { if (isMobile) $("#side").classList.toggle("open"); else $("#mirror").classList.toggle("closed"); });

/* câmera */
let tween = null;
function flyTo(pos, target, dur = 1300) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), dur }; controls.autoRotate = false; }
controls.addEventListener("start", () => { tween = null; controls.autoRotate = false; $("#hint").classList.add("off"); });
const VIEWS = {};
function setupViews() {
  const corner = W(1460, 1880), front = W(1150, 1760), lat = W(1360, 1150), back = W(1000, 120), court = W(1095, 1350);
  VIEWS.frente = { t: V3(front, 6), p: V3(corner.clone().add(new THREE.Vector2(-62, 34)), 22) };
  VIEWS.lateral = { t: V3(lat, 6), p: V3(lat.clone().add(new THREE.Vector2(14, 88)), 26) };
  VIEWS.fundos = { t: V3(back, 6), p: V3(back.clone().add(new THREE.Vector2(78, -22)), 26) };
  VIEWS.patio = { t: V3(W(1130, 1460), 3), p: V3(W(945, 1125), 23) };
  VIEWS.aerea = { t: new THREE.Vector3(0, 0, 0), p: new THREE.Vector3(-8, 175, 62) };
}
function flyToBlock(letter) {
  const us = UNITS.filter(u => u.bloco === letter && u.box && u.primary); if (!us.length) return;
  const c = us.reduce((a, u) => a.add(u.primary.pos), new THREE.Vector3()).multiplyScalar(1 / us.length);
  const n = us.reduce((a, u) => a.add(u.primary.normal), new THREE.Vector3()).normalize();
  flyTo(c.clone().add(n.multiplyScalar(isMobile ? 70 : 55)).add(new THREE.Vector3(0, 24, 0)), c.clone().setY(5));
}
$("#views").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; $("#views").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); const v = VIEWS[b.dataset.v]; flyTo(v.p, v.t); });
$("#fEtapa").addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (!b) return; state.etapa = +b.dataset.e; $("#fEtapa").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); if (state.sel && !matches(state.sel)) select(null, false); refreshUnits(); });
$("#fTipo").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; state.tipo = b.dataset.t; $("#fTipo").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); if (state.sel && !matches(state.sel)) select(null, false); refreshUnits(); });
$("#tHi").addEventListener("click", () => { state.hi = !state.hi; $("#tHi").classList.toggle("on", state.hi); refreshUnits(); });

/* clique / toque */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function pick(cx, cy) {
  ptr.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([...hitPanels.filter(h => h.userData.enabled !== false), ...occluders], false);
  const h = hits[0]; return h && h.object.userData.unit ? h.object.userData.unit : null;
}
let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > 7 || dt > 600 || state.intro) return;
  const u = pick(e.clientX, e.clientY); if (u) select(u); else if (state.sel && !isMobile) select(null);
});
let lastMove = 0;
renderer.domElement.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || state.intro) return; const now = performance.now(); if (now - lastMove < 60) return; lastMove = now;
  const u = pick(e.clientX, e.clientY), tip = $("#tip");
  renderer.domElement.style.cursor = u ? "pointer" : "";
  if (u) { tip.style.display = "block"; tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; tip.innerHTML = `${u.u} <span>· ${u.vendida ? "vendida" : "disponível"}</span>`; } else tip.style.display = "none";
});

/* horário */
const range = $("#tRange");
let playing = false;
const setPlay = on => { playing = on; $("#tPlay").innerHTML = on ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; };
range.addEventListener("input", () => { setPlay(false); introT = null; setTime(+range.value); });
$("#tPlay").addEventListener("click", () => { introT = null; if (!playing && +range.value >= 20.9) range.value = 5; setPlay(!playing); });

/* ---------- Monta tudo ---------- */
function build() {
  buildSurroundings();
  buildSite();
  BOXES.forEach(buildBox);
  BOXES.forEach(buildUnitWindows);
  buildStairs();
  // letras dos blocos sobre o telhado
  // letra de cada bloco pintada no telhado
  const ROOF_OF = { A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G1", H: "H" };
  Object.entries(ROOF_OF).forEach(([b, id]) => {
    const F = BOXES.find(x => x.id === id).F;
    flatText(`BLOCO ${b}`, F.bil(.5, .3), F.u, Math.min(2.4, F.D * .22), yTopo + .58, { bg: "rgba(201,164,106,.95)", fg: "#1a1408", pad: 22 });
  });
  setupViews();
  const sold = UNITS.filter(u => u.vendida).length, pct = sold / UNITS.length * 100;
  $("#pct").innerHTML = `${pct.toFixed(1).replace(".", ",")}%<small>VENDIDO · ${sold} DE ${UNITS.length}</small>`;
  setTimeout(() => $("#pbar").style.width = pct + "%", 400);
  $("#tRise").textContent = "Nascer " + fmtH(SUNRISE); $("#tSet").textContent = "Pôr do sol " + fmtH(SUNSET);
  refreshUnits();
}
// espera a fonte carregar (até 1,5 s) para os letreiros saírem com a tipografia certa
await Promise.race([document.fonts.load("800 40px Manrope"), new Promise(r => setTimeout(r, 1500))]).catch(() => {});
build();

/* abertura */
const params = new URLSearchParams(location.search);
const deep = params.get("unidade") && UNITS.find(u => u.u === params.get("unidade").toUpperCase());
let introT = { start: performance.now(), dur: 5200, h0: SUNSET - .9, h1: SUNSET + .75 };
setTime(introT.h0); range.value = introT.h0;
flyTo(VIEWS.frente.p.clone().add(new THREE.Vector3(-30, 25, 40)), VIEWS.frente.t, 4800);
$("#loading").textContent = "";
$("#go").disabled = false;
function closeIntro() {
  state.intro = false; $("#intro").classList.add("gone"); document.body.classList.remove("intro-on");
  if (introT) { const h = introT.h1; introT = null; setTime(h); range.value = h; }
  if (deep) { mBlock = deep.bloco; select(deep); }
  else { flyTo(VIEWS.frente.p, VIEWS.frente.t, 1600); setTimeout(() => $("#hint").classList.add("off"), 9000); }
}
$("#go").addEventListener("click", closeIntro);
if (deep) { introT.dur = 0; closeIntro(); }

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
let labelsNear = false;
function loop() {
  const dt = Math.min(clock.getDelta(), .05), now = performance.now();
  if (tween) {
    const k = clamp((now - tween.start) / tween.dur, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) tween = null;
  }
  if (introT && introT.dur) { const k = clamp((now - introT.start) / introT.dur, 0, 1); const h = lerp(introT.h0, introT.h1, k * k * (3 - 2 * k)); setTime(h); range.value = h; if (k >= 1) introT = null; }
  if (playing) { let h = +range.value + dt * .9; if (h >= 21) { h = 21; setPlay(false); } range.value = h; setTime(h); }
  const near = camera.position.distanceTo(controls.target) < 62;
  if (near !== labelsNear) { labelsNear = near; $("#labels").classList.toggle("near", near); }
  if (state.hi) M.outline.opacity = .55 + .45 * Math.sin(now / 260);
  else M.outline.opacity = 1;
  controls.update();
  const az = controls.getAzimuthalAngle();
  $("#compass").style.transform = `rotate(${az * 180 / Math.PI}deg)`;
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight); applyViewOffset(); });
window.__maquete = { UNITS, BOXES, orphans, scene, camera, controls, setTime, select, VIEWS, flyTo };
