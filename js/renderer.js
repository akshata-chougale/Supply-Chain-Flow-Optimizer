// renderer.js — Canvas-based rendering engine with particle system

class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.graph  = null;

    // Visual state
    this.selectedNodeId  = null;
    this.hoveredNodeId   = null;
    this.highlightedPath = null;   // Array of node IDs on current augmenting path
    this.highlightedPathFlow = 0;

    // Particle system
    this.particles   = [];
    this.isAnimating = false;

    // Edge preview (while drawing an edge)
    this._edgePreview = null; // { fromNode, mouseX, mouseY }

    // Colors (design tokens)
    this.C = {
      bg:        '#060810',
      grid:      'rgba(255,255,255,0.025)',
      factory:   '#ff6b35',
      warehouse: '#4d9de0',
      store:     '#3bb273',
      edgeEmpty: 'rgba(255,255,255,0.18)',
      flow:      '#00d4aa',
      saturated: '#ff4d6d',
      highlight: '#ffd700',
      particle:  '#00ff88',
      text:      '#ffffff',
      textDim:   'rgba(255,255,255,0.45)',
    };

    this._lastTime = performance.now();
    this._rafId    = requestAnimationFrame(this._loop.bind(this));
  }

  // ─── Render Loop ──────────────────────────────────────────────────────────

  _loop(ts) {
    const dt = Math.min(ts - this._lastTime, 80); // cap dt at 80 ms
    this._lastTime = ts;
    if (this.isAnimating) this._updateParticles(dt);
    this._render();
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  _updateParticles(dt) {
    this.particles.forEach(p => {
      p.t += p.speed * (dt / 1000);
      if (p.t >= 1) p.t -= 1;
    });
  }

  _render() {
    const { ctx, canvas, C } = this;
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle dot grid
    this._drawGrid(W, H);

    if (!this.graph) return;

    // Edges (behind nodes)
    this.graph.edges.forEach(e => this._drawEdge(e));

    // Particles (on top of edges)
    if (this.isAnimating) {
      this.particles.forEach(p => this._drawParticle(p));
    }

    // Edge preview while connecting
    if (this._edgePreview) this._drawEdgePreview();

    // Nodes (topmost)
    this.graph.nodes.forEach(n => this._drawNode(n));
  }

  _drawGrid(W, H) {
    const ctx  = this.ctx;
    const size = 44;
    ctx.strokeStyle = this.C.grid;
    ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // ─── Node Drawing ─────────────────────────────────────────────────────────

  _drawNode(node) {
    const { ctx, C } = this;
    const { x, y, type, label, radius: r } = node;
    const color     = C[type] || '#888';
    const isSelected = this.selectedNodeId === node.id;
    const isHovered  = this.hoveredNodeId  === node.id;
    const isOnPath   = this.highlightedPath && this.highlightedPath.includes(node.id);

    ctx.save();

    // Glow
    const glow = isOnPath ? 28 : isSelected ? 22 : isHovered ? 16 : 10;
    ctx.shadowColor = isOnPath ? C.highlight : color;
    ctx.shadowBlur  = glow;

    // Outer halo
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = `${color}1a`;
    ctx.fill();

    // Main circle — radial gradient for 3-D feel
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
    grad.addColorStop(0, this._lighten(color, 45));
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border ring
    ctx.strokeStyle = isOnPath ? C.highlight : isSelected ? '#fff' : `${color}99`;
    ctx.lineWidth   = isOnPath || isSelected ? 2.5 : 1.5;
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // Type icon
    const icons = { factory: '🏭', warehouse: '📦', store: '🏪' };
    ctx.font         = '14px Segoe UI Emoji, Apple Color Emoji, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[type] || '●', x, y - 7);

    // Node label (auto-sized for long city names)
    const fsize = label.length > 6 ? 8 : 10;
    ctx.font      = `bold ${fsize}px Outfit, sans-serif`;
    ctx.fillStyle = C.text;
    ctx.fillText(label, x, y + 10);

    // Type caption below circle
    ctx.font      = '9px Outfit, sans-serif';
    ctx.fillStyle = C.textDim;
    const caption = { factory: 'Factory', warehouse: 'Warehouse', store: 'Store' }[type] || type;
    ctx.fillText(caption, x, y + r + 14);

    ctx.restore();
  }

  // ─── Edge Drawing ─────────────────────────────────────────────────────────

  _drawEdge(edge) {
    const { ctx, graph, C } = this;
    const from = graph.getNode(edge.fromId);
    const to   = graph.getNode(edge.toId);
    if (!from || !to) return;

    const r  = from.radius;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const ux = dx / len, uy = dy / len; // unit vector along edge

    // Start slightly outside source node, end slightly inside target
    const sx = from.x + ux * (r + 6),  sy = from.y + uy * (r + 6);
    const ex = to.x   - ux * (r + 14), ey = to.y   - uy * (r + 14);

    const isOnPath = this._isOnHighlightedPath(edge);

    // ── Colour by state ──
    let color;
    if      (isOnPath)              color = C.highlight;
    else if (edge.saturation >= 1)  color = C.saturated;
    else if (edge.flow > 0)         color = this._lerpColor(C.warehouse, C.flow, edge.saturation);
    else                            color = C.edgeEmpty;

    // ── Line width proportional to capacity ──
    const maxCap = Math.max(1, ...graph.edges.map(e => e.capacity));
    const lw = 1.5 + (edge.capacity / maxCap) * 4;

    ctx.save();
    if (isOnPath) { ctx.shadowColor = C.highlight; ctx.shadowBlur = 14; }

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = color;
    ctx.lineWidth   = isOnPath ? lw + 2 : lw;
    ctx.stroke();

    // Arrowhead
    const angle  = Math.atan2(ey - sy, ex - sx);
    const aSize  = 10;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - aSize * Math.cos(angle - 0.42), ey - aSize * Math.sin(angle - 0.42));
    ctx.lineTo(ex - aSize * Math.cos(angle + 0.42), ey - aSize * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Labels (flow/capacity + cost) offset perpendicular to edge ──
    const perp = 16; // pixels offset from the edge line
    const mx = (sx + ex) / 2 - uy * perp;
    const my = (sy + ey) / 2 + ux * perp;

    const flowLabel = `${edge.flow}/${edge.capacity}`;
    ctx.font         = 'bold 10px Outfit, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    const lbw = ctx.measureText(flowLabel).width + 10;
    ctx.fillStyle = 'rgba(6,8,16,0.88)';
    ctx.fillRect(mx - lbw / 2, my - 8, lbw, 16);

    ctx.fillStyle = isOnPath ? C.highlight : (edge.flow > 0 ? C.flow : C.textDim);
    ctx.fillText(flowLabel, mx, my);

    if (edge.cost > 0) {
      ctx.font      = '8px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`$${edge.cost}/u`, mx, my - 16);
    }
  }

  // ─── Particle Drawing ─────────────────────────────────────────────────────

  _drawParticle(p) {
    const { ctx, graph, C } = this;
    const edge = graph.getEdge(p.edgeId);
    if (!edge || edge.flow <= 0) return;
    const from = graph.getNode(edge.fromId);
    const to   = graph.getNode(edge.toId);
    if (!from || !to) return;

    const r  = from.radius;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;

    const sx = from.x + ux * (r + 6),  sy = from.y + uy * (r + 6);
    const ex = to.x   - ux * (r + 14), ey = to.y   - uy * (r + 14);

    const px = sx + (ex - sx) * p.t;
    const py = sy + (ey - sy) * p.t;

    ctx.save();
    ctx.shadowColor = C.particle;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = C.particle;
    ctx.fill();
    ctx.restore();
  }

  // ─── Edge Preview ─────────────────────────────────────────────────────────

  _drawEdgePreview() {
    const { ctx, C, _edgePreview: ep } = this;
    if (!ep) return;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(ep.fromNode.x, ep.fromNode.y);
    ctx.lineTo(ep.mouseX, ep.mouseY);
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _isOnHighlightedPath(edge) {
    if (!this.highlightedPath || this.highlightedPath.length < 2) return false;
    for (let i = 0; i < this.highlightedPath.length - 1; i++) {
      if (this.highlightedPath[i] === edge.fromId &&
          this.highlightedPath[i + 1] === edge.toId) return true;
    }
    return false;
  }

  _lighten(hex, amt) {
    const clamp = v => Math.min(255, Math.max(0, v));
    const r = clamp(parseInt(hex.slice(1,3), 16) + amt).toString(16).padStart(2,'0');
    const g = clamp(parseInt(hex.slice(3,5), 16) + amt).toString(16).padStart(2,'0');
    const b = clamp(parseInt(hex.slice(5,7), 16) + amt).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
  }

  _lerpColor(h1, h2, t) {
    const lerp = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2,'0');
    const r1=parseInt(h1.slice(1,3),16), r2=parseInt(h2.slice(1,3),16);
    const g1=parseInt(h1.slice(3,5),16), g2=parseInt(h2.slice(3,5),16);
    const b1=parseInt(h1.slice(5,7),16), b2=parseInt(h2.slice(5,7),16);
    return `#${lerp(r1,r2)}${lerp(g1,g2)}${lerp(b1,b2)}`;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  setGraph(g) { this.graph = g; }

  setHighlightedPath(nodeIds, flow) {
    this.highlightedPath     = nodeIds;
    this.highlightedPathFlow = flow;
  }

  clearHighlight() {
    this.highlightedPath     = null;
    this.highlightedPathFlow = 0;
  }

  setEdgePreview(fromNode, mouseX, mouseY) {
    this._edgePreview = fromNode ? { fromNode, mouseX, mouseY } : null;
  }

  spawnParticles() {
    this.particles = [];
    if (!this.graph) return;
    this.graph.edges.forEach(edge => {
      if (edge.flow <= 0) return;
      const count = Math.max(1, Math.round(edge.saturation * 5));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          edgeId: edge.id,
          t:      i / count,
          speed:  0.2 + edge.saturation * 0.35,
        });
      }
    });
    this.isAnimating = true;
  }

  stopParticles() {
    this.particles   = [];
    this.isAnimating = false;
  }

  /** Hit-test: return node at (x, y), or null */
  getNodeAt(x, y) {
    if (!this.graph) return null;
    return this.graph.nodes.find(n => {
      const dx = n.x - x, dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    }) || null;
  }

  /** Hit-test: return edge near (x, y), or null */
  getEdgeAt(x, y) {
    if (!this.graph) return null;
    const THRESH = 10;
    return this.graph.edges.find(edge => {
      const from = this.graph.getNode(edge.fromId);
      const to   = this.graph.getNode(edge.toId);
      if (!from || !to) return false;
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return false;
      const t = ((x - from.x) * dx + (y - from.y) * dy) / (len * len);
      if (t < 0.05 || t > 0.95) return false;
      const px = from.x + t * dx, py = from.y + t * dy;
      return Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= THRESH;
    }) || null;
  }
}
