/**
 * Hand-labeled validation set for retrieval quality.
 *
 * 32 student profiles written in the language students actually use ("I want to
 * build robots", "I want to be a nurse"), against a 44-program fixture catalog
 * written in the language program pages actually use. The labels are graded
 * relevance judgments made by hand:
 *
 *   2 = a counselor would put this in front of this student first
 *   1 = reasonable, would not be a mistake to show
 *   0 = not labeled, treated as irrelevant
 *
 * The point of the mismatch between the two vocabularies is that a pure keyword
 * ranker cannot pass this set. It is the regression test for the semantic layer.
 */

import type { RankableOpportunity, RankProfile } from "@/lib/matching";

export const FIXTURE_CATALOG: RankableOpportunity[] = [
  // Robotics / hardware
  { id: "p01", title: "FIRST Tech Challenge Mentorship Grant", organization: "FIRST", category: "competition", eligibility: "Open to all high school students", description: "Team funding and mentorship for mechatronics build seasons, CAD, and autonomous control.", tags: ["ftc", "mechatronics"], related_skills: [], application_fee: 0 },
  { id: "p02", title: "VEX Worlds Travel Fund", organization: "REC Foundation", category: "competition", eligibility: "Open to all high school students", description: "Covers travel for qualifying VEX teams building autonomous scoring machines.", tags: ["vex"], related_skills: [], travel_required: true },
  { id: "p03", title: "Embedded Systems Summer Lab", organization: "State Polytechnic", category: "summer_program", eligibility: "Open to all high school students", description: "Arduino and Raspberry Pi firmware, sensor fusion, and drone flight controllers.", tags: ["embedded", "drone"], related_skills: [], application_fee: 0 },
  // Software / AI
  { id: "p04", title: "Open Source Fellows", organization: "Code Commons", category: "internship", eligibility: "Open to all high school students", description: "Paid summer contributions to production repositories, code review, and algorithms practice.", tags: ["software"], related_skills: [], application_fee: 0 },
  { id: "p05", title: "Machine Learning Research Apprenticeship", organization: "University AI Institute", category: "research", eligibility: "Open to all high school students", description: "Neural network training, computer vision datasets, and a published poster.", tags: ["ml", "deep learning"], related_skills: [], application_fee: 0 },
  { id: "p06", title: "CyberPatriot Defense Academy", organization: "AFA", category: "competition", eligibility: "Open to all high school students", description: "Network defense drills, capture the flag rounds, and cryptography fundamentals.", tags: ["ctf"], related_skills: [] },
  { id: "p07", title: "Congressional App Challenge", organization: "US House of Representatives", category: "competition", eligibility: "Open to all high school students", description: "Build and submit an application, judged on ideology, impact, and technical structure.", tags: ["app"], related_skills: [], application_fee: 0 },
  // Bio / medicine
  { id: "p08", title: "Hospital Clinical Shadowing Cohort", organization: "County Health System", category: "internship", eligibility: "Open to all high school students", description: "Rotations with physicians and nurses, patient-safety training, healthcare career pathways.", tags: ["clinical"], related_skills: [], application_fee: 0 },
  { id: "p09", title: "Molecular Genetics Summer Institute", organization: "Genome Center", category: "summer_program", eligibility: "Open to all high school students", description: "Wet lab work in cell culture, PCR, and genomics data analysis.", tags: ["genomics"], related_skills: [] },
  { id: "p10", title: "USABO Semifinalist Training Camp", organization: "Center for Excellence in Education", category: "competition", eligibility: "Open to all high school students", description: "Olympiad-level biology preparation in physiology, ecology, and molecular biology.", tags: ["usabo"], related_skills: [] },
  { id: "p11", title: "Future Nurses Scholarship", organization: "State Nursing Foundation", category: "scholarship", eligibility: "Open to all high school students", description: "Award for students entering nursing and allied healthcare programs.", tags: ["nursing"], related_skills: [], value_usd: 8000, application_fee: 0 },
  { id: "p12", title: "Neuroscience Brain Bee Regional", organization: "Society for Neuroscience", category: "competition", eligibility: "Open to all high school students", description: "Cognitive science and neurology question rounds with a lab tour.", tags: ["brain bee"], related_skills: [] },
  // Physical sciences / math
  { id: "p13", title: "Astrophysics Observing Fellowship", organization: "Mountain Observatory", category: "research", eligibility: "Open to all high school students", description: "Telescope time, quantum optics seminars, and space mission data reduction.", tags: ["astronomy"], related_skills: [] },
  { id: "p14", title: "Chemistry Olympiad Prep Intensive", organization: "ACS", category: "competition", eligibility: "Open to all high school students", description: "Organic chemistry problem sets and materials lab technique for USNCO.", tags: ["usnco"], related_skills: [] },
  { id: "p15", title: "Number Theory Summer Seminar", organization: "Mathematics Institute", category: "summer_program", eligibility: "Open to all high school students", description: "Proof writing for AMC and AIME qualifiers, olympiad combinatorics.", tags: ["amc"], related_skills: [] },
  // Environment / agriculture
  { id: "p16", title: "Climate Solutions Youth Corps", organization: "Green Futures", category: "internship", eligibility: "Open to all high school students", description: "Paid fieldwork on renewable installations, watershed conservation, and sustainability audits.", tags: ["climate"], related_skills: [], application_fee: 0 },
  { id: "p17", title: "Sustainable Agriculture Apprenticeship", organization: "Land Grant Extension", category: "internship", eligibility: "Open to all high school students", description: "Soil science, crop rotation, and farming technology on working farms.", tags: ["agriculture"], related_skills: [] },
  // Law / policy / civics
  { id: "p18", title: "Senate Page Program", organization: "US Senate", category: "internship", eligibility: "Open to all high school students", description: "Legislative floor service, civics immersion, and government process training.", tags: ["government"], related_skills: [], application_fee: 0 },
  { id: "p19", title: "Youth Advocacy Legal Institute", organization: "Justice Project", category: "summer_program", eligibility: "Open to all high school students", description: "Mock trial, policy drafting, and legal research on juvenile justice.", tags: ["mock trial"], related_skills: [], application_fee: 0 },
  { id: "p20", title: "Model UN Global Conference Scholarship", organization: "UNA", category: "competition", eligibility: "Open to all high school students", description: "Delegate fees and travel for international diplomacy simulation.", tags: ["model un"], related_skills: [] },
  // Business
  { id: "p21", title: "Teen Founders Accelerator", organization: "Startup Guild", category: "summer_program", eligibility: "Open to all high school students", description: "Customer discovery, unit economics, and a demo day for student entrepreneurs.", tags: ["startup"], related_skills: [], application_fee: 0 },
  { id: "p22", title: "DECA Emerging Leader Award", organization: "DECA", category: "competition", eligibility: "Open to all high school students", description: "Marketing and finance case competition with a cash prize.", tags: ["deca"], related_skills: [] },
  // Arts / writing
  { id: "p23", title: "Portfolio Studio Intensive", organization: "City Art League", category: "summer_program", eligibility: "Open to all high school students", description: "Drawing, sculpture, and graphic design critique toward an admissions portfolio.", tags: ["portfolio"], related_skills: [], application_fee: 0 },
  { id: "p24", title: "Documentary Film Lab", organization: "Independent Media Center", category: "summer_program", eligibility: "Open to all high school students", description: "Cinematography, editing, and animation for short nonfiction film.", tags: ["film"], related_skills: [] },
  { id: "p25", title: "Scholastic Writing Awards", organization: "Alliance for Young Artists and Writers", category: "competition", eligibility: "Open to all high school students", description: "National recognition for poetry, creative writing, and journalism portfolios.", tags: ["writing"], related_skills: [], application_fee: 0 },
  { id: "p26", title: "Youth Symphony Fellowship", organization: "Metro Symphony", category: "summer_program", eligibility: "Open to all high school students", description: "Orchestra seat, composition coaching, and instrument loan for young musicians.", tags: ["orchestra"], related_skills: [] },
  // Trades / aviation / teaching
  { id: "p27", title: "Registered Welding Pre-Apprenticeship", organization: "Trades Council", category: "internship", eligibility: "Open to all high school students", description: "Paid CTE pathway into welding and fabrication with certification testing.", tags: ["welding"], related_skills: [], application_fee: 0 },
  { id: "p28", title: "Young Aviators Flight Scholarship", organization: "Pilot Association", category: "scholarship", eligibility: "Open to all high school students", description: "Covers flight hours toward a private pilot certificate.", tags: ["pilot"], related_skills: [], value_usd: 12000 },
  { id: "p29", title: "Future Educators Summer Corps", organization: "Teach Forward", category: "internship", eligibility: "Open to all high school students", description: "Paid tutoring placements, curriculum design, and classroom instruction coaching.", tags: ["tutor"], related_skills: [], application_fee: 0 },
  // Equity / need-based
  { id: "p30", title: "QuestBridge National College Match", organization: "QuestBridge", category: "scholarship", eligibility: "Open to all high school seniors", description: "Full four year scholarship to partner colleges for high achieving low income students.", tags: ["full ride"], related_skills: [], value_usd: 320000, application_fee: 0, underrepresented: true },
  { id: "p31", title: "Foster Youth Education and Training Voucher", organization: "State Child Welfare", category: "scholarship", eligibility: "Open to youth with foster care experience", description: "ETV funds and tuition fee waivers for current and former foster youth, plus campus support.", tags: ["etv", "foster"], related_skills: [], application_fee: 0 },
  { id: "p32", title: "SchoolHouse Connection Youth Scholarship", organization: "SchoolHouse Connection", category: "scholarship", eligibility: "Open to students experiencing homelessness", description: "Award and mentoring for unaccompanied homeless youth, McKinney-Vento connected.", tags: ["homeless"], related_skills: [], application_fee: 0 },
  { id: "p33", title: "TheDream.US National Scholarship", organization: "TheDream.US", category: "scholarship", eligibility: "Open to DACA and undocumented students, no citizenship requirement", description: "Tuition scholarship for undocumented students at partner colleges.", tags: ["daca"], related_skills: [], application_fee: 0 },
  { id: "p34", title: "First Generation Scholars Program", organization: "College Access Network", category: "scholarship", eligibility: "Open to first generation college students", description: "Need based award plus advising for students whose parents did not attend college.", tags: ["first-gen"], related_skills: [], application_fee: 0, value_usd: 20000 },
  { id: "p35", title: "Rural Scholars Leadership Award", organization: "Rural Futures Fund", category: "scholarship", eligibility: "Open to students from rural communities", description: "Award for students from small town and farming communities entering college.", tags: ["rural"], related_skills: [], application_fee: 0 },
  { id: "p36", title: "Pell Bridge Emergency Aid", organization: "Student Basic Needs Fund", category: "grant", eligibility: "Open to Pell eligible students", description: "Need based emergency grant covering food, housing, and transportation gaps.", tags: ["need based"], related_skills: [], application_fee: 0 },
  // Distractors, plausible but off-topic
  { id: "p37", title: "Marching Band Uniform Fund", organization: "Booster Club", category: "grant", eligibility: "Open to all high school students", description: "Uniform stipend for band members in good standing.", tags: [], related_skills: [] },
  { id: "p38", title: "Equestrian Riding Camp", organization: "Valley Stables", category: "summer_program", eligibility: "Open to all high school students", description: "Horsemanship instruction and stable management.", tags: [], related_skills: [], application_fee: 450 },
  { id: "p39", title: "Culinary Knife Skills Weekend", organization: "Culinary Guild", category: "summer_program", eligibility: "Open to all high school students", description: "Knife technique and plating for aspiring cooks.", tags: [], related_skills: [] },
  { id: "p40", title: "Local History Essay Prize", organization: "County Historical Society", category: "competition", eligibility: "Open to all high school students", description: "Short essay on county history judged by local archivists.", tags: [], related_skills: [] },
  { id: "p41", title: "Graduate Fellowship in Public Administration", organization: "Policy School", category: "research", eligibility: "Graduate students only", description: "Doctoral level policy research assistantship.", tags: [], related_skills: [] },
  { id: "p42", title: "Golf Caddie Scholarship", organization: "Regional Golf Association", category: "scholarship", eligibility: "Open to students who caddied two seasons", description: "Award for experienced caddies at member clubs.", tags: [], related_skills: [] },
  { id: "p43", title: "Ceramics Wheel Throwing Workshop", organization: "Community Center", category: "summer_program", eligibility: "Open to all high school students", description: "Six week pottery wheel and glazing workshop.", tags: [], related_skills: [], application_fee: 200 },
  { id: "p44", title: "Retail Management Trainee Program", organization: "Regional Grocer", category: "internship", eligibility: "Open to students 18 and older", description: "Store operations and shift supervision training.", tags: [], related_skills: [] },
];

const HS: RankProfile = { education_level: "high_school" };

export type LabeledCase = {
  name: string;
  profile: RankProfile;
  /** Graded relevance judgments, 2 = strong, 1 = plausible. */
  gains: Record<string, number>;
};

export const LABELED_CASES: LabeledCase[] = [
  { name: "wants to build robots", profile: { ...HS, career_interests: ["I want to build robots"], academic_interests: ["making machines move"] }, gains: { p01: 2, p02: 2, p03: 2, p04: 1 } },
  { name: "drone hobbyist", profile: { ...HS, extracurriculars: ["flying drones I soldered myself"], long_term_goals: "design flying machines" }, gains: { p03: 2, p01: 1, p28: 1, p02: 1 } },
  { name: "self taught coder", profile: { ...HS, skills: ["python", "javascript"], long_term_goals: "write software people use" }, gains: { p04: 2, p07: 2, p05: 1, p06: 1 } },
  { name: "wants to work on AI", profile: { ...HS, career_interests: ["artificial intelligence researcher"], intended_major: "computer science" }, gains: { p05: 2, p04: 2, p07: 1 } },
  { name: "breaks into things legally", profile: { ...HS, extracurriculars: ["capture the flag competitions"], career_interests: ["keeping networks safe"] }, gains: { p06: 2, p04: 1, p05: 1 } },
  { name: "future doctor", profile: { ...HS, career_interests: ["physician"], intended_major: "biology" }, gains: { p08: 2, p09: 2, p10: 2, p12: 1, p11: 1 } },
  { name: "wants to be a nurse", profile: { ...HS, career_interests: ["nursing"], long_term_goals: "work in a hospital taking care of patients" }, gains: { p11: 2, p08: 2 } },
  { name: "genetics obsessive", profile: { ...HS, academic_interests: ["DNA and heredity"], certifications: ["USABO Semifinalist"] }, gains: { p09: 2, p10: 2, p05: 1 } },
  { name: "brain and behavior", profile: { ...HS, academic_interests: ["how the brain works"], career_interests: ["neurologist"] }, gains: { p12: 2, p08: 1, p09: 1 } },
  { name: "space kid", profile: { ...HS, academic_interests: ["stars and galaxies"], long_term_goals: "work on space missions" }, gains: { p13: 2, p15: 1 } },
  { name: "chemistry competitor", profile: { ...HS, academic_interests: ["organic chemistry"], certifications: ["USNCO qualifier"] }, gains: { p14: 2, p09: 1 } },
  { name: "math proofs", profile: { ...HS, academic_interests: ["mathematics"], certifications: ["AIME qualifier"] }, gains: { p15: 2, p14: 1, p04: 1 } },
  { name: "climate worried", profile: { ...HS, long_term_goals: "fix climate change in my city", academic_interests: ["environmental science"] }, gains: { p16: 2, p17: 2, p19: 1 } },
  { name: "farm kid", profile: { ...HS, extracurriculars: ["FFA", "working on my family farm"], socioeconomic_info: "rural, low income" }, gains: { p17: 2, p35: 2, p16: 1, p36: 1 } },
  { name: "future lawyer", profile: { ...HS, career_interests: ["attorney"], extracurriculars: ["mock trial"] }, gains: { p19: 2, p18: 2, p20: 1 } },
  { name: "policy and government", profile: { ...HS, long_term_goals: "run for office and change laws", extracurriculars: ["student council"] }, gains: { p18: 2, p19: 2, p20: 2 } },
  { name: "international relations", profile: { ...HS, extracurriculars: ["model un"], academic_interests: ["diplomacy"] }, gains: { p20: 2, p18: 1, p19: 1 } },
  { name: "wants to start a company", profile: { ...HS, long_term_goals: "start my own business", extracurriculars: ["reselling sneakers"] }, gains: { p21: 2, p22: 2 } },
  { name: "business club officer", profile: { ...HS, extracurriculars: ["DECA state finalist"], intended_major: "finance" }, gains: { p22: 2, p21: 2 } },
  { name: "visual artist", profile: { ...HS, extracurriculars: ["drawing every day"], intended_major: "graphic design" }, gains: { p23: 2, p24: 1 } },
  { name: "filmmaker", profile: { ...HS, extracurriculars: ["making short films on my phone"], career_interests: ["director"] }, gains: { p24: 2, p23: 1, p25: 1 } },
  { name: "writer", profile: { ...HS, extracurriculars: ["school newspaper", "poetry"], intended_major: "english" }, gains: { p25: 2, p24: 1 } },
  { name: "musician", profile: { ...HS, extracurriculars: ["first chair violin"], long_term_goals: "compose music" }, gains: { p26: 2, p23: 1 } },
  { name: "hands on trades", profile: { ...HS, long_term_goals: "work with my hands and get certified fast", skills: ["welding"] }, gains: { p27: 2 } },
  { name: "wants to fly", profile: { ...HS, career_interests: ["pilot"], long_term_goals: "get my license before college" }, gains: { p28: 2, p03: 1 } },
  { name: "future teacher", profile: { ...HS, career_interests: ["teacher"], extracurriculars: ["tutoring younger kids"] }, gains: { p29: 2 } },
  { name: "low income high achiever", profile: { ...HS, socioeconomic_info: "low income, first generation", needs_full_ride: true, certifications: ["AIME qualifier"], dream_colleges: ["Stanford"] }, gains: { p30: 2, p34: 2, p36: 1, p15: 1 } },
  { name: "foster youth", profile: { ...HS, foster_youth_status: true, socioeconomic_info: "low income" }, gains: { p31: 2, p36: 1, p34: 1 } },
  { name: "housing insecure", profile: { ...HS, housing_insecure_status: true, socioeconomic_info: "low income" }, gains: { p32: 2, p36: 2 } },
  { name: "undocumented student", profile: { ...HS, immigration_status_note: "undocumented, no SSN", socioeconomic_info: "low income, first gen" }, gains: { p33: 2, p34: 1 } },
  { name: "first gen no counselor", profile: { ...HS, socioeconomic_info: "first generation, parents did not attend college", applying_with_financial_aid: true }, gains: { p34: 2, p30: 1, p36: 1 } },
  { name: "bio plus equity", profile: { ...HS, intended_major: "biology", career_interests: ["physician"], socioeconomic_info: "low income, first gen", needs_full_ride: true }, gains: { p08: 2, p09: 2, p30: 2, p34: 1, p11: 1 } },
];
