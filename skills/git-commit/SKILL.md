---
name: git-commit
description: Create git commits with intelligent change detection and interactive confirmation. Use when user wants to commit changes with `/commit` or asks to commit code. Prioritizes staged changes; falls back to working directory changes if nothing staged. Generates Conventional Commits message, allows user modification, then commits on confirmation.
---

# Git Commit Skill

Create git commits with intelligent change detection and interactive message confirmation.

## Workflow

### Step 1: Detect Changes

Run these commands to understand the current state:

```bash
git status
git diff --cached --stat   # Check staged changes
git diff --stat            # Check unstaged changes
```

**Priority logic:**
- If staged changes exist (`git diff --cached` has output) → Use staged changes only
- If no staged changes → Use all working directory changes

### Step 2: Analyze Changes

Based on the priority logic above:

**For staged changes:**
```bash
git diff --cached
```

**For working directory changes (when nothing staged):**
```bash
git diff HEAD
```

### Step 3: Generate Commit Message

Generate a Conventional Commits format message:

```
type(scope): subject line (max 72 chars)

- Detailed bullet point 1
- Detailed bullet point 2
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting (no logic change)
- `refactor`: Code restructuring (no behavior change)
- `perf`: Performance improvement
- `test`: Test additions/changes
- `chore`: Build process, dependencies, tooling
- `ci`: CI/CD configuration changes

**Rules:**
- NO author information (no "Co-Authored-By", no emoji)
- Subject line max 72 characters
- Use imperative mood ("add" not "added")
- Scope is optional but recommended

### Step 4: User Confirmation

Present the generated message and ask user:

1. Show the generated commit message
2. Use AskUserQuestion tool to ask:
   - "Commit with this message?"
   - Options: "Commit as-is", "Edit message", "Cancel"

**If user selects "Edit message":**
- Ask user to provide their modified message
- Use the user's message for commit

**If user selects "Cancel":**
- Stop without committing

### Step 5: Execute Commit

**If staged changes were used:**
```bash
git commit -m "$(cat <<'EOF'
<commit message here>
EOF
)"
```

**If working directory changes (nothing was staged):**
```bash
git add -A && git commit -m "$(cat <<'EOF'
<commit message here>
EOF
)"
```

After commit, show the result:
```bash
git log --oneline -1
```

## Error Handling

- If no changes detected: Inform user "No changes to commit"
- If commit fails: Show error and suggest fixes
- Never commit files that may contain secrets (.env, credentials.json, etc.) - warn user first
