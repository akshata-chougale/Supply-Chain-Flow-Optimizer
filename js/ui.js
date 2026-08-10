// ui.js — User Interface Controller
// Handles toolbar, canvas mouse events, modal, presets, and stats updates

class UIController {
  constructor(app) {
    this.app = app;
    this.activeTool      = null;
    this.edgeSourceNodeId = null;
    this._pendingTarget   = null;

    this._initToolButtons();
    this._initAlgoButtons();
    this._initPresetButtons();
    this._initModal();
    this._initCanvasEvents();
  }

  // ─── Button Init ──────────────────────────────────────────────────────────

  _initToolButtons() {
    ['factory', 'warehouse', 'store', 'edge', 'delete'].forEach(tool => {
      document.getElementById(`tool-${tool}`)
        ?.addEventListener('click', () => this.setActiveTool(tool));
    });
  }

  _initAlgoButtons() {
    document.getElementById('btn-run')  ?.addEventListener('click', () => this.app.runAlgorithm());
    document.getElementById('btn-step') ?.addEventListener('click', () => this.app.nextStep());
    document.getElementById('btn-reset')?.addEventListener('click', () => this.app.resetFlow());
    document.getElementById('btn-clear')?.addEventListener('click', () => this.app.clearAll());
  }

  _initPresetButtons() {
    ['simple', 'india', 'amazon'].forEach(name => {
      document.getElementById(`preset-${name}`)
        ?.addEventListener('click', () => this.app.loadPreset(name));
    });
  }

  _initModal() {
    document.getElementById('modal-confirm')?.addEventListener('click', () => this._confirmEdge());
    document.getElementById('modal-cancel') ?.addEventListener('click', () => this._cancelModal());
    document.getElementById('modal-close')  ?.addEventListener('click', () => this._cancelModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', e => {
      if (e.target === document.getElementById('modal-backdrop')) this._cancelModal();
    });
    // Allow Enter to confirm
    document.getElementById('edge-cost')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._confirmEdge();
    });
  }

  // ─── Canvas Mouse Events ──────────────────────────────────────────────────

  _initCanvasEvents() {
    const canvas    = this.app.renderer.canvas;
    const renderer  = this.app.renderer;
    let mouseDown   = false;
    let startX = 0, startY = 0;
    let isDragging  = false;
    let draggingNode = null;

    canvas.addEventListener('mousemove', e => {
      const { x, y } = this._pos(e);

      // Hover state
      const hovered = renderer.getNodeAt(x, y);
      renderer.hoveredNodeId = hovered ? hovered.id : null;
      canvas.style.cursor    = hovered ? 'pointer' : (this.activeTool ? 'crosshair' : 'default');

      // Drag node
      if (mouseDown && draggingNode) {
        const dxMouse = x - startX, dyMouse = y - startY;
        if (!isDragging && Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse) > 6) {
          isDragging = true;
        }
        if (isDragging) {
          draggingNode.x = x;
          draggingNode.y = y;
        }
      }

      // Edge preview line
      if (this.activeTool === 'edge' && this.edgeSourceNodeId !== null) {
        const fromNode = this.app.graph.getNode(this.edgeSourceNodeId);
        renderer.setEdgePreview(fromNode, x, y);
      }
    });

    canvas.addEventListener('mousedown', e => {
      const { x, y } = this._pos(e);
      mouseDown = true;
      startX = x; startY = y;
      isDragging  = false;

      // Allow dragging nodes in any mode except pure delete
      const onNode = renderer.getNodeAt(x, y);
      draggingNode = (onNode && this.activeTool !== 'delete') ? onNode : null;
    });

    canvas.addEventListener('mouseup', e => {
      const { x, y } = this._pos(e);
      if (!isDragging) this._handleClick(x, y);
      mouseDown    = false;
      isDragging   = false;
      draggingNode = null;
    });

    canvas.addEventListener('mouseleave', () => {
      mouseDown = false; isDragging = false; draggingNode = null;
      renderer.hoveredNodeId = null;
      renderer.setEdgePreview(null);
    });
  }

  _pos(e) {
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ─── Click Dispatch ───────────────────────────────────────────────────────

  _handleClick(x, y) {
    const { graph, renderer } = this.app;
    const tool        = this.activeTool;
    const clickedNode = renderer.getNodeAt(x, y);
    const clickedEdge = !clickedNode ? renderer.getEdgeAt(x, y) : null;

    if (tool === 'factory' || tool === 'warehouse' || tool === 'store') {
      if (!clickedNode) {
        const node = graph.addNode(tool, x, y);
        this.app.log(`Added ${tool}: ${node.label}`, 'success');
        this.updateStats();
        this._showHintIfEmpty();
      }

    } else if (tool === 'edge') {
      if (!clickedNode) {
        // Click on empty canvas → cancel edge creation
        this.edgeSourceNodeId = null;
        renderer.selectedNodeId = null;
        renderer.setEdgePreview(null);
        return;
      }
      if (this.edgeSourceNodeId === null) {
        // First click: pick source
        this.edgeSourceNodeId   = clickedNode.id;
        renderer.selectedNodeId = clickedNode.id;
        this.app.log(`Source: ${clickedNode.label}. Now click the destination node.`, 'info');
      } else {
        if (clickedNode.id !== this.edgeSourceNodeId) {
          // Second click: open modal to set capacity/cost
          this._pendingTarget = clickedNode.id;
          const from = graph.getNode(this.edgeSourceNodeId);
          document.getElementById('modal-sub').textContent =
            `Route: ${from.label}  →  ${clickedNode.label}`;
          this._openModal();
        }
      }

    } else if (tool === 'delete') {
      if (clickedNode) {
        const lbl = clickedNode.label;
        graph.removeNode(clickedNode.id);
        renderer.selectedNodeId = null;
        this.app.log(`Removed node: ${lbl}`, 'warn');
        this.updateStats();
        this._showHintIfEmpty();
      } else if (clickedEdge) {
        const from = graph.getNode(clickedEdge.fromId);
        const to   = graph.getNode(clickedEdge.toId);
        graph.removeEdge(clickedEdge.id);
        this.app.log(`Removed route: ${from?.label} → ${to?.label}`, 'warn');
        this.updateStats();
      }
    }
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  _openModal() {
    document.getElementById('edge-capacity').value = '10';
    document.getElementById('edge-cost').value     = '1';
    document.getElementById('modal-backdrop').style.display = 'flex';
    setTimeout(() => document.getElementById('edge-capacity').focus(), 50);
  }

  _closeModal() {
    document.getElementById('modal-backdrop').style.display = 'none';
  }

  _confirmEdge() {
    const cap  = Math.max(1, parseInt(document.getElementById('edge-capacity').value) || 10);
    const cost = Math.max(0, parseInt(document.getElementById('edge-cost').value)     || 1);
    const { graph, renderer } = this.app;

    const edge = graph.addEdge(this.edgeSourceNodeId, this._pendingTarget, cap, cost);
    if (edge) {
      const from = graph.getNode(this.edgeSourceNodeId);
      const to   = graph.getNode(this._pendingTarget);
      this.app.log(`Route: ${from.label} → ${to.label} | Cap ${cap} | $${cost}/unit`, 'success');
    } else {
      this.app.log('Route already exists between those nodes.', 'warn');
    }

    this.edgeSourceNodeId   = null;
    this._pendingTarget     = null;
    renderer.selectedNodeId = null;
    renderer.setEdgePreview(null);
    this.updateStats();
    this._closeModal();
  }

  _cancelModal() {
    this.edgeSourceNodeId   = null;
    this._pendingTarget     = null;
    this.app.renderer.selectedNodeId = null;
    this.app.renderer.setEdgePreview(null);
    this._closeModal();
  }

  // ─── Tool State ───────────────────────────────────────────────────────────

  setActiveTool(tool) {
    this.activeTool = this.activeTool === tool ? null : tool; // toggle
    // Cancel any in-progress edge on tool change
    this.edgeSourceNodeId = null;
    this.app.renderer.selectedNodeId = null;
    this.app.renderer.setEdgePreview(null);

    document.querySelectorAll('.node-tool').forEach(btn => btn.classList.remove('tool-active'));
    if (this.activeTool) {
      document.getElementById(`tool-${this.activeTool}`)?.classList.add('tool-active');
    }
  }

  // ─── Stats & UI Updates ───────────────────────────────────────────────────

  updateStats() {
    const { graph } = this.app;
    document.getElementById('stat-nodes').textContent = graph.nodes.length;
    document.getElementById('stat-edges').textContent = graph.edges.length;
    this._showHintIfEmpty();
  }

  updateFlowStats(maxFlow, pathCount) {
    document.getElementById('stat-max-flow').textContent = maxFlow !== '—' ? `${maxFlow}` : '—';
    document.getElementById('stat-paths').textContent    = pathCount;
  }

  updateBottleneck(edge) {
    const box = document.getElementById('bottleneck-box');
    if (!box) return;
    if (!edge) {
      box.innerHTML = '<span class="no-data-text">Run algorithm to find bottleneck</span>';
      return;
    }
    const from = this.app.graph.getNode(edge.fromId);
    const to   = this.app.graph.getNode(edge.toId);
    const pct  = Math.round(edge.saturation * 100);
    box.innerHTML = `
      <div class="bottleneck-route">${from?.label} → ${to?.label}</div>
      <div class="bottleneck-detail">${edge.flow} / ${edge.capacity} units — ${pct}% full</div>
      <div class="sat-track"><div class="sat-fill" style="width:${pct}%"></div></div>
    `;
  }

  setStepEnabled(on) {
    const btn = document.getElementById('btn-step');
    if (btn) btn.disabled = !on;
  }

  setRunBusy(busy) {
    const btn = document.getElementById('btn-run');
    if (!btn) return;
    btn.disabled     = busy;
    btn.textContent  = busy ? '⏳ Running…' : '▶ Run Max-Flow';
  }

  _showHintIfEmpty() {
    const hint = document.getElementById('empty-hint');
    if (hint) hint.style.display = this.app.graph.nodes.length > 0 ? 'none' : 'flex';
  }
}
