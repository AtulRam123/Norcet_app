"""
NORCET MCQ Converter — v5
==========================

KEY CHANGES vs v4
------------------
1. UNIQUE ID GENERATION — was using MD5 of question text only, which caused
   collisions for:
   (a) Image-only questions (empty text) — 25 distinct Qs all got the same ID.
   (b) Generic-stem image questions ('Identify above IUDs', 'Identify above
       logo', etc.) — multiple different questions shared the same short stem.
   FIX: ID is now MD5 of  question_text + "||" + all_options_text + "||" + image_path
   making every question with different content get a guaranteed unique ID.

2. DEDUPLICATION LOGIC — only questions that are truly identical (same question
   text AND same options AND same image) are considered duplicates. Every other
   question, even if sharing a generic stem, is kept as a distinct entry.

3. ALL 1,112 QUESTIONS PRESERVED — all questions parsed from the docx appear
   in the output JSON with no unintended drops.

Previous fixes (v2–v4) retained:
- Trailing \n as dense-section block boundary
- Removed lowercase-start continuation heuristic
- Quote-start = new option, not continuation
- Image-Q + options block merging (1-line and 2-line Q+IMG)
- Overflow lines re-parsed when answer found at >=4 options

Usage:
    python convert_docx_to_json.py src/questions.docx [src_dir] [public_dir]

Output:
    src/questions.json
    public/images/q_*.jpg/png
"""

import json, sys, os, hashlib, re
from docx import Document
from docx.oxml.ns import qn


# ── helpers ──────────────────────────────────────────────────────────────────

def is_hl(para):
    YELLOW = {"yellow", "green", "ffff00", "ffff99", "00ff00", "92d050"}
    for run in para.runs:
        rpr = run._r.find(qn("w:rPr"))
        if rpr is None:
            continue
        hl = rpr.find(qn("w:highlight"))
        if hl is not None and hl.get(qn("w:val"), "").lower() in YELLOW:
            return True
        shd = rpr.find(qn("w:shd"))
        if shd is not None:
            fill = shd.get(qn("w:fill"), "").lower()
            if fill in YELLOW or fill.startswith("ffff"):
                return True
    return False


def has_img(para):
    return para._p.find(".//" + qn("a:blip")) is not None


def get_img_rids(para):
    blips = para._p.findall(".//" + qn("a:blip"))
    return [b.get(qn("r:embed")) for b in blips if b.get(qn("r:embed"))]


def clean(t):
    return " ".join(t.strip().split())


def norm_text(t):
    """Lowercase alphanum only — for dedup comparison."""
    return "".join(c.lower() for c in t if c.isalnum())


def make_id(question_text, options, image):
    """
    Composite ID: question text + all option texts + image path.
    Guarantees uniqueness across image-only Qs and generic-stem Qs.
    """
    combined = (
        question_text.strip().lower()
        + "||"
        + "|".join(v.strip().lower() for v in options.values())
        + "||"
        + (image or "")
    )
    return hashlib.md5(combined.encode()).hexdigest()[:12]


def infer_topic(question_text, options):
    text = " ".join(
        part for part in [question_text, *options.values()] if isinstance(part, str) and part.strip()
    ).lower()

    topic_rules = [
        ("pharmacology", [r"\bdrug\b", r"\bdoc\b", r"\bantibiotic", r"\binsulin\b", r"\bdigoxin\b", r"\bantipsychotic\b", r"\blevodopa\b", r"\bparkinson", r"\bthyroid", r"\bdiabetes\b"]),
        ("pediatrics", [r"\bchild\b", r"\binfant\b", r"\bnewborn\b", r"\bneonate\b", r"\bpaediatric\b", r"\bvaccine\b", r"\bbreast milk\b", r"\bfetus\b"]),
        ("obstetrics_gynecology", [r"\bpregnan", r"\bgestation", r"\blabor\b", r"\bvaginal\b", r"\bobstetric", r"\biud\b", r"\bovar", r"\bpostpartum\b", r"\bantenatal\b"]),
        ("psychiatry", [r"\bschizophrenia\b", r"\bbipolar\b", r"\bdelirium\b", r"\bdepression\b", r"\bmania\b", r"\bpsychi", r"\bparkinsonism\b"]),
        ("community_health", [r"\bwho\b", r"\bunicef\b", r"\bunfpa\b", r"\bepidemi", r"\bdemography\b", r"\bdependency ratio\b", r"\bsampling\b", r"\bcommunity\b", r"\bpublic health\b"]),
        ("medical_surgical", [r"\bheart failure\b", r"\bshock\b", r"\barrhythm", r"\bembol", r"\brenal\b", r"\bmeningitis\b", r"\bpulmonary\b", r"\bfracture\b", r"\btraction\b", r"\bsplint\b"]),
        ("anatomy_physiology", [r"\bpituitary\b", r"\bhypothalamus\b", r"\bchromosome\b", r"\bhormone\b", r"\bgestational age\b", r"\bphysiology\b"]),
    ]

    for topic, patterns in topic_rules:
        if any(re.search(pattern, text) for pattern in patterns):
            return topic
    return None


OPEN_QUOTES = {"\u201c", "\u2018", '"', "'"}


def looks_like_continuation(prev_text, text, has_image=False):
    """
    Returns True only on structural evidence of line wrapping.
    A line that starts with an opening quote is always a new option.
    """
    if has_image or not prev_text or not text:
        return False
    stripped = text.lstrip()
    prev     = prev_text.rstrip()

    if stripped and stripped[0] in OPEN_QUOTES:
        return False
    if stripped.startswith((")", ",", ".", ":", ";")):
        return True
    if prev.count("\u201c") > prev.count("\u201d"):
        return True
    if prev.count('"') % 2 == 1:
        return True
    tail = prev.rstrip('"\u2019].,;:!?').split()[-1].lower() if prev.split() else ""
    LINK = {"was","were","is","are","be","been","being",
            "with","without","of","for","to","into","from","that"}
    if tail in LINK and len(stripped.split()) <= 8:
        return True
    return False


def extract_image(doc, rid, out_path):
    try:
        part = doc.part.related_parts[rid]
        ext  = part.content_type.split("/")[-1].replace("jpeg", "jpg")
        if ext not in ("jpg","jpeg","png","gif","bmp","webp"):
            ext = "jpg"
        final = out_path + "." + ext
        os.makedirs(os.path.dirname(final), exist_ok=True)
        with open(final, "wb") as f:
            f.write(part.blob)
        return "images/" + os.path.basename(final)
    except Exception as e:
        print(f"  Warning: image extract failed: {e}")
        return None


# ── collect raw lines ─────────────────────────────────────────────────────────

def collect_lines(doc, images_dir):
    lines       = []
    img_counter = [0]
    for p in doc.paragraphs:
        raw         = p.text
        t           = clean(raw)
        hl          = is_hl(p)
        img         = None
        is_img_para = has_img(p)
        if is_img_para:
            for rid in get_img_rids(p):
                img_counter[0] += 1
                base  = os.path.join(images_dir, f"q_{img_counter[0]:04d}")
                saved = extract_image(doc, rid, base)
                if saved:
                    img = saved
                    break
        lines.append({
            "text":        t,
            "hl":          hl,
            "img":         img,
            "is_img_para": is_img_para,
            "ends_block":  "\n" in raw,
            "is_blank":    not t and not is_img_para,
        })
    return lines


# ── split into blocks ─────────────────────────────────────────────────────────

def split_into_blocks(lines):
    blocks, cur = [], []
    for ln in lines:
        if ln["is_blank"]:
            if cur:
                blocks.append(cur)
                cur = []
            continue
        cur.append(ln)
        if ln["ends_block"]:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    return blocks


# ── merge image-question blocks with their option blocks ──────────────────────

def looks_like_options_only_block(block):
    if not (2 <= len(block) <= 5):
        return False
    text_lines = [ln["text"] for ln in block if ln["text"]]
    if len(text_lines) < 2:
        return False
    return not any(t.endswith("?") for t in text_lines)


def is_image_only_block(block):
    return bool(block) and all(ln["is_img_para"] and not ln["text"] for ln in block)


def merge_image_question_blocks(blocks):
    merged, i = [], 0
    while i < len(blocks):
        b = blocks[i]
        is_lone_q = len(b) == 1
        is_q_img  = (len(b) == 2 and b[1]["is_img_para"] and not b[1]["text"])

        if (
            i + 2 < len(blocks)
            and any(ln["text"] for ln in b)
            and not any(ln["is_img_para"] for ln in b)
            and is_image_only_block(blocks[i + 1])
            and looks_like_options_only_block(blocks[i + 2])
        ):
            img_block = blocks[i + 1]
            option_block = blocks[i + 2]
            img_ln = next((ln for ln in img_block if ln["img"]), None)
            merged_q = list(b)
            if img_ln and not any(ln["img"] for ln in merged_q):
                merged_q[0] = dict(merged_q[0])
                merged_q[0]["img"] = img_ln["img"]
            merged.append(merged_q + option_block)
            i += 3
            continue

        if (is_lone_q or is_q_img) and i + 1 < len(blocks):
            if looks_like_options_only_block(blocks[i + 1]):
                merged.append(b + blocks[i + 1])
                i += 2
                continue

        if all(ln["is_img_para"] and not ln["text"] for ln in b) and i + 1 < len(blocks):
            if looks_like_options_only_block(blocks[i + 1]):
                if merged:
                    prev   = list(merged[-1])
                    img_ln = next((ln for ln in b if ln["img"]), None)
                    if img_ln and not any(l["img"] for l in prev):
                        prev[0] = dict(prev[0])
                        prev[0]["img"] = img_ln["img"]
                    merged[-1] = prev + blocks[i + 1]
                else:
                    merged.append(b + blocks[i + 1])
                i += 2
                continue

        merged.append(b)
        i += 1
    return merged


# ── parse questions from blocks ───────────────────────────────────────────────

def parse_block(block):
    if len(block) < 2:
        return []

    opt_keys = ["A", "B", "C", "D", "E"]
    q_line   = block[0]
    q_text   = q_line["text"]
    q_img    = q_line["img"]

    if not q_text and not q_img:
        return []

    opts_raw = list(block[1:])

    # Some docx sequences are already grouped as: question -> image -> options.
    # In those cases the image paragraph should belong to the question, not option A.
    while opts_raw and opts_raw[0]["is_img_para"] and not opts_raw[0]["text"]:
        if not q_img and opts_raw[0]["img"]:
            q_img = opts_raw[0]["img"]
        opts_raw.pop(0)

    # Merge continuation lines in options
    merged = []
    for ln in opts_raw:
        t, hl, img = ln["text"], ln["hl"], ln["img"]
        if merged and looks_like_continuation(merged[-1]["text"], t, img is not None):
            merged[-1] = {
                "text": (merged[-1]["text"] + " " + t).strip(),
                "hl":   merged[-1]["hl"] or hl,
                "img":  merged[-1]["img"] or img,
            }
        else:
            merged.append({"text": t, "hl": hl, "img": img})

    if len(merged) < 2:
        return []

    opts, answer, overflow = {}, None, []
    for idx, opt in enumerate(merged):
        if idx >= 4 and answer is not None:
            overflow = merged[idx:]; break
        if idx >= 5:
            overflow = merged[idx:]; break
        k = opt_keys[idx]
        opts[k] = opt["text"]
        if opt["hl"]:
            answer = k

    result = []
    if len(opts) >= 2:
        result.append({
            "id":          make_id(q_text, opts, q_img),
            "question":    q_text,
            "options":     opts,
            "answer":      answer,
            "image":       q_img,
            "explanation": None,
        })

    if overflow:
        sub = [{"text": o["text"], "hl": o["hl"], "img": o["img"],
                "is_img_para": False, "ends_block": False, "is_blank": False}
               for o in overflow]
        result.extend(parse_block(sub))

    return result


def parse_questions_from_blocks(blocks):
    qs = []
    for b in blocks:
        qs.extend(parse_block(b))
    return qs


# ── deduplication ─────────────────────────────────────────────────────────────

def deduplicate(questions):
    """
    Keep only truly unique questions.
    Two questions are duplicates iff norm(question) + norm(all options) + image
    are all identical. Different options or different image = different question.
    """
    seen, result, dupes = set(), [], 0
    for q in questions:
        key = (
            norm_text(q["question"]),
            norm_text("".join(q["options"].values())),
            q["image"] or "",
        )
        if key in seen:
            dupes += 1
        else:
            seen.add(key)
            result.append(q)
    return result, dupes


def build_review_report(questions):
    flagged = []
    visual_patterns = [
        r"\bidentify above\b",
        r"\bidentify below\b",
        r"\bshown in (the )?(image|figure)\b",
        r"\bgiven image\b",
        r"\bdepicted\b",
        r"\bfigure\b",
        r"\bimage shows\b",
        r"\bshown below\b",
        r"\bshown above\b",
        r"\bgraphical representation\b",
        r"\bidentify above graph\b",
    ]

    for q in questions:
        flags = []
        question_text = q.get("question", "")
        options = q.get("options") or {}
        option_keys = [key for key, value in options.items() if value]

        if len(option_keys) < 4:
            flags.append("fewer_than_4_options")
        if any(not value for value in options.values()):
            flags.append("blank_option_value")
        if not q.get("answer"):
            flags.append("missing_answer_key")
        if any(re.search(pattern, question_text.lower()) for pattern in visual_patterns) and not q.get("image"):
            flags.append("visual_stem_without_image")

        if flags:
            flagged.append({
                "id": q.get("id"),
                "topic": q.get("topic"),
                "question": question_text,
                "image": q.get("image"),
                "answer": q.get("answer"),
                "flags": flags,
                "options": options,
            })

    summary = {}
    for item in flagged:
        for flag in item["flags"]:
            summary[flag] = summary.get(flag, 0) + 1

    return {
        "flagged_count": len(flagged),
        "summary": summary,
        "questions": flagged,
    }


def write_review_report(report, out_path):
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


# ── persistence ───────────────────────────────────────────────────────────────

def merge_and_update(new_questions, out_path):
    existing = []
    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            try:
                existing = json.load(f)
            except Exception:
                existing = []
        print(f"   {len(existing)} questions already in {out_path}")

    existing_by_id = {q.get("id"): q for q in existing if isinstance(q, dict)}
    existing_by_fallback = {}
    for q in existing:
        if not isinstance(q, dict):
            continue
        key = (
            norm_text("".join((q.get("options") or {}).values())),
            q.get("image") or "",
        )
        if key[0] or key[1]:
            existing_by_fallback[key] = q

    rebuilt = []
    added = updated = 0

    for q in new_questions:
        old = existing_by_id.get(q["id"])
        if old is None:
            fallback_key = (
                norm_text("".join(q["options"].values())),
                q["image"] or "",
            )
            old = existing_by_fallback.get(fallback_key)

        merged = dict(q)
        if old:
            if old.get("explanation"):
                merged["explanation"] = old["explanation"]
            merged["topic"] = old.get("topic") or q.get("topic")
            if not merged["answer"] and old.get("answer") in merged["options"]:
                merged["answer"] = old["answer"]
            if old.get("id") != q["id"] or old.get("answer") != merged["answer"]:
                updated += 1
        else:
            added += 1
        rebuilt.append(merged)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rebuilt, f, ensure_ascii=False, indent=2)
    return added, updated, len(rebuilt), rebuilt


# ── entry point ───────────────────────────────────────────────────────────────

def convert(docx_path, src_dir="src", public_dir="public"):
    if not os.path.exists(docx_path):
        print(f"\nERROR: File not found: {docx_path}")
        sys.exit(1)

    images_dir = os.path.join(public_dir, "images")
    json_path  = os.path.join(src_dir, "questions.json")
    review_path = os.path.join(src_dir, "questions.review.json")
    os.makedirs(src_dir,    exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)

    print(f"\nReading {docx_path} …")
    doc   = Document(docx_path)
    lines = collect_lines(doc, images_dir)
    print(f"   {len(lines)} paragraphs found")

    blocks = split_into_blocks(lines)
    print(f"   {len(blocks)} raw blocks")

    blocks = merge_image_question_blocks(blocks)
    print(f"   {len(blocks)} blocks after image-Q merge")

    raw_qs = parse_questions_from_blocks(blocks)
    print(f"   {len(raw_qs)} questions parsed")

    questions, dupes = deduplicate(raw_qs)
    if dupes:
        print(f"   {dupes} true duplicate(s) removed (identical Q+options+image)")
    print(f"   {len(questions)} unique questions")

    for q in questions:
        q["topic"] = infer_topic(q["question"], q["options"])

    with_ans = sum(1 for q in questions if q["answer"])
    with_img = sum(1 for q in questions if q["image"])
    null_ans = len(questions) - with_ans
    print(f"   {with_ans} with answers  |  {null_ans} null  |  {with_img} with images")

    added, updated, total, merged_questions = merge_and_update(questions, json_path)
    review = build_review_report(merged_questions)
    write_review_report(review, review_path)

    print(f"\n{'='*52}")
    print(f"  Done!")
    print(f"  +{added} new questions added")
    print(f"  ~{updated} existing answers updated")
    print(f"  {total} total in {json_path}")
    print(f"  {review['flagged_count']} flagged in {review_path}")
    if with_img:
        print(f"  Images saved to {images_dir}/")
    print(f"{'='*52}")

    print("\n-- First 5 questions --")
    for q in questions[:5]:
        print(f"\n  Q: {q['question'][:72]}")
        if q["image"]:
            print(f"     IMG: {q['image']}")
        for k in ["A","B","C","D","E"]:
            v = q["options"].get(k,"")
            if v:
                mark = "  <- ANSWER" if k == q["answer"] else ""
                print(f"     {k}) {v[:62]}{mark}")
        if not q["answer"]:
            print("     (no highlighted answer in docx)")

    if null_ans:
        print(f"\n-- {null_ans} question(s) with no highlighted answer --")
        for q in [x for x in questions if not x["answer"]][:10]:
            print(f"  Q: {q['question'][:70]}")
            for k, v in q["options"].items():
                print(f"    {k}) {v[:60]}")
            print()


if __name__ == "__main__":
    docx = sys.argv[1] if len(sys.argv) > 1 else "src/questions.docx"
    src  = sys.argv[2] if len(sys.argv) > 2 else "src"
    pub  = sys.argv[3] if len(sys.argv) > 3 else "public"
    convert(docx, src, pub)
