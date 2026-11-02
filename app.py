from flask import Flask, render_template, request, jsonify, Response
from collections import deque
import os
import uuid
import xml.etree.ElementTree as ET

try:
    from graphviz import Digraph
    HAS_GRAPHVIZ_PKG = True
except ImportError:
    HAS_GRAPHVIZ_PKG = False

app = Flask(__name__)

GRAPH_DIR = os.path.join("static", "graphs")
os.makedirs(GRAPH_DIR, exist_ok=True)


# ============================================================
# NFA ALGORITHM
# ============================================================

def epsilon_closure(states, epsilon_transitions):
    closure = set(states)
    stack = list(states)

    while stack:
        state = stack.pop()
        for next_state in epsilon_transitions.get(state, []):
            if next_state not in closure:
                closure.add(next_state)
                stack.append(next_state)

    return closure


def move(states, symbol, transitions):
    result = set()
    for state in states:
        for next_state in transitions.get(state, {}).get(symbol, []):
            result.add(next_state)
    return result


def set_name(states):
    if not states:
        return "∅"
    return "{" + ",".join(sorted(states)) + "}"


# ============================================================
# NFA → DFA SUBSET CONSTRUCTION
# ============================================================

def convert_nfa_to_dfa(data):
    nfa_states = data["states"]
    alphabet = data["alphabet"]
    start_state = data["start_state"]
    final_states = set(data["final_states"])
    transitions = data["transitions"]
    epsilon_transitions = data["epsilon_transitions"]

    steps = []

    # --------------------------------------------------------
    # COMPUTE ALL EPSILON CLOSURES FOR DISPLAY
    # --------------------------------------------------------
    epsilon_closures = {}
    for s in nfa_states:
        ec = epsilon_closure({s}, epsilon_transitions)
        epsilon_closures[s] = set_name(ec)

    steps.append({
        "title": "Compute ε-closures for all NFA states",
        "text": " | ".join(
            f"ε-closure({s}) = {epsilon_closures[s]}"
            for s in nfa_states
        )
    })

    # --------------------------------------------------------
    # INITIAL STATE
    # --------------------------------------------------------
    start_closure = epsilon_closure({start_state}, epsilon_transitions)
    dfa_start = frozenset(start_closure)

    steps.append({
        "title": "Initial DFA State",
        "text": f"Start state of DFA is ε-closure({start_state}) = {set_name(start_closure)}"
    })

    # --------------------------------------------------------
    # SUBSET CONSTRUCTION (BFS ORDER)
    # --------------------------------------------------------
    unprocessed = deque([dfa_start])
    dfa_states_ordered = [dfa_start]
    dfa_states_set = {dfa_start}
    dfa_transitions = {}

    while unprocessed:
        current = unprocessed.popleft()
        current_name = set_name(current)

        if current_name not in dfa_transitions:
            dfa_transitions[current_name] = {}

        for symbol in alphabet:
            reachable = move(current, symbol, transitions)
            closure = epsilon_closure(reachable, epsilon_transitions)
            next_state = frozenset(closure)
            next_name = set_name(next_state)

            dfa_transitions[current_name][symbol] = next_name

            steps.append({
                "title": f"Transition from {current_name} on '{symbol}'",
                "text": (
                    f"move({current_name}, {symbol}) = {set_name(reachable)} → "
                    f"ε-closure({set_name(reachable)}) = {next_name}"
                )
            })

            if next_state not in dfa_states_set:
                dfa_states_set.add(next_state)
                dfa_states_ordered.append(next_state)
                unprocessed.append(next_state)

                steps.append({
                    "title": "New DFA State Discovered",
                    "text": f"Added {next_name} to the queue of unprocessed DFA states."
                })

    # --------------------------------------------------------
    # DFA FINAL STATES
    # --------------------------------------------------------
    dfa_final_states = []
    for state in dfa_states_ordered:
        if any(final_state in state for final_state in final_states):
            dfa_final_states.append(set_name(state))

    dfa_state_names = [set_name(state) for state in dfa_states_ordered]

    steps.append({
        "title": "Determine DFA Final States",
        "text": (
            f"Any DFA state containing at least one NFA final state ({set_name(final_states)}) is marked final: "
            + (", ".join(dfa_final_states) if dfa_final_states else "None")
        )
    })

    return {
        "states": dfa_state_names,
        "alphabet": alphabet,
        "start_state": set_name(dfa_start),
        "final_states": dfa_final_states,
        "transitions": dfa_transitions,
        "epsilon_closures": epsilon_closures,
        "steps": steps
    }


# ============================================================
# DOT SOURCE GENERATORS + GRAPHVIZ FALLBACK
# ============================================================

def build_nfa_dot_source(data):
    lines = [
        'digraph NFA {',
        '    rankdir=LR;',
        '    bgcolor="transparent";',
        '    pad="0.5";',
        '    nodesep="0.8";',
        '    ranksep="1.0";',
        '    node [shape=circle, fontname="Inter, Arial", fontsize=14, fontcolor="#F8FAFC", color="#64748B", penwidth=2, style=filled, fillcolor="#151C28"];',
        '    edge [fontname="DM Mono, Arial", fontsize=12, fontcolor="#F8FAFC", color="#94A3B8", penwidth=2, arrowsize=0.8];',
        '    "__start" [shape=none, label="", width=0, height=0, style=""];',
        f'    "__start" -> "{data["start_state"]}" [color="#60A5FA", penwidth=2.5];'
    ]

    final_states = set(data["final_states"])
    for state in data["states"]:
        if state in final_states:
            lines.append(
                f'    "{state}" [shape=doublecircle, label="{state}", fontcolor="#FFFFFF", color="#43D19E", fillcolor="#10271F", penwidth=2.5];'
            )
        else:
            lines.append(
                f'    "{state}" [shape=circle, label="{state}", fontcolor="#F8FAFC", color="#64748B", fillcolor="#151C28", penwidth=2];'
            )

    # Group parallel normal transitions between same states
    grouped_edges = {}
    for from_state, symbols in data["transitions"].items():
        for symbol, destinations in symbols.items():
            for destination in destinations:
                key = (from_state, destination)
                grouped_edges.setdefault(key, []).append(symbol)

    for (from_state, destination), syms in grouped_edges.items():
        label = ", ".join(syms)
        lines.append(
            f'    "{from_state}" -> "{destination}" [label="{label}", color="#94A3B8", fontcolor="#F8FAFC"];'
        )

    for from_state, destinations in data["epsilon_transitions"].items():
        for destination in destinations:
            lines.append(
                f'    "{from_state}" -> "{destination}" [label="ε", color="#A78BFA", fontcolor="#C4B5FD", style=dashed, penwidth=2];'
            )

    lines.append('}')
    return "\n".join(lines)


def build_dfa_dot_source(result):
    lines = [
        'digraph DFA {',
        '    rankdir=LR;',
        '    bgcolor="transparent";',
        '    pad="0.5";',
        '    nodesep="0.8";',
        '    ranksep="1.0";',
        '    node [fontname="Inter, Arial", fontsize=13, fontcolor="#F8FAFC", color="#64748B", penwidth=2, style=filled, fillcolor="#151C28"];',
        '    edge [fontname="DM Mono, Arial", fontsize=11, fontcolor="#F8FAFC", color="#94A3B8", penwidth=2, arrowsize=0.8];',
        '    "__start" [shape=none, label="", width=0, height=0, style=""];',
        f'    "__start" -> "{result["start_state"]}" [color="#60A5FA", penwidth=2.5];'
    ]

    final_set = set(result["final_states"])
    for state in result["states"]:
        if state in final_set:
            lines.append(
                f'    "{state}" [shape=doublecircle, label="{state}", fontcolor="#FFFFFF", color="#43D19E", fillcolor="#10271F", penwidth=2.5];'
            )
        elif state == "∅":
            lines.append(
                f'    "{state}" [shape=circle, label="{state}", fontcolor="#94A3B8", color="#475569", fillcolor="#0F141D", style="filled,dashed", penwidth=1.8];'
            )
        else:
            lines.append(
                f'    "{state}" [shape=circle, label="{state}", fontcolor="#F8FAFC", color="#64748B", fillcolor="#151C28", penwidth=2];'
            )

    for from_state, symbols in result["transitions"].items():
        grouped = {}
        for symbol, destination in symbols.items():
            grouped.setdefault(destination, []).append(symbol)

        for destination, syms in grouped.items():
            label = ", ".join(syms)
            lines.append(
                f'    "{from_state}" -> "{destination}" [label="{label}", color="#94A3B8", fontcolor="#F8FAFC"];'
            )

    lines.append('}')
    return "\n".join(lines)


def create_nfa_graph(data):
    if not HAS_GRAPHVIZ_PKG:
        return None
    try:
        graph = Digraph("NFA", format="svg")
        graph.attr(rankdir="LR", bgcolor="transparent", pad="0.5", nodesep="0.8", ranksep="1")
        graph.attr(
            "node", shape="circle", fontname="Arial", fontsize="14",
            fontcolor="#F8FAFC", color="#64748B", penwidth="2",
            style="filled", fillcolor="#151C28"
        )
        graph.attr(
            "edge", fontname="Arial", fontsize="12", fontcolor="#F8FAFC",
            color="#94A3B8", penwidth="2", arrowsize="0.8"
        )
        graph.node("__start", shape="none", label="")
        graph.edge("__start", data["start_state"], color="#60A5FA", penwidth="2.5")

        states = data["states"]
        final_states = set(data["final_states"])

        for state in states:
            if state in final_states:
                graph.node(
                    state, shape="doublecircle", label=state,
                    fontcolor="#FFFFFF", color="#43D19E", fillcolor="#10271F", penwidth="2.5"
                )
            else:
                graph.node(
                    state, shape="circle", label=state,
                    fontcolor="#F8FAFC", color="#64748B", fillcolor="#151C28", penwidth="2"
                )

        for from_state, symbols in data["transitions"].items():
            for symbol, destinations in symbols.items():
                for destination in destinations:
                    graph.edge(from_state, destination, label=symbol, color="#94A3B8", fontcolor="#F8FAFC")

        for from_state, destinations in data["epsilon_transitions"].items():
            for destination in destinations:
                graph.edge(
                    from_state, destination, label="ε",
                    color="#A78BFA", fontcolor="#C4B5FD", style="dashed", penwidth="2"
                )

        filename = f"nfa_{uuid.uuid4().hex}"
        path = graph.render(filename=filename, directory=GRAPH_DIR, cleanup=True)
        return "/" + path.replace("\\", "/")
    except Exception:
        return None


def create_dfa_graph(result):
    if not HAS_GRAPHVIZ_PKG:
        return None
    try:
        graph = Digraph("DFA", format="svg")
        graph.attr(rankdir="LR", bgcolor="transparent", pad="0.5", nodesep="0.8", ranksep="1")
        graph.attr(
            "node", fontname="Arial", fontsize="13", fontcolor="#F8FAFC",
            color="#64748B", penwidth="2", style="filled", fillcolor="#151C28"
        )
        graph.attr(
            "edge", fontname="Arial", fontsize="11", fontcolor="#F8FAFC",
            color="#94A3B8", penwidth="2", arrowsize="0.8"
        )
        graph.node("__start", shape="none", label="")

        for state in result["states"]:
            if state in result["final_states"]:
                graph.node(
                    state, shape="doublecircle", label=state,
                    fontcolor="#FFFFFF", color="#43D19E", fillcolor="#10271F", penwidth="2.5"
                )
            else:
                graph.node(
                    state, shape="circle", label=state,
                    fontcolor="#F8FAFC", color="#64748B", fillcolor="#151C28", penwidth="2"
                )

        graph.edge("__start", result["start_state"], color="#60A5FA", penwidth="2.5")

        for from_state, symbols in result["transitions"].items():
            grouped = {}
            for symbol, destination in symbols.items():
                grouped.setdefault(destination, []).append(symbol)
            for destination, syms in grouped.items():
                graph.edge(
                    from_state, destination, label=", ".join(syms),
                    color="#94A3B8", fontcolor="#F8FAFC"
                )

        filename = f"dfa_{uuid.uuid4().hex}"
        path = graph.render(filename=filename, directory=GRAPH_DIR, cleanup=True)
        return "/" + path.replace("\\", "/")
    except Exception:
        return None


# ============================================================
# JFLAP (.jff) EXPORT GENERATOR
# ============================================================

def build_jflap_xml(automaton, is_dfa=True):
    """
    Generate valid JFLAP 7.1 XML (.jff) for either the input NFA or converted DFA.
    """
    structure = ET.Element("structure")
    type_el = ET.SubElement(structure, "type")
    type_el.text = "fa"
    fa = ET.SubElement(structure, "automaton")

    states = automaton["states"]
    start_state = automaton["start_state"]
    final_states = set(automaton["final_states"])

    state_id_map = {}
    import math
    count = max(len(states), 1)
    radius = max(140, 45 * count)
    cx, cy = 320, 240

    for idx, s in enumerate(states):
        state_id_map[s] = str(idx)
        angle = (2 * math.pi * idx) / count
        x = round(cx + radius * math.cos(angle), 1)
        y = round(cy + radius * math.sin(angle), 1)

        st_el = ET.SubElement(fa, "state", id=str(idx), name=s)
        ET.SubElement(st_el, "x").text = str(x)
        ET.SubElement(st_el, "y").text = str(y)
        if s == start_state:
            ET.SubElement(st_el, "initial")
        if s in final_states:
            ET.SubElement(st_el, "final")

    if is_dfa:
        for from_s, sym_map in automaton["transitions"].items():
            for sym, to_s in sym_map.items():
                tr_el = ET.SubElement(fa, "transition")
                ET.SubElement(tr_el, "from").text = state_id_map[from_s]
                ET.SubElement(tr_el, "to").text = state_id_map[to_s]
                ET.SubElement(tr_el, "read").text = sym
    else:
        for from_s, sym_map in automaton.get("transitions", {}).items():
            for sym, dests in sym_map.items():
                for to_s in dests:
                    if from_s in state_id_map and to_s in state_id_map:
                        tr_el = ET.SubElement(fa, "transition")
                        ET.SubElement(tr_el, "from").text = state_id_map[from_s]
                        ET.SubElement(tr_el, "to").text = state_id_map[to_s]
                        ET.SubElement(tr_el, "read").text = sym
        for from_s, dests in automaton.get("epsilon_transitions", {}).items():
            for to_s in dests:
                if from_s in state_id_map and to_s in state_id_map:
                    tr_el = ET.SubElement(fa, "transition")
                    ET.SubElement(tr_el, "from").text = state_id_map[from_s]
                    ET.SubElement(tr_el, "to").text = state_id_map[to_s]
                    ET.SubElement(tr_el, "read")  # empty read tag = epsilon in JFLAP

    xml_bytes = ET.tostring(structure, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    try:
        data = request.get_json()
        result = convert_nfa_to_dfa(data)

        # Provide both Graphviz SVG path (if installed) and raw DOT source for client-side SVG rendering
        result["nfa_graph"] = create_nfa_graph(data)
        result["dfa_graph"] = create_dfa_graph(result)
        result["nfa_dot"] = build_nfa_dot_source(data)
        result["dfa_dot"] = build_dfa_dot_source(result)
        result["dfa_jff"] = build_jflap_xml(result, is_dfa=True)
        result["nfa_jff"] = build_jflap_xml(data, is_dfa=False)

        return jsonify({
            "success": True,
            "result": result
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400


@app.route("/test-string", methods=["POST"])
def test_string():
    try:
        data = request.get_json()
        transitions = data["transitions"]
        current = data["start_state"]
        final_states = set(data["final_states"])
        test = data["test"]

        path = [current]
        trace = []

        for symbol in test:
            if current not in transitions:
                return jsonify({
                    "accepted": False,
                    "path": path,
                    "trace": trace,
                    "message": f"State {current} has no outgoing transitions."
                })

            if symbol not in transitions[current]:
                return jsonify({
                    "accepted": False,
                    "path": path,
                    "trace": trace,
                    "message": f"Symbol '{symbol}' is not in the DFA alphabet or has no transition from {current}."
                })

            next_st = transitions[current][symbol]
            trace.append({
                "from": current,
                "symbol": symbol,
                "to": next_st
            })
            current = next_st
            path.append(current)

        accepted = current in final_states

        return jsonify({
            "accepted": accepted,
            "path": path,
            "trace": trace,
            "message": (
                f"String accepted — halted in final state {current}."
                if accepted
                else f"String rejected — halted in non-final state {current}."
            )
        })

    except Exception as e:
        return jsonify({
            "accepted": False,
            "error": str(e)
        }), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)

