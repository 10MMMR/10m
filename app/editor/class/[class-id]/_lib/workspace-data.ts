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
      { title: "Spring 2024", type: "semester", checked: false },
      { title: "Intro to AI (CS101)", type: "course", checked: true, active: true },
      { title: "Unit 1: Fundamentals", type: "unit", checked: true, active: true },
      { title: "Lecture Notes", type: "material", checked: true, active: true },
      { title: "Slide Deck", type: "material", checked: false },
      { title: "Biology 201", type: "course", checked: false },
      { title: "Module 3: Genetics", type: "unit", checked: false },
      { title: "Calculus II", type: "course", checked: false },
      { title: "Integration Techniques", type: "unit", checked: false },
      { title: "Practice Problems", type: "material", checked: false },
      { title: "Comp Arch (CS305)", type: "course", checked: false },
      { title: "Data Structures (CS201)", type: "course", checked: false },
      { title: "Ethics in Tech", type: "course", checked: false },
    ],
    sessions: ["Unit 1: Fundamentals", "Midterm Study", "A* Search"],
    approaches: [
      ["Thinking Humanly", "Cognitive modeling", "Human psychology"],
      ["Acting Humanly", "Behavioral modeling", "Turing test"],
      ["Thinking Rationally", "Formal logic", "Laws of thought"],
      ["Acting Rationally", "Performance measure", "Rational agents"],
    ],
    messages: [
      {
        author: "StudyAI",
        time: "10:42 AM",
        side: "assistant",
        text: "Hi! I’m ready to help you study Unit 1: AI Fundamentals. What would you like to focus on today?",
      },
      {
        author: "You",
        time: "10:45 AM",
        side: "user",
        text: "Can you explain the difference between thinking rationally and acting rationally?",
      },
      {
        author: "StudyAI",
        time: "10:45 AM",
        side: "assistant",
        text: "Thinking rationally focuses on deriving correct conclusions through logic. Acting rationally focuses on choosing the action that best achieves the goal, even when perfect reasoning is unavailable.",
      },
    ],
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
      { title: "Spring 2024", type: "semester", checked: false },
      { title: "Biology 201", type: "course", checked: true, active: true },
      { title: "Module 3: Genetics", type: "unit", checked: true, active: true },
      { title: "Lecture Notes", type: "material", checked: true, active: true },
      { title: "Punnett Practice", type: "material", checked: true },
      { title: "Lab Worksheet", type: "material", checked: false },
      { title: "Intro to AI (CS101)", type: "course", checked: false },
      { title: "Calculus II", type: "course", checked: false },
      { title: "Ethics in Tech", type: "course", checked: false },
    ],
    sessions: ["Module 3 review", "Punnett drills", "Quiz corrections"],
    approaches: [
      ["Mendelian inheritance", "Monohybrid and dihybrid crosses", "Segregation + independent assortment"],
      ["Molecular genetics", "DNA to RNA to protein", "Central dogma"],
      ["Population genetics", "Allele frequencies over time", "Hardy-Weinberg"],
      ["Pedigree analysis", "Infer genotype from family data", "Dominant vs recessive traits"],
    ],
    messages: [
      {
        author: "StudyAI",
        time: "2:11 PM",
        side: "assistant",
        text: "Ready for genetics review. Want to start with Punnett squares, pedigrees, or molecular pathways?",
      },
      {
        author: "You",
        time: "2:12 PM",
        side: "user",
        text: "Pedigrees first. I keep mixing up autosomal recessive vs dominant patterns.",
      },
      {
        author: "StudyAI",
        time: "2:13 PM",
        side: "assistant",
        text: "Good call. Start by checking whether unaffected parents produce affected children. If yes, recessive becomes much more likely.",
      },
    ],
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
      { title: "Spring 2024", type: "semester", checked: false },
      { title: "Calculus II", type: "course", checked: true, active: true },
      { title: "Integration Techniques", type: "unit", checked: true, active: true },
      { title: "Formula Sheet", type: "material", checked: true, active: true },
      { title: "Worked Examples", type: "material", checked: true },
      { title: "Timed Quiz Set", type: "material", checked: false },
      { title: "Intro to AI (CS101)", type: "course", checked: false },
      { title: "Biology 201", type: "course", checked: false },
      { title: "Comp Arch (CS305)", type: "course", checked: false },
    ],
    sessions: ["Substitution drills", "By-parts reps", "Partial fractions set"],
    approaches: [
      ["u-substitution", "Composite expressions", "f(g(x)) * g'(x)"],
      ["Integration by parts", "Products of unlike functions", "ln(x), inverse trig, polynomial*exp"],
      ["Partial fractions", "Rational functions", "P(x)/Q(x) with factorable Q"],
      ["Trig substitution", "Radicals of quadratic forms", "sqrt(a^2 - x^2), sqrt(x^2 + a^2)"],
    ],
    messages: [
      {
        author: "StudyAI",
        time: "7:03 PM",
        side: "assistant",
        text: "Want a fast method selector before we do timed problems?",
      },
      {
        author: "You",
        time: "7:05 PM",
        side: "user",
        text: "Yes. I waste time deciding between substitution and by-parts.",
      },
      {
        author: "StudyAI",
        time: "7:05 PM",
        side: "assistant",
        text: "Rule of thumb: if one part differentiates simpler and the other integrates cleanly, by-parts is usually the better first attempt.",
      },
    ],
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

  return workspaceSeeds[DEFAULT_CLASS_ID];
}
