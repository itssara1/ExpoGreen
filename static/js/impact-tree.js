(() => {
    "use strict";

    const namespace = "http://www.w3.org/2000/svg";
    const container = document.getElementById("tree-leaves");

    if (!container) return;

    function readJson(id, fallback) {
        try {
            const node = document.getElementById(id);
            return node ? JSON.parse(node.textContent) : fallback;
        } catch {
            return fallback;
        }
    }

    const data = readJson("tree-data", []);
    const leaves = Array.isArray(data) ? data : [];
    const newVisitor = readJson("tree-new-visitor", null);

    const positions = [
        [300, 115], [218, 146], [382, 146],
        [146, 193], [260, 204], [340, 204], [455, 193],
        [100, 253], [192, 262], [300, 273], [405, 262], [505, 253],
        [121, 326], [233, 330], [361, 330], [473, 326],
        [160, 396], [269, 397], [382, 397], [478, 398],
        [220, 461], [332, 464], [113, 452], [431, 463],
    ];

    const angles = [
        -12, -24, 22, -20, -8, 10, 22,
        -15, -18, 0, 18, 15,
        -12, -8, 8, 12,
        -16, -6, 12, 18,
        -12, 8, -18, 15,
    ];

    const colors = ["#426b52", "#376e65", "#665176", "#75613b"];
    const descriptions = [];
    const storageKey = "expogreen-tree-arrivals";

    let animated = [];

    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
        animated = Array.isArray(saved) ? saved : [];
    } catch {
        animated = [];
    }

    const newId = newVisitor == null ? null : String(newVisitor);
    let animationAdded = false;

    function element(tag, attributes = {}) {
        const node = document.createElementNS(namespace, tag);

        for (const [key, value] of Object.entries(attributes)) {
            node.setAttribute(key, String(value));
        }

        return node;
    }

    function shortName(name) {
        const parts = typeof Intl.Segmenter === "function"
            ? Array.from(
                new Intl.Segmenter(undefined, {
                    granularity: "grapheme",
                }).segment(name),
                (part) => part.segment
            )
            : Array.from(name);

        return parts.length > 11
            ? `${parts.slice(0, 10).join("")}…`
            : name;
    }

    function updateDescriptions() {
        const english = document.documentElement.lang === "en";

        descriptions.forEach(({ person, leaf, title }) => {
            const count = Math.max(0, Number(person.contributions) || 0);
            const description = english
                ? `${person.name} — ${count} contributions`
                : `${person.name} — عدد المشاركات: ${count}`;

            title.textContent = description;
            leaf.setAttribute("aria-label", description);
        });
    }

    container.replaceChildren();

    leaves.slice(0, positions.length).forEach((person, index) => {
        if (!person || typeof person !== "object") return;

        const name = String(person.name || "").trim();
        if (!name) return;

        const [x, y] = positions[index];
        const isNew = newId !== null
            && String(person.id) === newId
            && !animated.includes(newId);

        const holder = element("g", {
            transform: `translate(${x} ${y})`,
        });

        const leaf = element("g", {
            class: isNew
                ? "participant-leaf new-leaf"
                : "participant-leaf",
            role: "img",
        });

        if (isNew) animationAdded = true;

        const title = element("title");
        leaf.appendChild(title);

        const artwork = element("g", {
            transform: `rotate(${angles[index]})`,
            "aria-hidden": "true",
        });

        artwork.appendChild(element("path", {
            d: "M-49 5Q-44 2-39 0",
            fill: "none",
            stroke: "#7a8069",
            "stroke-width": "2",
            "stroke-linecap": "round",
        }));

        artwork.appendChild(element("path", {
            d: "M-44 0C-27-25 8-25 44 0C22 23-15 27-44 0Z",
            fill: colors[index % colors.length],
            stroke: "#f5f6ef",
            "stroke-width": "1.5",
        }));

        artwork.appendChild(element("path", {
            d: "M-34 0Q0-3 33 0M-17-1L-7-13M3-1L14-13M-7 0L4 13M15 0L25 9",
            fill: "none",
            stroke: "#fff",
            "stroke-opacity": ".14",
            "stroke-width": "1",
        }));

        leaf.appendChild(artwork);

        const text = element("text", {
            x: "0",
            y: "1",
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            class: "leaf-name",
            direction: /[\u0600-\u06ff]/.test(name) ? "rtl" : "ltr",
        });

        text.style.unicodeBidi = "plaintext";
        text.textContent = shortName(name);

        leaf.appendChild(text);
        holder.appendChild(leaf);
        container.appendChild(holder);

        descriptions.push({ person, leaf, title });
    });

    if (animationAdded) {
        animated.push(newId);

        try {
            sessionStorage.setItem(
                storageKey,
                JSON.stringify(animated.slice(-100))
            );
        } catch {
            // لا يؤثر فشل التخزين على عرض الشجرة.
        }
    }

    updateDescriptions();
    document.addEventListener(
        "expogreen:languagechange",
        updateDescriptions
    );
})();