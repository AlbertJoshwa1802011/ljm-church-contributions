-- Migration 0023: programs.week_of_month — which week of the month a
-- recurrence='monthly' program falls on (1-5), so the public Programs page
-- can render "2nd Friday of every month" instead of a bare weekday code.
-- Purely additive (nullable column). Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md and CLAUDE.md's Programs QA note.

ALTER TABLE programs ADD COLUMN week_of_month INTEGER;
