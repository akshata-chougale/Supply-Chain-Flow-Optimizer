// maxflow.js — Edmonds-Karp Max-Flow Algorithm (BFS-based Ford-Fulkerson)
// Time Complexity: O(V * E^2)
// Used in: logistics optimization, network routing, resource allocation

class MaxFlowSolver {

  /**
   * BFS to find the shortest augmenting path in the residual graph.
   * @returns {Int32Array|null} parent array, or null if sink is unreachable
   */
  _bfs(cap, flow, n, s, t) {
    const parent  = new Int32Array(n).fill(-1);
    const visited = new Uint8Array(n);
    const queue   = [s];
    visited[s] = 1;
    let head = 0;

    while (head < queue.length) {
      const u = queue[head++];
      for (let v = 0; v < n; v++) {
        // Residual capacity: cap[u][v] - flow[u][v] > 0 means edge is usable
        if (!visited[v] && cap[u][v] - flow[u][v] > 0) {
          visited[v] = 1;
          parent[v] = u;
          if (v === t) return parent; // Found sink — return immediately
          queue.push(v);
        }
      }
    }
    return null; // No augmenting path exists
  }

  /**
   * Run Edmonds-Karp and return all augmenting paths + final max-flow.
   *
   * @param {number[][]} cap   - n×n capacity matrix
   * @param {number}     n     - total number of nodes
   * @param {number}     s     - super-source index
   * @param {number}     t     - super-sink index
   * @returns {{ maxFlow: number, steps: Array<{path: number[], flow: number}>, flow: number[][] }}
   */
  solve(cap, n, s, t) {
    // Flow matrix (initialised to 0)
    const flow = Array.from({ length: n }, () => new Array(n).fill(0));
    const steps = [];
    let maxFlow = 0;
    let parent;

    while ((parent = this._bfs(cap, flow, n, s, t)) !== null) {

      // ── Trace path from t → s, find bottleneck (min residual cap) ──
      const path = [];
      let bottleneck = Infinity;
      let v = t;
      while (v !== s) {
        const u = parent[v];
        bottleneck = Math.min(bottleneck, cap[u][v] - flow[u][v]);
        path.unshift(v);
        v = u;
      }
      path.unshift(s);

      // ── Update residual graph (forward + backward edges) ──
      v = t;
      while (v !== s) {
        const u = parent[v];
        flow[u][v] += bottleneck;
        flow[v][u] -= bottleneck; // Residual (backward edge)
        v = u;
      }

      maxFlow += bottleneck;
      steps.push({ path: [...path], flow: bottleneck });
    }

    return { maxFlow, steps, flow };
  }

  /**
   * Find the single most-saturated edge (the bottleneck of the final flow).
   * @param {Edge[]} edges
   * @returns {Edge|null}
   */
  findBottleneck(edges) {
    let worst = null;
    let minRemaining = Infinity;
    edges.forEach(edge => {
      if (edge.flow > 0 && edge.remaining < minRemaining) {
        minRemaining = edge.remaining;
        worst = edge;
      }
    });
    return worst;
  }
}
