(() => {
    "use strict";
    const root = document.querySelector("[data-bin-visualization]");
    if (!root) return;
    const bins = [...root.querySelectorAll("[data-bin-kind]")];
    const status = root.querySelector(".bin-viz-status");
    const mapping = {plastic: "plastic", metal: "aluminum", aluminum: "aluminum",
        paper: "paper", cardboard: "paper", mixed: "mixed"};
    function text(node, ar, en) {
        if (window.ExpoGreen) window.ExpoGreen.setText(node, ar, en);
        else { node.dataset.ar = ar; node.dataset.en = en; node.textContent = ar; }
    }
    function render({label = "", phase = "started"} = {}) {
        const kind = mapping[label];
        const selected = bins.find(bin => bin.dataset.binKind === kind);
        for (const bin of bins) {
            const active = bin === selected && ["selected", "classified", "waiting", "completed"].includes(phase);
            bin.classList.toggle("is-selected", active);
            bin.classList.toggle("is-open", active && phase === "waiting");
            bin.classList.toggle("is-completed", active && phase === "completed");
            text(bin.querySelector(".visual-bin-state"),
                active ? (phase === "waiting" ? "مفتوحة في الرسم" : phase === "completed" ? "اكتملت العملية" : "الحاوية المختارة") : "مغلقة",
                active ? (phase === "waiting" ? "Open in illustration" : phase === "completed" ? "Completed" : "Selected bin") : "Closed");
        }
        const messages = {
            started: ["بعد التعرّف، تظهر الحاوية المناسبة هنا.", "Your bin appears here after identification."],
            scanning: ["ثبّت المخلف، نتحقق من نوعه…", "Hold steady while we identify your item…"],
            selected: ["تم التعرّف. جارٍ اعتماد الحاوية…", "Item identified. Confirming your bin…"],
            classified: ["تم اختيار الحاوية. بانتظار جاهزية العملية.", "Bin selected. Waiting for the session to be ready."],
            waiting: ["الحاوية المختارة مفتوحة في المحاكاة المرئية.", "The selected bin is open in the visual simulation."],
            completed: ["اكتملت العملية. هذا تمثيل مرئي للرمي.", "Session completed. This is a visual disposal illustration."],
            unsupported: ["هذا النوع غير متاح للفرز هنا. يمكنك اختيار المختلط دون نقاط.", "This item is not supported here. You can choose mixed waste without points."],
            failed: ["تعذّر اعتماد الحاوية. أعد المحاولة من البداية.", "The bin could not be confirmed. Start again."],
            expired: ["انتهت مهلة العملية.", "This session has expired."]
        };
        const message = messages[phase] || messages.started;
        text(status, ...message);
    }
    document.addEventListener("expogreen:classification", event => render(event.detail));
    render({label: root.dataset.waste, phase: root.dataset.status});
})();
