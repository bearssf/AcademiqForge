/**
 * Research Anatomy — component keys (tile ids), rubric labels, and LLM prompts.
 */

const RUBRIC_JSON = {
  rubric: [
    {
      component: 'Problem/Gap',
      levels: {
        Poor: 'The research problem or gap is unclear or missing.',
        Developing: 'Problem/gap is identified but vaguely or partially connected to existing literature.',
        Effective: 'Problem/gap is clearly stated and linked to existing research.',
        Strong: 'Problem/gap is clearly articulated, significant, and strongly justified by the literature.',
      },
    },
    {
      component: 'Purpose & Research Question',
      levels: {
        Poor: 'Purpose and research questions are missing or unclear.',
        Developing: 'Purpose/questions are stated but lack focus or specificity.',
        Effective: 'Purpose/questions are clear, specific, and aligned with the study.',
        Strong: 'Purpose/questions are precise, compelling, and clearly guide the research.',
      },
    },
    {
      component: 'Ontological & Epistemological Positioning',
      levels: {
        Poor: 'No discussion of assumptions about reality or knowledge.',
        Developing: 'Assumptions are partially acknowledged but unclear or inconsistent.',
        Effective: 'Assumptions about reality and knowledge are explicitly stated and coherent.',
        Strong: 'Assumptions are explicitly articulated, coherent, and meaningfully inform the research design.',
      },
    },
    {
      component: 'Theoretical / Conceptual Framework',
      levels: {
        Poor: 'No framework or theory is described.',
        Developing: 'Framework/theory is mentioned but weakly connected to the study.',
        Effective: 'Framework/theory is clearly described and relevant to the study.',
        Strong: 'Framework/theory is well-articulated, strongly connected, and guides the study comprehensively.',
      },
    },
    {
      component: 'Literature Foundation',
      levels: {
        Poor: 'Literature review is missing, minimal, or irrelevant.',
        Developing: 'Literature review exists but is limited, superficial, or poorly synthesized.',
        Effective: 'Literature review is clear, relevant, and shows understanding of prior research.',
        Strong: 'Literature review is comprehensive, critically synthesized, and establishes a strong foundation for the study.',
      },
    },
    {
      component: 'Methodology & Design',
      levels: {
        Poor: 'Methodology/design is unclear or inappropriate.',
        Developing: 'Methodology/design is described but partially aligned with research questions.',
        Effective: 'Methodology/design is clear, appropriate, and aligns with research questions.',
        Strong: 'Methodology/design is thorough, well-justified, and rigorously aligned with research questions.',
      },
    },
    {
      component: 'Methods & Instrumentation',
      levels: {
        Poor: 'Methods or instruments are missing or inappropriate.',
        Developing: 'Methods/instruments are partially described or inconsistently applied.',
        Effective: 'Methods/instruments are clearly described and appropriate for the study.',
        Strong: 'Methods/instruments are detailed, appropriate, and rigorously applied.',
      },
    },
    {
      component: 'Data/Evidence',
      levels: {
        Poor: 'Data/evidence is missing or inadequate.',
        Developing: 'Data/evidence is limited, incomplete, or partially relevant.',
        Effective: 'Data/evidence is sufficient, relevant, and clearly presented.',
        Strong: 'Data/evidence is comprehensive, highly relevant, and clearly supports the study.',
      },
    },
    {
      component: 'Analysis & Findings',
      levels: {
        Poor: 'Analysis is missing or flawed; findings are unclear.',
        Developing: 'Analysis or findings are partially presented or not clearly linked to questions.',
        Effective: 'Analysis is appropriate and findings are clear and supported.',
        Strong: 'Analysis is rigorous, findings are insightful, and strongly linked to research questions.',
      },
    },
    {
      component: 'Argument/Claims',
      levels: {
        Poor: 'Claims or arguments are missing, unsupported, or unclear.',
        Developing: 'Claims are present but weakly supported or inconsistently argued.',
        Effective: 'Claims are clear, supported, and logically presented.',
        Strong: 'Claims are compelling, well-supported, and critically argued.',
      },
    },
    {
      component: 'Contribution to Knowledge',
      levels: {
        Poor: 'Contribution is missing or unclear.',
        Developing: 'Contribution is stated but minor or not well justified.',
        Effective: 'Contribution is clear and demonstrates added value to the field.',
        Strong: 'Contribution is significant, well-justified, and advances knowledge or theory.',
      },
    },
    {
      component: 'Practical/Applied Implications',
      levels: {
        Poor: 'Implications are missing or irrelevant.',
        Developing: 'Implications are stated but vague or limited.',
        Effective: 'Implications are clear, relevant, and connected to findings.',
        Strong: 'Implications are meaningful, actionable, and clearly derived from findings.',
      },
    },
    {
      component: 'Researcher Positionality',
      levels: {
        Poor: 'No reflection on positionality or potential biases.',
        Developing: 'Positionality is acknowledged superficially or inconsistently.',
        Effective: 'Positionality is clearly reflected and considered in the research process.',
        Strong: 'Positionality is thoughtfully reflected, critically examined, and transparently integrated into the study.',
      },
    },
    {
      component: 'Validity & Trustworthiness',
      levels: {
        Poor: 'Validity or trustworthiness is missing or ignored.',
        Developing: 'Some discussion of validity/trustworthiness, but limited or unclear.',
        Effective: 'Validity/trustworthiness is addressed with appropriate strategies.',
        Strong: 'Validity/trustworthiness is thoroughly addressed with robust, well-justified strategies.',
      },
    },
  ],
};

/** Canonical rubric / API names in evaluation order */
const COMPONENT_EVAL_ORDER = [
  'Problem/Gap',
  'Purpose & Research Question',
  'Ontological & Epistemological Positioning',
  'Theoretical / Conceptual Framework',
  'Literature Foundation',
  'Methodology & Design',
  'Methods & Instrumentation',
  'Data/Evidence',
  'Analysis & Findings',
  'Argument/Claims',
  'Contribution to Knowledge',
  'Practical/Applied Implications',
  'Researcher Positionality',
  'Validity & Trustworthiness',
];

/** Tile id -> rubric component label */
const TILE_ID_TO_RUBRIC = {
  problem: 'Problem/Gap',
  purpose: 'Purpose & Research Question',
  onto: 'Ontological & Epistemological Positioning',
  theory: 'Theoretical / Conceptual Framework',
  lit: 'Literature Foundation',
  methodology: 'Methodology & Design',
  methods: 'Methods & Instrumentation',
  data: 'Data/Evidence',
  analysis: 'Analysis & Findings',
  argument: 'Argument/Claims',
  contribution: 'Contribution to Knowledge',
  practical: 'Practical/Applied Implications',
  positionality: 'Researcher Positionality',
  validity: 'Validity & Trustworthiness',
};

const PASS1_PROMPTS = {
  'Problem/Gap':
    'You are evaluating an academic paper. Identify any passages in the following text that address the research problem that the writer is attempting to address or the gap in existing literature/research that the author is trying to fill. Return the relevant excerpts and their location.',
  'Purpose & Research Question':
    'You are evaluating an academic paper. Identify any passages in the following text that address the research purpose and the explicit questions that the writer is attempting to answer with research. Return the relevant excerpts and their location.',
  'Ontological & Epistemological Positioning':
    'You are evaluating an academic paper. Identify any passages in the following text that reveal the author’s ontological and epistemological assumptions, including how they conceptualize reality, knowledge, and ways of knowing. Return the relevant excerpts and their location.',
  'Theoretical / Conceptual Framework':
    'You are evaluating an academic paper. Identify any passages in the following text that describe the theoretical or conceptual framework guiding the study, including named theories, models, or key concepts that structure the research. Return the relevant excerpts and their location.',
  'Literature Foundation':
    'You are evaluating an academic paper. Identify any passages in the following text that summarize, synthesize, or critique existing literature that informs the study, including references to prior research, debates, or scholarly trends. Return the relevant excerpts and their location.',
  'Methodology & Design':
    'You are evaluating an academic paper. Identify any passages in the following text that describe the overall research methodology and design, including the research approach (e.g., qualitative, quantitative, mixed methods), study type, and rationale for the chosen design. Return the relevant excerpts and their location.',
  'Methods & Instrumentation':
    'You are evaluating an academic paper. Identify any passages in the following text that describe the specific methods, procedures, tools, or instruments used to collect data (e.g., surveys, interviews, experiments, measurements). Return the relevant excerpts and their location.',
  'Data/Evidence':
    'You are evaluating an academic paper. Identify any passages in the following text that present the data or evidence collected for the study, including descriptions of datasets, participants, samples, or empirical observations. Return the relevant excerpts and their location.',
  'Analysis & Findings':
    'You are evaluating an academic paper. Identify any passages in the following text that describe how the data were analyzed and what findings or results emerged from that analysis. Return the relevant excerpts and their location.',
  'Argument/Claims':
    'You are evaluating an academic paper. Identify any passages in the following text where the author makes central arguments, claims, or interpretations based on the findings. Return the relevant excerpts and their location.',
  'Contribution to Knowledge':
    'You are evaluating an academic paper. Identify any passages in the following text that explain how the study contributes to existing knowledge, theory, or scholarship in the field. Return the relevant excerpts and their location.',
  'Practical/Applied Implications':
    'You are evaluating an academic paper. Identify any passages in the following text that discuss the practical, applied, or real-world implications of the research findings. Return the relevant excerpts and their location.',
  'Researcher Positionality':
    'You are evaluating an academic paper. Identify any passages in the following text where the author reflects on their own positionality, perspective, background, or potential biases and how these may influence the research. Return the relevant excerpts and their location.',
  'Validity & Trustworthiness':
    'You are evaluating an academic paper. Identify any passages in the following text that address the validity, reliability, or trustworthiness of the study, including limitations, credibility strategies, or steps taken to ensure rigor. Return the relevant excerpts and their location.',
};

function scoringPromptForComponent(componentName, passageBlock) {
  const rubricItem = RUBRIC_JSON.rubric.find((r) => r.component === componentName);
  const rubricSnippet = rubricItem
    ? JSON.stringify({ component: rubricItem.component, levels: rubricItem.levels })
    : '';

  return `You are evaluating an academic text passage using a detailed rubric for ONE component: "${componentName}".

Rubric levels for this component:
${rubricSnippet}

Passage(s) assembled from the paper (may include multiple excerpts):
---
${passageBlock}
---

Instructions:
1. Read the passage carefully.
2. Determine if and how the passage addresses "${componentName}".
3. Assign a score using the four-level scale: Poor, Developing, Effective, or Strong (matching the rubric).
4. Provide evidence: a direct quote, paraphrase, or specific reference from the passage.
5. Provide feedback: a short, actionable comment explaining the score or how the passage could be improved.
6. If the component cannot be assessed from the passage, use "N/A" for the score and explain in feedback.

Return ONLY valid JSON in this exact shape (single object, no markdown):
{"score":"","evidence":"","feedback":""}`;
}

const PASS2_FULL_RUBRIC_PROMPT = `You are evaluating an academic text passage using a detailed rubric. The rubric contains 14 components: Problem/Gap, Purpose & Research Question, Ontological & Epistemological Positioning, Theoretical/Conceptual Framework, Literature Foundation, Methodology & Design, Methods & Instrumentation, Data/Evidence, Analysis & Findings, Argument/Claims, Contribution to Knowledge, Practical/Applied Implications, Researcher Positionality, and Validity & Trustworthiness.

For each component:

1. Read the passage carefully.  
2. Determine if and how the passage addresses the component.  
3. Assign a score using the four-level scale:
   - Poor: The component is missing, unclear, or inadequate.
   - Developing: The component is partially addressed, but limited or inconsistent.
   - Effective: The component is clearly addressed and demonstrates competence.
   - Strong: The component is thoroughly and clearly addressed with exemplary quality.
4. Provide **evidence**: a direct quote, paraphrase, or specific reference from the passage that supports your score.  
5. Provide **feedback**: a short, actionable comment explaining why the score was given or how the passage could be improved.  
6. If the component cannot be assessed from the passage, indicate "N/A" for the score and explain why in feedback.

Return your response in this JSON format only (no markdown fences):

{
  "Problem/Gap": {"score": "", "evidence": "", "feedback": ""},
  "Purpose & Research Question": {"score": "", "evidence": "", "feedback": ""},
  "Ontological & Epistemological Positioning": {"score": "", "evidence": "", "feedback": ""},
  "Theoretical / Conceptual Framework": {"score": "", "evidence": "", "feedback": ""},
  "Literature Foundation": {"score": "", "evidence": "", "feedback": ""},
  "Methodology & Design": {"score": "", "evidence": "", "feedback": ""},
  "Methods & Instrumentation": {"score": "", "evidence": "", "feedback": ""},
  "Data/Evidence": {"score": "", "evidence": "", "feedback": ""},
  "Analysis & Findings": {"score": "", "evidence": "", "feedback": ""},
  "Argument/Claims": {"score": "", "evidence": "", "feedback": ""},
  "Contribution to Knowledge": {"score": "", "evidence": "", "feedback": ""},
  "Practical/Applied Implications": {"score": "", "evidence": "", "feedback": ""},
  "Researcher Positionality": {"score": "", "evidence": "", "feedback": ""},
  "Validity & Trustworthiness": {"score": "", "evidence": "", "feedback": ""}
}

Use only information present in the passage. Keep evidence concise, directly tied to the text, and make feedback actionable and specific.`;

module.exports = {
  RUBRIC_JSON,
  COMPONENT_EVAL_ORDER,
  TILE_ID_TO_RUBRIC,
  PASS1_PROMPTS,
  scoringPromptForComponent,
  PASS2_FULL_RUBRIC_PROMPT,
};
