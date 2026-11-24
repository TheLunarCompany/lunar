# graphify

graphify builds a knowledge graph of the codebase (AST-only, no LLM, no API cost) into `graphify-out/`. Claude Code queries it before grepping, so code exploration reads a scoped subgraph instead of raw files.

It is opt-in and local:

- `graphify-out/` and `.graphifyignore` are gitignored. Each developer builds and scopes their own graph.
- The graphify rules in [CLAUDE.md](../CLAUDE.md) only apply when `graphify-out/graph.json` exists, so nothing changes for anyone who doesn't install it.

## Install

Run from the repo root.

1. Install the CLI: `uv tool install graphifyy` (two y's).
2. Install the `/graphify` skill for Claude Code: `graphify install`.
3. Write your `.graphifyignore` (see [Scope](#scope-with-graphifyignore)).
4. Build the graph: `graphify update .`
5. Add the Claude Code hook: `graphify claude install`, then `git restore CLAUDE.md`.
   - The PreToolUse hook goes to `.claude/settings.json`, which is gitignored. It reminds the agent to query the graph before Bash, Grep, Read and Glob.
   - The command also replaces the graphify section of the committed CLAUDE.md with its stock text, which assumes a committed graph. The restore drops that.
6. Add the git hooks (recommended): `graphify hook install`, then `git restore .gitattributes`.
   - post-commit, post-checkout, post-merge and post-rewrite hooks go to `.git/hooks`. They rebuild the graph for changed code files, so it stays current without manual `graphify update .` runs.
   - The command also registers a `graph.json` merge driver in `.gitattributes`. `graph.json` is not tracked here, so the restore drops that.

## Scope with .graphifyignore

`.graphifyignore` uses gitignore syntax and applies on top of `.gitignore`. It can only exclude more, never re-include something `.gitignore` ignores.

Starter that graphs only the AI Gateway code:

```
/*
!/mcpx/
!/mcpx-webapp/
!/ai-gateway-shared/
```

Narrow it to what you work on: a smaller graph gives tighter query results. After a change, rebuild with `graphify update . --force`. Without `--force`, graphify refuses to write a graph with fewer nodes than the current one.

## Use

| Command | What it answers |
| --- | --- |
| `graphify query "<names>"` | Subgraph around the named classes, functions or files |
| `graphify path "<A>" "<B>"` | Shortest path between two nodes (directed; `--undirected` ignores direction) |
| `graphify explain "<X>"` | A node and its neighbors, in plain language |
| `graphify affected "<X>"` | What depends on X |

Tips:

- Ask with code names, not prose. `query` matches your words against symbol and file names: `"SandboxAnalysisService Obo"` finds both, while `"how does the sandbox analysis start OBO"` also seeds on unrelated `start` and `service` nodes.
- An ambiguous name exits with code 3 and lists its candidates. Retry with `path/to/file.ts::Symbol`.
- A dependency taken through an interface has no edge to the concrete class. Ask `path` about the interface (`OboServiceI`, not `Obo`).
- `affected` on anything built in `services.ts` lists every IT suite, since they all import `Services`.

`graphify-out/graph.html` is an interactive view of the graph.

## Uninstall

Run from the repo root.

1. Remove the git hooks: `graphify hook uninstall`.
2. Remove the skill, the Claude Code hook and `graphify-out/`: `graphify uninstall --purge`, then `git restore CLAUDE.md`. The command also deletes the graphify section from the committed CLAUDE.md, so the restore puts it back.
3. Remove the CLI: `uv tool uninstall graphifyy`.
4. Delete your `.graphifyignore`.
