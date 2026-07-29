#!/usr/bin/env python3
"""
Build an ATS-optimised resume PDF for Albert Joshwa A.

ATS-safety rules enforced here (see resume/RESUME_AUDIT.md for why):
  * Helvetica only - a base-14 PDF font, no embedding, universally extractable.
  * Every paragraph is LEFT aligned. Never justified, so ReportLab never
    hyphenates and no keyword is ever split across a line break.
  * Dates live in their own right-aligned table cell, so a URL can never be
    glued to a date in the extracted text stream.
  * Single column, no images, no text boxes, no header/footer frames.
  * Standard section headings that every parser recognises.
  * Document metadata (title/author/subject/keywords) is set.

Usage:  python3 resume/build_resume.py [output.pdf]
"""

import sys

from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable,
)

# ---------------------------------------------------------------- constants

NAME = "ALBERT JOSHWA A"
TAGLINE = "Java Backend Engineer  |  Microservices &amp; Distributed Systems  |  AI / LLM Systems"
PHONE = "+91 99442 70690"
EMAIL = "albertjoshrock101@gmail.com"
LOCATION = "Coimbatore, Tamil Nadu, India"
LINKEDIN = "linkedin.com/in/albert-joshwa-625511208"
GITHUB = "github.com/AlbertJoshwa1802011"

INK = colors.HexColor("#111111")
RULE = colors.HexColor("#444444")

LEFT_MARGIN = RIGHT_MARGIN = 0.55 * inch
TOP_MARGIN = 0.45 * inch
BOTTOM_MARGIN = 0.45 * inch

BODY_SIZE = 9.4
LEADING = 12.1

# ------------------------------------------------------------------ styles

def _p(name, **kw):
    base = dict(
        fontName="Helvetica",
        fontSize=BODY_SIZE,
        leading=LEADING,
        textColor=INK,
        alignment=TA_LEFT,      # never TA_JUSTIFY -> never hyphenated
        spaceBefore=0,
        spaceAfter=0,
    )
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    "name": _p("name", fontName="Helvetica-Bold", fontSize=19, leading=22,
               alignment=TA_CENTER, spaceAfter=3),
    "tagline": _p("tagline", fontSize=9.8, leading=12, alignment=TA_CENTER,
                  textColor=colors.HexColor("#333333"), spaceAfter=3),
    "contact": _p("contact", fontSize=9.0, leading=11.6, alignment=TA_CENTER,
                  textColor=colors.HexColor("#222222")),
    "section": _p("section", fontName="Helvetica-Bold", fontSize=10.4,
                  leading=12.6, spaceBefore=8, spaceAfter=0),
    "body": _p("body"),
    "role": _p("role", fontName="Helvetica-Bold", fontSize=10.0, leading=12.4),
    "date": _p("date", fontSize=9.2, leading=12.4, alignment=TA_RIGHT,
               textColor=colors.HexColor("#333333")),
    "sub": _p("sub", fontName="Helvetica-Oblique", fontSize=9.0, leading=11.4,
              textColor=colors.HexColor("#333333")),
    "bullet": _p("bullet", leftIndent=11, bulletIndent=1, spaceAfter=1.6),
    "skill": _p("skill", leftIndent=0, spaceAfter=2.2),
}


# ------------------------------------------------------------------ helpers

def section(title):
    """A section heading plus its underline rule, kept together."""
    return [
        Paragraph(title, S["section"]),
        HRFlowable(width="100%", thickness=0.7, color=RULE,
                   spaceBefore=2, spaceAfter=4.5),
    ]


def header_row(left_html, right_html, left_style="role"):
    """Two-column row: content left, date right.

    The right cell is a separate table cell, which guarantees whitespace
    between (say) a project URL and its date in the extracted text stream.
    """
    tbl = Table(
        [[Paragraph(left_html, S[left_style]), Paragraph(right_html, S["date"])]],
        colWidths=[5.05 * inch, 2.35 * inch],
    )
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return tbl


def bullet(text):
    # KeepTogether stops a bullet splitting mid-sentence across the page
    # break, which reads as a formatting error to a human reviewer.
    return KeepTogether(Paragraph(text, S["bullet"], bulletText="•"))


def skill(label, items):
    return Paragraph("<b>%s:</b> %s" % (label, items), S["skill"])


# ------------------------------------------------------------------ content

def build_story():
    st = []

    # ---- header -----------------------------------------------------
    st.append(Paragraph(NAME, S["name"]))
    st.append(Paragraph(TAGLINE, S["tagline"]))
    st.append(Paragraph(
        "%s  |  %s  |  %s" % (PHONE, EMAIL, LOCATION), S["contact"]))
    st.append(Paragraph(
        '<a href="https://www.%s">%s</a>  |  <a href="https://%s">%s</a>'
        % (LINKEDIN, LINKEDIN, GITHUB, GITHUB), S["contact"]))
    st.append(Spacer(1, 5))
    st.append(HRFlowable(width="100%", thickness=1.0, color=RULE,
                         spaceBefore=0, spaceAfter=1))

    # ---- summary ----------------------------------------------------
    st += section("PROFESSIONAL SUMMARY")
    st.append(Paragraph(
        "Java backend engineer with 4+ years building enterprise SaaS at Zoho "
        "Corporation and GoFrugal Technologies (Zoho group), serving customers in "
        "150+ countries. Led the monolith-to-microservices decomposition of Zoho "
        "Books, splitting 15+ tightly coupled APIs into independently deployable "
        "services now shared across 6+ Zoho Finance products, and shipped a "
        "real-time bidirectional sync engine live with paying customers on the "
        "ONDC Network after clearing internal security and DPIA review. Also "
        "ships production systems end to end independently, including a live "
        "payments platform on Cloudflare Workers and D1 backed by 300+ automated "
        "tests. Java 17, Spring Boot, Kafka, MySQL and AWS, delivered in "
        "Agile/Scrum teams.",
        S["body"]))

    # ---- skills -----------------------------------------------------
    st += section("TECHNICAL SKILLS")
    st.append(skill("Languages",
        "Java (11, 17, 21), Python, JavaScript, SQL, Deluge"))
    st.append(skill("Backend Frameworks",
        "Spring Boot, Spring Cloud, Spring Security, Spring Data JPA, Hibernate, "
        "Spring MVC, Jersey, Servlets, JDBC, Undertow"))
    st.append(skill("Architecture",
        "Microservices, Monolith Decomposition, REST API Design, Event-Driven "
        "Architecture, Webhook-Driven Services, RMI, Multi-Tenant SaaS"))
    st.append(skill("Data &amp; Messaging",
        "MySQL, PostgreSQL, SQLite, Cloudflare D1, Redis, Apache Kafka, Schema "
        "Migrations, Query Optimization"))
    st.append(skill("AI &amp; Agentic Systems",
        "Large Language Models (LLM), Multi-Agent Orchestration, Prompt "
        "Engineering, Model Context Protocol (MCP), Human-in-the-Loop AI"))
    st.append(skill("Testing &amp; Quality",
        "JUnit 5, Mockito, Test-Driven Development (TDD), Integration Testing, "
        "SAST Scanning, Secure Code Review"))
    st.append(skill("Cloud &amp; DevOps",
        "AWS (EC2, S3), Docker, Kubernetes, Cloudflare Workers and Pages, "
        "Gradle, Maven, Git, GitLab, CI/CD Pipelines, Deployment Automation"))
    st.append(skill("Security &amp; Integrations",
        "OAuth 2.0, HMAC-SHA256 Webhook Verification, Role-Based Access Control, "
        "Razorpay API, Meta WhatsApp Business API"))
    st.append(skill("Practices",
        "Agile, Scrum, Cross-Functional Collaboration, Code Review, Application "
        "Monitoring and Analytics"))

    # ---- experience -------------------------------------------------
    st += section("PROFESSIONAL EXPERIENCE")

    st.append(header_row(
        "Member Technical Staff - Java Backend Engineer",
        "Jul 2023 - Present"))
    st.append(Paragraph(
        "Zoho Corporation - Customization Platform, Zoho Finance  |  "
        "Chennai / Coimbatore, India", S["sub"]))
    st.append(Spacer(1, 3))
    for b in [
        "Spearheaded the monolith-to-microservice migration of Zoho Books "
        "(Java 17), decoupling 15+ tightly coupled APIs into independently "
        "deployable services supporting 6+ Zoho Finance product lines including "
        "Zoho Books, Zoho Inventory, Zoho Expense, Zoho Payroll and Zoho Billing.",

        "Engineered a connector-based plug-and-play architecture that resolves "
        "cross-repository dependencies at startup, enabling each of the 6+ "
        "Finance products to build, deploy and release independently without "
        "coordinated downtime windows.",

        "Solved cross-service data dependencies with two complementary "
        "strategies: static metadata injected through HTTP headers at request "
        "initiation, and RMI for dynamically generated data inside the "
        "microservice layer.",

        "Built a real-time bidirectional sync engine between GoFrugal "
        "On-Premise (Vikra ONDC) and Zoho Finance applications using incremental "
        "sync and blob-based data processing; cleared internal security review "
        "and DPIA audit and is now in use by paying customers on the ONDC Network.",

        "Architected that sync framework around a generic connector pattern, "
        "letting the follow-on Zoho Commerce integration reuse the same "
        "extensible design and complete in 50% less time than the initial "
        "GoFrugal integration.",

        "Migrated 8+ core entity classes into a shared upper-level module "
        "consumed by 6+ Zoho Finance applications, coordinating a phased rollout "
        "across multiple product build cycles to avoid regressions.",

        "Designed and shipped the System Module Layout Customization feature for "
        "the Vendor and Sales Receipt modules, letting end users reorder and "
        "restructure field layouts; also owned the cross-product Shortcuts "
        "framework, integrating with internal configuration services to persist "
        "per-user keyboard settings across 6+ Finance products.",

        "Independently designed and built the Zoho Finance Developer Console in "
        "under one month, a JavaScript internal tool that unifies Gradle builds, "
        "server startup and sub-repository management into a visual workflow "
        "builder; adopted by 15+ engineers on the team.",

        "Identified and remediated 10+ security vulnerabilities, including a "
        "permission-level escalation in document upload workflows, through SAST "
        "scanning and manual code review ahead of each production deployment.",

        "Authored unit and integration tests (JUnit 5, Mockito) for migrated "
        "microservice modules, improving regression coverage across the shared "
        "platform layer.",
    ]:
        st.append(bullet(b))

    st.append(Spacer(1, 7))
    st.append(header_row(
        "Member Technical Staff - Backend Engineer",
        "Jun 2022 - Jul 2023"))
    st.append(Paragraph(
        "GoFrugal Technologies (Zoho group) - Connect Team, Alerts  |  "
        "Chennai, Tamil Nadu, India  |  Promoted from intern to full-time",
        S["sub"]))
    st.append(Spacer(1, 3))
    for b in [
        "Integrated the Meta WhatsApp Business API into GoFrugal On-Premise and "
        "On-Cloud POS systems; the integration now ships as part of the GoFrugal "
        "product used by 1,000+ merchants across their network.",

        "Launched the Alert Gateway microservice on Undertow and Java 17 with "
        "Apache Kafka as the message broker, delivering asynchronous WhatsApp and "
        "SMS notifications from a single consolidated service.",

        "Built a Facebook template registration UI with emoji support, rich text "
        "formatting and live preview, enabling business users to create and manage "
        "WhatsApp notification templates at scale.",

        "Conducted security analysis across the codebase within Agile sprints, "
        "remediating 5+ critical vulnerabilities (SQL injection, path traversal, "
        "XSS) and hardening every module exposing open API endpoints.",

        "Managed application deployment on AWS EC2 and S3, supporting production "
        "infrastructure for Connect team services.",
    ]:
        st.append(bullet(b))

    # ---- projects ---------------------------------------------------
    st += section("PROJECTS")

    st.append(header_row(
        "Church Contribution Portal - Full-Stack Payments Platform",
        "Dec 2024 - Present"))
    st.append(Paragraph(
        'Live in production  |  '
        '<a href="https://light-of-jesus-ministry-contributions.pages.dev/">'
        'light-of-jesus-ministry-contributions.pages.dev</a>  |  '
        'Cloudflare Pages Functions, D1, Razorpay', S["sub"]))
    st.append(Spacer(1, 3))
    for b in [
        "Designed and shipped a live contribution management platform for a 40+ "
        "member community: 23 REST endpoints running as Cloudflare Pages "
        "Functions over a Cloudflare D1 database of 20 tables, evolved through "
        "13 additive, backward-compatible migrations with zero production data loss.",

        "Automated the money path end to end with a Razorpay checkout plus a "
        "webhook receiver that verifies every callback with HMAC-SHA256 signature "
        "validation before recording a contribution, replacing manual "
        "spreadsheet reconciliation.",

        "Enforced role-based access control across 12 granular permissions and "
        "shipped a flag-gated v2 rollout behind a signed-cookie beta allowlist, "
        "so new flows reach opted-in users while production stays on the stable path.",

        "Hardened the platform with a 300+ case automated test suite that "
        "exercises the API handlers against a real in-memory SQLite instance, "
        "with CI blocking deployment on a red suite; migrated the original "
        "Google Apps Script backend onto Cloudflare with no downtime.",
    ]:
        st.append(bullet(b))

    st.append(Spacer(1, 6))
    st.append(header_row(
        "Platform Copilot - AI Multi-Agent Workflow Automation",
        "May 2026"))
    st.append(Paragraph("Zoho Books Internal Hackathon", S["sub"]))
    st.append(Spacer(1, 3))
    for b in [
        "Architected a two-agent LLM pipeline (Pattern Detector plus Executor) "
        "that reads Zoho Books activity logs, detects repetitive business patterns "
        "across 5 categories and auto-generates production-ready workflow "
        "automations with human-in-the-loop approval, cutting authoring time from "
        "roughly 30 minutes to about 30 seconds in prototype testing.",

        "Designed an enriched prefill JSON schema with a topological dependency "
        "map, enabling cross-agent coordination across 6 automation primitives: "
        "email templates, alerts, field updates, custom functions, webhooks and "
        "push notifications.",

        "Delivered a working production baseline, an active Zoho Books workflow "
        "with 3 wired actions (custom function, email alert, webhook) verified in "
        "a live org, and authored a hybrid MCP and UI playbook that cut manual "
        "workflow builds from 60 minutes to 5.",

        "Iterated the Executor system prompt across 3 versions against live API "
        "behaviour, diagnosing and documenting an MCP wrapper defect that silently "
        "dropped inline action objects, then rewriting the agent around a "
        "pre-create-then-reference pattern.",
    ]:
        st.append(bullet(b))

    st.append(Spacer(1, 6))
    st.append(header_row(
        "TradeSync POS - Multi-Platform Business Management Suite",
        "Oct 2024"))
    st.append(Paragraph(
        '<a href="https://github.com/AlbertJoshwa1802011/allwin-traders-pos-main">'
        'github.com/AlbertJoshwa1802011/allwin-traders-pos-main</a>', S["sub"]))
    st.append(Spacer(1, 3))
    st.append(bullet(
        "Developed a 3-platform business management suite comprising a "
        "voice-assisted Android delivery app, a Vercel-hosted web invoice manager "
        "and a customer-facing storefront, all synchronising in real time through "
        "Google Firebase on a multi-tenant database architecture."))

    # ---- education --------------------------------------------------
    st += section("EDUCATION")
    st.append(header_row(
        "Bachelor of Engineering, Electronics and Communication Engineering",
        "2018 - 2022", left_style="role"))
    st.append(Paragraph(
        "Sri Ramakrishna Engineering College, Coimbatore, Tamil Nadu  |  "
        "CGPA 8.1 / 10", S["sub"]))

    return st


# ------------------------------------------------------------------ build

def build(path):
    doc = BaseDocTemplate(
        path,
        pagesize=LETTER,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Albert Joshwa A - Java Backend Engineer Resume",
        author="Albert Joshwa A",
        subject="Resume - Java Backend Engineer, Microservices, AI/LLM Systems",
        keywords=("Java, Java 17, Spring Boot, Spring Cloud, Microservices, "
                  "REST API, Hibernate, JUnit 5, Mockito, Apache Kafka, Redis, "
                  "MySQL, PostgreSQL, AWS, Docker, Kubernetes, CI/CD, Python, "
                  "LLM, Multi-Agent AI, MCP, Agile, Scrum, SaaS, FinTech, ERP, "
                  "Backend Developer, Software Engineer"),
        creator="build_resume.py",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="body",
    )
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame])])
    doc.build(build_story())
    return path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Albert_Joshwa_A_Resume.pdf"
    print("wrote %s" % build(out))
