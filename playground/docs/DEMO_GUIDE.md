# Demo Guide — Clinical Trial Risk Monitor

Step-by-step walkthrough for presenting the dashboard to judges, stakeholders, or evaluators.

---

## Before You Start

1. Open `dashboard.html` in **Chrome**, **Firefox**, or **Edge**.
2. Keep this guide open in a second tab or printed beside you.
3. Estimated presentation time: **8–10 minutes** for the full tour, **4–5 minutes** for a focused demo.

---

## Step 1 — Login as FDA Auditor (1 min)

Start with the FDA view to show the full picture first.

1. On the login screen, click the **FDA Login** tab.
2. Click the quick-demo button: **🏛 Login as FDA Auditor (full access)**
   - Or manually enter `auditor@fda.gov` / `fda2025`
3. The topbar updates to **"FDA Regulatory View — All Hospitals"**.
4. The sidebar shows a new **Hospital Audit** item (hidden for hospital users).

**What to say:**  
> "The FDA auditor sees every hospital, every patient, every CAPA — with a full immutable audit trail. Hospital staff only ever see their own region."

---

## Step 2 — Dashboard Overview (1 min)

The dashboard loads automatically with 12 seed patients across 6 NYC regions.

Point out the **4 KPI cards**:
- **Total Monitored Patients** — 12
- **Critical Triage Alerts** — number of patients with score ≥ 65
- **Active Outbreaks** — regions with risk score ≥ 70
- **High-Risk Zones** — regions with risk score ≥ 40

Point out **Severity Distribution** bars and **Top Suspected Diagnoses** (ICD-10 frequency).

Scroll to **Critical Triage Alerts** — click **View Detail** on a critical patient.

In the modal, show:
- Flagged vitals (red boxes)
- Rule engine flags (vital + lab)
- Differential diagnosis matches with composite scores
- Clinical action plan and diagnostic orders

**What to say:**  
> "Every patient is scored 0–100 using vital signs, lab results, and disease matching. Critical patients get an immediate action plan — ICU alert, physician notification, isolation protocol."

---

## Step 3 — Protocol Deviation Detector (2 min) ★ Core Feature

Click **Protocol Deviations** in the sidebar.

Point out the **Trial context banner** at the top:
> "5,000+ patient visits across 200+ sites — this monitor runs in real time before the FDA audit."

Point out the **4 KPI cards**: Major, Minor, Administrative deviations, and Patients Flagged.

Point out the **Protocol Specification panel** — banned co-meds, visit windows, dose thresholds.

Scroll to the **Protocol Deviation Registry**. Show at least one of each class:

**Major — Banned Co-Medication (PT-011):**
> "PT-011 has warfarin in their pre-existing conditions. Warfarin is on the banned co-medication list for this trial. The system flags it as a Major deviation — requiring immediate CAPA, sponsor and IRB notification within 24–72 hours."

**Major — Dosing Threshold Violation:**
> "Several patients were flagged because their SpO₂ was below 94% or their temperature exceeded 38°C — the protocol prohibits dosing outside those windows."

**Minor — Missed Visit Window (PT-012):**
> "PT-012's onset was 20 days ago with no lab results recorded. The Day 0 and Week 2 protocol visit windows have both been missed. Each window generates its own named deviation — not a single generic flag."

Click **CAPA-Ready Report** → download the JSON. Open it and show the `deviations` and `capaActions` arrays.

**What to say:**  
> "This JSON file goes straight to the sponsor or CRO. Every deviation has its ICH reference, recommended mitigation, and required timeline. No manual reporting — it's one click."

---

## Step 4 — Site Risk Monitor (1.5 min) ★ Core Feature

Click **Site Risk Monitor** in the sidebar.

Point out the **4 KPI cards**: High-Risk Sites, Moderate-Risk Sites, Total Sites, Open Site CAPAs.

Point out the **Leading Indicator Framework** panel explaining the 4 indicators.

Show a **HIGH-risk site card**:
- 4 indicator bars (deviation rate, critical concentration, velocity, CAPA overdue rate)
- Composite site risk score / 100
- Major / minor deviation counts
- **Recommended Actions** box (red):
  > "Trigger on-site audit within 72 hours · Escalate all open CAPAs to sponsor · Freeze enrolment · File FDA Form 3500A if SAE confirmed"

**What to say:**  
> "This is what risk managers asked for — real-time visibility into which sites will fail the FDA audit. The score is built from leading indicators, not lagging outcomes. You act before the problem escalates."

---

## Step 5 — ICH E6 GCP Classifier (1 min)

Click **ICH E6 GCP** in the sidebar.

Point out the **4 KPI cards**: SAE (Grade 4–5), Severe (Grade 3), Moderate (Grade 2), Mild (Grade 1).

Point out the **CTCAE Grading Reference** table — show reporting timelines (24h for Grade 5, 7d for Grade 4, 15d for Grade 3).

Click on a **Grade 4** patient card:
- Show the SAE badge
- Show the 8 CTCAE criteria checklist (met vs unmet)
- Show the Regulatory Obligation panel: `"SAE — Mandatory Expedited Report"`
- Show the autonote: `"Sponsor/IRB notification required within 7 days. CAPA investigation mandatory."`

**What to say:**  
> "Every patient is auto-graded using CTCAE criteria. Grade 4 and 5 are Serious Adverse Events — the system tells you exactly who to notify, what to file, and by when."

---

## Step 6 — CAPA Module (1 min)

Click **CAPA** in the sidebar.

Point out the **4 KPI cards**: Open, In Progress, Closed, Overdue.

Scroll to the **CAPA Registry**. Show an auto-generated CAPA (labelled `auto-generated from triage severity`):
- Status badge (Open / In Progress)
- GCP Grade tag
- Due date (colour-coded red if overdue)
- Root cause from critical vital flags
- Click **View Timeline** — shows creation → assignment history

Show the **Audit Trail** panel at the bottom:
- Immutable log of every action
- Timestamp, user, event type, detail

**What to say:**  
> "No deviation is ever silently dropped. The CAPA module is ICH E6 §8 compliant — the audit trail is immutable and timestamped. An FDA inspector can walk through every action taken on every patient."

---

## Step 7 — Switch to Hospital View (1 min)

Click **Sign Out** in the top right.

On the login screen, click **Hospital Login** and use the **Manhattan North** quick-demo button.

Notice:
- Topbar now says **"Manhattan North — Disease & Symptom Dashboard"**
- Patient Monitor shows **only Manhattan North patients**
- Protocol Deviations and Site Risk show only that region's data
- **Add Patient** nav item appears; **Hospital Audit** is hidden

Click **Add Patient**:
- Fill in a few fields (Age: 55, Gender: M, Region: Manhattan North, ZIP: 10001, Temp: 39.2, SpO₂: 91, HR: 115, BP: 85/60, Onset: today)
- Select symptoms: fever, shortness of breath, confusion
- Click **Add Patient & Run Analysis**

Show the live result panel — severity badge, score, flags, action.

Navigate back to **Protocol Deviations** — the new patient's deviations appear immediately.

**What to say:**  
> "Hospital staff can only see their own patients. When they add a patient, triage, deviations, CAPAs, and reminders are all generated in real time. The FDA auditor would immediately see this patient in their cross-hospital view."

---

## Optional: Deeper Features (if time allows)

### Regional Risk / Heatmap
- Click **Regional Risk** — show the heatmap and the velocity ratio column
- Explain outbreak trigger at risk score ≥ 70

### Containment Alerts
- Click **Containment Alerts** — show automated public health actions for triggered regions

### Reminders
- Click **Reminders** — show pre-admission and post-treatment reminders auto-generated per patient
- Mark one as Sent — audit log updates

### Reports & Export
- Click **Reports & Export**
- Export Public Health Report (JSON) — show the `regionalBreakdown` and `icdCodeFrequency` fields
- Export Patient Case Log (CSV)

---

## Likely Jury Questions

**Q: Why a single HTML file?**  
A: Zero deployment friction — any clinical site can open it. No server, no install, no IT dependency. In a real deployment you'd add authentication middleware and a real GraphQL backend behind it.

**Q: How would this scale to 200+ real sites?**  
A: The GraphQL fetch layer is already wired in. Point `GRAPHQL_ENDPOINT` at a real API, and the pipeline processes whatever the API returns. The analysis functions are O(n) — 5,000 patients would run in under a second in the browser.

**Q: Is the audit trail truly immutable?**  
A: In this demo it is append-only in memory. In production you would persist it to a write-once store (e.g. an append-only database table or a blockchain audit log) and sign each entry.

**Q: How do you handle false positives in deviation detection?**  
A: Each rule has explicit thresholds matching the published protocol spec. Major deviations require physician confirmation before CAPA closure — the status workflow (Open → In Progress → Closed) is the human-in-the-loop gate.

**Q: Can the protocol spec be updated without code changes?**  
A: The `PROTOCOL_SPEC` constant in `dashboard.html` is the single source of truth. In a production build you would serve it from a config endpoint — the rule evaluation functions read from it dynamically.
