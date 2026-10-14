const video = document.getElementById("live-video");
const canvas = document.getElementById("live-canvas");
const config = document.getElementById("camera-config");
const message = document.getElementById("live-message");
const result = document.getElementById("live-result");
const progress = document.getElementById("scan-progress");
const retry = document.getElementById("retry-camera");

const labels = {
    plastic: "بلاستيك",
    metal: "معادن",
    paper: "ورق",
    cardboard: "كرتون",
};

const csrfToken = config.querySelector(
    "[name=csrfmiddlewaretoken]"
).value;

let stream = null;
let running = false;
let timer = null;
let startedAt = 0;
let controller = null;

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
        throw new Error(data.error || "تعذر إكمال العملية.");
    }

    return data;
}

async function analyze() {
    if (!running) return;

    try {
        if (Date.now() - startedAt > 45000) {
            throw new Error(
                "لم نتعرف بوضوح. غيّر زاوية المخلف وأعد المحاولة."
            );
        }

        if (!video.videoWidth || !video.videoHeight) {
            timer = setTimeout(analyze, 500);
            return;
        }

        // Analyze only the middle square shown by the frame.
        const side = Math.min(
            video.videoWidth, video.videoHeight
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
        if (!blob) throw new Error("تعذر تجهيز لقطة الكاميرا.");

        const body = new FormData();
        body.append("image", blob, "frame.jpg");

        const prediction = await post(config.dataset.url, body);
        if (!running) return;

        progress.value = prediction.count;
        message.textContent = prediction.message;

        if (prediction.stable) {
            // Freeze the result: no further classification requests.
            running = false;
            result.textContent =
                `تم التعرف: ${labels[prediction.label]}`;
            message.textContent = "جاري تحديد الحاوية...";

            const final = await post(
                config.dataset.finalize,
                new FormData()
            );

            stopCamera();
            window.location.assign(final.redirect);
            return;
        }

        result.textContent = prediction.count > 0
            ? "ثبّت المخلف"
            : "ارفع المخلف داخل الإطار";

        timer = setTimeout(analyze, 800);
    } catch (error) {
        if (error.name === "AbortError") return;

        stopCamera();
        message.textContent = error.message;
        retry.hidden = false;
    }
}

async function start() {
    stopCamera();
    retry.hidden = true;
    progress.value = 0;
    result.textContent = "ارفع المخلف داخل الإطار";
    message.textContent = "جاري تشغيل الكاميرا...";

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
    } catch (error) {
        stopCamera();
        message.textContent =
            "تعذر تشغيل الكاميرا. تأكد من السماح باستخدامها.";
        retry.hidden = false;
    }
}

retry.addEventListener("click", () => window.location.reload());
window.addEventListener("pagehide", stopCamera);

start();