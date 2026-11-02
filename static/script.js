let currentDFA = null;
let currentNFA = null;


/* ============================================================
   ADD / REMOVE TRANSITIONS
============================================================ */

function addTransition(fromVal = "", symVal = "", toVal = "") {

    const container =
        document.getElementById(
            "transitionContainer"
        );


    const row =
        document.createElement("div");


    row.className =
        "transition-row";


    row.innerHTML = `

        <div class="transition-input">

            <span>q</span>

            <input
                class="from-state"
                placeholder="q0"
                value="${fromVal}"
            >

        </div>


        <div class="transition-symbol">

            <input
                class="symbol"
                placeholder="0 / 1 / ε"
                value="${symVal}"
            >

        </div>


        <div class="transition-input">

            <span>q</span>

            <input
                class="to-state"
                placeholder="q1"
                value="${toVal}"
            >

        </div>


        <button
            class="delete-button"
            onclick="removeTransition(this)"
        >

            ×

        </button>

    `;


    container.appendChild(row);
}


function addEpsilonTransition() {
    addTransition("", "ε", "");
}


function removeTransition(button) {

    button.parentElement.remove();

}


/* ============================================================
   GET INPUT
============================================================ */

function getValues() {

    return {

        states:

            document
                .getElementById("states")
                .value
                .split(",")
                .map(x => x.trim())
                .filter(Boolean),


        alphabet:

            document
                .getElementById("alphabet")
                .value
                .split(",")
                .map(x => x.trim())
                .filter(Boolean),


        startState:

            document
                .getElementById("startState")
                .value
                .trim(),


        finalStates:

            document
                .getElementById("finalStates")
                .value
                .split(",")
                .map(x => x.trim())
                .filter(Boolean)

    };
}


/* ============================================================
   BUILD TRANSITIONS
============================================================ */

function buildTransitions() {

    const transitions = {};

    const epsilonTransitions = {};


    const rows =
        document.querySelectorAll(
            ".transition-row"
        );


    rows.forEach(row => {


        const from =
            row.querySelector(
                ".from-state"
            ).value.trim();


        const symbol =
            row.querySelector(
                ".symbol"
            ).value.trim();


        const to =
            row.querySelector(
                ".to-state"
            ).value.trim();


        if (!from || !symbol || !to) {

            return;

        }


        if (
            symbol === "ε" ||
            symbol.toLowerCase() === "epsilon"
        ) {


            if (!epsilonTransitions[from]) {

                epsilonTransitions[from] = [];

            }


            epsilonTransitions[from]
                .push(to);


        } else {


            if (!transitions[from]) {

                transitions[from] = {};

            }


            if (!transitions[from][symbol]) {

                transitions[from][symbol] = [];

            }


            transitions[from][symbol]
                .push(to);

        }

    });


    return {

        transitions,

        epsilonTransitions

    };

}


/* ============================================================
   CONVERT
============================================================ */

async function convertNFA() {


    hideError();


    const values =
        getValues();


    if (!values.states.length) {

        showError(
            "Please enter the NFA states."
        );

        return;

    }


    if (!values.alphabet.length) {

        showError(
            "Please enter the alphabet."
        );

        return;

    }


    if (!values.startState) {

        showError(
            "Please enter the start state."
        );

        return;

    }


    if (
        !values.states.includes(
            values.startState
        )
    ) {

        showError(
            "Start state must belong to the state set."
        );

        return;

    }


    const transitionData =
        buildTransitions();


    const data = {

        states:
            values.states,

        alphabet:
            values.alphabet,

        start_state:
            values.startState,

        final_states:
            values.finalStates,

        transitions:
            transitionData.transitions,

        epsilon_transitions:
            transitionData.epsilonTransitions

    };

    currentNFA = data;


    try {


        const response =
            await fetch(
                "/convert",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(data)

                }
            );


        const result =
            await response.json();


        if (!result.success) {

            showError(
                result.error
            );

            return;

        }


        currentDFA =
            result.result;


        displayResult(
            currentDFA,
            currentNFA
        );


    } catch (error) {

        console.error(error);


        showError(
            "Could not connect to the Flask server."
        );

    }

}


/* ============================================================
   DISPLAY RESULT
============================================================ */

function displayResult(result, nfaData) {


    document
        .getElementById(
            "resultSection"
        )
        .classList.remove(
            "hidden"
        );


    document
        .getElementById(
            "dfaStart"
        )
        .textContent =
            result.start_state;


    document
        .getElementById(
            "dfaStateCount"
        )
        .textContent =
            result.states.length;


    document
        .getElementById(
            "dfaFinal"
        )
        .textContent =

            result.final_states.length

                ? result.final_states.join(
                    ", "
                )

                : "None";


    /*
       If server-side Graphviz SVG was generated, use it;
       otherwise render the interactive dark-theme SVG diagram directly in the browser.
    */

    const nfaImg = document.getElementById("nfaGraph");
    const dfaImg = document.getElementById("dfaGraph");
    const nfaCanvas = document.getElementById("nfaSvgCanvas");
    const dfaCanvas = document.getElementById("dfaSvgCanvas");

    if (result.nfa_graph) {
        nfaImg.src = result.nfa_graph + "?t=" + Date.now();
        nfaImg.classList.remove("hidden");
        nfaCanvas.classList.add("hidden");
    } else {
        nfaImg.classList.add("hidden");
        nfaCanvas.classList.remove("hidden");
        nfaCanvas.innerHTML = renderAutomatonSVG(nfaData, false);
    }

    if (result.dfa_graph) {
        dfaImg.src = result.dfa_graph + "?t=" + Date.now();
        dfaImg.classList.remove("hidden");
        dfaCanvas.classList.add("hidden");
    } else {
        dfaImg.classList.add("hidden");
        dfaCanvas.classList.remove("hidden");
        dfaCanvas.innerHTML = renderAutomatonSVG(result, true);
    }


    createEpsilonClosures(result);

    createTable(result);

    createSteps(result);


    document
        .getElementById(
            "resultSection"
        )
        .scrollIntoView({
            behavior: "smooth"
        });

}


/* ============================================================
   EPSILON CLOSURE DISPLAY
============================================================ */

function createEpsilonClosures(result) {
    const container = document.getElementById("epsilonClosureContainer");
    if (!container) return;
    container.innerHTML = "";

    const closures = result.epsilon_closures || {};
    Object.keys(closures).forEach(state => {
        const div = document.createElement("div");
        div.className = "closure-chip";
        div.innerHTML = `
            <span>ε-closure(${state})</span>
            <strong>${closures[state]}</strong>
        `;
        container.appendChild(div);
    });
}


/* ============================================================
   BUILT-IN DARK-THEME SVG AUTOMATON RENDERER
============================================================ */

function renderAutomatonSVG(automaton, isDFA) {
    const states = automaton.states || [];
    const startState = automaton.start_state;
    const finalStates = new Set(automaton.final_states || []);
    const n = states.length;

    const width = 620;
    const height = 360;
    const cx = width / 2 + 15;
    const cy = height / 2 + 10;
    const nodeRadius = 28;

    // Position states nicely: 1-3 states in a horizontal line, 4+ on an ellipse
    const positions = {};
    if (n === 1) {
        positions[states[0]] = { x: cx, y: cy };
    } else if (n === 2) {
        positions[states[0]] = { x: cx - 130, y: cy };
        positions[states[1]] = { x: cx + 130, y: cy };
    } else if (n === 3) {
        positions[states[0]] = { x: cx - 175, y: cy };
        positions[states[1]] = { x: cx, y: cy };
        positions[states[2]] = { x: cx + 175, y: cy };
    } else {
        const rx = Math.min(210, 95 + n * 18);
        const ry = Math.min(125, 65 + n * 10);
        states.forEach((st, i) => {
            const angle = Math.PI + (2 * Math.PI * i) / n;
            positions[st] = {
                x: cx + rx * Math.cos(angle),
                y: cy + ry * Math.sin(angle)
            };
        });
    }

    // Collect and group edges: key = "from|||to|||type"
    const edgeMap = {};
    const addEdge = (from, to, label, isEps) => {
        if (!positions[from] || !positions[to]) return;
        const key = `${from}|||${to}|||${isEps ? "eps" : "norm"}`;
        if (!edgeMap[key]) {
            edgeMap[key] = { from, to, labels: [], isEps };
        }
        if (!edgeMap[key].labels.includes(label)) {
            edgeMap[key].labels.push(label);
        }
    };

    if (isDFA) {
        const trans = automaton.transitions || {};
        Object.keys(trans).forEach(from => {
            Object.keys(trans[from]).forEach(sym => {
                const to = trans[from][sym];
                addEdge(from, to, sym, false);
            });
        });
    } else {
        const trans = automaton.transitions || {};
        Object.keys(trans).forEach(from => {
            Object.keys(trans[from]).forEach(sym => {
                (trans[from][sym] || []).forEach(to => {
                    addEdge(from, to, sym, false);
                });
            });
        });
        const eps = automaton.epsilon_transitions || {};
        Object.keys(eps).forEach(from => {
            (eps[from] || []).forEach(to => {
                addEdge(from, to, "ε", true);
            });
        });
    }

    const edges = Object.values(edgeMap);
    const pairSet = new Set(edges.map(e => `${e.from}|||${e.to}`));

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="arrow-norm-${isDFA ? 'd' : 'n'}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94A3B8"/>
            </marker>
            <marker id="arrow-eps-${isDFA ? 'd' : 'n'}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#A78BFA"/>
            </marker>
            <marker id="arrow-start-${isDFA ? 'd' : 'n'}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#60A5FA"/>
            </marker>
        </defs>`;

    // Draw edges
    edges.forEach(edge => {
        const p1 = positions[edge.from];
        const p2 = positions[edge.to];
        const label = edge.labels.join(", ");
        const strokeColor = edge.isEps ? "#A78BFA" : "#94A3B8";
        const textColor = edge.isEps ? "#C4B5FD" : "#F8FAFC";
        const dashAttr = edge.isEps ? `stroke-dasharray="5,4"` : "";
        const markerId = edge.isEps ? `arrow-eps-${isDFA ? 'd' : 'n'}` : `arrow-norm-${isDFA ? 'd' : 'n'}`;

        if (edge.from === edge.to) {
            // Self-loop above the node
            const sx = p1.x - 12;
            const sy = p1.y - nodeRadius + 2;
            const ex = p1.x + 12;
            const ey = p1.y - nodeRadius + 2;
            const c1x = p1.x - 28;
            const c1y = p1.y - nodeRadius - 42;
            const c2x = p1.x + 28;
            const c2y = p1.y - nodeRadius - 42;
            const lx = p1.x;
            const ly = p1.y - nodeRadius - 36;

            svg += `<path d="M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}" fill="none" stroke="${strokeColor}" stroke-width="2" ${dashAttr} marker-end="url(#${markerId})"/>`;
            svg += `<text x="${lx}" y="${ly}" fill="${textColor}" font-family="DM Mono, monospace" font-size="11" text-anchor="middle">${escapeXml(label)}</text>`;
        } else {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;

            // Curve slightly if reverse edge exists or if horizontal collinear jump
            const hasReverse = pairSet.has(`${edge.to}|||${edge.from}`);
            const isCollinearJump = Math.abs(dy) < 5 && Math.abs(dx) > 220;
            let curveOffset = 0;
            if (hasReverse) {
                curveOffset = 28;
            } else if (isCollinearJump) {
                curveOffset = -45;
            } else if (edge.isEps) {
                curveOffset = -20;
            }

            const nx = -uy;
            const ny = ux;
            const mx = (p1.x + p2.x) / 2 + nx * curveOffset;
            const my = (p1.y + p2.y) / 2 + ny * curveOffset;

            // Compute start and end points on node boundary towards control point
            const sdx = mx - p1.x;
            const sdy = my - p1.y;
            const sdist = Math.hypot(sdx, sdy) || 1;
            const sx = p1.x + (sdx / sdist) * nodeRadius;
            const sy = p1.y + (sdy / sdist) * nodeRadius;

            const edx = p2.x - mx;
            const edy = p2.y - my;
            const edist = Math.hypot(edx, edy) || 1;
            const ex = p2.x - (edx / edist) * (nodeRadius + 2);
            const ey = p2.y - (edy / edist) * (nodeRadius + 2);

            const lx = 0.25 * sx + 0.5 * mx + 0.25 * ex + nx * 10;
            const ly = 0.25 * sy + 0.5 * my + 0.25 * ey + ny * 10;

            svg += `<path d="M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}" fill="none" stroke="${strokeColor}" stroke-width="2" ${dashAttr} marker-end="url(#${markerId})"/>`;
            svg += `<rect x="${lx - (label.length * 4 + 6)}" y="${ly - 9}" width="${label.length * 8 + 12}" height="15" rx="4" fill="#10141D" opacity="0.85"/>`;
            svg += `<text x="${lx}" y="${ly + 2}" fill="${textColor}" font-family="DM Mono, monospace" font-size="11" text-anchor="middle">${escapeXml(label)}</text>`;
        }
    });

    // Start arrow
    if (startState && positions[startState]) {
        const sp = positions[startState];
        const sx = sp.x - nodeRadius - 38;
        const sy = sp.y;
        const ex = sp.x - nodeRadius - 3;
        const ey = sp.y;
        svg += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#60A5FA" stroke-width="2.5" marker-end="url(#arrow-start-${isDFA ? 'd' : 'n'})"/>`;
    }

    // Draw nodes
    states.forEach(st => {
        const p = positions[st];
        const isFinal = finalStates.has(st);
        const isTrap = st === "∅";

        const fill = isFinal ? "#10271F" : (isTrap ? "#0F141D" : "#151C28");
        const stroke = isFinal ? "#43D19E" : (isTrap ? "#475569" : "#64748B");
        const strokeDash = isTrap ? `stroke-dasharray="4,3"` : "";
        const fontSize = st.length > 7 ? 10 : (st.length > 4 ? 11 : 13);

        svg += `<circle cx="${p.x}" cy="${p.y}" r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="${isFinal ? 2.5 : 2}" ${strokeDash}/>`;
        if (isFinal) {
            svg += `<circle cx="${p.x}" cy="${p.y}" r="${nodeRadius - 5}" fill="none" stroke="${stroke}" stroke-width="1.6"/>`;
        }
        svg += `<text x="${p.x}" y="${p.y + 4}" fill="#F8FAFC" font-family="DM Mono, Inter, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle">${escapeXml(st)}</text>`;
    });

    svg += `</svg>`;
    return svg;
}

function escapeXml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}


/* ============================================================
   DFA TABLE
============================================================ */

function createTable(result) {


    const head =
        document.getElementById(
            "dfaTableHead"
        );


    const body =
        document.getElementById(
            "dfaTableBody"
        );


    head.innerHTML = "";

    body.innerHTML = "";


    const header =
        document.createElement("tr");


    const stateHeader =
        document.createElement("th");


    stateHeader.textContent =
        "DFA STATE";


    header.appendChild(
        stateHeader
    );


    result.alphabet.forEach(
        symbol => {


            const th =
                document.createElement(
                    "th"
                );


            th.textContent =
                symbol;


            header.appendChild(th);

        }
    );


    head.appendChild(
        header
    );


    result.states.forEach(
        state => {


            const row =
                document.createElement(
                    "tr"
                );


            if (
                result.final_states
                    .includes(state)
            ) {

                row.classList.add(
                    "final-row"
                );

            }


            const stateCell =
                document.createElement(
                    "td"
                );


            let label = state;


            if (
                state ===
                result.start_state
            ) {

                label =
                    "→ " + label;

            }


            if (
                result.final_states
                    .includes(state)
            ) {

                label =
                    "★ " + label;

            }


            stateCell.textContent =
                label;


            row.appendChild(
                stateCell
            );


            result.alphabet.forEach(
                symbol => {


                    const cell =
                        document.createElement(
                            "td"
                        );


                    cell.textContent =

                        result
                            .transitions[state][symbol]

                        || "∅";


                    row.appendChild(
                        cell
                    );

                }
            );


            body.appendChild(
                row
            );

        }
    );

}


/* ============================================================
   SUBSET CONSTRUCTION STEPS
============================================================ */

function createSteps(result) {


    const container =
        document.getElementById(
            "steps"
        );


    container.innerHTML = "";


    result.steps.forEach(
        (step, index) => {


            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "step";


            div.innerHTML = `

                <div class="step-title">

                    Step ${index + 1}:
                    ${step.title}

                </div>


                <div class="step-text">

                    ${step.text}

                </div>

            `;


            container.appendChild(
                div
            );

        }
    );

}


/* ============================================================
   TEST STRING
============================================================ */

async function testString() {


    if (!currentDFA) {

        showError(
            "Convert the NFA first."
        );

        return;

    }


    const test =
        document
            .getElementById(
                "testString"
            )
            .value
            .trim();


    const response =
        await fetch(
            "/test-string",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        transitions:
                            currentDFA.transitions,

                        start_state:
                            currentDFA.start_state,

                        final_states:
                            currentDFA.final_states,

                        test:
                            test

                    })

            }
        );


    const result =
        await response.json();


    const box =
        document.getElementById(
            "testResult"
        );


    box.classList.remove(
        "hidden",
        "accepted",
        "rejected"
    );


    if (result.accepted) {


        box.classList.add(
            "accepted"
        );


        box.innerHTML = `

            ✓ STRING ACCEPTED (${result.message || ""})

            <br><br>

            Path:

            ${result.path.join(
                " → "
            )}

        `;


    } else {


        box.classList.add(
            "rejected"
        );


        box.innerHTML = `

            ✗ STRING REJECTED (${result.message || ""})

            <br><br>

            Path:

            ${(result.path || []).join(
                " → "
            )}

        `;

    }

}


/* ============================================================
   EXPORT DFA / JFLAP (.jff)
============================================================ */

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportDFAJson() {
    if (!currentDFA) {
        showError("Convert an NFA first before exporting.");
        return;
    }
    const payload = {
        states: currentDFA.states,
        alphabet: currentDFA.alphabet,
        start_state: currentDFA.start_state,
        final_states: currentDFA.final_states,
        transitions: currentDFA.transitions
    };
    downloadFile("converted_dfa.json", JSON.stringify(payload, null, 2), "application/json");
}

function exportJFLAP(kind = "dfa") {
    if (!currentDFA) {
        showError("Convert an NFA first before exporting to JFLAP.");
        return;
    }
    if (kind === "nfa" && currentDFA.nfa_jff) {
        downloadFile("input_nfa.jff", currentDFA.nfa_jff, "application/xml");
    } else if (currentDFA.dfa_jff) {
        downloadFile("converted_dfa.jff", currentDFA.dfa_jff, "application/xml");
    }
}


/* ============================================================
   SAMPLE
============================================================ */

function loadSample(type = "standard") {

    const container =
        document.getElementById(
            "transitionContainer"
        );

    container.innerHTML = "";

    if (type === "epsilon") {
        document.getElementById("states").value = "q0,q1,q2";
        document.getElementById("alphabet").value = "0,1";
        document.getElementById("startState").value = "q0";
        document.getElementById("finalStates").value = "q2";

        const epsSample = [
            ["q0", "ε", "q1"],
            ["q0", "0", "q0"],
            ["q1", "1", "q1"],
            ["q1", "ε", "q2"],
            ["q2", "0", "q2"]
        ];
        epsSample.forEach(([from, symbol, to]) => {
            addTransition(from, symbol, to);
        });
        return;
    }


    document.getElementById(
        "states"
    ).value =
        "q0,q1,q2";


    document.getElementById(
        "alphabet"
    ).value =
        "0,1";


    document.getElementById(
        "startState"
    ).value =
        "q0";


    document.getElementById(
        "finalStates"
    ).value =
        "q2";


    const sample = [

        ["q0", "0", "q0"],

        ["q0", "0", "q1"],

        ["q0", "1", "q0"],

        ["q1", "1", "q2"]

    ];


    sample.forEach(
        ([from, symbol, to]) => {
            addTransition(from, symbol, to);
        }
    );

}


/* ============================================================
   ERRORS
============================================================ */

function showError(message) {


    const box =
        document.getElementById(
            "errorBox"
        );


    box.textContent =
        message;


    box.classList.remove(
        "hidden"
    );

}


function hideError() {


    document
        .getElementById(
            "errorBox"
        )
        .classList.add(
            "hidden"
        );

}

