export const meta = {
  name: 'spec-lens-review',
  description: 'Design lens review of a spec folder: one read-only reviewer per lens, in parallel, using the spec review rubric; returns findings JSON',
  whenToUse: 'Design phase of the /spec skill, after architecture.md and decisions.md have a first draft. args: { specDir, lenses? }',
  phases: [{ title: 'Review', detail: 'one read-only reviewer per lens' }],
}

// args: { specDir: string, lenses?: Array<string | { key, focus }>, webPr?: boolean, model?: string }
// Default lenses: security-data, contract-deploy, premortem. Add "frontend" (or webPr: true) only when a PR changes a UI.

const A = args || {}
if (!A.specDir) throw new Error('spec-lens-review: args must be { specDir, lenses? }')

const RUBRIC = '~/.claude/skills/spec/references/review-rubric.md'
const FOCUS = {
  'security-data':
    'Security and data: authentication, permission checks, personal data, secrets, retention, audit, and logging of sensitive values. Look hardest at DL8, DL9 and DL11.',
  'contract-deploy':
    'Contracts and deploy: API and schema contracts, compatibility across versions and clients (deprecated apps included), deploy order, migrations, config changes, rollback. Look hardest at DL3, DL4, DL6 and DL7.',
  premortem:
    'Pre-mortem with states and exits: first write the 3 most likely reasons this failed in production a week after release, then check each against the design. Check every persistent state for an exit per actor, timeouts, retries, partial failure and duplicates. Look hardest at DL5, DL9 and DL12.',
  frontend:
    'Frontend and UX, for a PR that changes a UI: user flows; loading, empty, error and no-permission states for every user-visible AC; copy against the glossary; the project accessibility and translation rules.',
}
const DEFAULT_LENSES = ['security-data', 'contract-deploy', 'premortem']

let lenses = (Array.isArray(A.lenses) && A.lenses.length ? A.lenses : DEFAULT_LENSES).map((l) =>
  typeof l === 'string' ? { key: l, focus: FOCUS[l] || l } : { key: l.key, focus: l.focus || FOCUS[l.key] || l.key },
)
if (A.webPr && !lenses.some((l) => l.key === 'frontend')) lenses.push({ key: 'frontend', focus: FOCUS.frontend })
log(`Lenses: ${lenses.map((l) => l.key).join(', ')}`)

const STR = { type: 'string' }
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    checklist: {
      type: 'array',
      items: {
        type: 'object',
        properties: { item: STR, answer: { type: 'string', enum: ['yes', 'no', 'unknown'] }, evidence: STR },
        required: ['item', 'answer', 'evidence'],
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          affects: { type: 'array', items: STR },
          finding: STR,
          evidence: STR,
          fix: STR,
        },
        required: ['severity', 'affects', 'finding', 'evidence', 'fix'],
      },
    },
  },
  required: ['checklist', 'findings'],
}

function prompt(lens) {
  return `Read-only design review of a feature spec. Do not create, edit or delete any file.

Lens: ${lens.key}
Focus: ${lens.focus}

1. Read the rubric at ${RUBRIC}: the sections "Rules for every review", "Severity" and "Design lens review".
2. Read, in the spec folder ${A.specDir}: intent.md, decisions.md and architecture.md. Read research.md only to check
   the evidence for a claim. Do not read review.md.
3. Take the appetite and door from the front matter of intent.md. Respect them: do not ask for work they rule out
   unless an acceptance criterion fails without it.
4. Answer every DL item (DL1 to DL12) yes, no or unknown, with evidence. Look hardest at the items your focus names.
5. Report only correctness or requirement gaps. Each finding has a severity (blocker, major or minor), the AC, D or
   other ids it affects, one line, evidence (file and section, path:line, or a quoted line), and a one-line fix.
   No evidence, no finding. At most 10 findings, most severe first. Minor findings are optional.
Never quote secrets or personal data; give the location only.`
}

async function review(lens) {
  const opts = {
    label: `lens: ${lens.key}`,
    phase: 'Review',
    schema: REVIEW_SCHEMA,
    ...(A.model ? { model: A.model } : {}),
  }
  try {
    return await agent(prompt(lens), { ...opts, agentType: 'spec-reviewer' })
  } catch (e) {
    log(`spec-reviewer agent not available for ${lens.key} (${(e && e.message) || e}); using a default agent told to stay read-only.`)
    return agent(prompt(lens), opts)
  }
}

phase('Review')
const results = await parallel(lenses.map((lens) => () => review(lens).then((r) => ({ lens: lens.key, r }))))

const RANK = { blocker: 0, major: 1, minor: 2 }
const findings = []
const checklist = {}
const failedLenses = []
results.forEach((x, i) => {
  const key = lenses[i].key
  if (!x || !x.r) {
    failedLenses.push(key)
    return
  }
  checklist[key] = x.r.checklist
  for (const f of x.r.findings) findings.push({ lens: key, ...f })
})
findings.sort((a, b) => RANK[a.severity] - RANK[b.severity])
if (failedLenses.length) log(`No result for lenses: ${failedLenses.join(', ')}. Run them again or in a fresh chat.`)

const counts = { blocker: 0, major: 0, minor: 0 }
for (const f of findings) counts[f.severity]++

return {
  specDir: A.specDir,
  lenses: lenses.map((l) => l.key),
  counts,
  findings,
  checklist,
  failedLenses,
}
