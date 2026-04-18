import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
JSON_PATH = ROOT_DIR / "src" / "questions.json"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
DELAY = 1.2


class RateLimitError(Exception):
    pass


def normalize_explanation(text):
    if not text:
        return None

    cleaned = text.strip().replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"^(Explanation|Rationale|Answer)\s*:\s*", "", cleaned, flags=re.I)
    normalized_lines = []
    for line in cleaned.split("\n"):
        compact = re.sub(r"\s+", " ", line).strip()
        if compact:
            normalized_lines.append(compact)

    cleaned = "\n".join(normalized_lines)

    if not cleaned:
        return None

    final_lines = []
    for line in cleaned.split("\n"):
        if re.match(r"^(Why not:|[A-E]\))", line):
            final_lines.append(line)
        else:
            final_lines.append(line if re.search(r"[.!?]$", line) else f"{line}.")

    return "\n".join(final_lines)


def build_prompt(question):
    options_text = "\n".join(
        f"  {key}) {value}" for key, value in question["options"].items() if value
    )
    answer_text = ""

    if question.get("answer") and question["options"].get(question["answer"]):
        answer_text = f"\nKeyed answer: {question['answer']}) {question['options'][question['answer']]}"

    image_text = ""
    if question.get("image"):
        image_text = f"\nImage reference: {question['image']}"

    return f"""You are a NORCET nursing exam expert writing final reviewed explanations.

Question: {question['question']}

Options:
{options_text}
{answer_text}
{image_text}

Instructions:
- Start with 2 short sentences explaining why the correct answer is best, using any clues from the question stem, options, or image.
- After that, write a new line with exactly: Why not:
- Then add one short line for each wrong option, using labels like A), B), C), D), E) as applicable
- Each wrong-option line should briefly say what that option actually refers to, or why it is not the best answer here
- Keep each wrong-option line very short and specific
- Keep the tone like a good MCQ rationale book: direct, factual, and high-yield
- Prioritize standard nursing / medical exam reasoning over broad textbook explanation
- Use only well-established textbook-level reasoning; do not speculate or hedge
- Mention specific clues such as hallmark sign, drug of choice, first-line step, contraindication, complication, instrument feature, graph pattern, or lab association when relevant
- If the stem is image-based, tie the rationale to what the learner should notice in the image rather than speaking vaguely
- Avoid generic lines like "this is important for exams" unless you name the actual exam clue
- Do not repeat the full question
- Do not say "the correct answer is"
- Do not mention being an AI
- Return only the explanation text"""


def save_questions(questions):
    temp_path = JSON_PATH.with_suffix(".json.tmp")
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(questions, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    try:
        temp_path.replace(JSON_PATH)
    except PermissionError:
        with open(JSON_PATH, "w", encoding="utf-8") as handle:
            json.dump(questions, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        if temp_path.exists():
            temp_path.unlink()


def call_groq(prompt):
    payload = json.dumps(
        {
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 260,
            "temperature": 0.1,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        GROQ_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "norcet-explanations/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
            return normalize_explanation(data["choices"][0]["message"]["content"])
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        if error.code == 429:
            raise RateLimitError("Rate limit hit")
        if error.code == 401:
            print("\nInvalid GROQ_API_KEY.")
            sys.exit(1)
        print(f"   HTTP {error.code}: {body[:160]}")
        return None
    except Exception as error:
        print(f"   Error: {error}")
        return None


def is_valid_explanation(explanation):
    if not explanation or len(explanation) < 45:
        return False

    lowered = explanation.lower()
    bad_phrases = [
        "that is not an option",
        "is not listed",
        "as an ai",
        "i apologize",
        "there is no correct answer",
        "i cannot verify",
        "may be correct",
        "might be correct",
        "important for exams",
        "for nursing students",
    ]

    if "why not:" not in lowered:
        return False

    return not any(phrase in lowered for phrase in bad_phrases)


def call_groq_with_retry(prompt, retries=3):
    for attempt in range(retries):
        try:
            result = call_groq(prompt)
        except RateLimitError:
            wait_seconds = min(45 * (attempt + 1), 180)
            print(f"   Rate limit hit; waiting {wait_seconds} seconds before retry...")
            time.sleep(wait_seconds)
            continue

        if result and is_valid_explanation(result):
            return result

        if result:
            print(f"   [!] Rejected explanation: {result[:90]}...")

        if attempt < retries - 1:
            wait_seconds = (attempt + 1) * 8
            print(f"   Retry {attempt + 1}/{retries} in {wait_seconds}s...")
            time.sleep(wait_seconds)

    return None


def find_resume_index(questions):
    for index, question in enumerate(questions):
        if not normalize_explanation(question.get("explanation")):
            return index
    return len(questions)


def main():
    args = sys.argv[1:]
    regenerate_all = "--all" in args
    validate_only = "--validate" in args
    resume = "--resume" in args
    start = int(args[args.index("--start") + 1]) if "--start" in args else 0
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None

    if not GROQ_API_KEY:
        print("\nPlease set GROQ_API_KEY before running this script.")
        print("PowerShell example: $env:GROQ_API_KEY='your_key_here'")
        sys.exit(1)

    if not JSON_PATH.exists():
        print(f"\nFile not found: {JSON_PATH}")
        sys.exit(1)

    with open(JSON_PATH, "r", encoding="utf-8") as handle:
        questions = json.load(handle)

    if resume and not regenerate_all and not validate_only:
        start = find_resume_index(questions)

    print(f"\nLoaded {len(questions)} questions from {JSON_PATH}")
    if resume and not regenerate_all and not validate_only:
        print(f"Resume mode: starting from index {start}")
    to_process = []

    if validate_only:
        for index, question in enumerate(questions):
            explanation = normalize_explanation(question.get("explanation"))
            if explanation and not is_valid_explanation(explanation):
                to_process.append(index)
        print(f"Found {len(to_process)} questionable explanations to regenerate.")
    else:
        for index, question in enumerate(questions):
            if index < start:
                continue
            if not regenerate_all and normalize_explanation(question.get("explanation")):
                continue
            to_process.append(index)
            if limit and len(to_process) >= limit:
                break

    if not to_process:
        print("No questions need explanation updates.")
        return

    print(f"Generating explanations for {len(to_process)} questions...")
    success = 0
    failed = 0

    for count, index in enumerate(to_process, 1):
        question = questions[index]
        preview = question["question"][:70] + ("..." if len(question["question"]) > 70 else "")
        print(f"[{count}/{len(to_process)} | idx {index}] {preview}")

        if not question.get("answer"):
            print("   Skipped: no answer key")
            failed += 1
            continue

        explanation = call_groq_with_retry(build_prompt(question))
        if explanation:
            questions[index]["explanation"] = explanation
            success += 1
            print(f"   OK: {explanation[:100]}...")
        else:
            failed += 1
            print(f"   Failed at index {index}")

        save_questions(questions)

        if count < len(to_process):
            time.sleep(DELAY)

    print(f"\nDone. {success} generated, {failed} failed.")


if __name__ == "__main__":
    main()
