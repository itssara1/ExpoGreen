from django.conf import settings
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_http_methods

from .models import Bin, DisposalSession, Visitor, WasteType
from .services import (
    confirm_disposal,
    mark_bin_opened,
    select_bin,
    start_session,
)


@require_http_methods(["GET", "POST"])
def home(request):
    error = None

    if request.method == "POST":
        mode = request.POST.get("mode")

        if mode not in {"sort", "quick"}:
            error = "اختاري طريقة التخلص من المخلف."
        else:
            try:
                session = start_session(
                    ticket_code=request.POST.get("ticket_code"),
                    quick=(mode == "quick"),
                )
            except Visitor.DoesNotExist:
                error = "التذكرة غير موجودة."
            except ValueError:
                error = "أدخلي كود التذكرة أولًا."
            else:
                request.session["disposal_session_id"] = str(session.id)
                return redirect("recycling:session_detail")

    return render(request, "recycling/home.html", {"error": error})


@require_http_methods(["GET", "POST"])
def session_detail(request):
    session_id = request.session.get("disposal_session_id")

    if not session_id:
        return redirect("recycling:home")

    session = get_object_or_404(DisposalSession, pk=session_id)
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

                session = confirm_disposal(
                    session.id,
                    session.bin.hardware_id,
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

    reward = 0

    if session.status == DisposalSession.Status.COMPLETED:
        entry = session.point_entry if hasattr(session, "point_entry") else None
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