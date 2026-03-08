# AI Git Code Reviewer

A global AI code review tool for Laravel + Vue projects.
Automatically reviews staged code before commits and blocks commits if critical issues are found (e.g., `dd()`, `dump()`, `console.log()`, security or performance issues).

This tool uses [OpenRouter](https://openrouter.ai) or compatible OpenAI endpoints.

---

## Installation

1. Install the package globally via NPM:

```bash
npm install -g @levelxup/ai-git-review
```

Make sure you have **Node.js >= 18** installed.

---

## Configuration

Copy the `.env-example` to `.env` inside the package folder:

```bash
cd $(npm root -g)/@levelxup/ai-git-review
cp .env-example .env
```

Edit the `.env` file and add your API key and configuration:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=deepseek/deepseek-coder
OPENROUTER_API_ENDPOINT=https://openrouter.ai/api/v1
OPENROUTER_MAX_TOKENS=400
```

> ⚠️ The script will always use the `.env` file located next to `index.js`, not your project's `.env`.

---

## Setup Git Pre-commit Hook (Optional)

To automatically run AI review on every commit:

**1. Create a global Git hooks folder** (if you don't have one yet):

```bash
mkdir -p ~/.git-hooks
```

**2. Create a `pre-commit` file inside it:**

```bash
nano ~/.git-hooks/pre-commit
```

**3. Add the following content:**

```sh
#!/bin/sh
# Run the global AI reviewer
AI_REVIEWER="$(npm root -g)/@levelxup/ai-git-review/index.js"

if [ ! -f "$AI_REVIEWER" ]; then
    echo "❌ AI reviewer script not found at $AI_REVIEWER"
    exit 0
fi

node "$AI_REVIEWER"
STATUS=$?

if [ $STATUS -eq 1 ]; then
    echo "❌ Commit blocked due to AI detected issues."
    exit 1
fi

echo "✅ Commit passed AI review."
exit 0
```

**4. Make it executable:**

```bash
chmod +x ~/.git-hooks/pre-commit
```

**5. Tell Git to use this global hooks folder:**

```bash
git config --global core.hooksPath ~/.git-hooks
```

Now all your repositories will automatically run AI code review on commit.

---

## Usage

Run manually in any repo:

```bash
ai-git-review
```

Or automatically via the Git pre-commit hook (recommended).

---

## Logging

All AI review results and errors are logged in your project at:

```
storage/logs/ai-review.log
```

The log includes timestamps and reasons for failed commits.

---

## Notes

- Only **staged changes** (`git add`) are reviewed.
- Only `.php`, `.js`, and `.vue` files are checked.
- Large diffs (>15,000 characters) are skipped automatically.
- Commits are **blocked only** if AI detects critical issues.