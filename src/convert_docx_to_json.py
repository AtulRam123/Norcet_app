"""
NORCET MCQ Converter — built from actual analysis of your Word file
====================================================================

Your Word file structure (confirmed by analysis):

NORMAL (5 lines, one block):
    Question text                        <- line 1
    Option A                             <- line 2
    Option B  [HIGHLIGHTED = answer]     <- line 3 (any position)
    Option C                             <- line 4
    Option D                             <- line 5
    [blank line]

SPLIT QUESTION (question separated from options by blank line):
    Question text                        <- block 1 (1 line)
    [blank line]
    Option A                             <- block 2 (4 lines)
    Option B
    Option C
    Option D

SPLIT OPTION (one option wraps to 2 paragraphs, both highlighted):
    "The changes in his behavior..."     <- highlighted
    "happening."                         <- also highlighted = same option

IMAGE QUESTION (image in separate block):
    [IMAGE]                              <- standalone image block
    Option A text
    Option B text [HIGHLIGHTED]
    Option C text
    Option D text

Usage (from project root):
    python convert_docx_to_json.py src/questions.docx

Output:
    src/questions.json
    public/images/q_*.jpg/png
"""

import json, sys, os, hashlib
from docx import Document
from docx.oxml.ns import qn


def is_hl(para):
    YELLOW = {"yellow","green","ffff00","ffff99","00ff00","92d050"}
    for run in para.runs:
        rpr = run._r.find(qn("w:rPr"))
        if rpr is None: continue
        hl = rpr.find(qn("w:highlight"))
        if hl is not None and hl.get(qn("w:val"),"").lower() in YELLOW: return True
        shd = rpr.find(qn("w:shd"))
        if shd is not None:
            fill = shd.get(qn("w:fill"),"").lower()
            if fill in YELLOW or fill.startswith("ffff"): return True
    return False

def has_img(para):
    return para._p.find(".//" + qn("a:blip")) is not None

def get_img_rids(para):
    blips = para._p.findall(".//" + qn("a:blip"))
    return [b.get(qn("r:embed")) for b in blips if b.get(qn("r:embed"))]

def clean(t):
    return " ".join(t.strip().split())

def make_id(t):
    return hashlib.md5(t.strip().lower().encode()).hexdigest()[:8]

def extract_image(doc, rid, out_path):
    try:
        part = doc.part.related_parts[rid]
        ext  = part.content_type.split("/")[-1].replace("jpeg","jpg")
        if ext not in ("jpg","jpeg","png","gif","bmp","webp"): ext = "jpg"
        final = out_path + "." + ext
        os.makedirs(os.path.dirname(final), exist_ok=True)
        with open(final, "wb") as f: f.write(part.blob)
        return "images/" + os.path.basename(final)
    except Exception as e:
        print(f"  Warning: image extract failed: {e}")
        return None


def collect_lines(doc, images_dir):
    """Return list of (text, is_highlighted, image_path) for every paragraph."""
    lines = []
    img_counter = [0]
    for p in doc.paragraphs:
        t   = clean(p.text)
        hl  = is_hl(p)
        img = None
        if has_img(p):
            for rid in get_img_rids(p):
                img_counter[0] += 1
                base  = os.path.join(images_dir, f"q_{img_counter[0]:04d}")
                saved = extract_image(doc, rid, base)
                if saved: img = saved; break
        lines.append((t, hl, img))
    return lines


def split_blocks(lines):
    """Split into blocks by blank lines."""
    blocks, cur = [], []
    for t, hl, img in lines:
        if not t and not img:
            if cur: blocks.append(cur); cur = []
        else:
            cur.append((t, hl, img))
    if cur: blocks.append(cur)
    return blocks


def merge_blocks(raw_blocks):
    """
    Merge split blocks:
    - Single-line question blocks get merged with the next block
    - Image-only blocks get attached to the previous question's options
    """
    merged = []
    i = 0
    while i < len(raw_blocks):
        b = raw_blocks[i]
        t0, hl0, img0 = b[0]

        # Image-only block → attach image to previous question
        if len(b) == 1 and img0 and not t0:
            if merged:
                merged[-1] = list(merged[-1]) + [(t0, hl0, img0)]
            i += 1
            continue

        # Single-line text block → orphaned question, merge with next block
        if len(b) == 1 and t0 and not img0:
            if i + 1 < len(raw_blocks):
                merged.append(b + raw_blocks[i+1])
                i += 2
                continue

        merged.append(b)
        i += 1
    return merged


def parse_block(b):
    """
    Parse one merged block into a question dict.
    Block structure: [question_line, opt_A, opt_B, opt_C, opt_D]
    Handles:
    - Split options (two consecutive highlighted lines = one option)
    - Image-only lines (attach as question image)
    """
    t0, hl0, img0 = b[0]
    if not t0: return None  # skip image-only first lines

    q_text = t0
    q_img  = img0
    opts   = {"A":"","B":"","C":"","D":""}
    answer = None
    opt_i  = 0
    prev_hl = None

    for t, hl, img in b[1:]:
        # Image line → attach to question, don't count as option
        if img and not t:
            if not q_img: q_img = img
            continue

        if opt_i >= 4: break

        key = ["A","B","C","D"][opt_i]

        if opts[key] == "":
            # Start new option
            opts[key] = t
            if hl: answer = key
            prev_hl = hl
            opt_i += 1
        else:
            # Possible continuation of previous option
            # (split option = same highlight status as previous line)
            prev_key = ["A","B","C","D"][opt_i - 1]
            if hl == prev_hl:
                # Same highlight → continuation of previous option
                opts[prev_key] += " " + t
            else:
                # Different highlight → new option
                opts[key] = t
                if hl: answer = key
                prev_hl = hl
                opt_i += 1

        if img and not q_img: q_img = img

    filled = [k for k in ["A","B","C","D"] if opts[k]]
    if len(filled) < 2: return None

    return {
        "id":          make_id(q_text),
        "question":    q_text,
        "options":     opts,
        "answer":      answer,
        "image":       q_img,
        "explanation": None,
    }


def merge_and_update(new_questions, out_path):
    """Add new questions, update answers on existing ones, preserve explanations."""
    existing = []
    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            try: existing = json.load(f)
            except: existing = []
        print(f"   {len(existing)} questions already in {out_path}")

    existing_map = {q["id"]: i for i, q in enumerate(existing)}
    added = updated = 0

    for q in new_questions:
        if q["id"] in existing_map:
            idx = existing_map[q["id"]]
            old = existing[idx]
            existing[idx]["options"] = q["options"]
            if q["image"]: existing[idx]["image"] = q["image"]
            if q["answer"] and old.get("answer") != q["answer"]:
                existing[idx]["answer"] = q["answer"]
                updated += 1
            # Never overwrite explanation
        else:
            existing.append(q)
            existing_map[q["id"]] = len(existing) - 1
            added += 1

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    return added, updated, len(existing)


def convert(docx_path, src_dir="src", public_dir="public"):
    if not os.path.exists(docx_path):
        print(f"\nERROR: File not found: {docx_path}")
        print("Run from project root: python convert_docx_to_json.py src/questions.docx")
        sys.exit(1)

    images_dir = os.path.join(public_dir, "images")
    json_path  = os.path.join(src_dir, "questions.json")

    print(f"\nReading {docx_path} ...")
    doc   = Document(docx_path)
    lines = collect_lines(doc, images_dir)
    print(f"   {len(lines)} paragraphs found")

    raw_blocks = split_blocks(lines)
    print(f"   {len(raw_blocks)} raw blocks")

    merged = merge_blocks(raw_blocks)
    print(f"   {len(merged)} merged blocks")

    questions = []
    skipped   = 0
    for b in merged:
        q = parse_block(b)
        if q:
            questions.append(q)
        else:
            skipped += 1

    with_ans = sum(1 for q in questions if q["answer"])
    with_img = sum(1 for q in questions if q["image"])
    print(f"   {len(questions)} valid questions  ({skipped} skipped)")
    print(f"   {with_ans} have answers  |  {with_img} have images")

    if len(questions) == 0:
        print("\nWARNING: No questions found! Check your file path.")
        return

    added, updated, total = merge_and_update(questions, json_path)

    print(f"\n{'='*50}")
    print(f"  ✅  Done!")
    print(f"  +{added} new questions added")
    print(f"  ~{updated} existing answers updated")
    print(f"  {total} total in {json_path}")
    if with_img > 0:
        print(f"  Images saved to {images_dir}/")
    print(f"{'='*50}")

    print("\n── Preview first 5 questions ──")
    for q in questions[:5]:
        print(f"\n  Q: {q['question'][:72]}")
        if q['image']: print(f"     IMG: {q['image']}")
        for k in ["A","B","C","D"]:
            v = q["options"][k]
            if v:
                mark = "  ← ANSWER" if k == q["answer"] else ""
                print(f"     {k}) {v[:62]}{mark}")
        if not q["answer"]: print("     (no answer detected)")


if __name__ == "__main__":
    docx = sys.argv[1] if len(sys.argv) > 1 else "src/questions.docx"
    src  = sys.argv[2] if len(sys.argv) > 2 else "src"
    pub  = sys.argv[3] if len(sys.argv) > 3 else "public"
    convert(docx, src, pub)
