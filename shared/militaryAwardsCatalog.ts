/**
 * US military decorations & service awards (all branches + Coast Guard + Space Force + joint).
 * Includes branch warfare pins / occupational badges (awardType `badge`) and ribbons/medals.
 * Precedence follows consolidated DoD wear order (approximate); lower = more senior.
 * Ribbon images: Wikimedia Commons thumbnails where available; otherwise empty → UI placeholder.
 */

export type MilitaryBranch =
  | "Joint"
  | "Army"
  | "Navy"
  | "Marine Corps"
  | "Air Force"
  | "Space Force"
  | "Coast Guard";

export type MilitaryAwardType = "medal" | "commendation" | "citation" | "achievement" | "badge";

export type MilitaryAwardDefinition = {
  id: string;
  name: string;
  branch: MilitaryBranch;
  precedence: number;
  awardType: MilitaryAwardType;
  imageUrl: string;
};

/** Commons /thumb/.../105px-...png ribbon thumbnails (public domain U.S. military ribbon graphics). */
const C = "https://upload.wikimedia.org/wikipedia/commons/thumb";

const R = {
  moh: `${C}/2/27/Medal_of_Honor_ribbon.svg/105px-Medal_of_Honor_ribbon.svg.png`,
  dssm: `${C}/8/8e/Defense_Distinguished_Service_Medal_ribbon.svg/105px-Defense_Distinguished_Service_Medal_ribbon.svg.png`,
  dsm: `${C}/4/4e/Distinguished_Service_Medal_ribbon.svg/105px-Distinguished_Service_Medal_ribbon.svg.png`,
  ss: `${C}/e/e5/Silver_Star_ribbon.svg/105px-Silver_Star_ribbon.svg.png`,
  dfc: `${C}/2/2e/Distinguished_Flying_Cross_ribbon.svg/105px-Distinguished_Flying_Cross_ribbon.svg.png`,
  bsm: `${C}/3/3e/Bronze_Star_ribbon.svg/105px-Bronze_Star_ribbon.svg.png`,
  ph: `${C}/6/6a/Purple_Heart_ribbon.svg/105px-Purple_Heart_ribbon.svg.png`,
  msm: `${C}/9/9d/Meritorious_Service_Medal_ribbon.svg/105px-Meritorious_Service_Medal_ribbon.svg.png`,
  am: `${C}/5/5e/Air_Medal_ribbon.svg/105px-Air_Medal_ribbon.svg.png`,
  aam: `${C}/a/a9/Army_Achievement_Medal_ribbon.svg/105px-Army_Achievement_Medal_ribbon.svg.png`,
  acm: `${C}/8/8f/Army_Commendation_Medal_ribbon.svg/105px-Army_Commendation_Medal_ribbon.svg.png`,
  lom: `${C}/6/65/Legion_of_Merit_ribbon.svg/105px-Legion_of_Merit_ribbon.svg.png`,
  ndsm: `${C}/5/56/National_Defense_Service_Medal_ribbon.svg/105px-National_Defense_Service_Medal_ribbon.svg.png`,
  gwotem: `${C}/5/53/Global_War_on_Terrorism_Expeditionary_Medal_ribbon.svg/105px-Global_War_on_Terrorism_Expeditionary_Medal_ribbon.svg.png`,
  gwotsm: `${C}/6/6e/Global_War_on_Terrorism_Service_Medal_ribbon.svg/105px-Global_War_on_Terrorism_Service_Medal_ribbon.svg.png`,
  nato: `${C}/9/9a/NATO_Medal_ribbon.svg/105px-NATO_Medal_ribbon.svg.png`,
  nc: `${C}/1/17/Navy_Cross_ribbon.svg/105px-Navy_Cross_ribbon.svg.png`,
  ncm: `${C}/8/8c/Navy_Commendation_Medal_ribbon.svg/105px-Navy_Commendation_Medal_ribbon.svg.png`,
  nam: `${C}/4/4e/Navy_and_Marine_Corps_Achievement_Medal_ribbon.svg/105px-Navy_and_Marine_Corps_Achievement_Medal_ribbon.svg.png`,
  afcm: `${C}/8/8a/Air_Force_Commendation_Medal_ribbon.svg/105px-Air_Force_Commendation_Medal_ribbon.svg.png`,
  afcam: `${C}/a/a9/Air_Force_Achievement_Medal_ribbon.svg/105px-Air_Force_Achievement_Medal_ribbon.svg.png`,
  cgcm: `${C}/9/9e/Coast_Guard_Commendation_Medal_ribbon.svg/105px-Coast_Guard_Commendation_Medal_ribbon.svg.png`,
  cgam: `${C}/a/a1/Coast_Guard_Achievement_Medal_ribbon.svg/105px-Coast_Guard_Achievement_Medal_ribbon.svg.png`,
} as const;

type Row = [string, string, MilitaryBranch, number, MilitaryAwardType, string?];

const RAW: Row[] = [
  ["joint-moh", "Medal of Honor", "Joint", 100, "medal", R.moh],
  ["army-dsc", "Distinguished Service Cross", "Army", 210, "medal", ""],
  ["navy-navy-cross", "Navy Cross", "Navy", 211, "medal", R.nc],
  ["af-afcross", "Air Force Cross", "Air Force", 212, "medal", ""],
  ["cg-cg-medal", "Coast Guard Medal", "Coast Guard", 220, "medal", ""],
  ["defense-dssm", "Defense Distinguished Service Medal", "Joint", 300, "medal", R.dssm],
  ["dhs-hsdsm", "Homeland Security Distinguished Service Medal", "Joint", 310, "medal", ""],
  ["army-dsm", "Distinguished Service Medal (Army)", "Army", 400, "medal", R.dsm],
  ["navy-dsm", "Distinguished Service Medal (Navy)", "Navy", 401, "medal", R.dsm],
  ["af-dsm", "Distinguished Service Medal (Air Force)", "Air Force", 402, "medal", R.dsm],
  ["cg-dsm", "Coast Guard Distinguished Service Medal", "Coast Guard", 403, "medal", ""],
  ["defense-silver-star", "Silver Star Medal", "Joint", 500, "medal", R.ss],
  ["defense-sssm", "Defense Superior Service Medal", "Joint", 510, "medal", ""],
  ["defense-dmsm", "Defense Meritorious Service Medal", "Joint", 520, "medal", ""],
  ["joint-jsm", "Joint Service Commendation Medal", "Joint", 530, "commendation", ""],
  ["joint-jsam", "Joint Service Achievement Medal", "Joint", 540, "medal", ""],
  ["army-silver-star", "Silver Star (Army)", "Army", 550, "medal", R.ss],
  ["navy-silver-star", "Silver Star (Navy)", "Navy", 551, "medal", R.ss],
  ["mc-silver-star", "Silver Star (Marine Corps)", "Marine Corps", 552, "medal", R.ss],
  ["af-silver-star", "Silver Star (Air Force)", "Air Force", 553, "medal", R.ss],
  ["army-lom", "Legion of Merit", "Army", 600, "medal", R.lom],
  ["navy-lom", "Legion of Merit (Navy)", "Navy", 601, "medal", R.lom],
  ["mc-lom", "Legion of Merit (Marine Corps)", "Marine Corps", 602, "medal", R.lom],
  ["af-lom", "Legion of Merit (Air Force)", "Air Force", 603, "medal", R.lom],
  ["cg-lom", "Legion of Merit (Coast Guard)", "Coast Guard", 604, "medal", R.lom],
  ["army-dfc", "Distinguished Flying Cross (Army)", "Army", 620, "medal", R.dfc],
  ["navy-dfc", "Distinguished Flying Cross (Navy)", "Navy", 621, "medal", R.dfc],
  ["af-dfc", "Distinguished Flying Cross (Air Force)", "Air Force", 622, "medal", R.dfc],
  ["army-soldiers-medal", "Soldier's Medal", "Army", 630, "medal", ""],
  ["navy-marine-corps-medal", "Navy and Marine Corps Medal", "Navy", 631, "medal", ""],
  ["mc-navy-marine-corps-medal", "Navy and Marine Corps Medal (Marine Corps)", "Marine Corps", 632, "medal", ""],
  ["af-airmens-medal", "Airmen's Medal", "Air Force", 633, "medal", ""],
  ["army-bsm", "Bronze Star Medal (Army)", "Army", 700, "medal", R.bsm],
  ["navy-bsm", "Bronze Star Medal (Navy)", "Navy", 701, "medal", R.bsm],
  ["mc-bsm", "Bronze Star Medal (Marine Corps)", "Marine Corps", 702, "medal", R.bsm],
  ["af-bsm", "Bronze Star Medal (Air Force)", "Air Force", 703, "medal", R.bsm],
  ["cg-bsm", "Bronze Star Medal (Coast Guard)", "Coast Guard", 704, "medal", R.bsm],
  ["joint-purple-heart", "Purple Heart", "Joint", 710, "medal", R.ph],
  ["army-msm", "Meritorious Service Medal (Army)", "Army", 720, "medal", R.msm],
  ["navy-msm", "Meritorious Service Medal (Navy)", "Navy", 721, "medal", R.msm],
  ["mc-msm", "Meritorious Service Medal (Marine Corps)", "Marine Corps", 722, "medal", R.msm],
  ["af-msm", "Meritorious Service Medal (Air Force)", "Air Force", 723, "medal", R.msm],
  ["cg-msm", "Meritorious Service Medal (Coast Guard)", "Coast Guard", 724, "medal", R.msm],
  ["army-am", "Air Medal (Army)", "Army", 730, "medal", R.am],
  ["navy-am", "Air Medal (Navy)", "Navy", 731, "medal", R.am],
  ["mc-am", "Air Medal (Marine Corps)", "Marine Corps", 732, "medal", R.am],
  ["af-am-af", "Air Medal (Air Force)", "Air Force", 733, "medal", R.am],
  ["af-aerial-achievement", "Aerial Achievement Medal", "Air Force", 735, "medal", ""],
  ["army-pebd", "Presidential Unit Citation (Army)", "Army", 740, "citation", ""],
  ["navy-pebd", "Presidential Unit Citation (Navy)", "Navy", 741, "citation", ""],
  ["af-pebd", "Presidential Unit Citation (Air Force)", "Air Force", 742, "citation", ""],
  ["cg-pebd", "Presidential Unit Citation (Coast Guard)", "Coast Guard", 743, "citation", ""],
  ["army-acm", "Army Commendation Medal", "Army", 800, "commendation", R.acm],
  ["navy-ncm", "Navy Commendation Medal", "Navy", 801, "commendation", R.ncm],
  ["mc-ncm", "Navy and Marine Corps Commendation Medal", "Marine Corps", 802, "commendation", R.ncm],
  ["af-afcm", "Air Force Commendation Medal", "Air Force", 803, "commendation", R.afcm],
  ["sf-afcm", "Space Force Commendation Medal", "Space Force", 804, "commendation", R.afcm],
  ["cg-cgcm", "Coast Guard Commendation Medal", "Coast Guard", 805, "commendation", R.cgcm],
  ["army-aam", "Army Achievement Medal", "Army", 810, "medal", R.aam],
  ["navy-nam", "Navy Achievement Medal", "Navy", 811, "medal", R.nam],
  ["mc-nam", "Navy and Marine Corps Achievement Medal", "Marine Corps", 812, "medal", R.nam],
  ["af-afam", "Air Force Achievement Medal", "Air Force", 813, "medal", R.afcam],
  ["sf-afam", "Space Force Achievement Medal", "Space Force", 814, "medal", R.afcam],
  ["cg-cgam", "Coast Guard Achievement Medal", "Coast Guard", 815, "medal", R.cgam],
  ["army-combat-action", "Combat Action Badge", "Army", 5202, "badge", ""],
  ["navy-combat-action", "Combat Action Ribbon", "Navy", 821, "medal", ""],
  ["mc-combat-action", "Combat Action Ribbon (Marine Corps)", "Marine Corps", 822, "medal", ""],
  ["joint-prisoner-of-war", "Prisoner of War Medal", "Joint", 830, "medal", ""],
  ["army-good-conduct", "Army Good Conduct Medal", "Army", 900, "medal", ""],
  ["navy-good-conduct", "Navy Good Conduct Medal", "Navy", 901, "medal", ""],
  ["mc-good-conduct", "Marine Corps Good Conduct Medal", "Marine Corps", 902, "medal", ""],
  ["af-good-conduct", "Air Force Good Conduct Medal", "Air Force", 903, "medal", ""],
  ["cg-good-conduct", "Coast Guard Good Conduct Medal", "Coast Guard", 904, "medal", ""],
  ["army-reserve-achievement", "Army Reserve Components Achievement Medal", "Army", 910, "medal", ""],
  ["navy-reserve-merit", "Selected Marine Corps Reserve Medal", "Marine Corps", 911, "medal", ""],
  ["af-reserve-merit", "Air Reserve Forces Meritorious Service Medal", "Air Force", 912, "medal", ""],
  ["cg-reserve-merit", "Coast Guard Reserve Good Conduct", "Coast Guard", 913, "medal", ""],
  ["army-service", "Army Service Ribbon", "Army", 920, "medal", ""],
  ["navy-service", "Navy Service Ribbon", "Navy", 921, "medal", ""],
  ["mc-service", "Marine Corps Service Ribbon", "Marine Corps", 922, "medal", ""],
  ["af-service", "Air Force Service Ribbon", "Air Force", 923, "medal", ""],
  ["sf-service", "Space Force Service Ribbon", "Space Force", 924, "medal", ""],
  ["cg-basic-training", "Coast Guard Basic Training Honor Graduate Ribbon", "Coast Guard", 925, "medal", ""],
  ["army-nco-professional", "NCO Professional Development Ribbon", "Army", 930, "medal", ""],
  ["af-nco-pme", "NCO PME Graduate Ribbon (Air Force)", "Air Force", 931, "medal", ""],
  ["army-drill-sergeant", "Drill Sergeant Identification Badge (ribbon)", "Army", 932, "badge", ""],
  ["army-overseas-short", "Army Overseas Service Ribbon (short tour)", "Army", 940, "medal", ""],
  ["army-overseas-long", "Army Overseas Service Ribbon (long tour)", "Army", 941, "medal", ""],
  ["navy-sea-service", "Sea Service Deployment Ribbon", "Navy", 942, "medal", ""],
  ["mc-sea-service", "Sea Service Deployment Ribbon (Marine Corps)", "Marine Corps", 943, "medal", ""],
  ["af-overseas-short", "Air Force Overseas Short Tour Ribbon", "Air Force", 944, "medal", ""],
  ["af-overseas-long", "Air Force Overseas Long Tour Ribbon", "Air Force", 945, "medal", ""],
  ["cg-special-operations", "Special Operations Service Ribbon", "Coast Guard", 946, "medal", ""],
  ["af-recruiter", "Air Force Recruiter Ribbon", "Air Force", 950, "medal", ""],
  ["army-recruiter", "Army Recruiter Ribbon", "Army", 951, "medal", ""],
  ["navy-recruiter", "Navy Recruiting Service Ribbon", "Navy", 952, "medal", ""],
  ["joint-ndsm", "National Defense Service Medal", "Joint", 1000, "medal", R.ndsm],
  ["joint-antarctica", "Antarctica Service Medal", "Joint", 1010, "medal", ""],
  ["joint-armed-forces-exp", "Armed Forces Expeditionary Medal", "Joint", 1020, "medal", ""],
  ["joint-inherent-resolve", "Inherent Resolve Campaign Medal", "Joint", 1030, "medal", ""],
  ["joint-afghanistan-cm", "Afghanistan Campaign Medal", "Joint", 1040, "medal", ""],
  ["joint-iraq-cm", "Iraq Campaign Medal", "Joint", 1050, "medal", ""],
  ["joint-gwotem", "Global War on Terrorism Expeditionary Medal", "Joint", 1060, "medal", R.gwotem],
  ["joint-gwotsm", "Global War on Terrorism Service Medal", "Joint", 1070, "medal", R.gwotsm],
  ["joint-kdsm", "Korean Defense Service Medal", "Joint", 1080, "medal", ""],
  ["joint-asm", "Armed Forces Service Medal", "Joint", 1090, "medal", ""],
  ["joint-hsm", "Humanitarian Service Medal", "Joint", 1100, "medal", ""],
  ["joint-msm-dod", "Military Outstanding Volunteer Service Medal", "Joint", 1110, "medal", ""],
  ["army-superior-unit", "Army Superior Unit Award", "Army", 1120, "commendation", ""],
  ["navy-unit-commendation", "Navy Unit Commendation", "Navy", 1121, "commendation", ""],
  ["mc-unit-commendation", "Navy Unit Commendation (Marine Corps)", "Marine Corps", 1122, "commendation", ""],
  ["af-outstanding-unit", "Air Force Outstanding Unit Award", "Air Force", 1123, "commendation", ""],
  ["cg-unit-commendation", "Coast Guard Unit Commendation", "Coast Guard", 1124, "commendation", ""],
  ["army-meritorious-unit", "Meritorious Unit Commendation (Army)", "Army", 1130, "commendation", ""],
  ["navy-meritorious-unit", "Meritorious Unit Commendation (Navy)", "Navy", 1131, "commendation", ""],
  ["af-organizational-excellence", "Air Force Organizational Excellence Award", "Air Force", 1132, "commendation", ""],
  ["cg-meritorious-unit", "Coast Guard Meritorious Unit Commendation", "Coast Guard", 1133, "commendation", ""],
  ["navy-e", "Battle Effectiveness Award (Navy E Ribbon)", "Navy", 1145, "medal", ""],
  ["af-longevity", "Air Force Longevity Service Award", "Air Force", 1150, "medal", ""],
  ["af-small-arms", "Small Arms Expert Marksmanship Ribbon (Air Force)", "Air Force", 1160, "medal", ""],
  ["army-marksman", "Marksmanship Qualification Badge / Ribbon (Army)", "Army", 1161, "medal", ""],
  ["navy-marksman", "Navy Rifle Marksmanship Ribbon", "Navy", 1162, "medal", ""],
  ["mc-marksman", "Marine Corps Rifle Qualification Badge", "Marine Corps", 1163, "medal", ""],
  ["cg-marksmanship", "Coast Guard Marksmanship Ribbon", "Coast Guard", 1164, "medal", ""],
  ["joint-nato", "NATO Medal", "Joint", 1200, "medal", R.nato],
  ["joint-un-mission", "United Nations Medal", "Joint", 1210, "medal", ""],
  ["joint-multinational", "Multinational Force and Observers Medal", "Joint", 1220, "medal", ""],
  ["army-aviation-badge", "Army Aviation Badge (ribbon mount)", "Army", 1300, "badge", ""],
  ["navy-diver", "Navy Diving Officer / enlisted badges", "Navy", 1301, "badge", ""],
  ["af-space-ops", "Space Operations Badge (Air Force)", "Air Force", 1302, "badge", ""],
  ["sf-guardian-service", "Guardian Service Ribbon (Space Force)", "Space Force", 1303, "medal", ""],
  ["cg-advanced-boat", "Advanced Boat Force Operations Insignia", "Coast Guard", 1304, "badge", ""],
  ["army-drivers-badge", "Driver and Mechanic Badge", "Army", 1310, "badge", ""],
  ["navy-surface-warfare", "Surface Warfare insignia (enlisted)", "Navy", 1311, "badge", ""],
  ["navy-air-warfare", "Air Warfare insignia", "Navy", 1312, "badge", ""],
  ["mc-weapons-quals", "Weapons Qualification (Marine Corps)", "Marine Corps", 1313, "medal", ""],
  ["af-training-ribbon", "Air Force Training Ribbon", "Air Force", 1320, "medal", ""],
  ["army-basic-training", "Army Basic Training Honor Graduate", "Army", 1321, "medal", ""],
  ["navy-basic-training", "Navy Basic Military Training Honor Graduate", "Navy", 1322, "medal", ""],
  ["joint-remote-combat", "Remote Combat Effects Campaign Medal", "Joint", 1400, "medal", ""],
  ["joint-space-force-cm", "Space Force Campaign / service medals (future)", "Space Force", 1410, "medal", ""],
  ["army-valorous-unit", "Valorous Unit Award", "Army", 1500, "citation", ""],
  ["navy-meritorious-civ", "Navy Meritorious Civilian Service (mil analog)", "Navy", 1510, "commendation", ""],
  ["cg-special-ops-service", "Coast Guard Special Operations Service Ribbon", "Coast Guard", 1520, "medal", ""],
  ["cg-basic-training-ribbon", "Coast Guard Basic Training Ribbon", "Coast Guard", 1521, "medal", ""],
  ["cg-officer-training", "Coast Guard Officer Training Ribbon", "Coast Guard", 1522, "medal", ""],
  ["cg-enlisted-personnel", "Coast Guard Enlisted Person of the Year Ribbon", "Coast Guard", 1523, "medal", ""],
  ["cg-bicentennial", "Coast Guard Bicentennial Unit Commendation", "Coast Guard", 1524, "commendation", ""],
  ["cg-defense-service", "Coast Guard Defense Service Medal", "Coast Guard", 1525, "medal", ""],
  ["cg-expeditionary", "Coast Guard Expeditionary Medal", "Coast Guard", 1526, "medal", ""],
  ["cg-arctic-service", "Coast Guard Arctic Service Medal", "Coast Guard", 1527, "medal", ""],
  ["cg-honor-graduate", "Honor Graduate Ribbon (Coast Guard)", "Coast Guard", 1529, "medal", ""],
  ["navy-fleet-marine", "Fleet Marine Force Ribbon", "Navy", 1600, "medal", ""],
  ["navy-navy-pistol", "Navy Pistol Shot Ribbon", "Navy", 1601, "medal", ""],
  ["navy-navy-rifle", "Navy Rifle Shot Ribbon", "Navy", 1602, "medal", ""],
  ["mc-drill-instructor", "Drill Instructor Ribbon", "Marine Corps", 1610, "medal", ""],
  ["mc-security-guard", "Marine Corps Security Guard Ribbon", "Marine Corps", 1611, "medal", ""],
  ["af-nuclear-deterrence", "Nuclear Deterrence Operations Service Medal", "Air Force", 1620, "medal", ""],
  ["af-remote-pilot", "Remote Piloted Aircraft Ribbon", "Air Force", 1621, "medal", ""],
  ["army-ww2-victory", "World War II Victory Medal (legacy)", "Army", 1700, "medal", ""],
  ["navy-ww2-asia", "Asiatic-Pacific Campaign Medal (legacy)", "Navy", 1701, "medal", ""],
  ["joint-korean-war", "Korean Service Medal", "Joint", 1710, "medal", ""],
  ["joint-vietnam-svc", "Vietnam Service Medal", "Joint", 1720, "medal", ""],
  ["joint-southwest-asia", "Southwest Asia Service Medal", "Joint", 1730, "medal", ""],
  ["joint-kosovo", "Kosovo Campaign Medal", "Joint", 1740, "medal", ""],
  ["joint-iraqi-freedom", "Iraq Campaign Medal (OIF)", "Joint", 1750, "medal", ""],
  ["joint-enduring-freedom", "Afghanistan Campaign Medal (OEF)", "Joint", 1760, "medal", ""],
  ["army-superior-cadet", "Superior Cadet Decoration", "Army", 1800, "medal", ""],
  ["af-cadet-award", "Air Force ROTC Ribbon", "Air Force", 1801, "medal", ""],
  ["navy-jrotc", "Navy JROTC Ribbon", "Navy", 1802, "medal", ""],
  ["mc-jrotc", "Marine Corps JROTC Ribbon", "Marine Corps", 1803, "medal", ""],
  ["cg-cadet-ribbon", "Coast Guard JROTC Ribbon", "Coast Guard", 1804, "medal", ""],

  // ── U.S. Army skill tabs & warfare / combat / special-skill badges (awardType: badge; AR 670-1) ──
  // Skill tabs (SSI / unit / individual tabs)
  ["army-tab-special-forces", "Special Forces Tab", "Army", 5101, "badge", ""],
  ["army-tab-ranger", "Ranger Tab", "Army", 5100, "badge", ""],
  ["army-tab-sapper", "Sapper Tab", "Army", 5102, "badge", ""],
  ["army-tab-presidents-hundred", "President's Hundred Tab", "Army", 5103, "badge", ""],
  ["army-tab-airborne", "Airborne Tab", "Army", 5107, "badge", ""],
  ["army-tab-arctic", "Arctic Tab", "Army", 5108, "badge", ""],
  ["army-tab-sniper", "Sniper Tab", "Army", 5104, "badge", ""],
  ["army-tab-jungle", "Jungle Expert Tab", "Army", 5105, "badge", ""],
  ["army-tab-mountain", "Mountain Tab", "Army", 5106, "badge", ""],
  // Master combat badges (Group 1; policy as of 2025 - Master CIB/CMB/CAB)
  ["army-badge-mcib", "Master Combat Infantryman Badge (Master Infantryman)", "Army", 5185, "badge", ""],
  // Master-level field medical wear is MCMB (not a separate "Master EFMB"; see also EFMB below)
  ["army-badge-mcmb", "Master Combat Medical Badge (master field medical - EFMB/CMB pathway)", "Army", 5186, "badge", ""],
  ["army-badge-mcab", "Master Combat Action Badge", "Army", 5187, "badge", ""],
  // Combat / expert (standard)
  ["army-badge-cib", "Combat Infantryman Badge", "Army", 5200, "badge", ""],
  ["army-badge-cmb", "Combat Medical Badge", "Army", 5201, "badge", ""],
  ["army-badge-eib", "Expert Infantryman Badge", "Army", 5203, "badge", ""],
  ["army-badge-efmb", "Expert Field Medical Badge (EFMB - no separate Master EFMB; master wear is MCMB)", "Army", 5204, "badge", ""],
  // DA uses Expert Soldier Badge (ESB); no distinct badge titled Master Soldier in AR 670-1
  ["army-badge-esb", "Expert Soldier Badge (ESB - soldier proficiency; not a separate Master Soldier badge)", "Army", 5205, "badge", ""],
  // Parachutist & rigger
  ["army-badge-parachutist-basic", "Parachutist Badge (Basic)", "Army", 5300, "badge", ""],
  ["army-badge-parachutist-senior", "Parachutist Badge (Senior)", "Army", 5301, "badge", ""],
  ["army-badge-parachutist-master", "Parachutist Badge (Master)", "Army", 5302, "badge", ""],
  ["army-badge-parachute-rigger", "Parachute Rigger Badge", "Army", 5303, "badge", ""],
  // Air assault, pathfinder, MFF (special operations parachuting)
  ["army-badge-air-assault", "Air Assault Badge", "Army", 5310, "badge", ""],
  ["army-badge-pathfinder", "Pathfinder Badge", "Army", 5320, "badge", ""],
  ["army-badge-military-freefall", "Military Freefall Parachutist Badge (basic HALO/HAHO)", "Army", 5330, "badge", ""],
  // MFF Jumpmaster course awards the master badge (star and wreath), not a separate Jumpmaster-only device
  ["army-badge-military-freefall-jumpmaster", "Master Military Freefall Parachutist Badge (MFF Jumpmaster course)", "Army", 5340, "badge", ""],
  // Underwater / diving (including Special Forces & special operations diver)
  ["army-badge-special-operations-diver", "Special Operations Diver Badge", "Army", 5280, "badge", ""],
  ["army-badge-scuba-diver-second-class", "Scuba Diver Badge (Second Class)", "Army", 5281, "badge", ""],
  ["army-badge-diver-first-class", "Diver Badge (First Class)", "Army", 5282, "badge", ""],
  ["army-badge-salvage-diver", "Salvage Diver Badge", "Army", 5283, "badge", ""],
  // Space, EOD
  ["army-badge-space-operations", "Space Operations Badge", "Army", 5350, "badge", ""],
  ["army-badge-space-operations-senior", "Space Operations Badge (Senior)", "Army", 5351, "badge", ""],
  ["army-badge-space-operations-master", "Space Operations Badge (Master)", "Army", 5352, "badge", ""],
  ["army-badge-eod-basic", "Explosive Ordnance Disposal Badge (Basic)", "Army", 5360, "badge", ""],
  ["army-badge-eod-senior", "Explosive Ordnance Disposal Badge (Senior)", "Army", 5361, "badge", ""],
  ["army-badge-eod-master", "Explosive Ordnance Disposal Badge (Master)", "Army", 5362, "badge", ""],
  // Aviation
  ["army-badge-aviator", "Aviator Badge", "Army", 5400, "badge", ""],
  ["army-badge-aviator-senior", "Senior Aviator Badge", "Army", 5410, "badge", ""],
  ["army-badge-aviator-master", "Master Aviator Badge", "Army", 5420, "badge", ""],
  ["army-badge-flight-surgeon", "Flight Surgeon Badge", "Army", 5405, "badge", ""],
  // Same badge as DA “Aircrew Badge”; “Aircraft Crewman” is the common enlisted name (15-series crew).
  ["army-badge-aircrew", "Aircrew Badge (Aircraft Crewman Badge)", "Army", 5430, "badge", ""],
  ["army-badge-aircrew-senior", "Senior Aircrew Badge", "Army", 5431, "badge", ""],
  ["army-badge-aircrew-master", "Master Aircrew Badge", "Army", 5432, "badge", ""],
  // Driver & mechanic (wear levels / qualification)
  ["army-badge-driver-mechanic", "Driver and Mechanic Badge", "Army", 5450, "badge", ""],
  ["army-badge-senior-driver", "Senior Driver Badge", "Army", 5451, "badge", ""],
  ["army-badge-master-driver", "Master Driver Badge", "Army", 5452, "badge", ""],
  // Mariner & mountaineering (new / emerging DA badges)
  ["army-badge-mariner-basic", "Mariner Badge (Basic)", "Army", 5460, "badge", ""],
  ["army-badge-mariner-senior", "Mariner Badge (Senior)", "Army", 5461, "badge", ""],
  ["army-badge-mariner-master", "Mariner Badge (Master)", "Army", 5462, "badge", ""],
  ["army-badge-mountaineering", "Mountaineering Badge", "Army", 5465, "badge", ""],

  // ── Navy & Marine Corps warfare pins / aviation / expeditionary badges (NAVPERS / MCO P1020) ──
  ["navy-badge-naval-aviator", "Naval Aviator (Pilot) Insignia", "Navy", 6000, "badge", ""],
  ["navy-badge-naval-flight-officer", "Naval Flight Officer Insignia", "Navy", 6001, "badge", ""],
  ["navy-badge-naval-astronaut", "Naval Astronaut Insignia", "Navy", 6002, "badge", ""],
  ["mc-badge-naval-aviator", "Naval Aviator Insignia (Marine Corps)", "Marine Corps", 6003, "badge", ""],
  ["mc-badge-naval-flight-officer", "Naval Flight Officer Insignia (Marine Corps)", "Marine Corps", 6004, "badge", ""],
  ["navy-badge-surface-warfare-officer", "Surface Warfare Officer Insignia", "Navy", 6010, "badge", ""],
  ["navy-badge-enlisted-surface-warfare", "Enlisted Surface Warfare Specialist (ESWS)", "Navy", 6011, "badge", ""],
  ["navy-badge-surface-warfare-medical", "Surface Warfare Medical Department Officer", "Navy", 6012, "badge", ""],
  ["navy-badge-surface-warfare-dental", "Surface Warfare Dental Corps Officer", "Navy", 6013, "badge", ""],
  ["navy-badge-submarine-officer", "Submarine Warfare Officer Insignia (Dolphins)", "Navy", 6020, "badge", ""],
  ["navy-badge-enlisted-submarine-warfare", "Enlisted Submarine Warfare Specialist (SS)", "Navy", 6021, "badge", ""],
  ["navy-badge-submarine-medical", "Submarine Medical Officer Insignia", "Navy", 6022, "badge", ""],
  ["navy-badge-submarine-supply", "Submarine Supply Corps Officer Insignia", "Navy", 6023, "badge", ""],
  ["navy-badge-special-warfare-seal", "Special Warfare Operator (SEAL) Insignia", "Navy", 6030, "badge", ""],
  ["navy-badge-special-warfare-boat", "Special Warfare Combatant-Craft Crewman (SWCC) Insignia", "Navy", 6031, "badge", ""],
  ["navy-badge-explosive-ordnance-disposal", "Explosive Ordnance Disposal Warfare Insignia (Navy)", "Navy", 6032, "badge", ""],
  ["navy-badge-fleet-marine-force", "Fleet Marine Force Enlisted Warfare Specialist (FMF)", "Navy", 6035, "badge", ""],
  ["navy-badge-fleet-marine-force-officer", "Fleet Marine Force Officer Insignia", "Navy", 6036, "badge", ""],
  ["navy-badge-aircrew", "Naval Aircrew Warfare Specialist / Aircrew Insignia", "Navy", 6040, "badge", ""],
  ["navy-badge-integrated-operations", "Integrated Undersea Surveillance System Officer / enlisted", "Navy", 6042, "badge", ""],
  ["navy-badge-information-dominance", "Information Warfare / Cryptologic Warfare Insignia", "Navy", 6045, "badge", ""],
  ["navy-badge-meteorology-oceanography", "Meteorology and Oceanography (METOC) Officer Insignia", "Navy", 6046, "badge", ""],
  ["navy-badge-expeditionary-warfare", "Expeditionary Warfare Specialist", "Navy", 6048, "badge", ""],
  ["navy-badge-parachutist", "Navy / Marine Corps Parachutist Insignia", "Navy", 6050, "badge", ""],
  ["mc-badge-parachutist", "Parachutist Insignia (Marine Corps)", "Marine Corps", 6051, "badge", ""],
  ["navy-badge-scuba", "Navy Scuba Diver Insignia", "Navy", 6052, "badge", ""],
  ["mc-badge-combat-aircrew", "Combat Aircrew Insignia (Marine Corps — legacy / flight suit)", "Marine Corps", 6053, "badge", ""],
  ["mc-badge-aircrew", "Aircrew Insignia (Marine Corps)", "Marine Corps", 6054, "badge", ""],
  ["mc-badge-diver", "Diver Insignia (Marine Corps)", "Marine Corps", 6055, "badge", ""],
  ["mc-badge-drill-instructor", "Drill Instructor Badge (Marine Corps)", "Marine Corps", 6056, "badge", ""],
  ["mc-badge-security-forces", "Military Police / Security Forces Badge (Marine Corps)", "Marine Corps", 6057, "badge", ""],

  // ── Air Force & Space Force occupational / warfare badges (AFI 36-2903; USSF guidance) ──
  ["af-badge-command-pilot", "USAF Pilot / Command Pilot Badges (wings)", "Air Force", 6100, "badge", ""],
  ["af-badge-rpa-pilot", "Remotely Piloted Aircraft (RPA) Pilot Badge", "Air Force", 6101, "badge", ""],
  ["af-badge-combat-systems-officer", "Combat Systems Officer / Navigator Badge", "Air Force", 6102, "badge", ""],
  ["af-badge-air-battle-manager", "Air Battle Manager Badge", "Air Force", 6103, "badge", ""],
  ["af-badge-astronaut", "USAF / USSF Astronaut Badge", "Air Force", 6104, "badge", ""],
  ["af-badge-missile-operations", "Missile Operations Badge", "Air Force", 6110, "badge", ""],
  ["af-badge-missile-operations-senior", "Missile Operations Badge (Senior)", "Air Force", 6111, "badge", ""],
  ["af-badge-missile-operations-master", "Missile Operations Badge (Master)", "Air Force", 6112, "badge", ""],
  ["af-badge-cyberspace-operator", "Cyberspace Operator Badge", "Air Force", 6115, "badge", ""],
  ["af-badge-cyberspace-operator-senior", "Cyberspace Operator Badge (Senior)", "Air Force", 6116, "badge", ""],
  ["af-badge-cyberspace-operator-master", "Cyberspace Operator Badge (Master)", "Air Force", 6117, "badge", ""],
  ["af-badge-intelligence", "Air Force Intelligence Badge", "Air Force", 6120, "badge", ""],
  ["af-badge-weather", "Meteorologist / Weather Officer Badge", "Air Force", 6121, "badge", ""],
  ["af-badge-space-operations-badge", "Space Operations Badge (Air Force — orbital & missile ops)", "Air Force", 6125, "badge", ""],
  ["af-badge-space-operations-senior", "Space Operations Badge (Senior — Air Force)", "Air Force", 6126, "badge", ""],
  ["af-badge-space-operations-master", "Space Operations Badge (Master — Air Force)", "Air Force", 6127, "badge", ""],
  ["af-badge-aircrew-enlisted", "Enlisted Aircrew / Flight Engineer Badges", "Air Force", 6130, "badge", ""],
  ["af-badge-parachutist-basic", "Basic Parachutist Badge (Air Force)", "Air Force", 6135, "badge", ""],
  ["af-badge-parachutist-jumpmaster", "Jumpmaster Badge (Air Force)", "Air Force", 6136, "badge", ""],
  ["af-badge-dive", "Dive Badge (Air Force combat / pararescue / special tactics)", "Air Force", 6138, "badge", ""],
  ["af-badge-explosive-ordnance-disposal", "Explosive Ordnance Disposal Badge (Air Force)", "Air Force", 6140, "badge", ""],
  ["af-badge-security-forces", "Security Forces Badge / Defender", "Air Force", 6142, "badge", ""],
  ["af-badge-medical", "Medical Corps / Nurse / Biomedical Science Corps insignia", "Air Force", 6145, "badge", ""],

  ["sf-badge-space-operations", "Space Operations Badge (Guardian — basic)", "Space Force", 6200, "badge", ""],
  ["sf-badge-space-operations-senior", "Space Operations Badge (Guardian — senior)", "Space Force", 6201, "badge", ""],
  ["sf-badge-space-operations-master", "Space Operations Badge (Guardian — master)", "Space Force", 6202, "badge", ""],
  ["sf-badge-intelligence", "Intelligence Badge (Space Force)", "Space Force", 6210, "badge", ""],
  ["sf-badge-cyber", "Cyberspace Operator Badge (Space Force)", "Space Force", 6215, "badge", ""],
  ["sf-badge-acquisitions", "Acquisitions / Engineer Functional Badge (Space Force)", "Space Force", 6220, "badge", ""],
  ["sf-badge-orbital-warfare", "Orbital Warfare Specialist identifier (functional area)", "Space Force", 6225, "badge", ""],
  ["sf-badge-space-electronic-warfare", "Space Electronic Warfare identifier (functional area)", "Space Force", 6226, "badge", ""],
  ["sf-badge-sustainment", "Space Sustainment identifier (functional area)", "Space Force", 6227, "badge", ""],
  ["sf-badge-command-and-control", "Space Command & Control identifier (functional area)", "Space Force", 6228, "badge", ""],
  ["sf-badge-missile-warning", "Missile Warning identifier (functional area)", "Space Force", 6229, "badge", ""],
  ["sf-badge-guardian-astronaut", "Guardian Astronaut Badge (when authorized)", "Space Force", 6235, "badge", ""],

  // ── Coast Guard qualification / warfare badges ──
  ["cg-badge-aviator", "Coast Guard Aviator / Aircrew Wings", "Coast Guard", 6300, "badge", ""],
  ["cg-badge-aircrew", "Coast Guard Advanced Boat Force / aircrew qualification badge", "Coast Guard", 6301, "badge", ""],
  ["cg-badge-coxswain", "Coxswain Insignia", "Coast Guard", 6310, "badge", ""],
  ["cg-badge-surfman", "Surfman Badge (heavy weather boat)", "Coast Guard", 6311, "badge", ""],
  ["cg-badge-tactical-law-enforcement", "Tactical Law Enforcement (TACLET) Badge", "Coast Guard", 6315, "badge", ""],
  ["cg-badge-diver", "Coast Guard Diver Insignia", "Coast Guard", 6320, "badge", ""],
  ["cg-badge-rescue-swimmer", "Rescue Swimmer insignia", "Coast Guard", 6321, "badge", ""],
  ["cg-badge-command-at-sea", "Command Afloat / Command Ashore insignia", "Coast Guard", 6325, "badge", ""],
  ["cg-badge-permanent-cutter-forces", "Permanent Cutter Forces insignia", "Coast Guard", 6330, "badge", ""],
  ["cg-badge-port-security", "Maritime Law Enforcement / Port Security Badge", "Coast Guard", 6335, "badge", ""],

  // ── Joint / multi-service identification badges (wear on joint assignments) ──
  ["joint-badge-office-secretary-defense", "Office of the Secretary of Defense Identification Badge", "Joint", 6400, "badge", ""],
  ["joint-badge-joint-chiefs-staff", "Joint Chiefs of Staff Identification Badge", "Joint", 6401, "badge", ""],
  ["joint-badge-hq-department-army", "Army Staff Identification Badge", "Joint", 6405, "badge", ""],
  ["joint-badge-hq-department-navy", "Navy Staff Identification Badge", "Joint", 6406, "badge", ""],
  ["joint-badge-hq-department-air-force", "Air Force Staff Identification Badge", "Joint", 6407, "badge", ""],
  ["joint-badge-hq-coast-guard", "Coast Guard Headquarters Staff Badge", "Joint", 6408, "badge", ""],
  ["joint-badge-nato", "NATO Identification Badge", "Joint", 6410, "badge", ""],
  ["joint-badge-un-mission", "United Nations Mission Identification Badge", "Joint", 6411, "badge", ""],
];

export const MILITARY_AWARDS_CATALOG: MilitaryAwardDefinition[] = RAW.map(
  ([id, name, branch, precedence, awardType, imageUrl]) => ({
    id,
    name,
    branch,
    precedence,
    awardType,
    imageUrl: imageUrl ?? "",
  }),
);

const BY_ID = new Map<string, MilitaryAwardDefinition>();
for (const a of MILITARY_AWARDS_CATALOG) {
  if (BY_ID.has(a.id)) throw new Error(`Duplicate military award id: ${a.id}`);
  BY_ID.set(a.id, a);
}

export function getMilitaryAwardById(id: string): MilitaryAwardDefinition | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export type AwardSortRow = {
  awardCatalogId?: string | null;
  awardedAt: string;
};

export function awardCatalogPrecedence(catalogId: string | null | undefined): number {
  const def = getMilitaryAwardById(String(catalogId || "").trim());
  return def?.precedence ?? 999_999;
}

/** Higher-precedence awards first; ties by most recent award date. */
export function sortAwardsByPrecedence<T extends AwardSortRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = awardCatalogPrecedence(a.awardCatalogId);
    const pb = awardCatalogPrecedence(b.awardCatalogId);
    if (pa !== pb) return pa - pb;
    return new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime();
  });
}
