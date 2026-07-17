import { db } from "./firebase-init.js";
import {
  ref, push, onChildAdded, remove, set, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { spawnHearts } from "./hearts.js";

// ---------- decorative hearts ----------
spawnHearts(document.getElementById("heartsLayer"), 14);

// ---------- canvas setup ----------
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
ctx.lineCap = "round";
ctx.lineJoin = "round";

// Full rainbow, plus the couple's signature orange/pink/purple shades,
// plus ink/white for outlines and highlights.
const PALETTE = [
  "#2B1B33", // ink
  "#FFFFFF", // white
  "#E63946", // red
  "#FF8C42", // orange
  "#FFC15E", // amber
  "#FFE066", // yellow
  "#8AC926", // green
  "#1FA2A6", // teal
  "#3A86FF", // blue
  "#5E60CE", // indigo
  "#7B3FA0", // purple
  "#B27BDB", // light purple
  "#E84A9C", // pink
  "#F792C4", // light pink
  "#C0356B", // deep rose
  "#FF5E7E"  // coral red
];

const colorSwatchesEl = document.getElementById("colorSwatches");
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const opacitySlider = document.getElementById("opacitySlider");
const eraserBtn = document.getElementById("eraserBtn");
const clearBtn = document.getElementById("clearBtn");
const statusDot = document.getElementById("statusDot");

let currentColor = "#E84A9C";
let currentSize = 6;
let currentOpacity = 1; // 0.1 - 1
let erasing = false;
let drawing = false;
let lastPoint = null;

// build swatches
PALETTE.forEach((color) => {
  const btn = document.createElement("button");
  btn.className = "swatch";
  btn.style.background = color;
  btn.addEventListener("click", () => {
    currentColor = color;
    erasing = false;
    eraserBtn.classList.remove("active");
    updateActiveSwatch(btn);
  });
  colorSwatchesEl.appendChild(btn);
  if (color === currentColor) updateActiveSwatch(btn);
});

function updateActiveSwatch(activeBtn) {
  [...colorSwatchesEl.children].forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

colorPicker.addEventListener("input", (e) => {
  currentColor = e.target.value;
  erasing = false;
  eraserBtn.classList.remove("active");
  [...colorSwatchesEl.children].forEach((b) => b.classList.remove("active"));
});

brushSize.addEventListener("input", (e) => {
  currentSize = Number(e.target.value);
});

opacitySlider.addEventListener("input", (e) => {
  currentOpacity = Number(e.target.value) / 100;
});

eraserBtn.addEventListener("click", () => {
  erasing = !erasing;
  eraserBtn.classList.toggle("active", erasing);
});

// ---------- coordinate helpers ----------
function getPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// ---------- drawing a segment locally ----------
function drawSegment(from, to, color, size, opacity = 1) {
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- Firebase refs ----------
const strokesRef = ref(db, "strokes");
const clearRef = ref(db, "clearSignal"); // holds a timestamp; both clients watch it

// ---------- pointer events ----------
function startDraw(e) {
  e.preventDefault();
  drawing = true;
  lastPoint = getPoint(e);
}

function moveDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  const point = getPoint(e);
  const color = erasing ? "#FFFFFF" : currentColor;
  const size = erasing ? currentSize * 3 : currentSize;
  const opacity = erasing ? 1 : currentOpacity;

  drawSegment(lastPoint, point, color, size, opacity);

  push(strokesRef, {
    x1: lastPoint.x, y1: lastPoint.y,
    x2: point.x, y2: point.y,
    color, size, opacity,
    t: Date.now()
  });

  lastPoint = point;
}

function endDraw() {
  drawing = false;
  lastPoint = null;
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", moveDraw);
window.addEventListener("mouseup", endDraw);

canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", moveDraw, { passive: false });
window.addEventListener("touchend", endDraw);

function blankCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Prime the canvas white FIRST, before any history can arrive, so we never
// accidentally wipe strokes that already drew in.
blankCanvas();

// ---------- clear-signal bookkeeping ----------
// We need to know the clear signal's timestamp BEFORE we finish replaying
// stroke history, so a clear that happened while a device was offline is
// respected (old strokes from before that clear don't get redrawn).
let lastSeenClearTime = 0;
let clearTimeKnown = false;
let pendingStrokes = [];

// ---------- receive every stroke ever drawn (full history) + live updates ----------
// onChildAdded fires once for EVERY existing node the moment a client
// connects (this is what makes the whole drawing history reappear after
// being offline or reloading), then keeps firing for each new stroke live.
// We hold strokes in a queue until we know the clear-signal's timestamp,
// so we never draw something that's actually older than the last "clear all".
onChildAdded(strokesRef, (snapshot) => {
  const s = snapshot.val();
  if (!s) return;

  if (!clearTimeKnown) {
    pendingStrokes.push(s);
    return;
  }
  if (s.t && s.t < lastSeenClearTime) return; // stroke predates the last clear

  drawSegment(
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
    s.color,
    s.size,
    s.opacity ?? 1
  );
});

// ---------- clear all (broadcasts to both clients, even ones offline right now) ----------
// Writing a timestamped signal to the database (instead of just deleting
// strokes locally) means: any device connected right now clears immediately,
// and any device that opens the site LATER also sees the clear, because it
// reads this signal before deciding which historical strokes to replay.
clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the whole board for both of you? This can't be undone.")) return;
  set(clearRef, { t: Date.now() });
});

onValue(clearRef, (snapshot) => {
  const val = snapshot.val();
  const t = (val && val.t) || 0;

  if (!clearTimeKnown) {
    // First time hearing the clear signal: use it to filter the stroke
    // history we've been holding, then flush whatever survives the filter.
    clearTimeKnown = true;
    lastSeenClearTime = t;
    blankCanvas();
    pendingStrokes
      .filter((s) => !s.t || s.t >= lastSeenClearTime)
      .forEach((s) =>
        drawSegment(
          { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 },
          s.color, s.size, s.opacity ?? 1
        )
      );
    pendingStrokes = [];
    statusDot.textContent = "● connected — go draw something 💌";
    statusDot.classList.add("connected");
    return;
  }

  if (t === lastSeenClearTime) return; // duplicate fire, ignore
  lastSeenClearTime = t;
  blankCanvas();
});

// ---------- photo placeholders: click to preview locally + fullscreen lightbox ----------
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add("open");
}
function closeLightbox() {
  lightbox.classList.remove("open");
  lightboxImg.src = "";
}
lightbox.addEventListener("click", closeLightbox);

[["photoLeft"], ["photoRight"]].forEach(([id]) => {
  const el = document.getElementById(id);

  el.addEventListener("click", () => {
    const existingImg = el.querySelector("img");
    if (existingImg) {
      // already has a photo -> open fullscreen instead of re-picking a file
      openLightbox(existingImg.src);
      return;
    }
    // no photo yet -> let them pick one to preview
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      el.innerHTML = `<img src="${url}" alt="photo">`;
    };
    input.click();
  });
});
