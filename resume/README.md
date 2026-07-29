# Resume toolkit

ATS-optimised resume for Albert Joshwa A, generated from source rather than
hand-edited in a word processor, so every rebuild is identical and the
ATS-safety rules can't be accidentally undone by a stray formatting click.

## Files

| File | What it is |
| --- | --- |
| `build_resume.py` | The resume itself. Content + layout live here; edit this, never the PDF. |
| `check_ats.py` | Automated ATS-parseability checks. Run against any resume PDF. |
| `RESUME_AUDIT.md` | The 20 defects found in the previous version (`v10_final.pdf`) and why each one mattered. |
| `Albert_Joshwa_A_Resume.pdf` | The generated output. |

## Rebuild

```bash
pip install reportlab pdfplumber
python3 resume/build_resume.py resume/Albert_Joshwa_A_Resume.pdf
python3 resume/check_ats.py resume/Albert_Joshwa_A_Resume.pdf
```

`check_ats.py` exits non-zero if any check fails, so it can gate a commit.

## What the checker enforces

Each check corresponds to a real defect found in the previous version:

1. Page count <= 2.
2. Phone, email, LinkedIn and GitHub all survive text extraction.
3. Every standard section heading sits on its own line.
4. **No hyphenated line breaks.** The old version justified its text, which
   made LibreOffice hyphenate, which split `cross-functional` across two
   lines. A literal ATS keyword match then fails. The generator only ever
   left-aligns, so this cannot recur.
5. High-frequency recruiter keywords each appear intact on a single line.
6. **No URL glued to a date.** The old version emitted
   `...pages.dev/Dec 2024` with no separating space, corrupting date parsing
   on the Projects section. Dates now live in their own table cell.
7. Consistent `Mon YYYY` date format throughout.
8. No embedded images; Helvetica only (a base-14 font, no embedding needed);
   nothing below 9pt.
9. PDF metadata Title and Author are set.
10. No `ADDITIONAL SKILLS` keyword-stuffing block.
11. No absurdly long lines; word count sanity check.

## Editing notes

- Content is plain Python lists of strings in `build_resume.py::build_story`.
- `&` must be written `&amp;` — ReportLab parses paragraph text as XML.
- Never switch a style to `TA_JUSTIFY`; that reintroduces defect 4.
- Keep dates in the `header_row()` right-hand cell; that is what prevents
  defect 6.
- Re-run `check_ats.py` after every content change.
