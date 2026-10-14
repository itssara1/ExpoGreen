const leaves = JSON.parse(
    document.getElementById("tree-data").textContent
);

const newVisitor = JSON.parse(
    document.getElementById("tree-new-visitor").textContent
);

const container = document.getElementById("tree-leaves");
const namespace = "http://www.w3.org/2000/svg";

const positions = [
    [300, 115], [218, 146], [382, 146],
    [146, 193], [260, 204], [340, 204], [455, 193],
    [100, 253], [192, 262], [300, 273], [405, 262], [505, 253],
    [121, 326], [233, 330], [361, 330], [473, 326],
    [160, 396], [269, 397], [382, 397], [478, 398],
    [220, 461], [332, 464], [113, 452], [431, 463],
];

const colors = ["#547445", "#398c87", "#7960a3", "#ad8438"];

function element(tag, attributes) {
    const node = document.createElementNS(namespace, tag);

    for (const [key, value] of Object.entries(attributes)) {
        node.setAttribute(key, value);
    }

    return node;
}

leaves.forEach((person, index) => {
    const [x, y] = positions[index];
    const holder = element("g", {
        transform: `translate(${x} ${y})`,
    });

    const leaf = element("g", {
        class: person.id === newVisitor
            ? "participant-leaf new-leaf"
            : "participant-leaf",
        "aria-label":
            `${person.name}، ${person.contributions} مشاركات`,
    });

    const title = element("title", {});
    title.textContent =
        `${person.name} — ${person.contributions} مشاركات`;

    leaf.appendChild(title);

    leaf.appendChild(element("path", {
        d: "M-45 0 Q-18-40 45 0 Q18 40-45 0Z",
        fill: colors[index % colors.length],
        stroke: "#ffffff",
        "stroke-width": "2",
    }));

    const text = element("text", {
        x: "0",
        y: "1",
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "leaf-name",
        direction: "rtl",
    });

    text.textContent = person.name.length > 10
        ? `${person.name.slice(0, 9)}…`
        : person.name;

    leaf.appendChild(text);
    holder.appendChild(leaf);
    container.appendChild(holder);
});