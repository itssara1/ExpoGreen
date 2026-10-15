<div align="center">

<img src="docs/assets/expogreen-banner.gif" alt="ExpoGreen: identify, sort, confirm and grow. Animated plant in green, violet and gold." width="1000">


# ExpoGreen · فرز

### One item. The right bin. A growing impact.

A smart recycling experience combining **computer vision**, **QR tickets**, and **connected bins**.

<img alt="Python" src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white">
<img alt="Django" src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white">
<img alt="PyTorch" src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white">
<img alt="ESP32" src="https://img.shields.io/badge/ESP32-USB_Serial-6B5B80?style=for-the-badge">
<img alt="Arabic and English visitor interface" src="https://img.shields.io/badge/Interface-AR_%2F_EN-39846A?style=for-the-badge">

[Experience](#visitor-experience) · [Features](#features) · [Quick start](#quick-start) · [Hardware](#esp32-integration) · [العربية](#نبذة-بالعربية)

</div>

---

<a id="about-the-project"></a>

## 🌿 About the project

ExpoGreen turns waste sorting into a guided, rewarding visitor experience. Built as a sustainability prototype for the Expo 2030 context, it connects a camera-based classifier to a disposal workflow: identify an item, select its bin, confirm disposal, and record the visitor's contribution.

Every eligible completed session earns **10 points**. A shared **Impact Tree** gives participation a visible presence through leaves carrying visitors' names.

For staff, a separate operations dashboard brings together recorded bin conditions, collection points, and collection rounds.

| For visitors | For operations teams |
| --- | --- |
| Scan a QR ticket and start sorting | View recorded bin fill levels |
| Follow live camera instructions | Identify bins that need collection |
| Watch the selected bin animate | Build and track collection rounds |
| Earn points after confirmation | Manage stations through Django Admin |

<details>
<summary><strong>A closer look at the Impact Tree artwork</strong></summary>

<br>

<img src="static/images/saudi-tree.png" alt="Impact Tree artwork used in the visitor interface" width="420">

*Project artwork. Participant names are added dynamically by the application.*

</details>

> **Project status:** hackathon prototype with software simulation and an ESP32 USB integration path. Tickets are project-issued; official Expo ticketing and commercial reward redemption are outside the current implementation.

<a id="visitor-experience"></a>

## 🎫 Visitor experience

1. **Issue a ticket:** enter a name to generate a unique ticket number and downloadable QR image.
2. **Scan to participate:** the kiosk validates the ticket and opens the recognition camera automatically.
3. **Hold one item steady:** instructions and a progress indicator guide the visitor while the server checks consecutive predictions.
4. **Use the selected bin:** hardware mode queues an opening request and waits for the device's sensor-ready event.
5. **Complete disposal:** a matching disposal event completes the session and awards **10 points** when eligible.
6. **See the impact:** the shared tree displays names of visitors with rewarded completed sessions.

Visitors can also choose **quick disposal**: use the mixed-waste bin without a ticket, camera classification, or points.

<a id="features"></a>

## ✨ Features

### Visitor application

- Unique QR tickets associated with visitor names.
- Browser-based QR scanning with jsQR.
- Automatic camera startup after ticket validation.
- Server-side image classification using a pretrained Vision Transformer.
- Consecutive-prediction checks before selecting a bin.
- Separate guided sorting and quick-disposal flows.
- Points ledger with one reward entry per disposal session.
- Shared Impact Tree with participant names and contribution counts.
- Animated bin visualization driven by classification and session state.
- Arabic/English switching on the shared visitor interface, including RTL/LTR layout.
- Responsive layouts and reduced-motion handling.

### Staff operations

- Staff-only dashboard and Django administration.
- Collection points with conceptual map coordinates.
- Recorded fill levels and status indicators:
  - **Normal:** below 70%.
  - **Warning:** 70–89%.
  - **Full:** 90–100%.
- Manual fill-level updates and emptying acknowledgements.
- Suggested or manually selected collection routes.
- Route lifecycle: draft → active → completed.
- Route completion blocked while stops remain pending.

**Current scope:** fill levels are updated manually through the dashboard. The USB bridge reports disposal events; it does not stream fill percentages. Maps are conceptual illustrations, and route ordering uses fullness priority followed by approximate map proximity, rather than road routing.

<a id="see-the-sorting-happen"></a>

## ♻️ See the sorting happen

The final section of the camera and session pages visualizes the sorting station:

| Moment | On-screen experience |
| --- | --- |
| Identifying | Bins stay closed while the visitor holds the item steady |
| Stable classification | The matching bin is highlighted |
| Waiting for disposal | The selected lid opens in the illustration |
| Completed session | An item-drop animation plays and the lid closes |
| Failed or expired session | The illustration resets and displays the session message |

**Simulation mode** displays plastic, metal, paper/cardboard, and mixed-waste bins. **Hardware mode** displays the two supported physical categories: plastic and mixed waste.

The animation follows the application state. It does not independently confirm a physical lid position or sensor event, and it never awards points by itself. In software simulation, the visitor still uses the disposal-confirmation button.

<a id="technology"></a>

## 🧩 Technology

| Layer | Implementation |
| --- | --- |
| Backend | Python, Django |
| Database | SQLite, Django ORM |
| Interface | Django Templates, HTML, CSS, JavaScript |
| Computer vision | PyTorch, Hugging Face Transformers, Pillow |
| QR tickets | Python qrcode, jsQR |
| Browser camera | getUserMedia, Canvas |
| Browser/server communication | Fetch, multipart image uploads, JSON status polling |
| Hardware bridge | pySerial, Django management command |
| Prototype controller | ESP32 with compatible servo/sensor firmware |
| Impact Tree | SVG, image assets, JavaScript, CSS animations |
| Interface preferences | LocalStorage; SessionStorage for animation state |

Exact Python dependencies are listed in [requirements.txt](requirements.txt). The committed project was developed with Python 3.13.7 and declares Django 6.1.2.

<a id="classification-model"></a>

## 👁️ Classification model

**Model:** [yangy50/garbage-classification](https://huggingface.co/yangy50/garbage-classification)

The application loads a pretrained **Vision Transformer (ViT)** through `AutoImageProcessor` and `AutoModelForImageClassification`. It performs local server-side inference with PyTorch, caches the loaded model within each process, and returns the top three predictions.

The model recognizes six labels: `cardboard`, `glass`, `metal`, `paper`, `plastic`, and `trash`.

According to the publisher's model card, its dataset contains **2,467 images**, training ran for **10 epochs** using Adam, and reported test accuracy is **95%**. These are publisher-reported results, not an independently measured accuracy for ExpoGreen's live camera environment. The model was integrated pretrained; this repository does not contain a training pipeline.

### Live decision rules

A candidate must meet all of these conditions:

- Supported label for the current mode.
- Top prediction score of at least **85%**.
- At least **20 percentage points** between the first and second predictions.
- At least **4 consecutive qualifying readings** spanning **3 seconds**.
- A recent candidate when finalization is requested.

These thresholds are prototype heuristics. Confidence and repeated agreement do not guarantee that a material was identified correctly.

| Model label | Simulation mapping | Physical prototype |
| --- | --- | --- |
| plastic | Plastic | Bin 1 |
| metal | Aluminum category | Unsupported; mixed-waste option offered |
| paper / cardboard | Paper | Unsupported; mixed-waste option offered |
| glass / trash | No automatic sorting finalization | Mixed-waste option offered |

The `metal` mapping is an application category mapping; the model does not specifically distinguish aluminum from other metals. The application uses computer vision, not an LLM.

<a id="quick-start"></a>

## 🚀 Quick start

### 1. Clone and install

Windows PowerShell:

```powershell
git clone https://github.com/itssara1/ExpoGreen.git
cd ExpoGreen
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Repository access is required while the project is private.

### 2. Choose simulation mode

For a software-only demonstration, edit `config/settings.py`:

```python
HARDWARE_SIMULATION = True
```

The repository currently defaults to simulation mode. No ESP32 is required for this mode; disposal is confirmed using the simulation button.

### 3. Create the database and administrator

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open [http://localhost:8000/admin/](http://localhost:8000/admin/) and sign in.

### 4. Configure bins

Migrations create the schema, but do not seed bin records. Add these through **Bins** in Django Admin:

| Name | station | waste_type | Example hardware_id | Available |
| --- | --- | --- | --- | --- |
| Plastic | main | plastic | BIN-01 | Yes |
| Mixed waste | main | mixed | BIN-05 | Yes |

To exercise additional simulation categories, also add `aluminum`, `paper`, and `non_recyclable` bins at station `main`, each with a unique hardware ID.

Physical bin numbers are selected by waste type in `recycling/hardware.py`; a mixed bin's database hardware ID does not have to be `BIN-02`.

For the operations dashboard, create active **Collection points** and link bins to them. Set conceptual X/Y positions between 0 and 100. For example, a zone code such as `sustainability-01` is recognized by the current zone grouping logic. Unassigned bins remain visible separately.

### 5. Try the visitor journey

- Open [http://localhost:8000/tickets/new/](http://localhost:8000/tickets/new/).
- Enter a visitor name and display the QR on another screen or print it.
- Open [http://localhost:8000/](http://localhost:8000/) on the kiosk device.
- Allow camera access, scan the ticket, and hold one item inside the frame.
- In simulation mode, complete the displayed simulated disposal confirmation.
- Check the updated points balance and shared tree.

> **First run:** The first model request downloads weights and preprocessing files from Hugging Face. Allow time for this initial download. Later requests reuse the local cache. The QR reader is loaded from jsDelivr, so that CDN must also be reachable.

Use `localhost` or HTTPS for camera access. Opening the site over a plain HTTP LAN IP may allow ticket issuance, but browser camera access can be unavailable.

<a id="esp32-integration"></a>

## 🔌 ESP32 integration

The current physical mapping is:

| Physical bin | Purpose | Reward |
| --- | --- | --- |
| 1 | Classified plastic | 10 points after confirmed disposal |
| 2 | Quick mixed-waste disposal | No points |

Compatible firmware must be flashed separately. **ESP32 firmware is not included in the current repository.**

1. Connect the ESP32 to the same computer running the Django bridge.
2. Identify its actual serial port.
3. Close Arduino Serial Monitor and Serial Plotter.
4. Configure `config/settings.py`:

```python
HARDWARE_SIMULATION = False
HARDWARE_STATION = "main"
HARDWARE_SERIAL_PORT = "COM4"  # Replace with the device's actual port.
```

Run Django in one terminal:

```powershell
python manage.py runserver
```

Run a single bridge instance for the station in another activated terminal:

```powershell
python manage.py run_hardware --port COM4
```

The bridge uses **115200 baud** and checks for `PONG` before processing queued jobs.

### Serial protocol

Commands are newline-terminated:

```text
PING
OPEN,<session-uuid>,<bin-number>
```

| Incoming message | Application behavior |
| --- | --- |
| PONG | Connection handshake succeeds |
| ACCEPTED,uuid,bin | Request acknowledged |
| OPENED,uuid,bin | Hardware job marked opened |
| ARMED,uuid,bin | Session moves to waiting for disposal |
| DISPOSED,uuid,bin | Session completes; eligible points awarded |
| EXPIRED,uuid,bin | Session expires without reward |
| BUSY / ERROR | Matching job fails or bridge stops, depending on message |

Events must match the active session UUID and physical bin number. `OPENED` is a firmware report, not independent proof of the lid's physical position. Rewarding happens after `DISPOSED`, not when an opening command is sent.

If the bridge is interrupted, it does not automatically resend an unfinished opening command. Inspect/reset the device before restarting. Hardware behavior must be verified on the assembled prototype; the presence of integration code alone does not establish a successful physical test.

<a id="project-structure"></a>

## 🗂️ Project structure

| Path | Responsibility |
| --- | --- |
| `config/` | Django settings and root URL configuration |
| `recycling/models.py` | Visitors, bins, disposal sessions, rewards, hardware jobs, collection routes |
| `recycling/services.py` | Transactional disposal lifecycle and reward rules |
| `recycling/classifier.py` | Model loading and image inference |
| `recycling/hardware.py` | Job creation and serial event handling |
| `recycling/management/commands/run_hardware.py` | USB bridge process |
| `recycling/views.py` | Visitor flow, classification endpoints, staff operations |
| `recycling/context_processors.py` | Shared Impact Tree participant data |
| `recycling/migrations/` | Database schema history |
| `templates/` | Active Django page templates |
| `static/` | Styles, scripts, fonts, and illustrations |

The active live camera template is `templates/recycling/live_test.html`. Root ZIP archives and the extra `recycling/live_test.html` file are not the configured template source.

### Core data relationships

- A **Visitor** can have multiple **DisposalSessions**.
- A session selects one **Bin** and can have one **PointEntry** and one **HardwareJob**.
- A **CollectionPoint** groups bins.
- A **CollectionRoute** contains ordered **RouteStops**, each linked to a bin.

Disposal status progresses through `started → classified → waiting → completed`, with `expired` and `failed` terminal alternatives. Transactions and a one-to-one reward relation prevent repeated confirmation from issuing a second reward for the same session.

<a id="main-pages-and-endpoints"></a>

## 🧭 Main pages and endpoints

| Path | Purpose |
| --- | --- |
| `/` | Scan a ticket or choose quick disposal |
| `/tickets/new/` | Issue a visitor ticket |
| `/tickets/ready/` | Show the issued QR ticket |
| `/live/` | Guided live camera |
| `/live/classify/` | POST an image frame for classification |
| `/live/finalize/` | POST to finalize a stable classification |
| `/session/` | Disposal status and results |
| `/session/status/` | JSON status polling |
| `/test-model/` | Manual image classification test |
| `/ops/dashboard/` | Staff collection dashboard |
| `/admin/` | Django administration |

Visitor flow endpoints use the browser's Django session. State-changing forms and camera requests use CSRF protection. Operations views require staff access.

<a id="verification-and-prototype-scope"></a>

## 🔎 Verification and prototype scope

Useful checks after installation:

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
python manage.py test
```

The current `recycling/tests.py` is a placeholder; the test command is not evidence of automated feature coverage.

Before a demo, manually verify ticket issuance/scanning, stable classification, quick disposal, single reward issuance, device timeout behavior, and staff route completion.

Current prototype boundaries:

- Only plastic and mixed waste are connected by the two-bin hardware mapping.
- A disposal sensor confirms passage, not the material's identity.
- No independent field accuracy benchmark is included.
- Fill percentages are manually maintained; they are separate from disposal detection.
- Collection maps and suggested routes are conceptual.
- Points are recorded locally; commercial reward redemption is not implemented.
- Visitor pages support language switching; the standalone operations dashboard is currently Arabic.
- The Impact Tree aggregates rewarded participants and renders a limited number of leaves.
- Settings currently target local development. Public deployment requires production configuration, including secret management, `DEBUG=False`, allowed hosts, HTTPS, and static-file serving.

<a id="acknowledgements"></a>

## 🤝 Acknowledgements

- Classification model: [yangy50/garbage-classification](https://huggingface.co/yangy50/garbage-classification).
- QR decoding: [jsQR](https://github.com/cozmo/jsQR).
- Arabic typography: Thmanyah Sans; source and licensing references are documented in [static/fonts/README.md](static/fonts/README.md).

<a id="نبذة-بالعربية"></a>

## 🌱 نبذة بالعربية

**فرز — ExpoGreen** نموذج أولي يجمع التذاكر الرقمية والتصنيف البصري والحاويات المتصلة، لتشجيع الزائر على فرز مخلفاته. يمسح الزائر تذكرته، ويعرض المخلف على الكاميرا، ثم تُحدَّد الحاوية وتُضاف النقاط بعد تأكيد الرمي. ويتيح خيار التخلص السريع استخدام الحاوية المختلطة دون نقاط.

يتضمن المشروع شجرة أثر بأسماء المشاركين ولوحة تشغيل للموظفين لمتابعة نسب الامتلاء المسجّلة وتنظيم مسارات الجمع. يدعم النموذج المادي الحالي حاويتين: البلاستيك والمختلط، بينما تبقى نسب الامتلاء والخريطة ومسارات الجمع ضمن نطاق النموذج الأولي الموضّح أعلاه.
