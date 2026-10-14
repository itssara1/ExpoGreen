(() => {
    "use strict";

    const storageKey = "expogreen-language";
    let language = "ar";

    try {
        language = localStorage.getItem(storageKey) === "en" ? "en" : "ar";
    } catch {
        language = "ar";
    }

    function translateElements() {
        document.querySelectorAll("[data-en]").forEach((node) => {
            if (!node.hasAttribute("data-ar")) {
                node.dataset.ar = node.textContent.trim();
            }

            const text = language === "en"
                ? node.dataset.en
                : node.dataset.ar;

            if (node.textContent !== text) {
                node.textContent = text;
            }
        });

        const attributes = [
            ["data-en-aria", "data-ar-aria", "aria-label"],
            ["data-en-alt", "data-ar-alt", "alt"],
            ["data-en-placeholder", "data-ar-placeholder", "placeholder"],
        ];

        for (const [enAttribute, arAttribute, target] of attributes) {
            document.querySelectorAll(`[${enAttribute}]`).forEach((node) => {
                if (!node.hasAttribute(arAttribute)) {
                    node.setAttribute(
                        arAttribute,
                        node.getAttribute(target) || ""
                    );
                }

                node.setAttribute(
                    target,
                    node.getAttribute(
                        language === "en" ? enAttribute : arAttribute
                    )
                );
            });
        }
    }

    function setText(node, arabic, english) {
        if (!node) return;

        node.dataset.ar = arabic;
        node.dataset.en = english;
        node.textContent = language === "en" ? english : arabic;
    }

    function applyLanguage(nextLanguage) {
        language = nextLanguage === "en" ? "en" : "ar";

        document.documentElement.lang = language;
        document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

        translateElements();

        document.querySelectorAll("[data-language]").forEach((button) => {
            const active = button.dataset.language === language;

            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        try {
            localStorage.setItem(storageKey, language);
        } catch {
            // يستمر تبديل اللغة عندما لا يتاح التخزين.
        }

        document.dispatchEvent(new CustomEvent(
            "expogreen:languagechange",
            { detail: { language } }
        ));
    }

    window.ExpoGreen = {
        setText,
        get language() {
            return language;
        },
    };

    document.querySelectorAll("[data-language]").forEach((button) => {
        button.addEventListener("click", () => {
            applyLanguage(button.dataset.language);
        });
    });

    applyLanguage(language);
})();