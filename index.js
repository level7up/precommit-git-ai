#!/usr/bin/env node

import { execSync } from "child_process";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Resolve .env next to this index.js file
const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), ".env");

dotenv.config({ path: envPath });

/**
 * Configuration
 */
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";
const BASE_URL = process.env.OPENROUTER_API_ENDPOINT || "https://openrouter.ai/api/v1";
const MAX_TOKENS = process.env.OPENROUTER_MAX_TOKENS || 300;

const MAX_DIFF_SIZE = 15000;
const MAX_BUFFER = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 10000;
const timestamp = new Date().toISOString();
const logFile = path.resolve(`storage/logs/ai-review.log`);
/**
 * Validate environment variables
 */
if (!API_KEY) {
    const logMessage = `[${timestamp}] ❌ OPENROUTER_API_KEY is missing in environment variables\n`;
    fs.appendFileSync(logFile, logMessage, "utf8");
    console.error(logMessage);
    process.exit(1);
}

/**
 * OpenAI client
 */
const openai = new OpenAI({
    apiKey: API_KEY,
    baseURL: BASE_URL,
    timeout: REQUEST_TIMEOUT,
});

/**
 * Get staged git diff (only added lines)
 */
console.log("Getting git diff...");
function getGitDiff() {
    try {
        const rawDiff = execSync(
            "git diff --cached -U0 -- '*.php' '*.js' '*.vue' ':!public/assets' ':!public/build'",
            { encoding: "utf8", maxBuffer: MAX_BUFFER }
        );

        // Keep only added lines
        const addedLines = rawDiff
            .split("\n")
            .filter(line => line.startsWith("+") && !line.startsWith("+++")) // remove diff headers
            .map(line => line.replace(/^\+/, "")) // remove leading '+'
            .join("\n")
            .trim();

        return addedLines;

    } catch (error) {
        const logMessage = `[${timestamp}] ❌ Failed to get git diff: ${error.message}\n`;
        console.error(logMessage);
        fs.appendFileSync(logFile, logMessage, "utf8");
        process.exit(0);
    }
}


/**
 * Limit diff size to avoid large API requests
 */
function sanitizeDiff(diff) {
    return diff.slice(0, MAX_DIFF_SIZE);
}

/**
 * Run AI code review
 */
async function runReview() {
    const diff = getGitDiff();

    if (!diff) {
        const logMessage = `[${timestamp}] ✅ No relevant staged changes detected.\n`;
        fs.appendFileSync(logFile, logMessage, "utf8");
        console.log(logMessage);
        process.exit(0);
    }

    try {
        const response = await openai.chat.completions.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            messages: [
                {
                    role: "system",
                    content: "You are a strict senior Laravel and Vue code reviewer.",
                },
                {
                    role: "user",
                    content: `
                    Review ONLY the following changed lines from a git commit.

                    Check for:
                    - Security issues
                    - Bad practices
                    - Performance problems
                    - Laravel mistakes
                    - Vue mistakes

                    code can not has debugging tools like dd, console.log, etc this is a critical issue.

                    If a CRITICAL issue exists respond EXACTLY:

                    FAIL: <file_name> new line <code> new line <reason>  new line <recommended_code>

                    Otherwise respond EXACTLY:

                    PASS

                    ${sanitizeDiff(diff)}
                    `,
                },
            ],
        });

        if (!response?.choices?.length) {
            const logMessage = `[${timestamp}] ❌ Invalid API response.\n`;
            console.error(logMessage);
            fs.appendFileSync(logFile, logMessage, "utf8");
            process.exit(0);
        }

        const review = response.choices[0].message.content.trim();

        const logMessage = `[${timestamp}] 🧠 AI Code Review:\n`;
        fs.appendFileSync(logFile, logMessage, "utf8");
        fs.appendFileSync(logFile, review + "\n", "utf8");

        if (review.startsWith("FAIL")) {
            const logMessage = `[${timestamp}] ❌ Commit blocked due to critical issues.\n`;
            console.error(logMessage);
            fs.appendFileSync(logFile, logMessage, "utf8");
            fs.appendFileSync(logFile, review + "\n", "utf8");
            process.exit(1);
        }

        logMessage = `[${timestamp}] ✅ Commit passed AI review.\n`;
        console.log(logMessage);
        fs.appendFileSync(logFile, logMessage, "utf8");
        process.exit(0);

    } catch (error) {
        const logMessage = `[${timestamp}] ❌ AI review failed: ${error.message}\n`;

        // Append to the log file
        fs.appendFileSync(logFile, logMessage, "utf8");
        // check if the changes have dd or dump or console.log
        const hasDebuggingTools = diff.includes(" dd(") ||  diff.includes(" @dd(") || diff.includes("dump(");
        // if (hasDebuggingTools) {
        //     const logMessage = `[${timestamp}] ❌ Commit blocked due to debugging tools.\n`;
        //     fs.appendFileSync(logFile, logMessage, "utf8");
        //     fs.appendFileSync(logFile, diff + "\n", "utf8");
        //     console.error(logMessage);
        //     process.exit(1);
        //     return;
        // }

        process.exit(0);
    }
}

runReview();