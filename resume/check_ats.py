#!/usr/bin/env python3
"""Automated ATS-parseability checks for a resume PDF.

Every check mirrors a defect found in the original v10 resume. Run against any
candidate PDF:  python3 resume/check_ats.py path/to/resume.pdf
"""

import re
import sys

import pdfplumber

REQUIRED_SECTIONS = [
    "PROFESSIONAL SUMMARY", "TECHNICAL SKILLS", "PROFESSIONAL EXPERIENCE",
    "PROJECTS", "EDUCATION",
]

# Keywords a boolean recruiter search is likely to use. Each must appear
# intact on a single line - never split by a hyphenated line break.
MUST_MATCH_INTACT = [
    "Java 17", "Spring Boot", "Spring Cloud", "Spring Security", "Microservices",
    "REST API", "Hibernate", "JUnit 5", "Mockito", "Apache Kafka", "Redis",
    "MySQL", "PostgreSQL", "Docker", "Kubernetes", "CI/CD", "Python",
    "Test-Driven Development", "Model Context Protocol", "Agile", "Scrum",
    "Cross-Functional", "Backend Engineer", "OAuth 2.0", "Event-Driven",
    "Role-Based Access Control", "Multi-Agent",
]

MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
DATE_RE = re.compile(r"(%s)[a-z]*\s+\d{4}" % MONTHS, re.I)
MONTH_RE = re.compile(r"(%s)[a-z]*$" % MONTHS, re.I)


def check(path):
    failures, warnings, notes = [], [], []

    with pdfplumber.open(path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
        meta = pdf.metadata
        n_images = sum(len(p.images) for p in pdf.pages)
        # The bullet glyph is deliberately drawn in an embedded Unicode font
        # at a smaller size; judge typeface and body size on prose only.
        prose = [c for p in pdf.pages for c in p.chars if c["text"] != "•"]
        fonts = {c["fontname"].split("+")[-1] for c in prose}
        min_size = min(round(c["size"], 1) for c in prose)

    text = "\n".join(pages)
    lines = [ln.strip() for ln in text.split("\n")]
    flat = " ".join(lines)

    # 1. page count
    notes.append("pages: %d" % len(pages))
    if len(pages) > 2:
        failures.append("more than 2 pages (%d)" % len(pages))

    # 2. contact details reachable in the text layer
    if not re.search(r"\+91\s*\d{5}\s*\d{5}", flat):
        failures.append("phone number not extractable")
    if not re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", flat):
        failures.append("email not extractable")
    if "linkedin.com/in/" not in flat:
        failures.append("LinkedIn URL not extractable")
    if "github.com/" not in flat:
        failures.append("GitHub URL not extractable")

    # 3. required sections present and on their own line
    for sec in REQUIRED_SECTIONS:
        if sec not in lines:
            failures.append("section heading not on its own line: %s" % sec)

    # 4. no keyword split across a hyphenated line break
    for i, ln in enumerate(lines[:-1]):
        if ln.endswith("-") and len(ln) > 1 and ln[-2].isalpha():
            failures.append(
                "hyphenated line break splits a word (line %d): ...%s" %
                (i + 1, ln[-28:]))

    # 5. searchable keywords survive intact on one line
    for kw in MUST_MATCH_INTACT:
        if not any(kw.lower() in ln.lower() for ln in lines):
            failures.append("keyword not found intact on any single line: %s" % kw)

    # 6. no URL glued to a date.
    # Match a whitespace-delimited token that looks like a URL and check
    # whether a month-year got absorbed into it. Matching the token first
    # (rather than a greedy URL pattern) is what makes the date visible -
    # a greedy \S* would swallow "Dec 2024" and report nothing.
    url_token = re.compile(r"\S*(?:https?://|\.(?:com|dev|io|org|net)/)\S*")
    for i, ln in enumerate(lines):
        for m in url_token.finditer(ln):
            token, tail = m.group(0), ln[m.end():]
            # (a) a whole month-year absorbed into the token
            embedded = DATE_RE.search(token)
            # (b) the token ends in a month name whose year sits just past the
            #     token boundary - "...pages.dev/Dec" followed by " 2024"
            split_date = (MONTH_RE.search(token)
                          and re.match(r"\s+\d{4}\b", tail))
            if embedded or split_date:
                failures.append(
                    "URL glued to a date (line %d): %s" % (i + 1, token[-60:]))
            elif tail[:1].isalpha():
                failures.append(
                    "URL glued to text (line %d): %s" % (i + 1, ln[:70]))

    # 7. every date range uses a consistent Mon YYYY form
    ranges = re.findall(r"([A-Za-z]{3,9})\s+(\d{4})\s*[-–]\s*"
                        r"(Present|[A-Za-z]{3,9}\s+\d{4})", flat)
    bad = [r for r in ranges if len(r[0]) != 3]
    if bad:
        failures.append("inconsistent month format in date ranges: %s" % bad)
    notes.append("date ranges found: %d" % len(ranges))

    # 8. graphics / font safety
    if n_images:
        failures.append("%d embedded image(s) - ATS cannot read text in images" % n_images)
    notes.append("fonts: %s" % ", ".join(sorted(fonts)))
    if not all(f.startswith("Helvetica") for f in fonts):
        warnings.append("non-Helvetica font present: %s" % sorted(fonts))
    notes.append("smallest font size: %.1fpt" % min_size)
    if min_size < 9.0:
        warnings.append("font smaller than 9pt (%.1f) hurts readability" % min_size)

    # 9. metadata
    if not meta.get("Author"):
        failures.append("PDF metadata Author is unset")
    if not meta.get("Title"):
        failures.append("PDF metadata Title is unset")
    notes.append("metadata author: %r title: %r"
                 % (meta.get("Author"), meta.get("Title")))

    # 10. keyword-stuffing block
    if re.search(r"^ADDITIONAL SKILLS", text, re.M):
        failures.append("ADDITIONAL SKILLS keyword-stuffing block present")

    # 11. bullets should not be absurdly long
    long_bullets = [ln for ln in lines if len(ln) > 165]
    if long_bullets:
        warnings.append("%d very long line(s)" % len(long_bullets))

    # 12. every glyph must map back to a real character. ReportLab drawing
    # U+2022 in a built-in font with no ToUnicode map extracts as
    # "(cid:127)", which prefixes every bullet line with garbage.
    n_cid = len(re.findall(r"\(cid:\d+\)", text))
    if n_cid:
        failures.append(
            "%d unmapped glyph(s) extract as (cid:NNN) - bullet or symbol font "
            "has no ToUnicode map" % n_cid)

    # 13. a skill claimed in the skills block but never evidenced anywhere
    # else reads as list-padding to a hiring manager.
    body = text
    for marker in ("PROFESSIONAL EXPERIENCE", "WORK EXPERIENCE"):
        if marker in text:
            body = text.split(marker, 1)[1]
            break
    skills_block = ""
    if "TECHNICAL SKILLS" in text:
        skills_block = text.split("TECHNICAL SKILLS", 1)[1].split(
            "PROFESSIONAL EXPERIENCE")[0]
    claimed = set()
    # Split on commas that are not inside parentheses, so "Java (11, 17, 21)"
    # and "AWS (EC2, S3)" stay whole instead of shattering into "21)" and
    # "AWS (EC2".
    for line in skills_block.split("\n"):
        if ":" not in line:
            continue
        # "Domain:" lists market/vertical descriptors, not tools; they have no
        # reason to reappear as a verb in a bullet.
        if line.split(":", 1)[0].strip() in ("Domain", "Practices"):
            continue
        depth, buf = 0, ""
        for ch in line.split(":", 1)[1]:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth = max(0, depth - 1)
            if ch == "," and depth == 0:
                claimed.add(buf.strip().rstrip("."))
                buf = ""
            else:
                buf += ch
        claimed.add(buf.strip().rstrip("."))
    claimed = {t for t in claimed if len(t) > 2}
    # Match on the base name, so "Java (11, 17, 21)" is evidenced by "Java 17"
    # and "AWS (EC2, S3)" by "AWS EC2".
    low = body.lower()
    unevidenced = sorted(
        t for t in claimed if t.split("(")[0].strip().lower() not in low)
    if unevidenced:
        warnings.append(
            "%d skill(s) claimed but never evidenced in experience/projects "
            "(reads as list-padding): %s"
            % (len(unevidenced), ", ".join(unevidenced)))

    # 14. a header row whose left cell wraps collides with its date cell
    for i, ln in enumerate(lines):
        if DATE_RE.search(ln) and len(ln) > 150:
            warnings.append("possible header/date collision (line %d)" % (i + 1))

    # 12. word count sanity
    words = len(flat.split())
    notes.append("word count: %d" % words)
    if not 550 <= words <= 1100:
        warnings.append("word count %d outside the 550-1100 sweet spot" % words)

    return failures, warnings, notes


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "Albert_Joshwa_A_Resume.pdf"
    failures, warnings, notes = check(path)

    print("=== ATS CHECK: %s ===" % path)
    for n in notes:
        print("  info    %s" % n)
    for w in warnings:
        print("  WARN    %s" % w)
    for f in failures:
        print("  FAIL    %s" % f)
    print("-" * 60)
    print("%d failure(s), %d warning(s)" % (len(failures), len(warnings)))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
