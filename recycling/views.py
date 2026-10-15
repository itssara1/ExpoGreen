import logging
import time

from PIL import Image, UnidentifiedImageError

from django.conf import settings
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import (
    require_GET,
    require_http_methods,
    require_POST,
)

from .classifier import classify_image
from .forms import ImageTestForm
from .models import Bin, DisposalSession, Visitor, WasteType
from .services import (
    confirm_disposal,
    mark_bin_opened,
    select_bin,
    start_session,
)

import base64
import uuid
from io import BytesIO

import qrcode

from .forms import TicketCreateForm
from .hardware import select_for_hardware

logger = logging.getLogger(__name__)


@require_http_methods(["GET", "POST"])
def home(request):
    error = None
    simulation = getattr(
        settings,
        "HARDWARE_SIMULATION",
        False,
    )

    if request.method == "POST":
        mode = request.POST.get("mode")
        ticket_code = request.POST.get(
            "ticket_code",
            "",
        ).strip()

        if mode not in {"sort", "quick"}:
            error = "اختاري مسح التذكرة أو التخلص بدون نقاط."

        elif mode == "sort" and len(ticket_code) > 100:
            error = "رمز التذكرة غير صالح."

        else:
            try:
                session = start_session(
                    ticket_code=ticket_code,
                    quick=(mode == "quick"),
                )

                if mode == "quick" and not simulation:
                    try:
                        session = select_for_hardware(
                            session.id,
                            WasteType.MIXED,
                        )

                    except (ValueError, Bin.DoesNotExist):
                        session.status = (
                            DisposalSession.Status.FAILED
                        )
                        session.save(update_fields=["status"])
                        raise ValueError(
                            "Mixed bin unavailable."
                        )

            except Visitor.DoesNotExist:
                error = "التذكرة غير موجودة في النظام."

            except ValueError:
                error = (
                    "تعذر بدء العملية. تأكدي من التذكرة "
                    "وتوفّر الحاوية وانتهاء العملية السابقة."
                )

            else:
                request.session["disposal_session_id"] = str(
                    session.id
                )
                request.session.pop("live_candidate", None)

                if mode == "sort":
                    return redirect("recycling:live_test")

                return redirect("recycling:session_detail")

    return render(
        request,
        "recycling/home.html",
        {"error": error},
    )


@require_http_methods(["GET", "POST"])
def session_detail(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return redirect("recycling:home")

    session = get_object_or_404(
        DisposalSession.objects.select_related("visitor", "bin"),
        pk=session_id,
    )
    error = None
    simulation = getattr(settings, "HARDWARE_SIMULATION", False)

    if request.method == "POST":
        if not simulation:
            return HttpResponseForbidden("Simulation is disabled.")

        action = request.POST.get("action")

        try:
            if action == "classify":
                session = select_bin(
                    session.id,
                    request.POST.get("waste_type", ""),
                )

            elif action == "open":
                session = mark_bin_opened(session.id)

            elif action == "confirm":
                if session.bin is None:
                    raise ValueError("No bin selected.")

                was_completed = (
                    session.status
                    == DisposalSession.Status.COMPLETED
                )

                session = confirm_disposal(
                    session.id,
                    session.bin.hardware_id,
                )

                entry = getattr(session, "point_entry", None)

                if (
                    not was_completed
                    and session.visitor_id
                    and entry
                    and entry.points > 0
                ):
                    request.session["tree_new_visitor"] = (
                        session.visitor_id
                    )

            else:
                raise ValueError("Invalid action.")

        except Bin.DoesNotExist:
            error = "الحاوية المطلوبة غير متاحة حاليًا."

        except ValueError:
            error = "الإجراء غير مناسب لحالة العملية الحالية."

        else:
            return redirect("recycling:session_detail")

        session.refresh_from_db()


        if session.status == DisposalSession.Status.COMPLETED:
            entry = getattr(session, "point_entry", None)

        if (
            request.session.get("tree_seen_session")
            != str(session.id)
            and session.visitor_id
            and entry
            and entry.points > 0
        ):
            request.session["tree_new_visitor"] = (
                session.visitor_id
            )
            request.session["tree_seen_session"] = str(
                session.id
            )
    reward = 0

    if session.status == DisposalSession.Status.COMPLETED:
        entry = getattr(session, "point_entry", None)
        reward = entry.points if entry else 0

    return render(
        request,
        "recycling/session_detail.html",
        {
            "session": session,
            "error": error,
            "simulation": simulation,
            "waste_types": WasteType.choices,
            "reward": reward,
        },
    )


@require_http_methods(["GET", "POST"])
def classifier_test(request):
    if request.method == "POST":
        form = ImageTestForm(request.POST, request.FILES)
    else:
        form = ImageTestForm()

    predictions = None
    error = None

    if request.method == "POST" and form.is_valid():
        try:
            predictions = classify_image(
                form.cleaned_data["image"]
            )
        except (
            UnidentifiedImageError,
            Image.DecompressionBombError,
            OSError,
            ValueError,
        ):
            error = "تعذر قراءة الصورة. جربي صورة JPG أو PNG واضحة وأصغر."
        except Exception:
            logger.exception("Classifier test failed.")
            error = "تعذر تشغيل الموديل. راجعي الخطأ في التيرمنال."

    return render(
        request,
        "recycling/classifier_test.html",
        {
            "form": form,
            "predictions": predictions,
            "error": error,
        },
    )


@require_GET
def live_test(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return redirect("recycling:home")

    session = get_object_or_404(
        DisposalSession.objects.select_related("visitor"),
        pk=session_id,
    )

    if (
        session.mode != DisposalSession.Mode.SORT
        or session.status != DisposalSession.Status.STARTED
    ):
        return redirect("recycling:session_detail")

    request.session.pop("live_candidate", None)

    return render(
        request,
        "recycling/live_test.html",
        {
            "session": session,
            "simulation": getattr(
                settings,
                "HARDWARE_SIMULATION",
                False,
            ),
        },
    )


@require_POST
def live_classify(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return JsonResponse(
            {"error": "ابدئي من صفحة التذكرة."},
            status=400,
        )

    session = get_object_or_404(
        DisposalSession,
        pk=session_id,
    )

    if (
        session.mode != DisposalSession.Mode.SORT
        or session.status != DisposalSession.Status.STARTED
    ):
        return JsonResponse(
            {"error": "هذه العملية ليست جاهزة للتصنيف."},
            status=409,
        )

    form = ImageTestForm(request.POST, request.FILES)

    if not form.is_valid():
        request.session.pop("live_candidate", None)

        return JsonResponse(
            {"error": "تعذر قراءة لقطة الكاميرا."},
            status=400,
        )

    try:
        predictions = classify_image(
            form.cleaned_data["image"]
        )
    except Exception:
        request.session.pop("live_candidate", None)
        logger.exception("Live classification failed.")

        return JsonResponse(
            {"error": "تعذر تشغيل التصنيف. راجعي التيرمنال."},
            status=503,
        )

    top = predictions[0]
    if (
        not getattr(settings, "HARDWARE_SIMULATION", False)
        and top["label"] != "plastic"
    ):
        request.session.pop("live_candidate", None)

        return JsonResponse({
            "stable": False,
            "count": 0,
            "unsupported": True,
            "message": (
                "النموذج الحالي يدعم البلاستيك فقط. "
                "يمكنك استخدام التخلص بدون نقاط."
            ),
        })
    gap = top["score"] - predictions[1]["score"]
    now = time.monotonic()

    # Initial demo thresholds; require camera testing.
    acceptable = (
        top["label"] in {"plastic", "metal", "paper", "cardboard"}
        and top["score"] >= 85
        and gap >= 20
    )

    if not acceptable:
        request.session.pop("live_candidate", None)

        return JsonResponse({
            "stable": False,
            "count": 0,
            "message": "ارفع المخلف داخل الإطار أو غيّر زاويته.",
        })

    candidate = request.session.get("live_candidate")

    if (
        not candidate
        or candidate["label"] != top["label"]
        or now - candidate["last_seen"] > 10
        or now < candidate["last_seen"]
    ):
        candidate = {
            "label": top["label"],
            "count": 1,
            "started": now,
            "last_seen": now,
        }
    else:
        candidate["count"] += 1
        candidate["last_seen"] = now

    request.session["live_candidate"] = candidate

    stable = (
        candidate["count"] >= 4
        and now - candidate["started"] >= 3
    )

    return JsonResponse({
        "stable": stable,
        "count": min(candidate["count"], 4),
        "message": "ثبّت المخلف… جاري التعرف.",
        "label": top["label"] if stable else None,
    })


@require_POST
def finalize_live(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return JsonResponse(
            {"error": "ابدئي من صفحة التذكرة."},
            status=400,
        )

    session = get_object_or_404(
        DisposalSession,
        pk=session_id,
    )

    if session.status != DisposalSession.Status.STARTED:
        return JsonResponse({
            "redirect": reverse("recycling:session_detail"),
        })

    candidate = request.session.get("live_candidate")
    now = time.monotonic()

    if (
        session.mode != DisposalSession.Mode.SORT
        or not candidate
        or candidate["count"] < 4
        or not 0 <= now - candidate["last_seen"] <= 10
        or candidate["last_seen"] - candidate["started"] < 3
    ):
        return JsonResponse(
            {"error": "النتيجة غير مستقرة. أعيدي المحاولة."},
            status=400,
        )

    simulation = getattr(
        settings,
        "HARDWARE_SIMULATION",
        False,
    )

    waste_mapping = {
        "plastic": WasteType.PLASTIC,
        "metal": WasteType.ALUMINUM,
        "paper": WasteType.PAPER,
        "cardboard": WasteType.PAPER,
    }

    waste_type = waste_mapping.get(candidate["label"])

    if waste_type is None:
        return JsonResponse(
            {"error": "هذا النوع غير مدعوم."},
            status=400,
        )

    if not simulation and waste_type != WasteType.PLASTIC:
        return JsonResponse(
            {
                "error": (
                    "النموذج الحالي يدعم البلاستيك فقط. "
                    "استخدمي التخلص بدون نقاط لباقي المخلفات."
                )
            },
            status=400,
        )

    try:
        if simulation:
            session = select_bin(session.id, waste_type)
            session = mark_bin_opened(session.id)

        else:
            session = select_for_hardware(
                session.id,
                waste_type,
            )

    except Bin.DoesNotExist:
        return JsonResponse(
            {"error": "الحاوية المطلوبة غير متاحة."},
            status=409,
        )

    except ValueError:
        return JsonResponse(
            {
                "error": (
                    "المحطة مشغولة أو تغيّرت حالة العملية. "
                    "انتظري انتهاء العملية الحالية وحاولي مجددًا."
                )
            },
            status=409,
        )

    request.session.pop("live_candidate", None)

    return JsonResponse({
        "redirect": reverse("recycling:session_detail"),
    })



@require_http_methods(["GET", "POST"])
def create_ticket(request):
    if request.method == "POST":
        form = TicketCreateForm(request.POST)

        if form.is_valid():
            # Avoid duplicate tickets when the same form is submitted twice.
            token = request.POST.get("issue_token", "")
            expected = request.session.get("ticket_issue_token")

            if not expected or token != expected:
                return redirect("recycling:create_ticket")

            visitor = Visitor.objects.create(
                name=form.cleaned_data["name"],
                ticket_code=f"EXPO-{uuid.uuid4().hex.upper()}",
            )

            request.session.pop("ticket_issue_token", None)
            request.session["issued_visitor_id"] = visitor.pk

            return redirect("recycling:ticket_ready")
    else:
        form = TicketCreateForm()

    if "ticket_issue_token" not in request.session:
        request.session["ticket_issue_token"] = uuid.uuid4().hex

    return render(
        request,
        "recycling/create_ticket.html",
        {
            "form": form,
            "issue_token": request.session["ticket_issue_token"],
        },
    )


@require_GET
def ticket_ready(request):
    visitor_id = request.session.get("issued_visitor_id")

    if not visitor_id:
        return redirect("recycling:create_ticket")

    visitor = get_object_or_404(Visitor, pk=visitor_id)

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(visitor.ticket_code)
    qr.make(fit=True)

    image = qr.make_image(
        fill_color="black",
        back_color="white",
    )

    buffer = BytesIO()
    image.save(buffer, format="PNG")

    qr_base64 = base64.b64encode(
        buffer.getvalue()
    ).decode("ascii")

    return render(
        request,
        "recycling/ticket_ready.html",
        {
            "visitor": visitor,
            "qr_data_url": f"data:image/png;base64,{qr_base64}",
        },
    )

@require_GET
def session_status(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return JsonResponse(
            {"error": "No active session."},
            status=400,
        )

    session = get_object_or_404(
        DisposalSession,
        pk=session_id,
    )

    response = JsonResponse({
        "status": session.status,
    })
    response["Cache-Control"] = "no-store"

    return response