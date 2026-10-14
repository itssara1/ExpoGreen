(() => {
    "use strict";

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

    const say = (ar, en) => window.ExpoGreen.setText(message, ar, en);

    function stopCamera() {
        scanning = false;
        clearTimeout(timer);
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
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
                    video, 0, 0, canvas.width, canvas.height
                );

                const pixels = context.getImageData(
                    0, 0, canvas.width, canvas.height
                );

                const code = jsQR(
                    pixels.data,
                    pixels.width,
                    pixels.height
                );

                if (code) {
                    const value = code.data.trim();

                    if (value && value.length <= 100) {
                        say(
                            "تم المسح. جارٍ التحقق من التذكــــرة…",
                            "Code scanned. Checking your ticket…"
                        );

                        ticketInput.value = value;
                        stopCamera();
                        ticketForm.requestSubmit();
                        return;
                    }

                    say(
                        "الرمز غير صالح. استخدم تذكرة ExpoGreen.",
                        "Invalid code. Please use your ExpoGreen ticket."
                    );
                }
            }

            timer = setTimeout(scanFrame, 200);
        } catch {
            stopCamera();
            scanButton.disabled = false;

            say(
                "تعذرت القراءة. اضغط مسح التذكرة للمحاولة مجددًا.",
                "Unable to read the code. Select Scan your ticket to retry."
            );
        }
    }

    scanButton.addEventListener("click", async () => {
        scanButton.disabled = true;
        scanner.hidden = false;

        say(
            "جارٍ تشغيل الكاميــــرا…",
            "Starting the camera…"
        );

        try {
            if (typeof jsQR !== "function") {
                say(
                    "تعذر تحميل الماسح. تحقق من الإنترنت وحدّث الصفحة.",
                    "The QR reader did not load. Check your connection and refresh."
                );
                scanButton.disabled = false;
                return;
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                say(
                    "الكاميرا غير متاحة. استخدم localhost أو اتصال HTTPS.",
                    "Camera unavailable. Use localhost or an HTTPS connection."
                );
                scanButton.disabled = false;
                return;
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

            say(
                "ضع رمز التذكرة داخل الإطار وثبّته قليــــلًا.",
                "Hold your ticket QR code steady inside the frame."
            );

            scanFrame();
        } catch (error) {
            stopCamera();
            scanButton.disabled = false;

            if (error.name === "NotAllowedError") {
                say(
                    "اسمح باستخدام الكاميرا من إعدادات المتصفح.",
                    "Allow camera access in your browser settings."
                );
            } else if (error.name === "NotFoundError") {
                say(
                    "لم يتم العثور على كاميــــرا.",
                    "No camera found."
                );
            } else if (error.name === "NotReadableError") {
                say(
                    "الكاميرا مشغولة. أغلق التطبيقات التي تستخدمها.",
                    "Camera busy. Close other apps using it."
                );
            } else {
                say(
                    "تعذر تشغيل الكاميرا. حاول مجــــددًا.",
                    "Unable to start the camera. Please try again."
                );
            }
        }
    });

    quickForm.addEventListener("submit", stopCamera);
    window.addEventListener("pagehide", stopCamera);
})();