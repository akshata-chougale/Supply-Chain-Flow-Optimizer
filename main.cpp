// ============================================================
// Supply Chain Network Optimizer
// Algorithm : Edmonds-Karp Max-Flow (BFS-based Ford-Fulkerson)
// Language  : C++17
// Author    : github.com/your-handle
// ============================================================
//
// Build:
//   g++ -std=c++17 -O2 -o supply_chain main.cpp
//
// Run:
//   ./supply_chain
//   supply_chain.exe      (Windows)
// ============================================================

#include <bits/stdc++.h>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#ifndef ENABLE_VIRTUAL_TERMINAL_PROCESSING
#define ENABLE_VIRTUAL_TERMINAL_PROCESSING 0x0004
#endif
#endif
using namespace std;

// ─────────────────────────────────────────────────────────────
// ANSI colour helpers (work on any modern terminal)
// ─────────────────────────────────────────────────────────────
namespace Col {
    const string RESET   = "\033[0m";
    const string BOLD    = "\033[1m";
    const string RED     = "\033[91m";
    const string GREEN   = "\033[92m";
    const string YELLOW  = "\033[93m";
    const string BLUE    = "\033[94m";
    const string MAGENTA = "\033[95m";
    const string CYAN    = "\033[96m";
    const string DIM     = "\033[2m";
}

// ─────────────────────────────────────────────────────────────
// Node types
// ─────────────────────────────────────────────────────────────
enum NodeType { FACTORY, WAREHOUSE, STORE };

string typeName(NodeType t) {
    if (t == FACTORY)   return "Factory";
    if (t == WAREHOUSE) return "Warehouse";
    return "Store";
}

string typeColor(NodeType t) {
    if (t == FACTORY)   return Col::YELLOW;
    if (t == WAREHOUSE) return Col::BLUE;
    return Col::GREEN;
}

string typeIcon(NodeType t) {
    if (t == FACTORY)   return "[F]";
    if (t == WAREHOUSE) return "[W]";
    return "[S]";
}

// ─────────────────────────────────────────────────────────────
// Graph structures
// ─────────────────────────────────────────────────────────────
struct Node {
    int      id;
    string   name;
    NodeType type;
};

struct Edge {
    int from, to;
    int capacity;
    int cost;
    int flow = 0;

    int remaining() const { return capacity - flow; }
    double saturation() const {
        return capacity > 0 ? (double)flow / capacity : 0.0;
    }
};

// ─────────────────────────────────────────────────────────────
// Edmonds-Karp Max-Flow Solver
// Uses adjacency matrix for residual capacities.
// Complexity: O(V * E^2)
// ─────────────────────────────────────────────────────────────
struct AugPath {
    vector<int> nodes;   // node indices along the path
    int         flow;    // flow pushed along this path
};

class MaxFlowSolver {
public:
    int              n;
    vector<vector<int>> cap;   // capacity matrix  (n x n)
    vector<vector<int>> flow;  // flow matrix      (n x n)

    MaxFlowSolver(int n) : n(n),
        cap(n, vector<int>(n, 0)),
        flow(n, vector<int>(n, 0)) {}

    void addCapacity(int u, int v, int c) { cap[u][v] += c; }

    // BFS: find shortest augmenting path s→t.
    // Returns parent[] array or {} if no path.
    vector<int> bfs(int s, int t) {
        vector<int> parent(n, -1);
        vector<bool> visited(n, false);
        queue<int> q;
        q.push(s); visited[s] = true;

        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (int v = 0; v < n; v++) {
                if (!visited[v] && cap[u][v] - flow[u][v] > 0) {
                    visited[v] = true;
                    parent[v]  = u;
                    if (v == t) return parent;
                    q.push(v);
                }
            }
        }
        return {}; // no path
    }

    // Run Edmonds-Karp. Returns max-flow and all augmenting paths.
    pair<int, vector<AugPath>> solve(int s, int t) {
        int maxFlow = 0;
        vector<AugPath> paths;

        vector<int> parent;
        while (!(parent = bfs(s, t)).empty()) {

            // Trace path t → s and find bottleneck
            int bottleneck = INT_MAX;
            vector<int> path;
            int v = t;
            while (v != s) {
                int u = parent[v];
                bottleneck = min(bottleneck, cap[u][v] - flow[u][v]);
                path.push_back(v);
                v = u;
            }
            path.push_back(s);
            reverse(path.begin(), path.end());

            // Update residual graph
            v = t;
            while (v != s) {
                int u = parent[v];
                flow[u][v] += bottleneck;
                flow[v][u] -= bottleneck;
                v = u;
            }

            maxFlow += bottleneck;
            paths.push_back({path, bottleneck});
        }
        return {maxFlow, paths};
    }
};

// ─────────────────────────────────────────────────────────────
// Supply Chain Graph
// ─────────────────────────────────────────────────────────────
class SupplyChainGraph {
public:
    vector<Node> nodes;
    vector<Edge> edges;

    // Add a node; returns its index
    int addNode(const string& name, NodeType type) {
        int id = nodes.size();
        nodes.push_back({id, name, type});
        return id;
    }

    // Add a directed edge; returns false if duplicate
    bool addEdge(int from, int to, int capacity, int cost = 1) {
        if (from == to) return false;
        for (auto& e : edges)
            if (e.from == from && e.to == to) return false;
        edges.push_back({from, to, capacity, cost});
        return true;
    }

    int nodeCount() const { return nodes.size(); }
    int edgeCount() const { return edges.size(); }

    vector<int> sources() const {
        vector<int> r;
        for (auto& n : nodes) if (n.type == FACTORY) r.push_back(n.id);
        return r;
    }
    vector<int> sinks() const {
        vector<int> r;
        for (auto& n : nodes) if (n.type == STORE) r.push_back(n.id);
        return r;
    }

    // ── Run Max-Flow ──────────────────────────────────────────
    // Adds virtual super-source S and super-sink T,
    // solves, then maps flow back to edges.
    struct Result {
        int              maxFlow;
        vector<AugPath>  paths;      // paths use real node indices
        string           bottleneck; // label of bottleneck edge
        bool             ok;
    };

    Result runMaxFlow() {
        if (sources().empty() || sinks().empty() || edges.empty())
            return {0, {}, "", false};

        int N       = nodes.size();
        int S       = N;       // virtual super-source
        int T       = N + 1;   // virtual super-sink
        int total   = N + 2;
        const int INF = 1e9;

        MaxFlowSolver solver(total);

        // Real edges
        for (auto& e : edges)
            solver.addCapacity(e.from, e.to, e.capacity);

        // Super-source → all factories (INF)
        for (int s : sources()) solver.addCapacity(S, s, INF);

        // All stores → super-sink (INF)
        for (int t : sinks())   solver.addCapacity(t, T, INF);

        pair<int, vector<AugPath>> solveResult = solver.solve(S, T);
        int maxFlow              = solveResult.first;
        vector<AugPath> allPaths = solveResult.second;

        // Strip virtual S and T from each path
        vector<AugPath> realPaths;
        for (auto& ap : allPaths) {
            vector<int> rp;
            for (int idx : ap.nodes)
                if (idx != S && idx != T) rp.push_back(idx);
            if (!rp.empty()) {
                AugPath ap2; ap2.nodes = rp; ap2.flow = ap.flow;
                realPaths.push_back(ap2);
            }
        }

        // Map flow matrix back to edges
        for (auto& e : edges)
            e.flow = max(0, solver.flow[e.from][e.to]);

        // Find bottleneck: highest saturation edge with flow > 0
        string bottleneck = "None";
        double worstSat   = -1;
        for (auto& e : edges) {
            if (e.flow > 0 && e.saturation() > worstSat) {
                worstSat    = e.saturation();
                bottleneck  = nodes[e.from].name + " → " + nodes[e.to].name
                            + " (" + to_string(e.flow) + "/" + to_string(e.capacity) + ")";
            }
        }

        return {maxFlow, realPaths, bottleneck, true};
    }
};

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────
void printBanner() {
    cout << "\n";
    cout << Col::CYAN << Col::BOLD;
    cout << "╔══════════════════════════════════════════════════════╗\n";
    cout << "║      Supply Chain Network Optimizer  v1.0           ║\n";
    cout << "║      Algorithm: Edmonds-Karp Max-Flow               ║\n";
    cout << "║      Complexity: O(V·E²)                            ║\n";
    cout << "╚══════════════════════════════════════════════════════╝\n";
    cout << Col::RESET << "\n";
}

void printHelp() {
    cout << Col::BOLD << "Commands:\n" << Col::RESET;
    cout << Col::DIM  << "─────────────────────────────────────────\n" << Col::RESET;
    cout << "  " << Col::YELLOW  << "add factory   <name>" << Col::RESET << "   — Add a production source\n";
    cout << "  " << Col::BLUE    << "add warehouse <name>" << Col::RESET << "   — Add a transfer hub\n";
    cout << "  " << Col::GREEN   << "add store     <name>" << Col::RESET << "   — Add a demand sink\n";
    cout << "  " << Col::CYAN    << "add edge <from> <to> <cap> [cost]" << Col::RESET << "\n";
    cout << "                               — Add a directed route\n";
    cout << "  " << Col::MAGENTA << "run" << Col::RESET << "                    — Run Max-Flow optimizer\n";
    cout << "  " << Col::MAGENTA << "show" << Col::RESET << "                   — Show current network\n";
    cout << "  " << Col::MAGENTA << "load simple|india|amazon" << Col::RESET << " — Load a preset network\n";
    cout << "  " << Col::MAGENTA << "clear" << Col::RESET << "                  — Clear all\n";
    cout << "  " << Col::MAGENTA << "help" << Col::RESET << "                   — Show this menu\n";
    cout << "  " << Col::RED     << "exit" << Col::RESET << "                   — Quit\n";
    cout << Col::DIM << "─────────────────────────────────────────\n" << Col::RESET;
}

void printNetwork(const SupplyChainGraph& g) {
    cout << "\n" << Col::BOLD << "── Network (" << g.nodeCount() << " nodes, " << g.edgeCount() << " routes) ──\n" << Col::RESET;

    // Nodes
    cout << Col::BOLD << "Nodes:\n" << Col::RESET;
    for (auto& n : g.nodes) {
        cout << "  " << typeColor(n.type) << typeIcon(n.type) << " " << n.name
             << Col::DIM << " (" << typeName(n.type) << ", id=" << n.id << ")" << Col::RESET << "\n";
    }

    // Edges
    cout << Col::BOLD << "Routes:\n" << Col::RESET;
    if (g.edges.empty()) {
        cout << Col::DIM << "  (none)\n" << Col::RESET;
    } else {
        for (auto& e : g.edges) {
            // Saturation bar
            int   bars   = (int)(e.saturation() * 10);
            string bar   = string(bars, '#') + string(10 - bars, '-');
            string satCol = e.saturation() >= 1.0 ? Col::RED : (e.flow > 0 ? Col::CYAN : Col::DIM);

            cout << "  " << Col::YELLOW << g.nodes[e.from].name << Col::RESET
                 << " → " << Col::GREEN << g.nodes[e.to].name   << Col::RESET
                 << "  cap=" << e.capacity
                 << "  cost=$" << e.cost
                 << "  flow=" << satCol << e.flow << "/" << e.capacity
                 << "  [" << bar << "]" << Col::RESET << "\n";
        }
    }
    cout << "\n";
}

void printResult(const SupplyChainGraph& g, const SupplyChainGraph::Result& res) {
    cout << "\n" << Col::BOLD << Col::CYAN
         << "═══════════════ OPTIMIZATION RESULT ═══════════════\n"
         << Col::RESET;

    cout << Col::BOLD << "  Max Flow : " << Col::GREEN << res.maxFlow << " units/day" << Col::RESET << "\n";
    cout << Col::BOLD << "  Paths    : " << Col::CYAN  << res.paths.size() << " augmenting path(s)" << Col::RESET << "\n";
    cout << Col::BOLD << "  Bottleneck: " << Col::RED  << res.bottleneck << Col::RESET << "\n\n";

    // Print each augmenting path
    cout << Col::BOLD << "Augmenting Paths (Edmonds-Karp steps):\n" << Col::RESET;
    for (int i = 0; i < (int)res.paths.size(); i++) {
        auto& ap = res.paths[i];
        cout << "  " << Col::BOLD << "Step " << (i + 1) << ": " << Col::RESET;
        for (int j = 0; j < (int)ap.nodes.size(); j++) {
            int idx = ap.nodes[j];
            cout << typeColor(g.nodes[idx].type) << g.nodes[idx].name << Col::RESET;
            if (j + 1 < (int)ap.nodes.size()) cout << Col::DIM << " → " << Col::RESET;
        }
        cout << "  " << Col::GREEN << Col::BOLD << "[+" << ap.flow << " units]" << Col::RESET << "\n";
    }

    // Edge utilisation table
    cout << "\n" << Col::BOLD << "Route Utilisation:\n" << Col::RESET;
    cout << Col::DIM << "  From          To            Flow  Cap   Util\n"
                     << "  ──────────────────────────────────────────\n" << Col::RESET;
    for (auto& e : g.edges) {
        if (e.flow == 0) continue;
        int pct = (int)(e.saturation() * 100);
        string satCol = pct >= 100 ? Col::RED : (pct >= 70 ? Col::YELLOW : Col::GREEN);
        cout << "  " << left << setw(14) << g.nodes[e.from].name
                     << setw(14) << g.nodes[e.to].name
             << right << setw(4) << e.flow << "  "
                      << setw(4) << e.capacity << "  "
             << satCol << setw(3) << pct << "%" << Col::RESET << "\n";
    }

    cout << Col::CYAN << "\n═════════════════════════════════════════════════════\n" << Col::RESET;
}

// ─────────────────────────────────────────────────────────────
// Preset networks
// ─────────────────────────────────────────────────────────────
void loadPreset(SupplyChainGraph& g, const string& name) {
    g = SupplyChainGraph(); // clear

    if (name == "simple") {
        // 1 factory → 2 warehouses → 1 store
        int f1 = g.addNode("FactoryA",  FACTORY);
        int w1 = g.addNode("Hub-North", WAREHOUSE);
        int w2 = g.addNode("Hub-South", WAREHOUSE);
        int s1 = g.addNode("StoreX",    STORE);

        g.addEdge(f1, w1, 15, 2);
        g.addEdge(f1, w2, 10, 3);
        g.addEdge(w1, s1, 12, 1);
        g.addEdge(w2, s1,  8, 2);

        cout << Col::GREEN << "  Loaded: Simple Network (4 nodes, 4 routes)\n" << Col::RESET;

    } else if (name == "india") {
        // Indian city supply chain
        int mumbai    = g.addNode("Mumbai",    FACTORY);
        int delhi     = g.addNode("Delhi",     FACTORY);
        int nagpur    = g.addNode("Nagpur",    WAREHOUSE);
        int kolkata   = g.addNode("Kolkata",   WAREHOUSE);
        int jaipur    = g.addNode("Jaipur",    WAREHOUSE);
        int hyderabad = g.addNode("Hyderabad", STORE);
        int pune      = g.addNode("Pune",      STORE);
        int bengaluru = g.addNode("Bengaluru", STORE);
        int chennai   = g.addNode("Chennai",   STORE);

        g.addEdge(mumbai,  nagpur,    20, 5);
        g.addEdge(mumbai,  jaipur,    15, 6);
        g.addEdge(delhi,   jaipur,    18, 3);
        g.addEdge(delhi,   kolkata,   14, 4);
        g.addEdge(nagpur,  hyderabad, 12, 3);
        g.addEdge(nagpur,  pune,      16, 2);
        g.addEdge(jaipur,  hyderabad,  8, 4);
        g.addEdge(jaipur,  pune,      10, 3);
        g.addEdge(kolkata, bengaluru,  9, 5);
        g.addEdge(kolkata, chennai,   12, 4);
        g.addEdge(pune,    bengaluru,  8, 2);

        cout << Col::GREEN << "  Loaded: India Supply Chain (9 nodes, 11 routes)\n" << Col::RESET;

    } else if (name == "amazon") {
        // Amazon-scale: 3 factories, 4 warehouses, 5 stores
        int f1 = g.addNode("Factory-Pune",    FACTORY);
        int f2 = g.addNode("Factory-NCR",     FACTORY);
        int f3 = g.addNode("Factory-Hyd",     FACTORY);
        int w1 = g.addNode("WH-Jaipur",       WAREHOUSE);
        int w2 = g.addNode("WH-Nagpur",       WAREHOUSE);
        int w3 = g.addNode("WH-Kolkata",      WAREHOUSE);
        int w4 = g.addNode("WH-Cochin",       WAREHOUSE);
        int s1 = g.addNode("Store-Delhi",     STORE);
        int s2 = g.addNode("Store-Mumbai",    STORE);
        int s3 = g.addNode("Store-Bengaluru", STORE);
        int s4 = g.addNode("Store-Chennai",   STORE);
        int s5 = g.addNode("Store-Kolkata",   STORE);

        g.addEdge(f1, w1, 25, 3); g.addEdge(f1, w2, 20, 2);
        g.addEdge(f2, w1, 18, 4); g.addEdge(f2, w2, 22, 2); g.addEdge(f2, w3, 15, 3);
        g.addEdge(f3, w2, 10, 3); g.addEdge(f3, w3, 20, 2); g.addEdge(f3, w4, 18, 2);
        g.addEdge(w1, s1, 20, 2); g.addEdge(w1, s2, 15, 3);
        g.addEdge(w2, s2, 18, 2); g.addEdge(w2, s3, 14, 3);
        g.addEdge(w3, s3, 16, 2); g.addEdge(w3, s4, 12, 3); g.addEdge(w3, s5, 15, 2);
        g.addEdge(w4, s4, 14, 2); g.addEdge(w4, s5, 20, 1);

        cout << Col::GREEN << "  Loaded: Amazon Network (12 nodes, 17 routes)\n" << Col::RESET;

    } else {
        cout << Col::RED << "  Unknown preset. Options: simple | india | amazon\n" << Col::RESET;
    }
}

// ─────────────────────────────────────────────────────────────
// Node lookup by name (case-insensitive)
// ─────────────────────────────────────────────────────────────
int findNode(const SupplyChainGraph& g, const string& name) {
    string lower = name;
    transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    for (auto& n : g.nodes) {
        string nl = n.name;
        transform(nl.begin(), nl.end(), nl.begin(), ::tolower);
        if (nl == lower) return n.id;
    }
    return -1;
}

// ─────────────────────────────────────────────────────────────
// Main — Interactive CLI loop
// ─────────────────────────────────────────────────────────────
int main() {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    if (hOut != INVALID_HANDLE_VALUE) {
        DWORD dwMode = 0;
        if (GetConsoleMode(hOut, &dwMode)) {
            dwMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;
            SetConsoleMode(hOut, dwMode);
        }
    }
#endif
    printBanner();
    printHelp();

    SupplyChainGraph graph;
    string line;

    cout << Col::BOLD << "\n> " << Col::RESET;
    while (getline(cin, line)) {
        // Trim
        while (!line.empty() && isspace(line.front())) line.erase(line.begin());
        while (!line.empty() && isspace(line.back()))  line.pop_back();
        if (line.empty()) { cout << Col::BOLD << "\n> " << Col::RESET; continue; }

        istringstream iss(line);
        vector<string> tokens;
        string tok;
        while (iss >> tok) tokens.push_back(tok);

        string cmd = tokens[0];
        transform(cmd.begin(), cmd.end(), cmd.begin(), ::tolower);

        // ── add ──────────────────────────────────────────────
        if (cmd == "add" && tokens.size() >= 3) {
            string sub = tokens[1];
            transform(sub.begin(), sub.end(), sub.begin(), ::tolower);

            if (sub == "factory" || sub == "warehouse" || sub == "store") {
                NodeType t = (sub == "factory") ? FACTORY : (sub == "warehouse") ? WAREHOUSE : STORE;
                string name = tokens[2];
                int id = graph.addNode(name, t);
                cout << typeColor(t) << "  + " << typeName(t) << ": " << name
                     << Col::DIM << " (id=" << id << ")" << Col::RESET << "\n";

            } else if (sub == "edge" && tokens.size() >= 5) {
                string fromName = tokens[2];
                string toName   = tokens[3];
                int cap         = stoi(tokens[4]);
                int cost        = tokens.size() >= 6 ? stoi(tokens[5]) : 1;

                int from = findNode(graph, fromName);
                int to   = findNode(graph, toName);

                if (from == -1) {
                    cout << Col::RED << "  Node not found: " << fromName << Col::RESET << "\n";
                } else if (to == -1) {
                    cout << Col::RED << "  Node not found: " << toName << Col::RESET << "\n";
                } else if (!graph.addEdge(from, to, cap, cost)) {
                    cout << Col::YELLOW << "  Route already exists: " << fromName << " → " << toName << Col::RESET << "\n";
                } else {
                    cout << Col::CYAN << "  + Route: " << fromName << " → " << toName
                         << "  cap=" << cap << "  cost=$" << cost << Col::RESET << "\n";
                }
            } else {
                cout << Col::RED << "  Usage: add factory|warehouse|store <name>\n"
                                    "         add edge <from> <to> <capacity> [cost]\n" << Col::RESET;
            }

        // ── run ──────────────────────────────────────────────
        } else if (cmd == "run") {
            if (graph.sources().empty()) {
                cout << Col::RED << "  No factories found. Add at least one factory.\n" << Col::RESET;
            } else if (graph.sinks().empty()) {
                cout << Col::RED << "  No stores found. Add at least one store.\n" << Col::RESET;
            } else if (graph.edges.empty()) {
                cout << Col::RED << "  No routes defined. Use: add edge <from> <to> <cap>\n" << Col::RESET;
            } else {
                cout << Col::MAGENTA << "\n  Running Edmonds-Karp Max-Flow...\n" << Col::RESET;
                auto result = graph.runMaxFlow();
                if (!result.ok || result.maxFlow == 0) {
                    cout << Col::RED << "  No feasible flow found. Check that factories connect to stores.\n" << Col::RESET;
                } else {
                    printResult(graph, result);
                }
            }

        // ── show ─────────────────────────────────────────────
        } else if (cmd == "show") {
            printNetwork(graph);

        // ── load ─────────────────────────────────────────────
        } else if (cmd == "load" && tokens.size() >= 2) {
            loadPreset(graph, tokens[1]);

        // ── clear ────────────────────────────────────────────
        } else if (cmd == "clear") {
            graph = SupplyChainGraph();
            cout << Col::YELLOW << "  Network cleared.\n" << Col::RESET;

        // ── help ─────────────────────────────────────────────
        } else if (cmd == "help") {
            printHelp();

        // ── exit ─────────────────────────────────────────────
        } else if (cmd == "exit" || cmd == "quit") {
            cout << Col::CYAN << "\n  Goodbye!\n\n" << Col::RESET;
            break;

        } else {
            cout << Col::RED << "  Unknown command. Type 'help' for options.\n" << Col::RESET;
        }

        cout << Col::BOLD << "\n> " << Col::RESET;
    }

    return 0;
}
