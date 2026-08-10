# Using agent-skills with Codex

This repository is also a [Codex plugin](https://developers.openai.com/codex/plugins/build). The same root-level `skills/` directory used by Claude Code is consumed by Codex, so no files are copied or duplicated.

## Install

```bash
codex plugin marketplace add addyosmani/agent-skills
codex plugin add agent-skills@agent-skills
```

> Requires Codex CLI v0.122 or later. On older releases the command was `codex marketplace add`. See the [Codex CLI docs](https://developers.openai.com/codex/cli).

The first command registers this repository as the `agent-skills` marketplace. The second command installs and enables the `agent-skills` plugin from that marketplace. Start a new Codex session after installation so the skills are discovered.

Local clones work too:

```bash
codex plugin marketplace add /path/to/your/clone
codex plugin add agent-skills@agent-skills
```

## Repair a standalone skill installation

The native plugin install above keeps the whole repository together. If an
installer instead copies individual `skills/<name>/` directories into a
standalone location such as `~/.codex/skills`, the shared repository-level
`references/` directory is outside that copy boundary.

From a checkout of this repository, materialize each shared file next to the
installed skill that uses it:

```bash
node scripts/materialize-skill-references.js --destination ~/.codex/skills
node scripts/materialize-skill-references.js --destination ~/.codex/skills --check
```

The command copies only referenced files, preserves unrelated installed
skills, and fails if a skill names a source reference that does not exist. Run
it again after refreshing a standalone installation. The `--check` form is
read-only and reports missing or stale installed copies.

## Usage

After install, invoke a skill in Codex chat with `@` (e.g. `@spec-driven-development`) or just describe the task and let Codex pick the right skill. All 24 skills under `skills/` are available.

## How it works

- `.codex-plugin/plugin.json` — Codex plugin manifest at the repo root. Points `skills` at `./skills/` and provides the metadata required by Codex.
- `.agents/plugins/marketplace.json` — marketplace entry declaring the repo root (`./`) as the plugin source.
- `skills/<name>/SKILL.md` — unchanged. Codex and Claude Code share the same `name` + `description` frontmatter format, so one file serves both platforms.

Slash commands in `.claude/commands/`, personas in `agents/`, and the lifecycle hook under `hooks/` stay Claude Code-specific. On Codex, invoke the underlying skill directly instead of the slash command (e.g. `@spec-driven-development` instead of `/spec`).
