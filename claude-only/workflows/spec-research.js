export const meta = {
  name: 'spec-research',
  description: 'Read-only research sweep for a spec folder: one Explore agent per area, then one verifier; returns markdown for research.md',
  whenToUse: 'Research phase of the /spec skill (tiers M and L), after refs are pinned in intent.md. args: { specDir, areas: [{ key, focus }], repos }',
  phases: [
    { title: 'Sweep', detail: 'one read-only Explore agent per area' },
    { title: 'Verify', detail: 'one agent re-checks the facts that will drive decisions' },
  ],
}

// args: { specDir: string, areas: [{ key, focus }], repos: { name: path } | { name: { path, ref } } | [{ name, path, ref }] }
// Optional: sweepModel, verifierModel (omit to inherit the session model), maxVerify (default 30).

const A = args || {}
if (!A.specDir || !Array.isArray(A.areas) || A.areas.length === 0) {
  throw new Error('spec-research: args must be { specDir, areas: [{ key, focus }], repos }')
}

function normRepos(r) {
  if (!r) return []
  if (Array.isArray(r)) {
    return r.map((x) => (typeof x === 'string' ? { name: x, path: '', ref: '' } : { name: x.name, path: x.path || '', ref: x.ref || '' }))
  }
  return Object.entries(r).map(([name, v]) => (typeof v === 'string' ? { name, path: v, ref: '' } : { name, path: (v && v.path) || '', ref: (v && v.ref) || '' }))
}

const repos = normRepos(A.repos)
const maxVerify = Number.isInteger(A.maxVerify) && A.maxVerify > 0 ? A.maxVerify : 30

const repoLines = repos.length
  ? repos.map((r) => `- ${r.name}: ${r.path || '(path: see spec-profile.md)'}; pinned ref: ${r.ref || 'the `refs` line in intent.md front matter'}`).join('\n')
  : '- See the `repos:` line of spec-profile.md (in the spec home or a parent folder) and the `refs` line in intent.md.'

const READ_ONLY = [
  'You are read-only. Do not create, edit or delete files.',
  'Do not run commands that change state: no checkout, no install, no fetch, no writes to any service.',
  'Allowed: reading and searching files, `git show <sha>:<path>`, `git log`, `git grep`.',
].join('\n')

const STR = { type: 'string' }
const AREA_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: STR, ref: STR, symbol: STR, decisionCandidate: { type: 'boolean' } },
        required: ['text', 'ref', 'decisionCandidate'],
      },
    },
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: STR,
          importance: { type: 'string', enum: ['high', 'medium', 'low'] },
          evidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          nextStep: STR,
        },
        required: ['text', 'importance', 'evidence', 'nextStep'],
      },
    },
    unknowns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: STR,
          impact: { type: 'string', enum: ['high', 'low'] },
          goesTo: { type: 'string', enum: ['question', 'task', 'live check', 'assumption'] },
        },
        required: ['text', 'impact', 'goesTo'],
      },
    },
    callers: {
      type: 'array',
      items: { type: 'object', properties: { client: STR, ref: STR, note: STR }, required: ['client', 'ref'] },
    },
    resolvedFromCode: {
      type: 'array',
      items: { type: 'object', properties: { question: STR, answer: STR, ref: STR }, required: ['question', 'answer', 'ref'] },
    },
  },
  required: ['facts', 'assumptions', 'unknowns', 'callers', 'resolvedFromCode'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: STR,
          verdict: { type: 'string', enum: ['confirmed', 'corrected', 'refuted'] },
          correction: STR,
          ref: STR,
        },
        required: ['id', 'verdict'],
      },
    },
  },
  required: ['checks'],
}

function areaPrompt(area) {
  return `${READ_ONLY}

You research one area of the code for a feature spec. You do not design anything.
Spec folder: ${A.specDir}. For context, read only intent.md (or spec.md for tier S) in that folder: the outcome, the
acceptance criteria, and the \`refs\` line in its front matter. Do not read other spec files.

Repos:
${repoLines}

Area: ${area.key}
Focus: ${area.focus || area.key}

Read the code at the pinned ref. If the checkout is not at that ref, read files with \`git -C <repo> show <sha>:<path>\`.
Report:
- facts: what the code does, one line each. ref is "<repo>:<path>:L<start>-<end>" at the pinned ref. Add the symbol
  name when one applies. Set decisionCandidate true when a design decision or an acceptance criterion will likely
  rest on the fact.
- assumptions: what you believe but did not prove. importance and evidence are each high, medium or low; nextStep
  names the live check, task, test or question that would settle it.
- unknowns: what you could not find out, with impact (high or low) and where it goes: a question for a person, a
  task for an executor, a read-only live check, or just an assumption.
- callers: every client or caller of the code in this area, including old or deprecated apps, with refs.
- resolvedFromCode: questions a person might ask that the code already answers, with the answer and a ref.
Line numbers must be exact. If you are not sure of a line range, cite the file and symbol only.
At most about 25 facts. Plain, short sentences. No secrets or personal data in any field.`
}

function cell(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
}
function table(header, rows) {
  if (!rows.length) return '_none_\n'
  const head = `| ${header.join(' | ')} |\n|${header.map(() => '---').join('|')}|\n`
  return head + rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n') + '\n'
}

// Sweep: all areas in parallel. The verifier needs every area's facts together, so this barrier is intentional.
phase('Sweep')
const results = await parallel(
  A.areas.map((area, i) => () =>
    agent(areaPrompt(area), {
      label: `area: ${area.key}`,
      phase: 'Sweep',
      agentType: 'Explore',
      schema: AREA_SCHEMA,
      ...(A.sweepModel ? { model: A.sweepModel } : {}),
    }).then((r) => (r ? { i, area, r } : null)),
  ),
)
const done = results.filter(Boolean)
const failedAreas = A.areas.filter((_, i) => !done.some((d) => d.i === i)).map((a) => a.key)
if (failedAreas.length) log(`No result for areas: ${failedAreas.join(', ')}`)

// Collect decision candidates with stable ids (area index . fact index).
const candidates = []
for (const d of done) {
  d.r.facts.forEach((f, j) => {
    if (f.decisionCandidate) candidates.push({ id: `A${d.i + 1}.${j + 1}`, area: d.area.key, text: f.text, ref: f.ref })
  })
}
const toVerify = candidates.slice(0, maxVerify)
if (candidates.length > toVerify.length) {
  log(`Verifying ${toVerify.length} of ${candidates.length} decision-critical facts; the rest are marked unverified.`)
}

const verdicts = {}
if (toVerify.length) {
  phase('Verify')
  const v = await agent(
    `${READ_ONLY}

You verify facts that a feature design will rely on. For each fact, re-read the code at the cited ref and decide:
confirmed (the text and the ref are right), corrected (the code says something different; give the corrected text
and ref), or refuted (the claim is wrong and there is nothing to correct it to; explain in correction).
Repos:
${repoLines}
Spec folder (for the pinned refs in intent.md front matter): ${A.specDir}

Facts:
${toVerify.map((c) => `- ${c.id} [${c.area}] ${c.text} (ref: ${c.ref})`).join('\n')}

Return one check per fact id. Be strict: a wrong line range counts as corrected.`,
    {
      label: 'verifier',
      phase: 'Verify',
      agentType: 'Explore',
      schema: VERIFY_SCHEMA,
      effort: 'high',
      ...(A.verifierModel ? { model: A.verifierModel } : {}),
    },
  )
  if (v && Array.isArray(v.checks)) for (const c of v.checks) verdicts[c.id] = c
  else log('The verifier returned nothing; every fact stays unverified.')
} else {
  log('No decision-critical facts reported; verifier skipped.')
}

// Build the markdown, in the tables of the research.md template. Corrected facts replace the original; refuted
// facts appear only under Corrections. Callers are facts. No F ids: the planner adds one only when a file cites it.
const facts = []
const corrections = []
const assumptions = []
const unknowns = []
const resolved = []
for (const d of done) {
  const { area, r } = d
  r.facts.forEach((f, j) => {
    const v = verdicts[`A${d.i + 1}.${j + 1}`]
    const sym = f.symbol ? ` (${f.symbol})` : ''
    if (v && v.verdict === 'refuted') {
      corrections.push([f.text, `Refuted: ${v.correction || 'no such behaviour'}`, `\`${v.ref || f.ref}\``])
      return
    }
    if (v && v.verdict === 'corrected') {
      corrections.push([f.text, v.correction || '', `\`${v.ref || f.ref}\``])
      facts.push(['-', area.key, v.correction || f.text, `\`${v.ref || f.ref}\`, verified`])
      return
    }
    facts.push(['-', area.key, f.text, `\`${f.ref}\`${sym}${v ? ', verified' : ''}`])
  })
  for (const c of r.callers) facts.push(['-', area.key, `Caller: ${c.client}${c.note ? `. ${c.note}` : ''}`, `\`${c.ref}\``])
  for (const a of r.assumptions) assumptions.push([`${area.key}: ${a.text}`, a.importance, a.evidence, a.nextStep])
  for (const u of r.unknowns) unknowns.push([`${area.key}: ${u.text}`, u.impact, u.goesTo])
  for (const q of r.resolvedFromCode) resolved.push([q.question, q.answer, `\`${q.ref}\``])
}

const out = []
out.push('## Scope\n\n')
out.push(`- Areas: ${A.areas.map((a) => a.key).join(', ')}.\n`)
out.push(`- Repos and refs: ${repos.length ? repos.map((r) => `${r.name}@${r.ref || '(see refs in intent.md)'}`).join(', ') : 'see refs in intent.md'}.\n`)
out.push(`- Produced by the spec-research workflow: one read-only agent per area, then a verifier re-checked the decision-critical facts (checked: ${Object.keys(verdicts).length}; kept facts are marked verified).\n`)
out.push('\n## Facts\n\n')
out.push(table(['F', 'Area', 'Fact', 'Evidence'], facts))
out.push('\n## Corrections\n\n')
out.push(table(['#', 'Earlier claim', 'Resolved fact', 'Evidence'], corrections.map((c, i) => [String(i + 1), ...c])))
out.push('\n## Assumptions\n\n')
out.push(table(['Assumption', 'Importance', 'Evidence', 'Next step'], assumptions))
out.push('\n## Unknowns\n\n')
out.push(table(['Unknown', 'Impact', 'Goes to'], unknowns))
out.push('\n## Live checks\n\n_none run by the sweep_\n')
out.push('\n## Resolved from code\n\n')
out.push(table(['Question', 'Answer', 'Evidence'], resolved))

const notes = []
if (failedAreas.length) notes.push(`Areas with no result: ${failedAreas.join(', ')}. Research them again or by hand.`)
if (candidates.length > toVerify.length) notes.push(`${candidates.length - toVerify.length} decision-critical facts were not verified (cap ${maxVerify}).`)
if (notes.length) out.push('\n## Gaps in this sweep\n\n' + notes.map((n) => `- ${n}`).join('\n') + '\n')

return out.join('')
