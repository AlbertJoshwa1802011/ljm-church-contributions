-- Migration 0023: programs — monthly-ordinal recurrence (e.g. "second Friday")
-- + an online meeting URL (e.g. Google Meet) for online prayer programs.
-- Purely additive and idempotent. Safe to run on the live database.
--
-- recurrence already free-text (no CHECK constraint); this migration adds the
-- 'daily' value to the set the API accepts, alongside the existing
-- 'weekly' | 'monthly' | 'once'. For 'monthly', month_ordinal (1-5, "nth
-- weekday of the month") pairs with the existing day_of_week to represent
-- rules like "second Friday of every month".
ALTER TABLE programs ADD COLUMN month_ordinal INTEGER;
ALTER TABLE programs ADD COLUMN meeting_url TEXT;
