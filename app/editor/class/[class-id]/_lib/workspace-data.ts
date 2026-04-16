export type ExplorerItemType = "semester" | "course" | "unit" | "material";

export type ExplorerItem = {
  title: string;
  type: ExplorerItemType;
  checked: boolean;
  active?: boolean;
};

export type ApproachRow = [string, string, string];

export type Message = {
  author: string;
  time: string;
  side: "assistant" | "user";
  text: string;
};

export type WorkspaceSeed = {
  classId: string;
  workspaceName: string;
  classLabel: string;
  unitTitle: string;
  unitDescription: string;
  sectionTitle: string;
  sectionBody: string;
  scopeLabel: string;
  tableHeaders: [string, string, string];
  explorerItems: ExplorerItem[];
  sessions: string[];
  approaches: ApproachRow[];
  messages: Message[];
};

export const DEFAULT_CLASS_ID = "cs101-ai";

const workspaceSeeds = {
  "cs101-ai": {
    classId: "cs101-ai",
    workspaceName: "Lumina Study",
    classLabel: "Intro to AI (CS101)",
    unitTitle: "Unit 1: AI Fundamentals",
    unitDescription:
      "Comprehensive overview of basic artificial intelligence concepts, historical context, and the problem-solving frameworks most likely to matter on the exam.",
    sectionTitle: "1. What is Artificial Intelligence?",
    sectionBody:
      "Artificial intelligence is the effort to build systems that can perform tasks usually associated with human intelligence, including reasoning, pattern recognition, learning, and decision-making under uncertainty.",
    scopeLabel: "Scope: Unit 1 + 2 others",
    tableHeaders: ["Approach", "Focus", "Key model"],
    explorerItems: [
      { title: "Intro to AI (CS101)", type: "course", checked: true, active: true },
      { title: "Unit 1: Fundamentals", type: "unit", checked: true, active: true },
      { title: "Lecture Notes", type: "material", checked: true, active: true },
      { title: "Slide Deck", type: "material", checked: false },
      { title: "Practice Problems", type: "material", checked: false },
    ],
    sessions: ["Unit 1: Fundamentals", "Midterm Study", "A* Search"],
    approaches: [
      ["Thinking Humanly", "Cognitive modeling", "Human psychology"],
      ["Acting Humanly", "Behavioral modeling", "Turing test"],
      ["Thinking Rationally", "Formal logic", "Laws of thought"],
      ["Acting Rationally", "Performance measure", "Rational agents"],
    ],
    messages: [],
  },
  "bio201-genetics": {
    classId: "bio201-genetics",
    workspaceName: "Lumina Study",
    classLabel: "Biology 201",
    unitTitle: "Module 3: Genetics",
    unitDescription:
      "Study notes on Mendelian inheritance, molecular genetics, and genotype-to-phenotype reasoning for short-answer exam prompts.",
    sectionTitle: "1. Core Genetics Concepts",
    sectionBody:
      "Genetics explains how biological information is stored, inherited, and expressed. Exam questions usually test both conceptual understanding and your ability to reason through inheritance patterns.",
    scopeLabel: "Scope: Module 3 + 1 lab",
    tableHeaders: ["Concept", "Exam focus", "Anchor idea"],
    explorerItems: [
      { title: "Biology 201", type: "course", checked: true, active: true },
      { title: "Module 3: Genetics", type: "unit", checked: true, active: true },
      { title: "Lecture Notes", type: "material", checked: true, active: true },
      { title: "Punnett Practice", type: "material", checked: true },
      { title: "Lab Worksheet", type: "material", checked: false },
    ],
    sessions: ["Module 3 review", "Punnett drills", "Quiz corrections"],
    approaches: [
      ["Mendelian inheritance", "Monohybrid and dihybrid crosses", "Segregation + independent assortment"],
      ["Molecular genetics", "DNA to RNA to protein", "Central dogma"],
      ["Population genetics", "Allele frequencies over time", "Hardy-Weinberg"],
      ["Pedigree analysis", "Infer genotype from family data", "Dominant vs recessive traits"],
    ],
    messages: [],
  },
  "biol-101": {
    classId: "biol-101",
    workspaceName: "Lumina Study",
    classLabel: "BIOL-101",
    unitTitle: "Unit 2: Cells and Energy",
    unitDescription:
      "Core BIOL-101 review on cell structure, membrane transport, cellular respiration, and cell division for quiz-style prompts.",
    sectionTitle: "1. Cell Biology Foundations",
    sectionBody:
      "BIOL-101 focuses on connecting structures to function. Questions often require you to compare related processes and identify where each step occurs.",
    scopeLabel: "Scope: Unit 2 + 1 lab",
    tableHeaders: ["Topic", "Exam focus", "Anchor idea"],
    explorerItems: [
      { title: "BIOL-101", type: "course", checked: true, active: true },
      { title: "Unit 2: Cells and Energy", type: "unit", checked: true, active: true },
      { title: "Lecture Notes", type: "material", checked: true, active: true },
      { title: "Lab Handout", type: "material", checked: true },
      { title: "Practice Quiz", type: "material", checked: false },
    ],
    sessions: ["Cells review", "Respiration drill", "Quiz corrections"],
    approaches: [
      ["Cell structure", "Match organelle to function", "Structure determines role"],
      ["Membrane transport", "Passive vs active transport", "Gradient + energy use"],
      ["Cellular respiration", "Stage sequencing", "ATP production pathway"],
      ["Cell division", "Mitosis vs meiosis comparison", "Growth vs gamete formation"],
    ],
    messages: [],
  },
  "calc2-integration": {
    classId: "calc2-integration",
    workspaceName: "Lumina Study",
    classLabel: "Calculus II",
    unitTitle: "Integration Techniques",
    unitDescription:
      "Condensed formula sheet and worked examples covering substitution, integration by parts, partial fractions, and improper integrals.",
    sectionTitle: "1. Strategy for Choosing a Technique",
    sectionBody:
      "Most integration mistakes come from choosing the wrong method too early. Build a quick decision flow based on structure before you start algebra.",
    scopeLabel: "Scope: Unit 4 + practice set",
    tableHeaders: ["Technique", "When to use", "Signal pattern"],
    explorerItems: [
      { title: "Calculus II", type: "course", checked: true, active: true },
      { title: "Integration Techniques", type: "unit", checked: true, active: true },
      { title: "Formula Sheet", type: "material", checked: true, active: true },
      { title: "Worked Examples", type: "material", checked: true },
      { title: "Timed Quiz Set", type: "material", checked: false },
    ],
    sessions: ["Substitution drills", "By-parts reps", "Partial fractions set"],
    approaches: [
      ["u-substitution", "Composite expressions", "f(g(x)) * g'(x)"],
      ["Integration by parts", "Products of unlike functions", "ln(x), inverse trig, polynomial*exp"],
      ["Partial fractions", "Rational functions", "P(x)/Q(x) with factorable Q"],
      ["Trig substitution", "Radicals of quadratic forms", "sqrt(a^2 - x^2), sqrt(x^2 + a^2)"],
    ],
    messages: [],
  },
} satisfies Record<string, WorkspaceSeed>;

export type SeededClassId = keyof typeof workspaceSeeds;

export function normalizeClassId(classId: string): string {
  return classId.trim().toLowerCase();
}

export function isSeededClassId(classId: string): classId is SeededClassId {
  return classId in workspaceSeeds;
}

export function getWorkspaceSeed(classId: string): WorkspaceSeed {
  const normalizedClassId = normalizeClassId(classId);

  if (isSeededClassId(normalizedClassId)) {
    return workspaceSeeds[normalizedClassId];
  }

  const defaultSeed = workspaceSeeds[DEFAULT_CLASS_ID];

  return {
    ...defaultSeed,
    classId: normalizedClassId,
    classLabel: normalizedClassId,
    explorerItems: defaultSeed.explorerItems.map((item, index) =>
      index === 0 && item.type === "course"
        ? { ...item, title: normalizedClassId }
        : item,
    ),
  };
}
