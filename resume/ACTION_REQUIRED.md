# Before you send this out — 5 things only you can answer

Everything else is done. These need facts I could not verify, so I did not
guess. The first two are the difference between a resume that survives a
screen and one that doesn't.

---

## 1. Your Zoho bullets never name a single framework you list under Skills

This is the biggest remaining risk, and it was in your original resume too.

Machine-checked: **Spring Boot, Spring Cloud, Spring Security, Spring Data JPA,
Hibernate, Spring MVC, JDBC, MySQL, PostgreSQL, Redis, Docker, Kubernetes,
Maven, CI/CD, Python and TDD appear ONLY in the skills list** — never in a
single thing you describe having done. `check_ats.py` now warns about exactly
this.

A hiring manager reads that as a padded list. In a screen you get asked
"where did you use Kubernetes?" and if the answer is thin, everything else on
the page becomes suspect.

I did not add these to your bullets because I don't know your real stack —
Zoho runs a lot of in-house infrastructure, and inventing "Spring Boot" into
your Zoho Books work would be a lie you'd have to defend in an interview.

**What to do:** for each skill below, either name it in a real bullet or
delete it from Skills. A short honest list beats a long indefensible one.

| Skill | Which bullet could truthfully carry it? |
| --- | --- |
| Spring Boot / Spring Cloud | The microservices you built at Zoho — were they Spring? |
| MySQL / PostgreSQL | What does the sync engine persist to? |
| Redis | Where do you cache? |
| Docker / Kubernetes | Is Zoho Finance deployed on K8s, or internal infra? |
| Maven / Gradle / CI/CD | The GitLab pipeline — do you own any of it? |
| Python | Only used in Platform Copilot? Then say so there. |

## 2. Your GoFrugal job title

I set both roles to "Member Technical Staff" because that's what your original
resume said. Check your GoFrugal offer letter. If your title there was
actually "Software Engineer" or "Trainee", **use the real one** — title
mismatches surface during background verification and can cost an offer.

It also helps you: two different titles show progression. Right now the resume
reads as four years at one level.

## 3. No engineering-scale numbers anywhere

Every number on your resume counts organisational things — 15+ APIs, 6+
products, 1,000+ merchants, 23 endpoints. **Nothing describes system
behaviour:** no throughput, no latency, no data volume.

At 4 years targeting senior roles, that's the gap between "worked on a big
system" and "reasoned about a big system." Two bullets are ready for a number
if you can get one:

- **Alert Gateway** — messages/day through Kafka, or partition count.
- **Sync engine** — records per sync cycle, or number of merchant tenants.

Rough-but-real beats absent. Add them before you apply.

## 4. Two claims I softened — confirm you're comfortable

- **"Spearheaded the monolith-to-microservice migration of Zoho Books"** is now
  **"Owned the decomposition of 15+ tightly coupled Zoho Books APIs ... as part
  of the Finance platform's monolith-to-microservices program."**
  Zoho Books is a flagship product with a large org; "spearheaded" invites
  "who was the tech lead, and how many engineers?" If you genuinely led the
  program, put the stronger word back — it's one line in `build_resume.py`.

- **Platform Copilot** previously claimed both "~30 minutes to ~30 seconds"
  and "60 minutes to 5 minutes" for what reads as the same task, two bullets
  apart. I kept the 60→5 figure and dropped the other. If they measured
  genuinely different things, say so explicitly or a careful reader will
  distrust both.

## 5. Small stuff

- **Email**: `albertjoshrock101@gmail.com`. "rock101" reads informal on a
  senior application. Your call, but a `firstname.lastname@` address costs
  nothing.
- **LinkedIn headline** should match "Member Technical Staff - Java Backend
  Engineer" so the dual title doesn't look invented.
- **Skills sit above Experience**, which pushes your first accomplishment to
  49% down page 1. That's conventional for the India market and good for ATS
  keyword pickup, but if you're applying to international/remote roles where a
  human skims first, move the `TECHNICAL SKILLS` block below
  `PROFESSIONAL EXPERIENCE` in `build_resume.py::build_story`.
- **RMI** will get probed ("why not gRPC or REST?"). Have the answer ready.
- **Notice period** goes in the application email, not on the resume.
