from django.db import transaction
from django.utils import timezone

from config import settings

from .models import Bin, DisposalSession, PointEntry, Visitor, WasteType


REWARD_POINTS = 10
REWARD_TYPES = {
    WasteType.PLASTIC,
    WasteType.ALUMINUM,
    WasteType.PAPER,
}


def start_session(ticket_code=None, quick=False):
    if quick:
        return DisposalSession.objects.create(
            mode=DisposalSession.Mode.QUICK,
        )

    ticket_code = (ticket_code or "").strip()

    if not ticket_code:
        raise ValueError("Ticket code is required.")

    # Demo tickets must already exist in our database.
    visitor = Visitor.objects.get(ticket_code=ticket_code)

    return DisposalSession.objects.create(
        visitor=visitor,
        mode=DisposalSession.Mode.SORT,
    )


@transaction.atomic
def select_bin(session_id, waste_type):
    session = DisposalSession.objects.select_for_update().get(
        pk=session_id
    )

    if session.status != DisposalSession.Status.STARTED:
        raise ValueError("This session has already been processed.")

    if session.mode == DisposalSession.Mode.QUICK:
        waste_type = WasteType.MIXED

    if waste_type not in WasteType.values:
        raise ValueError("Invalid waste type.")

    station = getattr(settings, "HARDWARE_STATION", "main")

    selected_bin = Bin.objects.get(
    station=station,
    waste_type=waste_type,
    is_available=True,
    )
    session.detected_waste = waste_type
    session.bin = selected_bin
    session.status = DisposalSession.Status.CLASSIFIED
    session.save(
        update_fields=["detected_waste", "bin", "status"]
    )

    return session


@transaction.atomic
def mark_bin_opened(session_id):
    session = DisposalSession.objects.select_for_update().get(
        pk=session_id
    )

    if session.status == DisposalSession.Status.WAITING:
        return session

    if session.status != DisposalSession.Status.CLASSIFIED:
        raise ValueError("The session is not ready to open a bin.")

    session.status = DisposalSession.Status.WAITING
    session.save(update_fields=["status"])

    return session


@transaction.atomic
def confirm_disposal(session_id, hardware_id):
    session = (
        DisposalSession.objects
        .select_for_update()
        .select_related("bin")
        .get(pk=session_id)
    )

    if session.bin is None:
        raise ValueError("No bin has been selected.")

    if session.bin.hardware_id != hardware_id:
        raise ValueError("Confirmation came from the wrong bin.")

    # Repeated sensor messages do not award points again.
    if session.status == DisposalSession.Status.COMPLETED:
        return session

    if session.status != DisposalSession.Status.WAITING:
        raise ValueError("The session is not waiting for disposal.")

    session.status = DisposalSession.Status.COMPLETED
    session.disposal_confirmed_at = timezone.now()
    session.save(
        update_fields=["status", "disposal_confirmed_at"]
    )

    if (
        session.mode == DisposalSession.Mode.SORT
        and session.visitor_id is not None
        and session.detected_waste in REWARD_TYPES
    ):
        PointEntry.objects.get_or_create(
            session=session,
            defaults={"points": REWARD_POINTS},
        )

    return session