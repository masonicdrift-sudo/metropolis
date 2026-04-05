import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useState, useRef } from "react";
import type { IsofacDoc } from "@shared/schema";
import {
  FileText, Plus, Trash2, Edit, Paperclip, X,
  Eye, Shield, AlertTriangle, Target, Map,
  Crosshair, Activity, BookOpen, Save, Upload, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Document type definitions ────────────────────────────────────────────────
const DOC_TYPES = [
  // Orders
  { value: "WARNO",         label: "WARNING ORDER",      icon: Activity,      color: "text-yellow-400",       bg: "bg-yellow-950/20 border-yellow-900/40",  group: "ORDERS" },
  { value: "OPORD",         label: "OPORD",              icon: Crosshair,     color: "text-red-400",          bg: "bg-red-950/20 border-red-900/40",         group: "ORDERS" },
  { value: "FRAGORD",       label: "FRAGORD",            icon: Activity,      color: "text-orange-400",       bg: "bg-orange-950/20 border-orange-900/40",   group: "ORDERS" },
  { value: "OPLAN",         label: "OPLAN",              icon: Map,           color: "text-blue-400",         bg: "bg-blue-950/20 border-blue-900/40",        group: "ORDERS" },
  { value: "CONOP",         label: "CONOP",              icon: Crosshair,     color: "text-orange-400",       bg: "bg-orange-950/20 border-orange-900/40",   group: "ORDERS" },
  // Intelligence
  { value: "IMINT",         label: "IMINT REPORT",       icon: Map,           color: "text-blue-400",         bg: "bg-blue-950/20 border-blue-900/40",        group: "INTEL" },
  { value: "HVT_CARD",      label: "HVT CARD",           icon: Target,        color: "text-red-400",          bg: "bg-red-950/20 border-red-900/40",          group: "INTEL" },
  { value: "INTEL_SUMMARY", label: "INTEL SUMMARY",      icon: AlertTriangle, color: "text-orange-400",       bg: "bg-orange-950/20 border-orange-900/40",    group: "INTEL" },
  { value: "JIPOE",         label: "JIPOE",              icon: Map,           color: "text-purple-400",       bg: "bg-purple-950/20 border-purple-900/40",   group: "INTEL" },
  { value: "COA",           label: "COA DEVELOPMENT",    icon: Crosshair,     color: "text-green-400",        bg: "bg-green-950/20 border-green-900/40",      group: "INTEL" },
  { value: "THREAT_ASSESS", label: "THREAT ASSESSMENT",  icon: AlertTriangle, color: "text-red-400",          bg: "bg-red-950/20 border-red-900/40",          group: "INTEL" },
  { value: "ACE",           label: "ACE / PIR",          icon: AlertTriangle, color: "text-orange-400",       bg: "bg-orange-950/20 border-orange-900/40",    group: "INTEL" },
  // Fires & Support
  { value: "ISR_PLAN",      label: "ISR PLAN",           icon: Eye,           color: "text-purple-400",       bg: "bg-purple-950/20 border-purple-900/40",   group: "SUPPORT" },
  { value: "FIRE_PLAN",     label: "FIRE SUPPORT PLAN",  icon: Target,        color: "text-red-400",          bg: "bg-red-950/20 border-red-900/40",          group: "SUPPORT" },
  { value: "CASEVAC_PLAN",  label: "CASEVAC PLAN",       icon: Shield,        color: "text-green-400",        bg: "bg-green-950/20 border-green-900/40",      group: "SUPPORT" },
  { value: "LOGSTAT",       label: "LOG / CSS PLAN",     icon: Activity,      color: "text-yellow-400",       bg: "bg-yellow-950/20 border-yellow-900/40",   group: "SUPPORT" },
  // Admin & Command
  { value: "ROE",           label: "ROE",                icon: BookOpen,      color: "text-yellow-400",       bg: "bg-yellow-950/20 border-yellow-900/40",   group: "ADMIN" },
  { value: "EPA",           label: "EVASION PLAN (EPA)", icon: Shield,        color: "text-green-400",        bg: "bg-green-950/20 border-green-900/40",      group: "ADMIN" },
  { value: "OPSEC",         label: "OPSEC PLAN",         icon: Shield,        color: "text-yellow-400",       bg: "bg-yellow-950/20 border-yellow-900/40",   group: "ADMIN" },
  { value: "REHEARSAL",     label: "REHEARSAL PLAN",     icon: Activity,      color: "text-blue-400",         bg: "bg-blue-950/20 border-blue-900/40",        group: "ADMIN" },
  { value: "CUSTOM",        label: "CUSTOM DOC",         icon: FileText,      color: "text-muted-foreground", bg: "bg-secondary/50 border-border",            group: "ADMIN" },
];

const DOC_GROUPS = [
  { key: "ORDERS",  label: "ORDERS",          types: ["WARNO","OPORD","FRAGORD","OPLAN","CONOP"] },
  { key: "INTEL",   label: "INTELLIGENCE",    types: ["IMINT","HVT_CARD","INTEL_SUMMARY","JIPOE","COA","THREAT_ASSESS","ACE"] },
  { key: "SUPPORT", label: "FIRES & SUPPORT", types: ["ISR_PLAN","FIRE_PLAN","CASEVAC_PLAN","LOGSTAT"] },
  { key: "ADMIN",   label: "CMD & ADMIN",     types: ["ROE","EPA","OPSEC","REHEARSAL","CUSTOM"] },
];

const CLASSIFICATIONS = ["UNCLASS", "CUI", "SECRET", "TS"];
const STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"];

// ── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES: Record<string, string> = {
WARNO: `WARNING ORDER (WARNO) #___

REFERENCES: 

TIME ZONE: ZULU

TASK ORGANIZATION: [Attached/OPCON units]

1. SITUATION:
  a. Enemy: 
  b. Friendly: 
  c. Attachments/Detachments: 

2. MISSION: [5Ws — Who, What, When, Where, Why]

3. EXECUTION:
  a. Commander's Intent: 
  b. Concept of Operations: 
  c. Tasks to Subordinate Units: 
  d. Coordinating Instructions: 
    (1) CCIR: 
    (2) PIR: 
    (3) D-Day / H-Hour (tentative): 
    (4) Orders Group: [Time/Location]

4. SERVICE SUPPORT (Initial): 

5. COMMAND AND SIGNAL (Initial):
  a. Command: 
  b. Signal: 
`,

OPORD: `OPERATION ORDER [UNIT] [SERIAL]
OPERATION [NAME]

REFERENCES: [Maps, charts, SOPs]
TIME ZONE: ZULU
TASK ORGANIZATION:

1. SITUATION:
  a. Enemy Forces:
    (1) Disposition: 
    (2) Composition: 
    (3) Strength: 
    (4) Capabilities: 
    (5) Enemy COA (Most Likely): 
    (6) Enemy COA (Most Dangerous): 
  b. Friendly Forces:
    (1) Higher HQ Mission/Intent: 
    (2) Left Unit: 
    (3) Right Unit: 
    (4) Supporting Units: 
  c. Attachments/Detachments: 
  d. Assumptions: 

2. MISSION:
[5Ws — Who, What (task), When, Where, Why (purpose)]

3. EXECUTION:
  a. Commander's Intent:
    Purpose: 
    Key Tasks: 
    End State: 
  b. Concept of Operations:
    (1) Scheme of Maneuver: 
    (2) Scheme of Fires: 
    (3) Intelligence: 
    (4) Engineer: 
    (5) Air Defense: 
  c. Tasks to Maneuver Units:
    (1) [Unit 1]: 
    (2) [Unit 2]: 
  d. Tasks to Combat Support Units:
    (1) Fires: 
    (2) ISR: 
    (3) Medical: 
  e. Coordinating Instructions:
    (1) CCIR: 
    (2) PIR: 
    (3) EEFI: 
    (4) Risk Guidance: 
    (5) Rules of Engagement: 
    (6) OPSEC: 
    (7) D-Day / H-Hour: 
    (8) SP/Release Point: 
    (9) Actions on Contact: 

4. SUSTAINMENT:
  a. Logistics:
    (1) Class I: 
    (2) Class III: 
    (3) Class V: 
    (4) Class IX: 
    (5) Transportation: 
  b. Personnel: 
  c. Medical:
    (1) CASEVAC Plan: 
    (2) MEDEVAC Freq: 
    (3) Hospital: 
  d. LOGPAC Plan: 

5. COMMAND AND SIGNAL:
  a. Command:
    (1) Location of CO: 
    (2) Succession of Command: 
    (3) Reports: 
  b. Signal:
    (1) Primary Freq: 
    (2) Alternate Freq: 
    (3) Call Signs: 
    (4) Challenge/Password: 
    (5) COMSEC / Crypto: 

ACKNOWLEDGE: ___________
`,

FRAGORD: `FRAGMENTARY ORDER (FRAGORD) #___
REF: [Parent OPORD]

SITUATION: [Changes to situation]

MISSION: [New/modified mission if changed]

EXECUTION:
  a. Changes to Tasks: 
  b. New Coordinating Instructions: 
  c. Timeline Changes: 

SUSTAINMENT: [Changes if any]

COMMAND AND SIGNAL: [Changes if any]

ACKNOWLEDGE: ___________
`,

OPLAN: `OPERATION PLAN (OPLAN) [UNIT] [SERIAL]

REFERENCES: 
TIME ZONE: ZULU
TASK ORGANIZATION:

1. SITUATION: [Same as OPORD format]

2. MISSION:

3. EXECUTION:
  a. Commander's Intent: 
  b. Concept of Operations: 
  c. Phases:
    Phase I — [Name]: 
    Phase II — [Name]: 
    Phase III — [Name]: 
  d. Tasks to Units: 
  e. Coordinating Instructions: 

4. SUSTAINMENT:

5. COMMAND AND SIGNAL:

ANNEXES:
  A — Task Organization
  B — Intelligence
  C — Operations Overlay
  D — Fire Support
  E — Rules of Engagement
  F — Command and Signal
`,

CONOP: `CONCEPT OF OPERATIONS (CONOP)

OPERATION: 
DATE/TIME: 
CLASSIFICATION: 

MISSION STATEMENT:

SITUATION:
  Enemy: 
  Friendly: 

CONCEPT:
  Phase 1 — Infiltration/Movement to Objective:
  Phase 2 — Actions on Objective:
  Phase 3 — Consolidation/Reorganization:
  Phase 4 — Exfil/RTB:

KEY TASKS:
  1. 
  2. 
  3. 

RISK ASSESSMENT:
  Risk Level: LOW / MEDIUM / HIGH
  Key Risks: 
  Mitigations: 

COMMANDER'S DECISION POINTS:
  GO/NO-GO Criteria: 
  Abort Criteria: 

TIMELINE:
  H-4: 
  H-2: 
  H-Hour: 
  H+1: 
  RTB: 
`,

HVT_CARD: `HIGH VALUE TARGET (HVT) CARD

TARGET DESIGNATION: 
CODENAME: 
PRIORITY: HVT-___

─── PERSONAL DATA ───────────────────────────────────────
  Full Name: 
  Aliases: 
  Age / DOB: 
  Nationality: 
  Language(s): 
  Physical Description: 
    Height: 
    Weight: 
    Hair: 
    Eyes: 
    Distinguishing Marks: 

─── AFFILIATION & ROLE ──────────────────────────────────
  Organization: 
  Role / Position: 
  Rank / Title: 
  Chain of Command: 

─── THREAT ASSESSMENT ───────────────────────────────────
  Threat Level: CRITICAL / HIGH / MEDIUM / LOW
  Capabilities: 
  Known Weapons: 

─── PATTERN OF LIFE ─────────────────────────────────────
  Known Locations: 
  Daily Routine: 
  Frequented Sites: 
  Known Vehicles: 
  Associates: 

─── INTELLIGENCE SUMMARY ────────────────────────────────
  Source(s): 
  Last Confirmed Location: 
  Last Confirmed Date/Time: 
  Activity Summary: 

─── ENGAGEMENT AUTHORITY ────────────────────────────────
  ROE: 
  Capture vs. Kill Authority: 
  Special Instructions: 

─── BIOMETRICS ──────────────────────────────────────────
  Fingerprints on File: YES / NO
  DNA on File: YES / NO
  Photo: [See Attached]

LAST UPDATED: 
PREPARED BY: 
`,

IMINT: `IMAGERY INTELLIGENCE (IMINT) REPORT

REPORT #: 
DATE/TIME: 
CLASSIFICATION: 
RELEASABILITY: 

─── COLLECTION DATA ──────────────────────────────────────
  Collection Platform: 
  Sensor Type: 
  Date/Time of Collection: 
  Target Grid: 
  Resolution: 

─── SUBJECT ──────────────────────────────────────────────
  Target Name/ID: 
  Target Type: 

─── KEY FINDINGS ─────────────────────────────────────────
  1. 
  2. 
  3. 

─── ACTIVITY OBSERVED ────────────────────────────────────
  Personnel: 
  Vehicles / Equipment: 
  Infrastructure: 
  Movement: 
  Defensive Posture: 

─── ANALYSIS ─────────────────────────────────────────────
  Assessment: 
  Confidence Level: HIGH / MEDIUM / LOW
  Change from Previous: 

─── RECOMMENDATIONS ──────────────────────────────────────
  Action: 
  Further Collection Required: 

─── ATTACHMENTS ──────────────────────────────────────────
  [See attached imagery — annotated versions labeled A, B, C...]

ANALYST: 
REVIEWED BY: 
`,

INTEL_SUMMARY: `INTELLIGENCE SUMMARY (INTSUM)

DATE/TIME: 
PERIOD COVERED: 
CLASSIFICATION: 
PREPARED BY: 

1. ENEMY SITUATION:
  a. Disposition: 
  b. Composition: 
  c. Strength: 
  d. Recent Activity: 

2. ENEMY INTENTIONS:
  a. Most Likely COA: 
  b. Most Dangerous COA: 

3. SIGNIFICANT ACTIVITIES (Past 24hrs):
  a. 
  b. 
  c. 

4. PRIORITY INTELLIGENCE REQUIREMENTS (PIR):
  PIR 1: [Question] — Status: OPEN / ANSWERED
  PIR 2: 
  PIR 3: 

5. ENEMY THREATS:
  IED: 
  Indirect Fire: 
  Air Defense: 
  Cyber/EW: 

6. WEATHER / TERRAIN:
  Weather: 
  Key Terrain: 
  Observation & Fields of Fire: 
  Cover & Concealment: 
  Obstacles: 
  Avenues of Approach: 

7. ASSESSMENT:

NEXT UPDATE: 
`,

JIPOE: `JOINT INTELLIGENCE PREPARATION OF THE ENVIRONMENT (JIPOE)

OPERATION: 
DATE: 
PREPARED BY: 
CLASSIFICATION: 

─── STEP 1: DEFINE THE OPERATIONAL ENVIRONMENT ───────────────
  AO Boundaries: 
  AI (Area of Interest): 
  Key Terrain: 
  Infrastructure: 
  Population: 
  Civil Considerations (ASCOPE):
    Areas: 
    Structures: 
    Capabilities: 
    Organizations: 
    People: 
    Events: 

─── STEP 2: DESCRIBE ENVIRONMENTAL EFFECTS ───────────────────
  Terrain Analysis (OAKOC):
    Observation / Fields of Fire: 
    Avenues of Approach: 
    Key Terrain: 
    Obstacles: 
    Cover & Concealment: 
  Weather Effects:
    Visibility: 
    Wind: 
    Temperature: 
    Effect on Operations: 

─── STEP 3: EVALUATE THE THREAT ──────────────────────────────
  Threat Overview: 
  Doctrine / TTPs: 
  Capabilities: 
  Vulnerabilities: 
  Order of Battle: 

─── STEP 4: DETERMINE THREAT COURSES OF ACTION ───────────────
  Most Likely Enemy COA: 
  Most Dangerous Enemy COA: 
  Decision Points: 

CONCLUSION / SO WHAT: 
`,

COA: `COURSE OF ACTION (COA) DEVELOPMENT

OPERATION: 
DATE: 

─── COA 1: [NAME] ────────────────────────────────────────────
  Concept: 
  Scheme of Maneuver: 
  Key Tasks: 
  Resources Required: 
  Risk: LOW / MEDIUM / HIGH
  Advantages: 
  Disadvantages: 

─── COA 2: [NAME] ────────────────────────────────────────────
  Concept: 
  Scheme of Maneuver: 
  Key Tasks: 
  Resources Required: 
  Risk: LOW / MEDIUM / HIGH
  Advantages: 
  Disadvantages: 

─── COA COMPARISON ───────────────────────────────────────────
  Criteria Weighted: 
  COA 1 Score: 
  COA 2 Score: 
  Recommended COA: 

COMMANDER'S DECISION: 
RATIONALE: 
`,

THREAT_ASSESS: `THREAT ASSESSMENT

OPERATION: 
DATE: 
CLASSIFICATION: 

─── THREAT OVERVIEW ──────────────────────────────────────────
  Primary Threat: 
  Secondary Threats: 

─── THREAT CATEGORIES ────────────────────────────────────────
  Kinetic:
    Small Arms: LOW / MEDIUM / HIGH
    Indirect Fire: LOW / MEDIUM / HIGH
    IED/VBIED: LOW / MEDIUM / HIGH
    Armor/Mech: LOW / MEDIUM / HIGH
    Air Threat: LOW / MEDIUM / HIGH
  Non-Kinetic:
    Cyber/EW: LOW / MEDIUM / HIGH
    CBRN: LOW / MEDIUM / HIGH
    Insider Threat: LOW / MEDIUM / HIGH
    Propaganda/IO: LOW / MEDIUM / HIGH

─── THREAT ANALYSIS ──────────────────────────────────────────
  TTPs (Tactics, Techniques, Procedures): 
  Patterns: 
  Triggers: 

─── RISK MATRIX ──────────────────────────────────────────────
  Overall Risk Level: LOW / MEDIUM / HIGH / CRITICAL
  Mission Impact: 

─── MITIGATIONS ──────────────────────────────────────────────
  1. 
  2. 
  3. 

ASSESSMENT AUTHOR: 
REVIEWED BY: 
`,

ACE: `ANALYSIS AND CONTROL ELEMENT (ACE) / PIR TRACKER

OPERATION: 
DATE/TIME: 
CLASSIFICATION: 

─── PRIORITY INTELLIGENCE REQUIREMENTS (PIR) ─────────────────
  PIR #1: 
    Supporting Information Requirements (SIR): 
    Responsible Collection Asset: 
    Suspense: 
    Status: OPEN / SATISFIED / ANSWERED
    Answer: 

  PIR #2: 
    SIR: 
    Asset: 
    Suspense: 
    Status: OPEN / SATISFIED / ANSWERED
    Answer: 

  PIR #3: 
    SIR: 
    Asset: 
    Suspense: 
    Status: OPEN / SATISFIED / ANSWERED
    Answer: 

─── COMMANDER'S CRITICAL INFORMATION REQUIREMENTS (CCIR) ──────
  FFIR (Friendly Force Info): 
  PIR: [See above]

─── ESSENTIAL ELEMENTS OF FRIENDLY INFORMATION (EEFI) ────────
  1. 
  2. 

─── COLLECTION MATRIX ────────────────────────────────────────
  Asset | NAI | PIR Supported | Window | Status
  ──────┼─────┼───────────────┼────────┼────────
        |     |               |        |
        |     |               |        |

STATUS UPDATE BY: 
`,

ISR_PLAN: `INTELLIGENCE, SURVEILLANCE & RECONNAISSANCE (ISR) PLAN

OPERATION: 
DATE: 
CLASSIFICATION: 

─── COLLECTION OBJECTIVES ────────────────────────────────────
  PIR Supported: 
  NAI (Named Areas of Interest):
    NAI-1: [Location/Description]
    NAI-2: 
    NAI-3: 

─── COLLECTION ASSETS ────────────────────────────────────────
  Asset | Type | Window | NAI | PIR
  ──────┼──────┼────────┼─────┼────
  sUAS  |      |        |     |
  Recce |      |        |     |
  SIGINT|      |        |     |

─── COLLECTION TIMELINE ──────────────────────────────────────
  H-72: [Pre-mission collection]
  H-48: 
  H-24: 
  H-6: 
  H-Hour: 
  Exploitation window: 

─── TASKING ──────────────────────────────────────────────────
  Organic Assets: 
  Requested Attachments: 
  Higher Collection Assets: 

─── DISSEMINATION PLAN ───────────────────────────────────────
  Reports To: 
  Frequency: 
  Format: SALUTE / IMINT / INTSUM
  Classification: 

─── EXPLOITATION ─────────────────────────────────────────────
  SSE Plan: 
  Evidence Collection: 
  Processing: 

PREPARED BY: 
`,

FIRE_PLAN: `FIRE SUPPORT PLAN

OPERATION: 
DATE: 
PREPARED BY: 
CLASSIFICATION: 

─── FIRE SUPPORT ASSETS ──────────────────────────────────────
  Organic:      [Mortars, AT, etc.]
  DS Artillery: 
  CAS:          
  Naval Gunfire: 
  Attack Aviation: 

─── FIRE SUPPORT TASKS ───────────────────────────────────────
  Mission: [Support [Unit] by...]
  Purpose: [Suppress/Destroy/Neutralize/Illuminate...]

─── TARGET LIST ──────────────────────────────────────────────
  TGT# | Description | Grid | Priority | Asset | Trigger
  ─────┼─────────────┼──────┼──────────┼───────┼────────
  AA001|             |      |          |       |
  AA002|             |      |          |       |

─── SCHEME OF FIRES ──────────────────────────────────────────
  Phase 1 — Pre-Assault: 
  Phase 2 — Assault: 
  Phase 3 — Consolidation: 

─── FIRE SUPPORT COORDINATION ────────────────────────────────
  FSCL: 
  NFL: 
  NFA: 
  RFA: 
  FARP Location: 
  SEAD Plan: 
  Danger Close Procedures: 

─── CALL FOR FIRE PROCEDURES ─────────────────────────────────
  Observer Net: 
  Fire Direction Net: 
  Auth to Fire: 

CAS BRIEF FORMAT (9-LINE):
  1. IP/BP: 
  2. Heading: 
  3. Distance IP to Target: 
  4. Target Elevation: 
  5. Target Description: 
  6. Target Location: 
  7. Type Mark: 
  8. Friendlies: 
  9. Egress: 

PREPARED BY: 
`,

CASEVAC_PLAN: `CASUALTY EVACUATION (CASEVAC) PLAN

OPERATION: 
DATE: 
CLASSIFICATION: 

─── CHAIN OF EVACUATION ──────────────────────────────────────
  POI (Point of Injury) → CCP → Role 1 → Role 2 → Role 3

─── CASUALTY COLLECTION POINTS (CCP) ─────────────────────────
  CCP-1: [Grid / Description]
  CCP-2: 
  Alternate: 

─── MEDICAL ASSETS ───────────────────────────────────────────
  Organic Medics: 
  CASEVAC Vehicle: 
  MEDEVAC Requested: YES / NO
    Freq: 
    Callsign: 
    LZ: 

─── 9-LINE MEDEVAC FORMAT ────────────────────────────────────
  Line 1 — Location: 
  Line 2 — Radio Freq/Callsign: 
  Line 3 — # Patients by Precedence: 
  Line 4 — Special Equipment: 
  Line 5 — # Patients by Type: 
  Line 6 — Security of Pickup Site: 
  Line 7 — Method of Marking Site: 
  Line 8 — Patient Nationality/Status: 
  Line 9 — NBC Contamination: 

─── PRECEDENCE DEFINITIONS ───────────────────────────────────
  URGENT — Immediate life/limb threat (evacuate within 1hr)
  URGENT SURGICAL — Surgery required within 2hrs
  PRIORITY — Condition could deteriorate (evacuate within 4hrs)
  ROUTINE — Stable, not urgent (evacuate within 24hrs)
  CONVENIENCE — Non-emergency

─── TREATMENT FACILITY ───────────────────────────────────────
  Role 1: 
  Role 2: [Grid / Name]
  Role 3: [Hospital / Grid]
  Hospital Coordinates: 

─── COMMUNICATIONS ───────────────────────────────────────────
  CASEVAC Net: 
  MEDEVAC Net: 
  Hospital Contact: 

─── KIA PROCEDURES ───────────────────────────────────────────
  Recovery Plan: 
  Reporting Chain: 

MEDICAL OFFICER: 
`,

LOGSTAT: `LOGISTICS STATUS / CSS PLAN

OPERATION: 
DATE/TIME: 
CLASSIFICATION: 

─── CLASS I (Food / Water) ────────────────────────────────────
  Days of Supply: 
  Water Plan: 
  LOGPAC Timing: 

─── CLASS II (Clothing / Equipment) ──────────────────────────
  Special Equipment Required: 
  NVG Status: 
  Body Armor: 

─── CLASS III (Fuel) ──────────────────────────────────────────
  Fuel Status: ____%
  Vehicle Fuel Plan: 
  FARP Location: 
  Generator Fuel: 

─── CLASS IV (Construction) ──────────────────────────────────
  Barrier Materials: 
  Sandbag Plan: 

─── CLASS V (Ammunition) ─────────────────────────────────────
  Basic Load Per Man: 
  Mission Load Out:
    5.56: 
    7.62: 
    40mm: 
    Frag: 
    Smoke: 
    IR: 
  Resupply Point: 
  Ammo Bearer Plan: 

─── CLASS VII (Equipment) ────────────────────────────────────
  Vehicles: 
  Aircraft: 
  Maintenance Status: 

─── CLASS VIII (Medical) ─────────────────────────────────────
  IFAK Status: 
  Aid Bag: 
  Blood Products: 

─── CLASS IX (Repair Parts) ──────────────────────────────────
  Critical Parts On Hand: 
  Maintenance Issues: 

─── TRANSPORTATION ────────────────────────────────────────────
  Vehicle Plan: 
  Chalk/Stick Assignments: 
  SP / Release Point: 

─── RESUPPLY PLAN ─────────────────────────────────────────────
  LOGPAC Schedule: 
  Drop Zone / PZ: 
  POC for Resupply: 

─── FIELD SERVICES ────────────────────────────────────────────
  Sleep Plan: 
  Hygiene: 

PREPARED BY: 
`,

ROE: `RULES OF ENGAGEMENT (ROE)

OPERATION: 
DATE: 
CLASSIFICATION: 
AUTHORITY: 

─── GENERAL RULES ────────────────────────────────────────────
  1. All personnel have the inherent right of self-defense.
  2. Engage only positively identified hostile forces/targets.
  3. Minimize collateral damage.
  4. Treat all detainees IAW Geneva Convention.

─── ENGAGEMENT AUTHORITY ──────────────────────────────────────
  Who may authorize engagement: 
  Levels of force:
    Level 1 — Presence / Show of Force
    Level 2 — Warning / Verbal Challenge
    Level 3 — Warning Shot / Non-Lethal
    Level 4 — Lethal Force

─── HOSTILE FORCE DEFINITION ─────────────────────────────────
  A hostile force is defined as: 
  Declared hostile forces (by name/unit): 

─── POSITIVE IDENTIFICATION (PID) ────────────────────────────
  PID required before engagement: YES / NO
  PID criteria: 

─── NO FIRE AREAS (NFA) ──────────────────────────────────────
  NFA-1: [Location / Reason]
  NFA-2: 

─── RESTRICTED FIRE AREAS (RFA) ──────────────────────────────
  RFA-1: [Location / Restrictions]

─── SENSITIVE SITES ──────────────────────────────────────────
  Hospitals: NO ENGAGEMENT
  Religious Sites: 
  Cultural Sites: 
  Schools: 

─── DETENTION AUTHORITY ──────────────────────────────────────
  Who can detain: 
  Detention procedures: 

─── REPORTING ────────────────────────────────────────────────
  Report all engagements to: 
  Format: SALUTE + BDA

LEGAL REVIEW BY: 
COMMANDER'S SIGNATURE: 
`,

EPA: `EVASION PLAN OF ACTION (EPA)

OPERATION: 
DATE: 
CLASSIFICATION: TOP SECRET

─── PERSONAL DATA (For Recovery Personnel Only) ──────────────
  Name: 
  Rank: 
  Service Number: 
  Blood Type: 
  Allergies / Medical: 

─── EVASION ROUTE ────────────────────────────────────────────
  Primary Route: 
    SP: 
    Checkpoints: 
    RP: 
  Alternate Route: 

─── RALLY POINTS ─────────────────────────────────────────────
  Primary RP: [Grid]
  Alternate RP: [Grid]
  Emergency RP: [Grid]

─── COMMUNICATIONS ───────────────────────────────────────────
  Primary ESAR Freq: 
  Alternate Freq: 
  Authentication Codes: 
  Scheduled Contact Times: 

─── RECOVERY SIGNALS ─────────────────────────────────────────
  Day Signal: 
  Night Signal: 
  IR Signal: 
  Code Word (Friendly):
  Code Word (Distress): 

─── RESISTANCE TO EXPLOITATION ────────────────────────────────
  Authorized to Release: Name, Rank, Service #, DOB only
  SERE Level: 

─── AREAS TO AVOID ───────────────────────────────────────────
  1. 
  2. 

─── SAFE AREAS / FRIENDLY FORCES ─────────────────────────────
  Nearest Friendly Lines: 
  CSAR Assets: 
  Supporting Unit: 

PREPARED BY: 
`,

OPSEC: `OPERATIONS SECURITY (OPSEC) PLAN

OPERATION: 
DATE: 
CLASSIFICATION: 

─── CRITICAL INFORMATION LIST (CIL) ──────────────────────────
  The following information is CRITICAL and must be protected:
  1. 
  2. 
  3. 

─── THREAT ANALYSIS ──────────────────────────────────────────
  HUMINT Threat: 
  SIGINT Threat: 
  IMINT Threat: 
  Cyber Threat: 
  Insider Threat: 

─── VULNERABILITY ASSESSMENT ──────────────────────────────────
  Pre-Mission:
    Vulnerability: 
    Likelihood: 
    Impact: 
  During Mission:
    Vulnerability: 
  Post-Mission: 

─── COUNTERMEASURES ───────────────────────────────────────────
  Physical Security: 
  Communications: 
    - No sensitive info on unsecured nets
    - Use brevity codes / keycalls
    - Minimize transmissions
  Personnel:
    - Need-to-know enforcement
    - Briefing procedures
  Digital:
    - Encrypted communications only
    - No mission photos on personal devices

─── OPSEC INDICATORS TO CONTROL ──────────────────────────────
  1. Increased radio traffic
  2. Vehicle staging
  3. Personnel patterns
  4. Resupply activity

─── REPORTING ────────────────────────────────────────────────
  OPSEC violations report to: 
  Format: 

OPSEC OFFICER: 
`,

REHEARSAL: `REHEARSAL PLAN

OPERATION: 
DATE/TIME OF REHEARSAL: 
LOCATION: 
CLASSIFICATION: 

─── REHEARSAL TYPE ────────────────────────────────────────────
  [ ] Map Rehearsal
  [ ] Sand Table
  [ ] Terrain Walk
  [ ] Full Mission Profile

─── PARTICIPANTS ──────────────────────────────────────────────
  Required Attendees: 
  Optional: 

─── SEQUENCE ──────────────────────────────────────────────────
  1. SP / Infiltration Phase
  2. Movement to Objective
  3. ORP / SBF / Assault Element Actions
  4. Actions on Objective (AOO)
  5. Consolidation / Reorganization
  6. Exfiltration / RTB

─── ACTIONS ON CONTACT ────────────────────────────────────────
  Ambush (Near): 
  Ambush (Far): 
  IED: 
  Air Threat: 
  Casualty: 

─── CONTINGENCIES ─────────────────────────────────────────────
  Abort Criteria: 
  Loss of Element Leader: 
  Comms Failure: 
  Missing Man: 
  E&E Trigger: 

─── BATTLE DRILLS ─────────────────────────────────────────────
  Rehearse:
  [ ] Actions on Contact
  [ ] CASEVAC 9-Line
  [ ] Break Contact
  [ ] CASEVAC / Buddy Carry
  [ ] Actions on Objective

─── QUESTIONS / NOTES ─────────────────────────────────────────

REHEARSAL CONDUCTED BY: 
`,

CUSTOM: `[DOCUMENT TITLE]

CLASSIFICATION: 
DATE: 
PREPARED BY: 

`,
};

// ── Attachment chip ──────────────────────────────────────────────────────────
interface AttachmentInfo { filename: string; originalName: string; url: string; mimeType: string; }

function AttachmentChip({ att, onRemove }: { att: AttachmentInfo; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 bg-secondary border border-border rounded px-2 py-1 text-[10px]">
      <Paperclip size={9} className="text-muted-foreground shrink-0" />
      <a href={att.url} target="_blank" rel="noreferrer"
        className="text-green-400 hover:text-green-300 truncate max-w-[160px]">{att.originalName}</a>
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-red-400 ml-0.5"><X size={9} /></button>
      )}
    </div>
  );
}

// ── File uploader ────────────────────────────────────────────────────────────
function FileUploader({ onUploaded }: { onUploaded: (att: AttachmentInfo) => void }) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      onUploaded(await res.json());
    } catch (e: any) {
      toast({ title: e?.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <label className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-[10px] tracking-wider transition-colors ${
      uploading ? "text-muted-foreground border-border" : "text-green-400/60 border-green-900/40 hover:text-green-400 hover:border-green-800/60"
    }`}>
      <Upload size={9} />
      {uploading ? "UPLOADING..." : "ATTACH FILE"}
      <input ref={ref} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </label>
  );
}

// ── Document editor / creator ────────────────────────────────────────────────
function DocEditor({ doc, onClose }: { doc?: IsofacDoc; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const defaultType = "OPORD";
  const [form, setForm] = useState({
    type: doc?.type || defaultType,
    title: doc?.title || "",
    classification: doc?.classification || "UNCLASS",
    status: doc?.status || "DRAFT",
    content: doc?.content || TEMPLATES[defaultType] || "",
    opName: doc?.opName || "",
    targetGrid: doc?.targetGrid || "",
  });
  const [attachments, setAttachments] = useState<AttachmentInfo[]>(
    doc ? JSON.parse(doc.attachments || "[]") : []
  );

  const create = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/isofac", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/isofac"] }); toast({ title: "Document created" }); onClose(); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: (d: any) => apiRequest("PATCH", `/api/isofac/${doc?.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/isofac"] }); toast({ title: "Document saved" }); onClose(); },
  });

  const save = () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = { ...form, attachments: JSON.stringify(attachments), tags: "[]" };
    doc ? update.mutate(payload) : create.mutate(payload);
  };

  const handleTypeChange = (t: string) => {
    const useTemplate = !form.content.trim() || form.content === TEMPLATES[form.type];
    setForm(f => ({ ...f, type: t, content: useTemplate ? (TEMPLATES[t] || "") : f.content }));
  };

  const typeInfo = DOC_TYPES.find(t => t.value === form.type);
  const TypeIcon = typeInfo?.icon || FileText;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-wrap shrink-0">
        <select value={form.type} onChange={e => handleTypeChange(e.target.value)}
          className="bg-secondary border border-border rounded px-2 py-1 text-[10px] font-bold tracking-wider text-foreground focus:outline-none h-7">
          {DOC_GROUPS.map(g => (
            <optgroup key={g.key} label={`── ${g.label} ──`}>
              {DOC_TYPES.filter(t => t.group === g.key).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}
          className="bg-secondary border border-border rounded px-2 py-1 text-[10px] tracking-wider text-foreground focus:outline-none h-7">
          {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="bg-secondary border border-border rounded px-2 py-1 text-[10px] tracking-wider text-foreground focus:outline-none h-7">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <FileUploader onUploaded={att => setAttachments(a => [...a, att])} />
        <Button size="sm" onClick={save} disabled={create.isPending || update.isPending}
          className="text-[10px] bg-green-800 hover:bg-green-700 h-7 gap-1">
          <Save size={10} /> SAVE
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="text-[10px] h-7">CANCEL</Button>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="col-span-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Document title..."
            className="w-full bg-transparent text-sm font-bold tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:outline-none border-b border-border/50 pb-1 font-mono uppercase" />
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground tracking-wider">ASSOCIATED OP</div>
          <input value={form.opName} onChange={e => setForm(f => ({ ...f, opName: e.target.value }))}
            placeholder="OP IRON VEIL"
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground mt-0.5 focus:outline-none focus:ring-1 focus:ring-green-700" />
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground tracking-wider">TARGET GRID</div>
          <input value={form.targetGrid} onChange={e => setForm(f => ({ ...f, targetGrid: e.target.value }))}
            placeholder="38T LP 1234 5678"
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground mt-0.5 focus:outline-none focus:ring-1 focus:ring-green-700" />
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap px-3 py-2 border-b border-border shrink-0">
          {attachments.map((att, i) => (
            <AttachmentChip key={i} att={att} onRemove={() => setAttachments(a => a.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          className="w-full h-full bg-transparent text-xs font-mono text-foreground/90 leading-relaxed p-4 focus:outline-none resize-none"
          placeholder="Begin typing or use the template..." spellCheck={false} />
      </div>
    </div>
  );
}

// ── Document viewer ──────────────────────────────────────────────────────────
function DocViewer({ doc }: { doc: IsofacDoc }) {
  const typeInfo = DOC_TYPES.find(t => t.value === doc.type);
  const TypeIcon = typeInfo?.icon || FileText;
  const attachments: AttachmentInfo[] = JSON.parse(doc.attachments || "[]");
  const images = attachments.filter(a => a.mimeType?.startsWith("image/"));
  const files = attachments.filter(a => !a.mimeType?.startsWith("image/"));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 py-3 border-b border-dashed border-border/60 shrink-0">
        <div className="flex items-start gap-3">
          <TypeIcon size={20} className={typeInfo?.color || "text-muted-foreground"} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold tracking-[0.2em] px-2 py-0.5 rounded border ${
                doc.classification === "TS" ? "text-red-400 bg-red-950/20 border-red-900/40" :
                doc.classification === "SECRET" ? "text-orange-400 bg-orange-950/20 border-orange-900/40" :
                doc.classification === "CUI" ? "text-yellow-400 bg-yellow-950/20 border-yellow-900/40" :
                "text-green-400 bg-green-950/10 border-green-900/20"
              }`}>{doc.classification}</span>
              <span className="text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded tracking-wider">{typeInfo?.label || doc.type}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded tracking-wider font-bold ${
                doc.status === "ACTIVE" ? "badge-active" :
                doc.status === "DRAFT" ? "badge-standby" : "badge-offline"
              }`}>{doc.status}</span>
            </div>
            <h2 className="text-base font-bold tracking-wider font-mono text-foreground uppercase">{doc.title}</h2>
            <div className="text-[9px] text-muted-foreground/60 mt-0.5 flex flex-wrap gap-3">
              <span>BY: {doc.createdBy}</span>
              {doc.opName && <span>OP: {doc.opName}</span>}
              {doc.targetGrid && <span className="grid-coord">{doc.targetGrid}</span>}
              <span>UPDATED: {new Date(doc.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Image preview */}
      {images.length > 0 && (
        <div className="px-5 py-2 border-b border-border flex gap-2 flex-wrap shrink-0">
          {images.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer">
              <img src={att.url} alt={att.originalName} className="h-28 rounded border border-border object-cover hover:opacity-80 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {/* File attachments */}
      {files.length > 0 && (
        <div className="px-5 py-2 border-b border-border flex gap-2 flex-wrap shrink-0">
          {files.map((att, i) => <AttachmentChip key={i} att={att} />)}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <pre className="text-[11px] font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap">{doc.content}</pre>
      </div>
    </div>
  );
}

// ── Sidebar doc card ─────────────────────────────────────────────────────────
function DocCard({ doc, active, onClick }: { doc: IsofacDoc; active: boolean; onClick: () => void }) {
  const typeInfo = DOC_TYPES.find(t => t.value === doc.type);
  const TypeIcon = typeInfo?.icon || FileText;
  return (
    <button onClick={onClick}
      className={`w-full text-left px-2 py-2 rounded transition-all border mb-0.5 ${
        active
          ? `${typeInfo?.bg || "bg-secondary"} border-current`
          : "border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
      }`}>
      <div className="flex items-start gap-1.5">
        <TypeIcon size={10} className={`shrink-0 mt-0.5 ${active ? typeInfo?.color : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold font-mono truncate tracking-wider">{doc.title}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[8px] text-muted-foreground/50">{typeInfo?.label || doc.type}</span>
            <span className={`text-[8px] font-bold ${
              doc.status === "ACTIVE" ? "text-green-400" :
              doc.status === "DRAFT" ? "text-yellow-400" : "text-muted-foreground"
            }`}>▪ {doc.status}</span>
          </div>
        </div>
        <span className={`text-[8px] font-bold shrink-0 ${
          doc.classification === "TS" ? "text-red-400" :
          doc.classification === "SECRET" ? "text-orange-400" :
          doc.classification === "CUI" ? "text-yellow-400" : "text-green-400/40"
        }`}>{doc.classification}</span>
      </div>
    </button>
  );
}

// ── Main ISOFAC page ─────────────────────────────────────────────────────────
export default function IsofacPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDoc, setEditDoc] = useState<IsofacDoc | undefined>();
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: docs = [] } = useQuery<IsofacDoc[]>({
    queryKey: ["/api/isofac"],
    queryFn: () => apiRequest("GET", "/api/isofac"),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/isofac/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/isofac"] }); setSelectedId(null); toast({ title: "Document deleted" }); },
  });

  const filtered = docs.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.opName?.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDoc = docs.find(d => d.id === selectedId) ?? null;

  const toggleGroup = (key: string) => {
    setCollapsedGroups(s => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  if (editing) {
    return (
      <div className="h-full flex flex-col" style={{ height: "calc(100vh)" }}>
        <DocEditor doc={editDoc} onClose={() => { setEditing(false); setEditDoc(undefined); }} />
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ height: "calc(100vh)" }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-60 border-r border-border bg-card flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={11} className="text-green-400" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-green-400">ISOFAC</span>
            <span className="text-[9px] text-muted-foreground/50">MISSION PLANNING</span>
          </div>
          <button onClick={() => { setEditDoc(undefined); setEditing(true); }}
            className="text-[9px] text-green-400/60 hover:text-green-400 flex items-center gap-1 tracking-wider transition-colors">
            <Plus size={9} /> NEW
          </button>
        </div>

        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-green-800" />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {DOC_GROUPS.map(group => {
            const groupDocs = filtered.filter(d => group.types.includes(d.type));
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                <button onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[9px] text-muted-foreground/50 tracking-[0.15em] hover:text-muted-foreground transition-colors">
                  {isCollapsed ? <ChevronRight size={9} /> : <ChevronDown size={9} />}
                  {group.label}
                  <span className="ml-auto text-[8px]">{groupDocs.length > 0 ? groupDocs.length : ""}</span>
                </button>
                {!isCollapsed && (
                  <div className="px-2">
                    {groupDocs.length === 0 && !search && (
                      <div className="text-[9px] text-muted-foreground/30 px-2 py-1">No documents</div>
                    )}
                    {groupDocs.map(doc => (
                      <DocCard key={doc.id} doc={doc} active={selectedId === doc.id} onClick={() => setSelectedId(doc.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-border text-[9px] text-muted-foreground/40 tracking-wider shrink-0">
          {docs.length} DOCS ▪ {docs.filter(d => d.status === "ACTIVE").length} ACTIVE
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {selectedDoc ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/30 shrink-0">
              <div className="flex-1" />
              <button onClick={() => { setEditDoc(selectedDoc); setEditing(true); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-green-400 tracking-wider transition-colors">
                <Edit size={11} /> EDIT
              </button>
              {isAdmin && (
                <button onClick={() => del.mutate(selectedDoc.id)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 tracking-wider transition-colors">
                  <Trash2 size={11} /> DELETE
                </button>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <DocViewer doc={selectedDoc} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <BookOpen size={32} className="text-muted-foreground/20 mb-3" />
            <div className="text-sm font-bold tracking-wider text-muted-foreground">INTELLIGENCE SUPPORT TO OPERATIONS</div>
            <div className="text-[10px] text-muted-foreground/50 mt-1 mb-6">Select a document or create a new one</div>
            <div className="grid grid-cols-4 gap-2 max-w-2xl w-full">
              {DOC_GROUPS.map(group => (
                <div key={group.key} className="bg-card border border-border rounded p-2">
                  <div className="text-[9px] font-bold tracking-wider text-muted-foreground mb-1.5">{group.label}</div>
                  {DOC_TYPES.filter(t => t.group === group.key).map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.value} onClick={() => { setEditDoc(undefined); setEditing(true); }}
                        className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-secondary transition-colors text-left">
                        <Icon size={9} className={t.color} />
                        <span className="text-[9px] text-muted-foreground hover:text-foreground truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
