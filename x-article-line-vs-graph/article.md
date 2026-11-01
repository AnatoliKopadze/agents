# Line agent vs graph agent: 14 differences, and how to build the second one with Claude Code

![cover](images/00-cover.png)

A Claude agent that works in a line is not the same as a Claude agent that works like a graph.

Let me explain.....

A line agent does one thing at a time.

Step one. Wait. Step two. Wait. Step three.

Give it 9 files and it reads them one by one, all in the same head.

By file 7 its context is full, and it starts to forget why it opened file 1.

If step 4 breaks, steps 5 to 9 never happen.

A graph agent gets the same 9 files.

Before it starts, it asks one question: "Does file 2 need anything from file 1?"

No? Then nobody waits.

It sends 9 subagents at once. Each one gets one file and a clean head.

Only the answers come back. Then one last subagent puts them together.

Same Claude. Same job. Different shape.

![01-line-vs-graph](images/01-line-vs-graph.png)

> If you build with Claude Code, follow my Substack. I post breakdowns like this one there: movez.substack.com

Claude Code can build the second agent for you. The feature is called **dynamic workflows**.

You ask for a workflow. Claude writes a short plan in plain JavaScript. Then it starts a team of subagents and runs the plan.

Running the plan costs zero tokens. It's code, not a chat.

A subagent is just a helper that Claude starts with its own clean context. It does one job and hands back the answer.

Below are 14 differences between the two agents. Each one comes with what to put in the script or what to tell Claude.

---

## 01. The line agent sees steps. The graph agent sees handoffs.

Every agent job is made of two things.

**Boxes.** A box is one job: one subagent, one input, one output.

**Arrows.** An arrow is a handoff. It means the answer from this box goes into that box.

People call them nodes and edges. Boxes and arrows is enough.

![02-and-then-test](images/02-and-then-test.png)

The line agent draws an arrow every time you write "and then".

"Check our pricing page and then check our competitor's pricing page."

There is no handoff here. The second check doesn't need anything from the first one. They can run at the same time.

Now compare: "Find the slowest API route and then find out why it's slow."

That one is real. You can't explain a slow route before you know which route it is.

So for every "and then" in your agent, ask one question:

**Does the next step read the last step's answer?**

If not, there's no arrow, and the wait is wasted.

> In a workflow script it's easy to check. A box is one agent() call. An arrow is a variable that goes from one call's result into the next call's prompt. No variable crosses? Those two boxes don't need each other.

---

## 02. The line agent waits because you typed it that way.

"Do A, then B, then C, then D" is also a graph. It's just the worst one: a single line where every box has one arrow in and one arrow out.

It works. It's also slow and easy to break. If C hangs, D never starts, and the work A did just sits there.

![03-redraw-the-chain](images/03-redraw-the-chain.png)

Take a weekly report agent:

1. Pull this week's GitHub issues
2. Pull the Stripe numbers
3. Pull the support tickets
4. Write the report

Go arrow by arrow. Does the Stripe step read the GitHub issues? No. Do the support tickets need the Stripe numbers? No.

Those two arrows carry nothing. They exist only because that's the order you typed things in.

Cut them, and the line turns into a short, wide shape: three pulls at once, then one report that needs all three.

Most agents have two or three arrows like this. Finding them takes five minutes and a pen, and it's the first real skill here.

---

## 03. The line agent gets essays back. The graph agent gets a filled-in form.

If you can't predict what a box returns, you can't run 20 of them at once. You'd get 20 essays, and you'd have to read all of them.

So every box needs a deal:

- **Input:** everything it needs, passed in directly. Never "it's somewhere above in the chat".
- **Output:** a fixed shape, so the next box can use it without guessing.
- **One job.** Not two.

![04-the-form](images/04-the-form.png)

In a workflow you get this with a schema. Give agent() a JSON schema, and the subagent has to answer in that shape. The answer is checked when the subagent hands it back. If it doesn't match, the subagent tries again.

So instead of "I found a few worrying patterns in the auth module...", you get file, line, problem, severity. Data your script can use.

That's the difference between a box Claude can plug into a graph and a box only a human can read.

```javascript
const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          problem: { type: 'string' },
          severity: { enum: ['low', 'high'] },
        },
        required: ['file', 'line', 'problem', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const result = await agent(`Review ${file} for missing auth checks.`, { schema: FINDINGS })
// result.findings is a list you can loop over. No parsing.
```

---

## 04. The line agent pays Claude to glue. The graph agent glues with code.

An arrow isn't just "B goes after A". It's a promise about what's inside: A gives this shape, and B expects this shape.

Name each arrow by what it carries ("list of findings"), not by when it happens ("step 3"). Then two things get easy:

- You see right away if the arrow is real. Does something actually move along it?
- You can swap the box on either end and nothing breaks, as long as the shape stays the same.

![05-glue-with-code](images/05-glue-with-code.png)

Now the part people overpay for.

Between "many subagents found stuff" and "one subagent writes the answer" there is usually glue: flatten the lists, drop the duplicates, drop the noise.

That's a few lines of JavaScript. Instant, the same result every time, zero tokens.

Still, a lot of people start a subagent to "combine the results". Don't. Save subagents for judgment, not for plumbing.

```javascript
// The arrow between the fan-out and the final writer: plain code, no agent.
const all = results.filter(Boolean).flatMap(r => r.findings)
const seen = new Set()
const unique = all.filter(f => {
  const key = `${f.file}:${f.line}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
const real = unique.filter(f => f.severity !== 'low')
```

---

## 05. The line agent reads 40 files one by one. The graph agent sends 40 subagents.

This is the move that pays for everything else.

When you have a list of things that don't depend on each other (40 files to review, 12 routes to check, 9 sources to read), you don't chain them. You run them at once.

In a workflow that's parallel(). You give it a list of small functions. Each one starts a subagent. They all run together, and you get back a list of answers.

![06-fan-out](images/06-fan-out.png)

Two details make it hard to break:

- parallel() waits until every subagent is done, so the next step sees the full set.
- If one subagent crashes, its spot in the list becomes null. The other 39 still come back. Always add .filter(Boolean).

You can hand it 100 jobs. Only a handful run at the same moment (it depends on your machine). The rest wait their turn and still finish.

Your main Claude never holds 40 files in its head. Each subagent has its own clean context, and only the answers come back. That's how one session runs dozens of subagents without choking.

```javascript
const results = await parallel(
  files.map(file => () =>
    agent(`Review ${file} for missing auth checks.`, { schema: FINDINGS })
  )
)
const answers = results.filter(Boolean) // drop the ones that crashed
```

---

## 06. The line agent always waits for everyone. The graph agent waits only when it has to.

A fan-out is useless if nothing collects it.

The collecting point is where the arrows meet. One subagent, or a few lines of code, sees every result at once and does something that needs the full set.

That's the one place where waiting for everyone is worth it.

![07-when-to-wait](images/07-when-to-wait.png)

So wait for everyone only when the next step truly needs all the results together:

- removing duplicates across all sources
- stopping early because nothing was found at all
- a prompt that says "compare this with the other findings"

Don't wait just to flatten a list or clean up each item. Do that on the way.

Quick test. If your script goes parallel, then a small cleanup, then parallel again, and that cleanup never compares items with each other, the wait in the middle is wasted. Use pipeline() instead (more on that in 13).

```javascript
// A wall that is worth it: stop before you pay for verification
const all = (await parallel(finders)).filter(Boolean).flatMap(r => r.findings)
if (all.length === 0) return 'Nothing found. Skipping verification.'
```

---

## 07. The graph agent's favorite shape: the diamond.

Put the fan-out and the fan-in together and you get the shape behind almost every serious agent job.

One box splits the work. Many boxes do it at the same time. One box merges.

Code review, a dependency audit, a competitor scan, a research report: it's the same shape every time. Swap the list and the prompts, and the skeleton stays.

![08-diamond](images/08-diamond.png)

It has a name worth remembering: **fan out → reduce → synthesize.**

- **Fan out** to cover a lot of ground.
- **Reduce** with plain code to make it small.
- **Synthesize** with one final subagent that writes the answer.

Once you see the diamond, you stop asking "how do I make my agent do more steps?"

You start asking "where does it split, and where does it merge?" That second question is the one that scales.

---

## 08. The line agent decides on a whim. The graph agent decides in code.

Not every graph is fixed. Sometimes the next step depends on what a box found.

Is this ticket a bug or a feature request? Send it to the right handler. Is this diff 10 lines or 2,000? Do a quick review, or a full audit.

In a workflow this is a plain if or switch on the subagent's answer. The schema makes sure the answer is one of the options you expect.

![09-router](images/09-router.png)

Here, boring code is exactly what you want.

Claude makes the call inside the box. The script follows that call the same way every time. You get Claude's judgment where you need judgment, and the reliability of code everywhere else.

No more "Claude decided to skip the audit today". If the audit gets skipped, someone wrote that into the script.

```javascript
const { size } = await agent(`Is this diff small or big?\n${diff}`, {
  schema: {
    type: 'object',
    properties: { size: { enum: ['small', 'big'] } },
    required: ['size'],
  },
})

let review
if (size === 'big') {
  const reviews = await parallel(
    ['correctness', 'security', 'performance'].map(lens => () =>
      agent(`Review this diff for ${lens} problems only.\n${diff}`)
    )
  )
  review = await agent(`You are the judge. Merge these into one review:\n${JSON.stringify(reviews.filter(Boolean))}`)
} else {
  review = await agent(`Do a quick review of this diff.\n${diff}`)
}
```

---

## 09. The line agent trusts its first answer. The graph agent tries to kill it.

More subagents isn't the win. The win is the checks you can wrap around them.

A checker sits on the arrow, right before a finding reaches the final answer. It has one job: prove the finding wrong. If the finding survives, it goes through. If it doesn't, it's gone.

![10-try-to-kill-it](images/10-try-to-kill-it.png)

Three ways to do it:

- **Skeptics.** For every finding, start 3 subagents and tell each one to prove it wrong. Keep the finding only if most of them fail.
- **Different lenses.** Give each checker its own question: is it correct? is it a security issue? can I reproduce it? Three different checks catch more than three copies of the same check.
- **Judges.** Make 3 attempts from different angles and let judges score them. Build on the winner and borrow the best parts of the other two.

A team used exactly this to port the Bun runtime, with adversarial review built into the loop.

```javascript
// VERDICT = { refuted: boolean, why: string }
const votes = await parallel([1, 2, 3].map(() => () =>
  agent(`Try to prove this finding wrong: ${JSON.stringify(finding)}
If you are not sure, say it is wrong.`, { schema: VERDICT })
))
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```

---

## 10. In a line, one crash kills the run. In a graph, it's one empty chair.

In a line, C crashes, D never runs, and the whole thing stops.

In a graph, a crash should stay inside its box. Part of that you already have: a subagent that crashes inside parallel() turns into null, and the other 8 still come back. Your .filter(Boolean) is the fuse.

So build every merge step to work with missing pieces. Never assume you got the full set.

![11-empty-chair](images/11-empty-chair.png)

The sneakier problem is subagents stepping on each other.

If 5 subagents edit files at the same time, they can overwrite each other's work.

The fix is **isolation: 'worktree'**. Each subagent gets its own git worktree, basically its own copy of the repo, and does its work there. Nobody touches anybody else's files.

Use it only when subagents really write files at the same time. Every worktree costs setup time and disk space. It's a seatbelt for one situation, not something to put on every run.

```javascript
await parallel(files.map(file => () =>
  agent(`Port ${file} to TypeScript and make its tests pass.`, { isolation: 'worktree' })
))
```

---

## 11. The line agent stops at a number. The graph agent stops when nothing new turns up.

Sometimes you don't know how big the job is until you're in it. You go looking for bugs, and every bug you find points to three more.

The line agent handles this with a number: "find 10 bugs". It finds 10 and stops, even if there are 30.

The graph agent uses a loop: an arrow that goes back to an earlier box. Loops are also how you burn money. A loop that never ends keeps starting subagents until your budget is gone.

![12-loop-until-dry](images/12-loop-until-dry.png)

The loop that ends is called **loop until dry**. Keep sending finders. When 2 rounds in a row find nothing new, stop.

One detail decides if it works, and almost everyone gets it wrong the first time: what you compare new finds against.

Compare against **everything you've seen**, not just the finds you kept. Otherwise the ones you rejected come back every round, the loop never runs dry, and you pay to rediscover the same dead ends forever.

Want a hard ceiling too? Put a budget like +500k in your prompt. The script can check how much is left, and once it's spent, no new subagents start.

```javascript
const seen = new Set()
const confirmed = []
let dryRounds = 0

while (dryRounds < 2) {
  const found = (await parallel(finders)).filter(Boolean).flatMap(r => r.bugs)
  const fresh = found.filter(b => !seen.has(key(b))) // compare with EVERYTHING seen
  if (fresh.length === 0) { dryRounds++; continue }
  dryRounds = 0
  fresh.forEach(b => seen.add(key(b)))
  confirmed.push(...(await verifyAll(fresh)))
}
```

---

## 12. The line agent pays top price for every step. The graph agent pays for judgment.

Not every box needs your best model.

Some boxes are chores: pull one field out of a file, tag a ticket, check a link. Some boxes hold the real judgment: write the final report, decide if a finding is real.

A graph makes this split obvious. A single agent never does.

![13-model-tiers](images/13-model-tiers.png)

Watch out for the default. Every subagent uses your session model unless the script says otherwise. So a run with 40 subagents runs all 40 on whatever model your session uses. If that's your top model, you pay top price 40 times.

The fix is one option on agent(). **model** sends just that subagent to a different model. **effort: 'low'** tells it not to overthink a simple job.

Before a big run, check /model. Then tell Claude: a cheaper model for the many small boxes, your best model for the merge.

Same graph. Smaller bill.

```javascript
// chores: cheap and fast
const facts = await parallel(files.map(file => () =>
  agent(`List the exported functions in ${file}.`, { model: 'haiku', effort: 'low', schema: NAMES })
))

// judgment: no override, so it runs on your session model
const report = await agent(`Write the API changes report from:\n${JSON.stringify(facts.filter(Boolean))}`)
```

---

## 13. The line agent's time is the sum of its steps. The graph agent's time is its slowest path.

The shape of the graph decides how long a run takes. More than any prompt trick.

The choice that trips people up: parallel() or pipeline().

parallel() puts up a wall. Every item waits for the slowest one before the next stage starts.

pipeline() has no wall. Each item goes through all the stages on its own. Item A can be at stage 3 while item B is still at stage 1. Fast items finish early instead of sitting around.

![14-parallel-vs-pipeline](images/14-parallel-vs-pipeline.png)

So default to pipeline().

Put up a wall only when a stage really needs every result at once: removing duplicates across the full set, stopping early when the total is zero, a prompt that compares with "the other findings".

"The code looks cleaner" isn't a reason. "These stages feel separate" isn't one either. Waiting is real time, and you can measure it. Separate steps don't have to move in sync.

```javascript
// each file goes find → verify on its own. no wall between the stages.
const verified = await pipeline(
  files,
  file => agent(`Find missing auth checks in ${file}.`, { schema: FINDINGS }),
  found => agent(`Try to prove these wrong:\n${JSON.stringify(found)}`, { schema: VERDICTS })
)
```

---

## 14. You draw the line agent. Claude draws the graph.

The last step: stop drawing the graph yourself for jobs you can't plan ahead.

With dynamic workflows you describe the goal. Claude writes the plan: it splits the task, picks the fan-out, starts the subagents and puts the result together. You get a graph made for this exact run.

![15-claude-draws-it](images/15-claude-draws-it.png)

Three ways in:

- **Ask for it.** Write "use a workflow" in your prompt, and Claude writes one for the task.
- **Run a saved one.** /deep-research is a real graph that ships in Claude Code: scope → parallel search → fetch → try to disprove → write. It's the diamond from this article, with skeptics on the arrows.
- **Turn on ultracode.** Claude then plans a workflow for every big task in the session.

When a run turns out well, press s to save its script into .claude/workflows/. It lives in git, and anyone who clones the repo can run it by name.

Want to watch it work? /workflows shows the run live, subagent by subagent.

```
› Use a workflow to check every file in src/routes for missing auth checks.
  One subagent per file. Then 3 skeptics try to prove each finding wrong.
  Report only what survives, sorted by severity.
```

---

## 6 jobs to give a graph agent this week

![16-six-jobs](images/16-six-jobs.png)

Each one comes with a prompt you can paste.

**1. Security sweep.** One subagent per route file looks for missing auth checks. Skeptics check every finding before it gets into the report. No single context could hold all of that.

*Prompt: "Use a workflow. One subagent per file in src/routes, each one looking for missing auth checks. Then 3 skeptics per finding. Report only what survives."*

**2. Research with sources.** /deep-research splits your question into angles, searches them in parallel, drops duplicate sources and has three skeptics vote on every claim before it writes.

*Prompt: "/deep-research what changed in [your topic] in the last 6 months"*

**3. Port a module, file by file.** One subagent per file, each in its own worktree. The tests are the gate for every file. Whatever fails goes back for another pass.

*Prompt: "Use a workflow to port src/legacy to TypeScript. One subagent per file, each in its own worktree. Run the tests after each file and send failures back."*

**4. Diff review that scales.** A small diff gets one quick pass. A big one gets three reviewers with different lenses (correctness, security, performance) and one judge.

*Prompt: "Use a workflow to review my current diff. If it's small, one quick pass. If it's big, three reviewers with different focus and one judge."*

**5. Weekly scan.** Many sources checked at once (release notes, blogs, forums), ranked by impact at the merge, written up as one digest. Save it once, run it every week.

*Prompt: "Use a workflow to check the release notes and blogs of [the tools I use] and give me this week's changes, ranked by impact."*

**6. Bug hunt of unknown size.** Finders run in parallel, new finds are compared with everything seen, survivors get verified, and it loops until two rounds find nothing new.

*Prompt: "Use a workflow to find bugs in src/payments. Verify each one. Keep going until two rounds in a row find nothing new."*

---

## The two agents, one last time

![17-cheat-sheet](images/17-cheat-sheet.png)

The line agent is one head doing one thing at a time. It waits for no reason, pays tokens for glue, trusts its first answer, and stops when it runs out of room.

The graph agent splits the work, runs it at once, checks itself, and hands you one clean answer.

Same Claude. Same prompt box. Different shape.

The line was never the limit. It's just the first shape everyone reaches for, because it matches how we type: one line, one thought, one thing at a time.

Most people will keep building lines. You don't have to.

Save the cheat sheet above. You'll want it the next time you write "and then".

> If this was useful, follow me here for more Claude Code breakdowns. The longer ones go out on my Substack: movez.substack.com
