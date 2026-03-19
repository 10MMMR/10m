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
      {
        author: "You",
        time: "10:47 AM",
        side: "user",
        text: "So can an agent be acting rationally even if its internal model is wrong?",
      },
      {
        author: "StudyAI",
        time: "10:48 AM",
        side: "assistant",
        text: "Yes. Rationality is judged by expected performance given available information, not by omniscience. A bounded agent can still be rational under uncertainty.",
      },
      {
        author: "You",
        time: "10:49 AM",
        side: "user",
        text: "How would that show up in an exam short answer?",
      },
      {
        author: "StudyAI",
        time: "10:49 AM",
        side: "assistant",
        text: "Use a 3-step structure: define rational action with a performance measure, mention uncertainty, then explain why utility-maximizing behavior can beat strict logical deduction in real environments.",
      },
      {
        author: "You",
        time: "10:51 AM",
        side: "user",
        text: "Can you give me a one-minute comparison table?",
      },
      {
        author: "StudyAI",
        time: "10:51 AM",
        side: "assistant",
        text: "Thinking rationally: logic-first, correctness of inference, can be brittle with incomplete data. Acting rationally: outcome-first, decision under uncertainty, robust in noisy environments.",
      },
      {
        author: "You",
        time: "10:53 AM",
        side: "user",
        text: "Great. Add one memory trick so I don’t mix them up.",
      },
      {
        author: "StudyAI",
        time: "10:54 AM",
        side: "assistant",
        text: "Try this: Think = proof, Act = payoff. If the question asks what the agent should do next, you usually want the acting-rationally frame.",
      },
      {
        author: "You",
        time: "10:55 AM",
        side: "user",
        text: "Nice. Can we quiz this after we finish the A* section?",
      },
      {
        author: "StudyAI",
        time: "10:55 AM",
        side: "assistant",
        text: "Absolutely. I’ll queue a 5-question mixed quiz with one compare/contrast prompt and one applied scenario.",
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
      {
        author: "You",
        time: "2:14 PM",
        side: "user",
        text: "What’s the fastest way to rule out X-linked inheritance?",
      },
      {
        author: "StudyAI",
        time: "2:15 PM",
        side: "assistant",
        text: "Check father-to-son transmission. If an affected father has an affected son, classic X-linked inheritance is unlikely because fathers pass Y to sons.",
      },
      {
        author: "You",
        time: "2:17 PM",
        side: "user",
        text: "I also get confused when traits skip generations.",
      },
      {
        author: "StudyAI",
        time: "2:18 PM",
        side: "assistant",
        text: "Generation skipping can indicate recessive inheritance, but incomplete penetrance can mimic that in dominant traits. Mention both if the pedigree is ambiguous.",
      },
      {
        author: "You",
        time: "2:20 PM",
        side: "user",
        text: "Can we do a mini drill with probabilities?",
      },
      {
        author: "StudyAI",
        time: "2:21 PM",
        side: "assistant",
        text: "Sure. If two heterozygous carriers mate for a recessive trait, offspring probabilities are 25% affected, 50% carrier, 25% unaffected non-carrier.",
      },
      {
        author: "You",
        time: "2:22 PM",
        side: "user",
        text: "And if one parent is affected recessive and the other is a carrier?",
      },
      {
        author: "StudyAI",
        time: "2:22 PM",
        side: "assistant",
        text: "Then each child has a 50% chance affected and 50% chance carrier. There are no unaffected non-carriers in that cross.",
      },
      {
        author: "You",
        time: "2:24 PM",
        side: "user",
        text: "Perfect. Save these as flashcard prompts.",
      },
      {
        author: "StudyAI",
        time: "2:24 PM",
        side: "assistant",
        text: "Saved. I tagged them as Pedigree Logic, X-linked Checks, and Probability Patterns for quick review later.",
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
      {
        author: "You",
        time: "7:07 PM",
        side: "user",
        text: "Can you give me a quick LIATE reminder?",
      },
      {
        author: "StudyAI",
        time: "7:07 PM",
        side: "assistant",
        text: "LIATE suggests what to pick for u in by-parts: Logarithmic, Inverse trig, Algebraic, Trig, Exponential. Choose u from the earliest matching category.",
      },
      {
        author: "You",
        time: "7:09 PM",
        side: "user",
        text: "When should I switch to partial fractions immediately?",
      },
      {
        author: "StudyAI",
        time: "7:10 PM",
        side: "assistant",
        text: "If the integrand is a proper rational function P(x)/Q(x) and Q factors over the reals, partial fractions is usually the highest-probability path.",
      },
      {
        author: "You",
        time: "7:12 PM",
        side: "user",
        text: "I panic on improper integrals with infinity bounds.",
      },
      {
        author: "StudyAI",
        time: "7:12 PM",
        side: "assistant",
        text: "Rewrite as a limit first. Then integrate normally, evaluate the finite endpoint, and check whether the limit exists. State converges or diverges explicitly.",
      },
      {
        author: "You",
        time: "7:14 PM",
        side: "user",
        text: "Could you queue 3 mixed problems in increasing difficulty?",
      },
      {
        author: "StudyAI",
        time: "7:14 PM",
        side: "assistant",
        text: "Queued: one u-sub warmup, one by-parts with ln(x), and one improper integral requiring limit comparison at infinity.",
      },
      {
        author: "You",
        time: "7:16 PM",
        side: "user",
        text: "Great. Score me harshly on setup mistakes.",
      },
      {
        author: "StudyAI",
        time: "7:16 PM",
        side: "assistant",
        text: "Done. I’ll penalize missing limits, incorrect u/dv choice rationale, and algebra slips that change domain constraints.",
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
