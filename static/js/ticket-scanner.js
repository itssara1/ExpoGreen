const scanButton = document.getElementById("scan-ticket");
const scanner = document.getElementById("ticket-scanner");
const video = document.getElementById("ticket-video");
const canvas = document.getElementById("ticket-canvas");
const message = document.getElementById("ticket-message");
const ticketForm = document.getElementById("ticket-form");
const ticketInput = document.getElementById("scanned-ticket");
const quickForm = document.getElementById("quick-form");

let stream = null;
let scanning = false;
let timer = null;

function stopCamera() {
    scanning = false;
    clearTimeout(timer);

    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }

    video.srcObject = null;
}

function scanFrame() {
    if (!scanning) return;

    try {
        if (video.videoWidth && video.videoHeight) {
            const scale = Math.min(1, 800 / video.videoWidth);

            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);

            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });

            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const pixels = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const code = jsQR(
                pixels.data,
                pixels.width,
                pixels.height
            );

            if (code) {
                const value = code.data.trim();

                if (value && value.length <= 100) {
                    message.textContent =
                        "تم المسح، جاري التحقق من التذكرة...";

                    ticketInput.value = value;
                    stopCamera();
                    ticketForm.requestSubmit();
                    return;
                }

                message.textContent =
                    "الرمز غير صالح. استخدم تذكرة المشروع.";
            }
        }

        timer = setTimeout(scanFrame, 200);
    } catch (error) {
        stopCamera();
        scanButton.disabled = false;
        message.textContent =
            "تعذر قراءة البث. اضغط مسح التذكرة لإعادة المحاولة.";
        console.error(error);
    }
}

scanButton.addEventListener("click", async () => {
    scanButton.disabled = true;
    scanner.hidden = false;
    message.textContent = "جاري تشغيل ماسح التذكرة...";

    try {
        if (typeof jsQR !== "function") {
            throw new Error(
                "مكتبة QR لم تتحمل. تأكد من اتصال الإنترنت وحدّث الصفحة."
            );
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "الكاميرا غير متاحة. افتح الموقع من localhost أو HTTPS."
            );
        }

        stopCamera();

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

        scanning = true;
        message.textContent =
            "ضع رمز QR أمام الكاميرا وثبّته حتى تتم قراءته.";

        scanFrame();
    } catch (error) {
        stopCamera();
        scanButton.disabled = false;

        if (error.name === "NotAllowedError") {
            message.textContent =
                "اسمح باستخدام الكاميرا من إعدادات الموقع في المتصفح.";
        } else if (error.name === "NotFoundError") {
            message.textContent = "لم يتم العثور على كاميرا.";
        } else if (error.name === "NotReadableError") {
            message.textContent =
                "الكاميرا مشغولة. أغلق التطبيقات أو التبويبات التي تستخدمها.";
        } else {
            message.textContent =
                error.message || "تعذر تشغيل ماسح التذكرة.";
        }

        console.error(error);
    }
});

quickForm.addEventListener("submit", stopCamera);
window.addEventListener("pagehide", stopCamera);