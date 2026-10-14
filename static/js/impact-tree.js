(() => {
    "use strict";

    const ns = "http://www.w3.org/2000/svg";
    const layer = document.getElementById("tree-leaves");

    if (!layer) return;

    function readData(id, fallback) {
        try {
            const value = document.getElementById(id)?.textContent;
            return JSON.parse(value || "null") ?? fallback;
        } catch {
            return fallback;
        }
    }

    const participants = readData("tree-data", []);
    const newVisitorId = readData("tree-new-visitor", null);
    const leafUrl = window.EXPOGREEN_LEAF_URL;

    if (!leafUrl || !Array.isArray(participants)) return;

    // x, y, rotation, scale
    // مواقع أنعم وأكثر تناسقًا مع شكل الشجرة الحالية
    const anchors = [
        [305, 310, -16, 0.82],
        [765, 315, 18, 0.82],
        [402, 238, 8, 0.72],
        [632, 240, -10, 0.72],
        [220, 425, -18, 0.76],
        [864, 430, 19, 0.76],
        [338, 505, 12, 0.78],
        [748, 510, -12, 0.78],
        [205, 620, -18, 0.74],
        [867, 622, 18, 0.74],
        [470, 405, -8, 0.68],
        [610, 412, 10, 0.68],
        [126, 555, -10, 0.68],
        [952, 556, 14, 0.68],
        [385, 640, 8, 0.72],
        [698, 648, -12, 0.72],
        [282, 742, -14, 0.70],
        [822, 742, 16, 0.70],
        [478, 742, -5, 0.64],
        [627, 760, 12, 0.64]
    ];

    function createSVG(tag, attrs = {}) {
        const node = document.createElementNS(ns, tag);

        Object.entries(attrs).forEach(([key, value]) => {
            node.setAttribute(key, String(value));
        });

        return node;
    }

    function shortenName(name) {
        const letters =
            typeof Intl.Segmenter === "function"
                ? Array.from(
                    new Intl.Segmenter("ar", {
                        granularity: "grapheme"
                    }).segment(name),
                    item => item.segment
                )
                : Array.from(name);

        return letters.length > 10
            ? letters.slice(0, 9).join("") + "…"
            : name;
    }

    let seen = [];

    try {
        seen = JSON.parse(
            sessionStorage.getItem("expo-natural-leaves-seen") || "[]"
        );
    } catch {
        seen = [];
    }

    if (!Array.isArray(seen)) seen = [];

    const rendered = [];
    layer.replaceChildren();

    participants.slice(0, anchors.length).forEach((person, index) => {
        if (!person || !String(person.name || "").trim()) return;

        const [x, y, rotation, scale] = anchors[index];
        const name = String(person.name).trim();

        const isNew =
            newVisitorId !== null &&
            String(person.id) === String(newVisitorId) &&
            !seen.includes(String(newVisitorId));

        const anchor = createSVG("g", {
            transform: `translate(${x} ${y}) rotate(${rotation}) scale(${scale})`
        });

        const leaf = createSVG("g", {
            class: `visitor-leaf-group${isNew ? " new-leaf" : ""}`,
            role: "img",
            tabindex: "0"
        });

        leaf.append(createSVG("image", {
            href: leafUrl,
            x: -78,
            y: -52,
            width: 156,
            height: 106,
            preserveAspectRatio: "xMidYMid meet",
            filter: "url(#visitorLeafShadow)"
        }));

        // الاسم مباشرة على الورقة - بدون خلفية
        const label = createSVG("text", {
            x: 0,
            y: 0,
            class: "natural-leaf-name",
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            direction: /[\u0600-\u06FF]/.test(name) ? "rtl" : "ltr"
        });

        label.textContent = shortenName(name);

        if (Array.from(name).length > 7) {
            label.setAttribute("textLength", "78");
            label.setAttribute("lengthAdjust", "spacingAndGlyphs");
        }

        leaf.append(label);

        const tooltip = createSVG("title");
        tooltip.textContent = name;
        leaf.prepend(tooltip);

        anchor.append(leaf);
        layer.append(anchor);

        rendered.push({ person, leaf, tooltip });
    });

    function updateLanguage() {
        const english = document.documentElement.lang === "en";

        rendered.forEach(({ person, leaf, tooltip }) => {
            const description = english
                ? `${person.name}, ${person.contributions} contributions`
                : `${person.name}، عدد المشاركات: ${person.contributions}`;

            tooltip.textContent = description;
            leaf.setAttribute("aria-label", description);
        });
    }

    updateLanguage();
    document.addEventListener("expogreen:languagechange", updateLanguage);

    if (
        newVisitorId !== null &&
        rendered.some(
            item => String(item.person.id) === String(newVisitorId)
        )
    ) {
        seen.push(String(newVisitorId));

        try {
            sessionStorage.setItem(
                "expo-natural-leaves-seen",
                JSON.stringify(seen.slice(-100))
            );
        } catch {
            // تجاهل
        }
    }
})();