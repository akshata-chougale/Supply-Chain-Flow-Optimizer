# Supply Chain Network Optimizer

> **DSA Project** — Max-Flow (Edmonds-Karp) applied to real-world supply chain optimization  
> Language: **C++17** | Algorithm: **Edmonds-Karp / Ford-Fulkerson** | Complexity: **O(V·E²)**

---

## Problem Statement

Given a supply chain network of **Factories** (sources), **Warehouses** (intermediate nodes), and **Stores** (sinks) — each connected by routes with limited daily capacity — find the **maximum amount of goods** that can flow from factories to stores per day.

This is a classic **Maximum Flow** problem, solved using the **Edmonds-Karp algorithm** (BFS-based Ford-Fulkerson).

---

## Algorithm

### Edmonds-Karp (BFS Ford-Fulkerson)

1. Add a **virtual super-source** connected to all factories (infinite capacity)
2. Add a **virtual super-sink** connected from all stores (infinite capacity)
3. Repeatedly find the **shortest augmenting path** (via BFS) from super-source to super-sink
4. Push maximum flow along that path, update the **residual graph**
5. Repeat until no augmenting path exists
6. Report total flow, each augmenting path, and the **bottleneck edge**

**Why Edmonds-Karp over plain Ford-Fulkerson?**  
Using BFS guarantees we always pick the *shortest* augmenting path, giving polynomial time complexity `O(V·E²)` instead of potentially infinite loops on irrational capacities.

**Residual Graph:**  
For every forward edge `u→v` with capacity `c` and flow `f`, we maintain a backward edge `v→u` with capacity `f`. This allows the algorithm to "undo" suboptimal flow assignments.

---

## Build & Run

### Requirements
- GCC 7+ or Clang 6+ (any compiler supporting C++17)
- Works on Linux, macOS, Windows (MSYS2 / WSL)

### Compile
```bash
g++ -std=c++17 -O2 -o supply_chain main.cpp
```

### Run
```bash
./supply_chain          # Linux/macOS
supply_chain.exe        # Windows
```

---

## Usage

```
> help
```
Shows all available commands.

### Commands

| Command | Description |
|---|---|
| `add factory <name>` | Add a production source node |
| `add warehouse <name>` | Add an intermediate transfer hub |
| `add store <name>` | Add a demand sink node |
| `add edge <from> <to> <cap> [cost]` | Add a directed route |
| `run` | Run the Max-Flow optimizer |
| `show` | Display the current network and flow values |
| `load simple\|india\|amazon` | Load a preset network |
| `clear` | Reset everything |
| `exit` | Quit |

---

## Example Session

```
> load india
  Loaded: India Supply Chain (9 nodes, 11 routes)

> run

  Running Edmonds-Karp Max-Flow...

═══════════════ OPTIMIZATION RESULT ═══════════════
  Max Flow  : 35 units/day
  Paths     : 4 augmenting path(s)
  Bottleneck: Nagpur → Pune (16/16)

Augmenting Paths (Edmonds-Karp steps):
  Step 1: Mumbai → Nagpur → Pune → Bengaluru  [+8 units]
  Step 2: Mumbai → Nagpur → Hyderabad         [+12 units]
  Step 3: Delhi  → Jaipur → Pune              [+8 units]
  Step 4: Delhi  → Kolkata → Chennai          [+7 units]
```

### Build your own network

```
> add factory  Surat
> add warehouse Nagpur
> add store     Bengaluru
> add edge Surat Nagpur 25 3
> add edge Nagpur Bengaluru 18 2
> run
```

---

## Preset Networks

| Preset | Nodes | Routes | Description |
|---|---|---|---|
| `simple` | 4 | 4 | 1 factory, 2 warehouses, 1 store |
| `india` | 9 | 11 | Mumbai + Delhi factories, 3 warehouses, 4 stores |
| `amazon` | 12 | 17 | 3 factories, 4 warehouses, 5 stores (complex) |

---

## Key DSA Concepts Demonstrated

| Concept | Where Used |
|---|---|
| **Graph (Adjacency Matrix)** | Capacity and flow matrices |
| **BFS** | Finding shortest augmenting path (Edmonds-Karp) |
| **Residual Graph** | Backward edges for flow reversal |
| **Greedy Augmentation** | Pushing max flow along each BFS path |
| **Super Source/Sink** | Handling multi-source, multi-sink networks |
| **Bottleneck Detection** | Finding the capacity-saturated edge |

---

## File Structure

```
supply-chain-optimizer/
└── main.cpp    # Single-file implementation (~350 lines)
```

Everything is in one self-contained C++ file — no dependencies.

---

## Time & Space Complexity

| | Complexity |
|---|---|
| **Time** | O(V · E²) |
| **Space** | O(V²) for the capacity matrix |
| **BFS per iteration** | O(V + E) |
| **Max iterations** | O(V · E) |

---

## Resume Bullet Points (copy-paste)

> - Implemented **Edmonds-Karp Max-Flow** (O(V·E²)) in C++ to optimize goods routing across a multi-source, multi-sink supply chain network with factories, warehouses, and stores
> - Built **residual graph** with backward edges enabling flow reversal across 3 preset networks (4–17 routes)
> - CLI displays step-by-step **augmenting paths**, edge utilisation table, and bottleneck detection
