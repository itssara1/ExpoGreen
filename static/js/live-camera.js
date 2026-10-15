(() => {
    "use strict";

    const video = document.getElementById("live-video");
    const canvas = document.getElementById("live-canvas");
    const config = document.getElementById("camera-config");
    const message = document.getElementById("live-message");
    const result = document.getElementById("live-result");
    const progress = document.getElementById("scan-progress");
    const retry = document.getElementById("retry-camera");

    const csrfToken = config.querySelector(
        "[name=csrfmiddlewaretoken]"
    ).value;

    const labels = {
        plastic: ["بلاستيــــك", "Plastic"],
        metal: ["معــــادن", "Metal"],
        paper: ["ورق", "Paper"],
        cardboard: ["كرتــــون", "Cardboard"],
    };

    let stream = null;
    let running = false;
    let timer = null;
    let startedAt = 0;
    let controller = null;

    function visualize(label, phase) {
        document.dispatchEvent(new CustomEvent("expogreen:classification", {
            detail: { label, phase },
        }));
    }

    function say(node, arabic, english) {
        window.ExpoGreen.setText(node, arabic, english);
    }

    function failure(arabic, english) {
        const error = new Error(arabic);
        error.english = english;
        return error;
    }

    function stopCamera() {
        running = false;
        clearTimeout(timer);
        controller?.abort();
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        video.srcObject = null;
    }

    async function post(url, body) {
        controller = new AbortController();

        const response = await fetch(url, {
            method: "POST",
            headers: { "X-CSRFToken": csrfToken },
            body,
            signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
            throw failure(
                data.error || "تعذر إكمال العملية. حاول مجددًا.",
                "Unable to complete the session. Please try again."
            );
        }

        return data;
    }

    async function analyze() {
        if (!running) return;

        try {
            if (Date.now() - startedAt > 45000) {
                throw failure(
                    "لم نتعرف بوضوح. غيّر زاوية المخلف وأعد المحاولة.",
                    "We could not identify your item. Adjust its angle and retry."
                );
            }

            if (!video.videoWidth || !video.videoHeight) {
                timer = setTimeout(analyze, 500);
                return;
            }

            const side = Math.min(
                video.videoWidth,
                video.videoHeight
            ) * 0.65;

            const left = (video.videoWidth - side) / 2;
            const top = (video.videoHeight - side) / 2;

            canvas.width = 384;
            canvas.height = 384;

            canvas.getContext("2d").drawImage(
                video,
                left, top, side, side,
                0, 0, 384, 384
            );

            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, "image/jpeg", 0.9);
            });

            if (!running) return;

            if (!blob) {
                throw failure(
                    "تعذر قراءة الكاميرا. أعد المحاولة.",
                    "Unable to read the camera. Please retry."
                );
            }

            const body = new FormData();
            body.append("image", blob, "frame.jpg");

            const prediction = await post(config.dataset.url, body);
            if (!running) return;
            if (prediction.unsupported) {
    visualize("", "unsupported");
    progress.value = 0;

    say(
        result,
        "هذه التجربة مخصصة للبلاستيك",
        "This demo supports plastic only"
    );

    say(
        message,
        "للمخلفات الأخرى، اختاري الحاوية المختلطة بدون نقاط.",
        "For other items, use the mixed-waste option without points."
    );

    timer = setTimeout(analyze, 800);
    return;
}

            progress.value = prediction.count || 0;

            if (prediction.stable) {
                visualize(prediction.label, "selected");
                running = false;

                const label = labels[prediction.label] || [
                    prediction.label,
                    prediction.label,
                ];

                say(
                    result,
                    `المخــــلف: ${label[0]}`,
                    `Item: ${label[1]}`
                );

                say(
                    message,
                    "جارٍ تحديد الحــــاوية…",
                    "Selecting your bin…"
                );

                const final = await post(
                    config.dataset.finalize,
                    new FormData()
                );

                stopCamera();
                window.location.assign(final.redirect);
                return;
            }

            if (prediction.count > 0) {
                visualize("", "scanning");
                say(
                    result,
                    "ثبّت المخــــلف",
                    "Hold your item steady"
                );

                say(
                    message,
                    "ابقَ ثابتًا قليلًا حتى يكتمل التعــــرّف.",
                    "Keep the item steady until identification is complete."
                );
            } else {
                visualize("", "started");
                say(
                    result,
                    "ضع المخلف داخل الإطــــار",
                    "Place your item inside the frame"
                );

                say(
                    message,
                    "قرّب المخلف وضعه في إضاءة أوضــــح.",
                    "Move your item closer and into better lighting."
                );
            }

            timer = setTimeout(analyze, 800);
        } catch (error) {
            if (error.name === "AbortError") return;

            visualize("", "failed");

            stopCamera();

            say(
                message,
                error.english
                    ? error.message
                    : "تعذر الاتصال. تحقق من الاتصال وأعد المحاولة.",
                error.english
                    || "Connection failed. Check your connection and retry."
            );

            retry.hidden = false;
        }
    }

    async function start() {
        stopCamera();
        retry.hidden = true;
        progress.value = 0;

        say(
            result,
            "ضع المخلف داخل الإطــــار",
            "Place your item inside the frame"
        );

        say(
            message,
            "جارٍ تشغيل الكاميــــرا…",
            "Starting the camera…"
        );

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            video.srcObject = stream;
            await video.play();

            running = true;
            startedAt = Date.now();
            analyze();
        } catch {
            stopCamera();

            say(
                message,
                "تعذر تشغيل الكاميرا. تأكد من السماح باستخدامها.",
                "Unable to start the camera. Please allow camera access."
            );

            retry.hidden = false;
        }
    }

    retry.addEventListener("click", () => window.location.reload());
    window.addEventListener("pagehide", stopCamera);

    document.getElementById("mixed-disposal-form")
    ?.addEventListener("submit", stopCamera);

    start();
})();
