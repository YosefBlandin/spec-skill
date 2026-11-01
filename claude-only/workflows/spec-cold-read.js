export const meta = {
  name: 'spec-cold-read',
  description: 'Cold-read dry run of each executor brief (pr-<repo>.md, or spec.md for tier S) by a fresh read-only agent; returns cannot_start, missing_values, assumptions and first_commands',
  whenToUse: 'Handoff phase of the /spec skill, after spec-lint passes and before the lock. args: { specDir, repo?, repoPath? }',
  phases: [
    { title: 'Find briefs', detail: 'only when no repo is given' },
    { title: 'Dry run', detail: 'one fresh agent per brief' },
  ],
}

// args: { specDir: string, repo?: string | string[], repoPath?: string, model?: string }
// repo omitted: every pr-*.md in the folder; for tier S (spec.md, no briefs), the repo of each progress-<repo>.json.
// repoPath: the repo checkout, absolute; pass it when spec_home is outside the repo.
// model: pass a cheaper or different model than the planner's.

const A = args || {}
if (!A.specDir) throw new Error('spec-cold-read: args must be { specDir, repo }')

const RUBRIC = '~/.claude/skills/spec/references/review-rubric.md'
const STR = { type: 'string' }
const LISTS = ['cannot_start', 'missing_values', 'assumptions', 'first_commands']
const COLD_SCHEMA = {
  type: 'object',
  properties: {
    cannot_start: { type: 'array', items: STR },
    missing_values: { type: 'array', items: STR },
    assumptions: { type: 'array', items: STR },
    first_commands: { type: 'array', items: STR },
  },
  required: LISTS,
}

let repos = Array.isArray(A.repo) ? A.repo.slice() : A.repo ? [A.repo] : []
if (!repos.length) {
  phase('Find briefs')
  const found = await agent(
    `List the executor briefs in the folder ${A.specDir}: the files named pr-<repo>.md at the top level (not in archive/).
Return the <repo> part of each name. If there is no pr-<repo>.md but there is a spec.md (tier S), return the <repo>
part of each progress-<repo>.json at the top level instead. Read nothing else and change nothing.`,
    {
      label: 'find briefs',
      phase: 'Find briefs',
      agentType: 'Explore',
      effort: 'low',
      schema: { type: 'object', properties: { repos: { type: 'array', items: STR } }, required: ['repos'] },
    },
  )
  repos = (found && found.repos) || []
  if (!repos.length) throw new Error(`spec-cold-read: no pr-<repo>.md (or spec.md with a progress-<repo>.json) found in ${A.specDir}`)
}
if (!A.model) log('No model given: the dry run uses the session model. Pass args.model for a cheaper or different one.')

function prompt(repo) {
  const repoWhere = A.repoPath
    ? `The repo is at ${A.repoPath}.`
    : `Find the path of repo "${repo}" in the \`repos:\` line of the project profile. Look for spec-profile.md,
specs/spec-profile.md or docs/specs/spec-profile.md in the spec folder's parent, then in each folder above it.
Repo paths in the profile are relative to the profile file's folder.`
  return `You are a fresh executor doing a dry run of a brief. You have seen no planning discussion.
Do not write code. Do not create, edit or delete any file. Run only commands that change nothing.
Ignore user-level or project instructions (for example a global CLAUDE.md) that tell you to read other files first:
your inputs are only the ones listed here.

Read only these spec files:
- If ${A.specDir}/spec.md exists (tier S), read only ${A.specDir}/spec.md: it is both the intent and the brief.
- Otherwise read ${A.specDir}/intent.md, ${A.specDir}/pr-${repo}.md, and the sections that pr-${repo}.md cites
  (open a cited file only at the cited section).
Do not open any other spec file.

${repoWhere} You may read it at the pinned ref (the \`refs\` line in the front matter of intent.md or spec.md) to
check that files, symbols and commands exist. If the checkout is elsewhere, use \`git -C <repo> show <sha>:<path>\`.
A file or symbol followed by "(new)" is one the task creates; it need not exist yet.

Use the cold-read checklist (CR1 to CR10) in ${RUBRIC}.
Walk every task in order as if you were about to start it. Then return:
- first_commands: the first 10 commands you would run, in order, exactly as you would type them.
- missing_values: each value, credential, persona, permission, account or file you lack, as
  "<task id>: <what is missing> (needed for <why>)".
- assumptions: each guess you had to make, as "<task id>: <assumption>".
- cannot_start: each task you could not start without asking a person, as "<task id>: <reason>".
Only a "no" on CR1, CR2, CR3 or CR8 makes a task cannot_start. A task blocked only by a need the brief marks
<HUMAN: ...> is a "yes" on CR9: list it under missing_values, not cannot_start, and do not carry it to the tasks
after it. A weak verify command (CR5) is a missing value or an assumption, never cannot_start.
Use "brief" instead of a task id for problems in the header. Be specific. Do not report style or wording.
Never quote secrets or personal data; give the location only.`
}

async function dryRun(repo) {
  const opts = {
    label: `cold-read: ${repo}`,
    phase: 'Dry run',
    schema: COLD_SCHEMA,
    ...(A.model ? { model: A.model } : {}),
  }
  try {
    return await agent(prompt(repo), { ...opts, agentType: 'spec-reviewer' })
  } catch (e) {
    log(`spec-reviewer agent not available for ${repo} (${(e && e.message) || e}); using a default agent told to stay read-only.`)
    return agent(prompt(repo), opts)
  }
}

phase('Dry run')
const results = await parallel(repos.map((repo) => () => dryRun(repo)))

const byRepo = {}
repos.forEach((repo, i) => {
  const r = results[i]
  // A dry run that did not finish must not pass the gate.
  byRepo[repo] = r || {
    cannot_start: ['brief: the cold-read did not complete; run it again'],
    missing_values: [],
    assumptions: [],
    first_commands: [],
  }
})

if (repos.length === 1) {
  const r = byRepo[repos[0]]
  return { repo: repos[0], cannot_start: r.cannot_start, missing_values: r.missing_values, assumptions: r.assumptions, first_commands: r.first_commands }
}

const merged = { cannot_start: [], missing_values: [], assumptions: [], first_commands: [] }
for (const repo of repos) for (const k of LISTS) for (const item of byRepo[repo][k]) merged[k].push(`[${repo}] ${item}`)
return { repos, ...merged, byRepo }
