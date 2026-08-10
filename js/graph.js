// graph.js — Graph Data Structure
// Nodes: Factory (source), Warehouse (intermediate), Store (sink)
// Edges: directed routes with capacity and cost

class Node {
  constructor(id, type, x, y, label) {
    this.id = id;
    this.type = type; // 'factory' | 'warehouse' | 'store'
    this.x = x;
    this.y = y;
    this.label = label;
    this.radius = 32;
  }
}

class Edge {
  constructor(id, fromId, toId, capacity, cost) {
    this.id = id;
    this.fromId = fromId;
    this.toId = toId;
    this.capacity = capacity;
    this.cost = cost;
    this.flow = 0;
  }

  get saturation() {
    return this.capacity > 0 ? this.flow / this.capacity : 0;
  }

  get remaining() {
    return this.capacity - this.flow;
  }
}

class Graph {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this._nextNodeId = 0;
    this._nextEdgeId = 0;
    this._counts = { factory: 0, warehouse: 0, store: 0 };
  }

  addNode(type, x, y, labelOverride = null) {
    const id = this._nextNodeId++;
    this._counts[type] = (this._counts[type] || 0) + 1;
    const prefix = { factory: 'F', warehouse: 'W', store: 'S' }[type] || 'N';
    const label = labelOverride || `${prefix}${this._counts[type]}`;
    const node = new Node(id, type, x, y, label);
    this.nodes.push(node);
    return node;
  }

  removeNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.fromId !== id && e.toId !== id);
  }

  addEdge(fromId, toId, capacity, cost = 1) {
    if (fromId === toId) return null;
    if (this.edges.find(e => e.fromId === fromId && e.toId === toId)) return null;
    const id = this._nextEdgeId++;
    const edge = new Edge(id, fromId, toId, capacity, cost);
    this.edges.push(edge);
    return edge;
  }

  removeEdge(id) {
    this.edges = this.edges.filter(e => e.id !== id);
  }

  getNode(id) { return this.nodes.find(n => n.id === id) || null; }
  getEdge(id) { return this.edges.find(e => e.id === id) || null; }
  getSources() { return this.nodes.filter(n => n.type === 'factory'); }
  getSinks()   { return this.nodes.filter(n => n.type === 'store'); }

  resetFlow() {
    this.edges.forEach(e => { e.flow = 0; });
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this._nextNodeId = 0;
    this._nextEdgeId = 0;
    this._counts = { factory: 0, warehouse: 0, store: 0 };
  }

  /**
   * Build a flow network matrix for the max-flow solver.
   * Adds a virtual super-source connected to all factories,
   * and a virtual super-sink connected from all stores.
   */
  buildFlowNetwork() {
    const n = this.nodes.length;
    if (n === 0) return null;

    const idToIdx = {};
    this.nodes.forEach((node, i) => { idToIdx[node.id] = i; });
    const idxToId = this.nodes.map(nd => nd.id);

    const S = n;      // super source index
    const T = n + 1;  // super sink index
    const total = n + 2;
    const INF = 1e9;

    // Build n+2 x n+2 capacity matrix
    const cap = Array.from({ length: total }, () => new Array(total).fill(0));

    // Add user edges to the matrix
    this.edges.forEach(edge => {
      const u = idToIdx[edge.fromId];
      const v = idToIdx[edge.toId];
      cap[u][v] += edge.capacity;
    });

    // Super-source → all factories
    this.getSources().forEach(nd => { cap[S][idToIdx[nd.id]] = INF; });

    // All stores → super-sink
    this.getSinks().forEach(nd => { cap[idToIdx[nd.id]][T] = INF; });

    return { cap, total, S, T, idToIdx, idxToId };
  }

  /**
   * After solving, copy flow values from the matrix back to edges.
   */
  applyFlowMatrix(flow, idToIdx) {
    this.edges.forEach(edge => {
      const u = idToIdx[edge.fromId];
      const v = idToIdx[edge.toId];
      edge.flow = Math.max(0, flow[u][v]);
    });
  }
}
