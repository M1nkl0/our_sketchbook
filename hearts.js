// Generates a handful of chunky, slightly-wobbly "MS Paint" style hearts
// that drift up the background. Pure decoration, no dependencies.

const HEART_COLORS = ["#FF8C42", "#E84A9C", "#7B3FA0", "#FFB067", "#F26AB0"];

// A heart path built from simple curves, then given tiny random jitter
// to its control points so every heart looks hand-drawn, not vector-perfect.
function wobblyHeartPath(jitter = 3) {
  const j = () => (Math.random() - 0.5) * jitter;
  return `M ${50 + j()} ${30 + j()}
    C ${35 + j()} ${5 + j()}, ${0 + j()} ${15 + j()}, ${5 + j()} ${45 + j()}
    C ${8 + j()} ${65 + j()}, ${30 + j()} ${80 + j()}, ${50 + j()} ${95 + j()}
    C ${70 + j()} ${80 + j()}, ${92 + j()} ${65 + j()}, ${95 + j()} ${45 + j()}
    C ${100 + j()} ${15 + j()}, ${65 + j()} ${5 + j()}, ${50 + j()} ${30 + j()} Z`;
}

export function spawnHearts(container, count = 14) {
  for (let i = 0; i < count; i++) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    const size = 18 + Math.random() * 26;
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.classList.add("paint-heart");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", wobblyHeartPath());
    const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
    path.setAttribute("fill", color);
    path.setAttribute("stroke", "#2B1B33");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);

    svg.style.left = `${Math.random() * 100}%`;
    const duration = 14 + Math.random() * 18;
    svg.style.animationDuration = `${duration}s`;
    svg.style.animationDelay = `-${Math.random() * duration}s`;

    container.appendChild(svg);
  }
}
