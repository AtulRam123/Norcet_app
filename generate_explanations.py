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


def split_into_sentences(value):
    if value is None:
        return []

    if isinstance(value, list):
        raw_parts = [str(item).strip() for item in value if str(item).strip()]
    else:
        text = re.sub(r"\s+", " ", str(value)).strip()
        if not text:
            return []
        raw_parts = re.split(r"(?<=[.!?])\s+", text)

    sentences = []
    for part in raw_parts:
        cleaned = re.sub(r"\s+", " ", str(part)).strip()
        if not cleaned:
            continue
        sentences.append(cleaned if re.search(r"[.!?]$", cleaned) else f"{cleaned}.")
    return sentences


def normalize_option_label(label):
    if label is None:
        return None

    text = str(label).strip().upper()
    match = re.search(r"\b([A-E])\b", text)
    return match.group(1) if match else None


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
    options = {key: value for key, value in question["options"].items() if value}
    wrong_labels = [key for key in options if key != question.get("answer")]

    payload = {
        "question": question["question"],
        "options": options,
        "correct_label": question.get("answer"),
        "correct_option": options.get(question.get("answer")),
        "image_reference": question.get("image"),
        "required_wrong_labels": wrong_labels,
    }

    return f"""You are a NORCET nursing exam expert.

Analyze the MCQ and return ONLY valid JSON.
Do not return markdown.
Do not return headings.
Do not use placeholder phrases like "this option fits", "best option", or "key clinical clue in the stem" unless you replace them with the actual content of the question.

Input:
{json.dumps(payload, ensure_ascii=False, indent=2)}

Return this JSON schema exactly:
{{
  "right": [
    "sentence 1",
    "sentence 2",
    "sentence 3"
  ],
  "wrong": {{
    "A": ["sentence 1", "sentence 2"],
    "B": ["sentence 1", "sentence 2"]
  }}
}}

Requirements:
- "right" must contain exactly 3 short factual sentences about why the correct option is right
- each sentence in "right" must mention the actual concept, feature, mechanism, investigation role, drug role, anatomical clue, or exam clue from THIS question
- "wrong" must contain every wrong option label listed in required_wrong_labels and no correct label
- each wrong option must have exactly 2 factual sentences
- wrong sentence 1: explain what that option actually refers to, or the exact reason it is wrong here
- wrong sentence 2: explain why it loses to the correct option in this specific question
- keep all reasoning specific to this MCQ, not generic template language
- if the stem is image-based, mention the visual clue where relevant
- do not mention being an AI"""


def build_fallback_prompt(question):
    options = {key: value for key, value in question["options"].items() if value}
    wrong_labels = [key for key in options if key != question.get("answer")]

    return f"""Write a concise NORCET MCQ explanation in plain text.

Question: {question["question"]}
Options:
{chr(10).join(f"{key}) {value}" for key, value in options.items())}
Correct answer: {question.get("answer")}) {options.get(question.get("answer"))}
Wrong option labels: {", ".join(wrong_labels)}

Return exactly this structure:
sentence sentence sentence
Why not:
A) sentence sentence
B) sentence sentence

Rules:
- first line must be 2 to 3 short factual sentences explaining why the correct answer is right
- after "Why not:" include every wrong option label exactly once
- each wrong option line must have 2 short factual sentences
- be specific to this question
- do not use placeholders like "this option fits" or "key clinical clue"
- do not use markdown
- do not mention being an AI"""


def extract_json_object(text):
    if not text:
        return None

    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", raw, flags=re.S)
    if not match:
        return None

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def format_structured_explanation(data, question):
    right = data.get("right") or []
    wrong = data.get("wrong") or {}
    answer = question.get("answer")
    options = question.get("options", {})

    right_lines = split_into_sentences(right)
    if len(right_lines) < 2:
        return None

    wrong_labels = [key for key, value in options.items() if value and key != answer]
    normalized_wrong = {}

    if isinstance(wrong, dict):
        for key, value in wrong.items():
            label = normalize_option_label(key)
            if label:
                normalized_wrong[label] = value
    elif isinstance(wrong, list):
        for entry in wrong:
            if not isinstance(entry, dict):
                continue
            label = normalize_option_label(
                entry.get("label") or entry.get("option") or entry.get("id")
            )
            value = (
                entry.get("sentences")
                or entry.get("lines")
                or entry.get("text")
                or entry.get("reason")
            )
            if label and value:
                normalized_wrong[label] = value

    if any(label not in normalized_wrong for label in wrong_labels):
        return None

    parts = [" ".join(right_lines[:3]), "Why not:"]

    for label in wrong_labels:
        pair_lines = split_into_sentences(normalized_wrong.get(label))
        if len(pair_lines) < 2:
            return None
        parts.append(f"{label}) {pair_lines[0]} {pair_lines[1]}")

    return normalize_explanation("\n".join(parts))


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


def call_groq(prompt, question):
    payload = json.dumps(
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "Return only valid JSON. No markdown. No prose outside JSON."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 700,
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
            content = data["choices"][0]["message"]["content"]
            structured = extract_json_object(content)
            if not structured:
                return None
            return format_structured_explanation(structured, question)
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


def call_groq_plaintext(prompt):
    payload = json.dumps(
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "Return only the requested explanation text. No markdown."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 700,
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
            content = data["choices"][0]["message"]["content"]
            return normalize_explanation(content)
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


def validate_explanation(explanation, question):
    if not explanation or len(explanation) < 80:
        return False, "too short or empty"

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
        "keyed answer",
        "best option",
        "this option fits because it matches the key clinical clue in the stem",
        "one more specific detail strengthens it",
    ]

    if "why not:" not in lowered:
        return False, "missing why not section"
    if any(phrase in lowered for phrase in bad_phrases):
        return False, "contains banned template text"

    lines = [line.strip() for line in explanation.split("\n") if line.strip()]
    why_not_index = next((idx for idx, line in enumerate(lines) if line.lower() == "why not:"), -1)
    if why_not_index == -1:
        return False, "why not marker not isolated"

    wrong_lines = lines[why_not_index + 1:]
    expected_wrong = [
        key for key, value in question.get("options", {}).items()
        if value and key != question.get("answer")
    ]

    present_labels = []
    for line in wrong_lines:
        match = re.match(r"^([A-E])\)", line)
        if match:
            present_labels.append(match.group(1))

    if sorted(present_labels) != sorted(expected_wrong):
        return False, f"wrong option coverage mismatch: expected {expected_wrong}, got {present_labels}"

    return True, None


def log_failed_attempt(index, question, reason):
    debug_path = ROOT_DIR / "failed_debug.log"
    with open(debug_path, "a", encoding="utf-8") as handle:
        handle.write(
            f"idx={index}\treason={reason}\tquestion={question.get('question', '').strip()}\n"
        )


def call_groq_with_retry(question, index, retries=3):
    prompt = build_prompt(question)
    fallback_prompt = build_fallback_prompt(question)
    for attempt in range(retries):
        try:
            result = call_groq(prompt, question)
        except RateLimitError:
            wait_seconds = min(45 * (attempt + 1), 180)
            print(f"   Rate limit hit; waiting {wait_seconds} seconds before retry...")
            time.sleep(wait_seconds)
            continue

        if not result:
            try:
                result = call_groq_plaintext(fallback_prompt)
                if result:
                    print("   Using fallback plain-text prompt...")
            except RateLimitError:
                wait_seconds = min(45 * (attempt + 1), 180)
                print(f"   Rate limit hit; waiting {wait_seconds} seconds before retry...")
                time.sleep(wait_seconds)
                continue

        is_valid, reason = validate_explanation(result, question)
        if result and is_valid:
            return result

        if result:
            print(f"   [!] Rejected explanation ({reason}): {result[:120]}...")
            log_failed_attempt(index, question, reason)
        else:
            log_failed_attempt(index, question, "no usable response from model")

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


def read_indexes_file(path):
    file_path = Path(path)
    if not file_path.exists():
        print(f"\nIndexes file not found: {file_path}")
        sys.exit(1)

    indexes = []
    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            indexes.append(int(line))
        except ValueError:
            print(f"\nInvalid index in {file_path}: {line}")
            sys.exit(1)

    return indexes


def main():
    args = sys.argv[1:]
    regenerate_all = "--all" in args
    validate_only = "--validate" in args
    resume = "--resume" in args
    indexes_file = args[args.index("--indexes-file") + 1] if "--indexes-file" in args else None
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

    if indexes_file:
        requested_indexes = read_indexes_file(indexes_file)
        to_process = [index for index in requested_indexes if 0 <= index < len(questions)]
        if limit:
            to_process = to_process[:limit]
        print(f"Loaded {len(to_process)} indexes from {indexes_file}")
    elif validate_only:
        for index, question in enumerate(questions):
            explanation = normalize_explanation(question.get("explanation"))
            is_valid, _ = validate_explanation(explanation, question)
            if explanation and not is_valid:
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
    failed_indexes = []

    for count, index in enumerate(to_process, 1):
        question = questions[index]
        preview = question["question"][:70] + ("..." if len(question["question"]) > 70 else "")
        print(f"[{count}/{len(to_process)} | idx {index}] {preview}")

        if not question.get("answer"):
            print("   Skipped: no answer key")
            failed += 1
            continue

        explanation = call_groq_with_retry(question, index)
        if explanation:
            questions[index]["explanation"] = explanation
            success += 1
            print(f"   OK: {explanation[:100]}...")
        else:
            failed += 1
            failed_indexes.append(index)
            print(f"   Failed at index {index}")

        save_questions(questions)

        if count < len(to_process):
            time.sleep(DELAY)

    if failed_indexes:
        failed_path = ROOT_DIR / "failed_indexes.txt"
        failed_path.write_text("\n".join(str(index) for index in failed_indexes) + "\n", encoding="utf-8")
        print(f"Saved failed indexes to {failed_path}")

    print(f"\nDone. {success} generated, {failed} failed.")


if __name__ == "__main__":
    main()
