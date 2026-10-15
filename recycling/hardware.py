from django.conf import settings
from django.db import IntegrityError, transaction

from .models import DisposalSession, HardwareJob, WasteType
from .services import (
    confirm_disposal,
    mark_bin_opened,
    select_bin,
)


ACTIVE_STATES = (
    "queued",
    "sent",
    "opened",
    "armed",
)

BIN_NUMBERS = {
    WasteType.PLASTIC: 1,
    WasteType.MIXED: 2,
}


def select_for_hardware(session_id, waste_type):
    if waste_type not in BIN_NUMBERS:
        raise ValueError("Unsupported hardware bin.")

    try:
        with transaction.atomic():
            session = select_bin(session_id, waste_type)

            HardwareJob.objects.create(
                session=session,
                bin_number=BIN_NUMBERS[waste_type],
                station=getattr(
                    settings,
                    "HARDWARE_STATION",
                    "main",
                ),
            )

            return session

    except IntegrityError as error:
        raise ValueError(
            "Station busy. Finish the current session first."
        ) from error


def fail_job(job_id, reason):
    with transaction.atomic():
        job = (
            HardwareJob.objects
            .select_for_update()
            .get(pk=job_id)
        )

        if job.state not in ACTIVE_STATES:
            return

        job.state = "failed"
        job.error = reason[:250]
        job.save(update_fields=["state", "error"])

        DisposalSession.objects.filter(
            pk=job.session_id,
            status__in=[
                DisposalSession.Status.CLASSIFIED,
                DisposalSession.Status.WAITING,
            ],
        ).update(
            status=DisposalSession.Status.FAILED
        )


def handle_event(job_id, line):
    parts = line.strip().split(",")

    if len(parts) != 3:
        return False

    event, session_id, bin_number = parts

    with transaction.atomic():
        job = (
            HardwareJob.objects
            .select_for_update()
            .select_related("session__bin")
            .get(pk=job_id)
        )

        # Ignore messages belonging to another session or bin.
        if (
            session_id != str(job.session_id)
            or bin_number != str(job.bin_number)
        ):
            return False

        if job.state not in ACTIVE_STATES:
            return False

        if event == "ACCEPTED":
            return False

        if event == "OPENED":
            if job.state == "sent":
                job.state = "opened"
                job.save(update_fields=["state"])

            return False

        if event == "ARMED":
            if job.state in ("sent", "opened"):
                # Show disposal instructions only after sensor readiness.
                mark_bin_opened(job.session_id)

                job.state = "armed"
                job.save(update_fields=["state"])

            return False

        if event == "DISPOSED":
            if job.state != "armed":
                raise ValueError(
                    "Disposal received before sensor readiness."
                )

            confirm_disposal(
                job.session_id,
                job.session.bin.hardware_id,
            )

            job.state = "completed"
            job.save(update_fields=["state"])

            return True

        if event == "EXPIRED":
            DisposalSession.objects.filter(
                pk=job.session_id,
                status__in=[
                    DisposalSession.Status.CLASSIFIED,
                    DisposalSession.Status.WAITING,
                ],
            ).update(
                status=DisposalSession.Status.EXPIRED
            )

            job.state = "expired"
            job.save(update_fields=["state"])

            return True

        if event in ("BUSY", "ERROR"):
            fail_job(job.pk, line)
            return True

    return False