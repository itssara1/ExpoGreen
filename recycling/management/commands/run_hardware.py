import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from recycling.hardware import fail_job, handle_event
from recycling.models import HardwareJob


class Command(BaseCommand):
    help = "Connect Django to SmartBin over USB."

    def add_arguments(self, parser):
        parser.add_argument("--port")

    def handle(self, *args, **options):
        try:
            import serial
        except ImportError as error:
            raise CommandError(
                "Install pyserial first."
            ) from error

        port = options["port"] or getattr(
            settings,
            "HARDWARE_SERIAL_PORT",
            "",
        )

        if not port:
            raise CommandError(
                "Connect ESP32, then specify --port COM4 "
                "using its actual port."
            )

        station = getattr(
            settings,
            "HARDWARE_STATION",
            "main",
        )

        unfinished = list(
            HardwareJob.objects.filter(
                station=station,
                state__in=["sent", "opened", "armed"],
            )
        )

        if unfinished:
            for job in unfinished:
                fail_job(
                    job.pk,
                    "Bridge interrupted. Command not resent.",
                )

            raise CommandError(
                "Previous session interrupted. "
                "Inspect/reset the device, then run again. "
                "No OPEN command was resent."
            )

        active_id = None

        try:
            with serial.Serial(
                port,
                baudrate=115200,
                timeout=0.2,
                write_timeout=2,
            ) as device:
                # USB connection may restart the board.
                deadline = time.monotonic() + 7
                next_ping = time.monotonic() + 2
                ready = False

                while time.monotonic() < deadline:
                    if time.monotonic() >= next_ping:
                        device.write(b"PING\n")
                        next_ping = time.monotonic() + 1

                    line = (
                        device.readline()
                        .decode("utf-8", errors="replace")
                        .strip()
                    )

                    if line == "PONG":
                        ready = True
                        break

                if not ready:
                    raise CommandError(
                        "No PONG received. Check port, "
                        "firmware, and close Serial Monitor."
                    )

                self.stdout.write(
                    self.style.SUCCESS(
                        "SmartBin connected. Waiting for sessions."
                    )
                )

                started = 0

                while True:
                    if active_id is None:
                        job = (
                            HardwareJob.objects
                            .filter(
                                station=station,
                                state="queued",
                            )
                            .order_by("created_at")
                            .first()
                        )

                        if job:
                            age = (
                                timezone.now() - job.created_at
                            ).total_seconds()

                            if age > 60:
                                fail_job(
                                    job.pk,
                                    "Request expired before connection.",
                                )
                                continue

                            claimed = (
                                HardwareJob.objects
                                .filter(
                                    pk=job.pk,
                                    state="queued",
                                )
                                .update(
                                    state="sent",
                                    sent_at=timezone.now(),
                                )
                            )

                            if claimed:
                                active_id = job.pk

                                command = (
                                    f"OPEN,{job.session_id},"
                                    f"{job.bin_number}\n"
                                )

                                device.write(
                                    command.encode("ascii")
                                )

                                started = time.monotonic()

                                self.stdout.write(
                                    command.strip()
                                )

                    line = (
                        device.readline()
                        .decode("utf-8", errors="replace")
                        .strip()
                    )

                    if line:
                        self.stdout.write(line)

                        if (
                            active_id
                            and line == "READY,SMARTBIN_USB"
                        ):
                            raise CommandError(
                                "ESP32 restarted during a session."
                            )

                        if (
                            active_id
                            and line.startswith("ERROR,")
                        ):
                            raise CommandError(
                                f"Device rejected command: {line}"
                            )

                        if (
                            active_id
                            and handle_event(active_id, line)
                        ):
                            if line.startswith("BUSY,"):
                                raise CommandError(
                                    "Device busy. Inspect it "
                                    "before restarting."
                                )

                            active_id = None

                    if (
                        active_id
                        and time.monotonic() - started > 60
                    ):
                        raise CommandError(
                            "No final sensor event. "
                            "Inspect the bin and sensor "
                            "before restarting."
                        )

        except KeyboardInterrupt:
            self.stdout.write("Bridge stopped.")

        except (
            serial.SerialException,
            OSError,
            ValueError,
        ) as error:
            raise CommandError(str(error)) from error

        finally:
            if active_id:
                fail_job(
                    active_id,
                    "Connection interrupted. "
                    "Inspect hardware before retrying.",
                )