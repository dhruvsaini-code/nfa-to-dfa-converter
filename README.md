# λ NFA → DFA Converter (Automata Theory Project)

An interactive web application built with **Python (Flask)**, **Graphviz / SVG**, and **JavaScript** that converts Non-Deterministic Finite Automata (**NFA** and **ε-NFA**) into equivalent Deterministic Finite Automata (**DFA**) using the **Subset Construction Algorithm** and **ε-Closure**.

It also supports **JFLAP (`.jff`) XML export** so you can directly open and verify both your input NFA and the generated DFA inside JFLAP.

---

## 📌 Project Architecture

```text
                 YOUR WEBSITE
                     │
             User enters NFA
                     │
                     ▼
              Python Flask
                     │
                     ▼
          NFA → DFA Algorithm
    (ε-Closure + Subset Construction)
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   DFA Table    DFA Diagram   JFLAP (.jff)
          │
          ▼
    Step-by-step conversion & String Simulator
```

---

## ✨ Features

1. **Enter NFA Configuration**: Define states ($Q$), input alphabet ($\Sigma$), start state ($q_0$), and final/accepting states ($F$).
2. **Transition Function Builder**: Add normal transitions and $\varepsilon$-transitions dynamically.
3. **One-Click Example Presets**: Load standard NFA or $\varepsilon$-NFA examples immediately.
4. **$\varepsilon$-Closure Table**: Automatically computes and displays $\varepsilon\text{-closure}(q)$ for every state in the NFA.
5. **Step-by-Step Subset Construction Trace**: Logs every `move(T, a)` and `ε-closure(move(T, a))` calculation as new DFA states are discovered.
6. **DFA Transition Table**: Clearly marks the start state (`→`), final states (`★`), and dead/trap states (`∅`).
7. **Side-by-Side State Diagrams**: Renders both the input NFA and output DFA with double-circled accepting states and dashed $\varepsilon$-edges.
8. **Interactive String Simulator**: Test any input string against the generated DFA and inspect the exact state-by-state execution path.
9. **JFLAP Verification & Export**: Export both the input NFA (`input_nfa.jff`) and converted DFA (`converted_dfa.jff`) to verify equivalence in **JFLAP**.

---

## 🧠 Automata Theory: How the Conversions Work

### 1. NFA (and ε-NFA) → DFA Conversion (Subset Construction)

A **Non-Deterministic Finite Automaton (NFA)** is a 5-tuple:
$$M_N = (Q_N, \Sigma, \delta_N, q_0, F_N)$$
where $\delta_N : Q_N \times (\Sigma \cup \{\varepsilon\}) \rightarrow \mathcal{P}(Q_N)$ maps a state and symbol to a **set** of possible next states.

To convert $M_N$ into an equivalent **Deterministic Finite Automaton (DFA)**:
$$M_D = (Q_D, \Sigma, \delta_D, q_D, F_D)$$
we use **Subset Construction** (also called the Powerset Construction), where each state in the DFA represents a **subset of NFA states** ($Q_D \subseteq \mathcal{P}(Q_N)$):

#### Step 1: Compute $\varepsilon$-Closure
For any NFA state $q$ (or set of states $T$), $\varepsilon\text{-closure}(T)$ is the set of all NFA states reachable from any state in $T$ by following zero or more $\varepsilon$-transitions:
- Initialize `closure = T` and push all states of $T$ onto a stack.
- Pop state $u$; for every transition $u \xrightarrow{\varepsilon} v$, if $v \notin \text{closure}$, add $v$ to `closure` and push $v$.

#### Step 2: Initial State of the DFA
The start state of the DFA is the $\varepsilon$-closure of the NFA's start state:
$$q_D = \varepsilon\text{-closure}(\{q_0\})$$

#### Step 3: Compute Deterministic Transitions ($\delta_D$)
Using a queue of unprocessed DFA states (starting with $q_D$), for each subset state $T \in Q_D$ and each input symbol $a \in \Sigma$:
1. Compute $\text{move}(T, a) = \bigcup_{q \in T} \delta_N(q, a)$ (all states reachable from $T$ on symbol $a$).
2. Compute the target DFA state:
   $$\delta_D(T, a) = \varepsilon\text{-closure}(\text{move}(T, a))$$
3. If $\delta_D(T, a)$ is a new subset not yet in $Q_D$, add it to $Q_D$ and enqueue it.
   *(If $\text{move}(T, a) = \emptyset$, the transition leads to the dead/trap state $\emptyset$.)*

#### Step 4: Accepting / Final States of the DFA
Any DFA subset state $T \in Q_D$ that contains **at least one** NFA final state becomes a final state in the DFA:
$$F_D = \{ T \in Q_D \mid T \cap F_N \neq \emptyset \}$$

---

### 2. DFA → NFA Conversion

Every **DFA** is already a special case of an **NFA** that happens to have:
- No $\varepsilon$-transitions, and
- Exactly one outgoing transition per state for each symbol in $\Sigma$.

Formally, given a DFA $M_D = (Q, \Sigma, \delta_D, q_0, F)$, its equivalent NFA $M_N = (Q, \Sigma, \delta_N, q_0, F)$ has the exact same states, alphabet, start state, and final states, with the transition function wrapped as a singleton set:
$$\delta_N(q, a) = \{ \delta_D(q, a) \} \quad \forall q \in Q, \, a \in \Sigma$$
$$\delta_N(q, \varepsilon) = \emptyset$$

*(Conversely, if you want to convert a DFA back into a compact NFA or Regular Expression, you can use **State Elimination** or **DFA Minimization**.)*

---

## 🔍 Worked Example & JFLAP Verification

Consider the classic NFA that accepts binary strings ending in `01`:
- **States ($Q$):** `q0, q1, q2`
- **Alphabet ($\Sigma$):** `0, 1`
- **Start State:** `q0`
- **Final State:** `q2`
- **Transitions:**
  - `q0 --0--> q0`
  - `q0 --0--> q1`
  - `q0 --1--> q0`
  - `q1 --1--> q2`

### Subset Construction Output:

| DFA State | Input `0` | Input `1` | Role |
| :--- | :---: | :---: | :--- |
| **`→ {q0}`** | `{q0,q1}` | `{q0}` | Start State |
| **`{q0,q1}`** | `{q0,q1}` | `{q0,q2}` | Intermediate State |
| **`★ {q0,q2}`** | `{q0,q1}` | `{q0}` | Final State (contains `q2`) |

### How to Verify with JFLAP:
1. Convert your NFA in the web app and click **↓ Export NFA (.jff)** or **↓ Export DFA (.jff)**.
2. Open `input_nfa.jff` in **JFLAP** (`File → Open`).
3. In JFLAP, select **`Convert → Convert to DFA`** and click **`Complete`**.
4. Compare JFLAP's generated states (`{q0}`, `{q0,q1}`, `{q0,q2}`) and transitions with our converter's table and diagram to verify 100% equivalence.

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.9+**
- *(Optional)* **Graphviz** system binary (`brew install graphviz` on macOS or `apt install graphviz` on Linux). Even without Graphviz installed, the app automatically falls back to its built-in client-side SVG graph renderer.

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/dhruvsaini-code/nfa-to-dfa-converter.git
cd nfa-to-dfa-converter

# 2. Install Python dependencies
pip3 install -r requirements.txt

# 3. Start the Flask server
python3 app.py
```

Open **`http://127.0.0.1:5000`** in your browser.

---

## 📁 Project Structure

```text
├── app.py                  # Flask backend, Subset Construction, ε-closure & JFLAP XML generator
├── requirements.txt        # Python dependencies (Flask, graphviz)
├── templates/
│   └── index.html          # Main UI template
└── static/
    ├── style.css           # Dark-theme responsive styling
    ├── script.js           # Frontend logic, SVG automaton renderer, simulator & exports
    └── graphs/             # Directory for Graphviz rendered SVGs
```
