-- Migration 0024: real ministry prayer/service schedule seed (PRD scope:
-- Programs + Prayer schedules). Idempotent — each row is only inserted if a
-- program with the same title_en doesn't already exist, so re-running this
-- (or having it land after admin-authored edits) never duplicates or
-- overwrites content an admin has already created/changed.
--
-- meeting_url is intentionally left NULL for Daily Morning/Night Prayer —
-- the real Google Meet link must be set by an admin via the Programs panel
-- (Admin Console → Programs), never hardcoded in a migration.
--
-- Times are as given by ministry leadership, IST (Asia/Kolkata) — the
-- 'HH:MM' columns are timezone-naive by design (see 0020_programs.sql),
-- matching how every other service time in this table is stored.
INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Daily Morning Prayer', 'தினசரி காலை ஜெபம்', 'Start your day in prayer with the ministry, online or in person.', 'ஊழியத்துடன் சேர்ந்து உங்கள் நாளை ஜெபத்துடன் தொடங்குங்கள் — ஆன்லைனில் அல்லது நேரடியாக.', 'prayer', 'daily', NULL, NULL, '05:00', '06:00', 10
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Daily Morning Prayer');

INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Daily Night Prayer', 'தினசரி இரவு ஜெபம்', 'End your day in prayer with the ministry, online or in person.', 'ஊழியத்துடன் சேர்ந்து உங்கள் நாளை ஜெபத்துடன் முடியுங்கள் — ஆன்லைனில் அல்லது நேரடியாக.', 'prayer', 'daily', NULL, NULL, '21:30', '22:00', 20
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Daily Night Prayer');

INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Sunday First Service', 'ஞாயிறு முதல் ஆராதனை', 'Our first Sunday worship gathering — praise, the Word, and prayer.', 'எங்கள் முதல் ஞாயிறு ஆராதனை — துதி, வார்த்தை மற்றும் ஜெபம்.', 'service', 'weekly', 0, NULL, '06:00', '08:30', 30
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Sunday First Service');

INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Sunday Second Service', 'ஞாயிறு இரண்டாம் ஆராதனை', 'Our second Sunday worship gathering of the day.', 'அந்நாளின் எங்கள் இரண்டாம் ஞாயிறு ஆராதனை.', 'service', 'weekly', 0, NULL, '10:00', '12:00', 40
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Sunday Second Service');

INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Youth Prayer', 'இளைஞர் ஜெபம்', 'A prayer gathering for our youth, held on the second Sunday of every month.', 'எங்கள் இளைஞர்களுக்கான ஜெப கூட்டம், ஒவ்வொரு மாதமும் இரண்டாம் ஞாயிறன்று நடைபெறும்.', 'prayer', 'monthly', 0, 2, '16:00', '17:30', 50
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Youth Prayer');

INSERT INTO programs (title_en, title_ta, description_en, description_ta, ministry_area, recurrence, day_of_week, month_ordinal, start_time, end_time, sort_order)
  SELECT 'Full Night Prayer', 'முழு இரவு ஜெபம்', 'An extended night of prayer and worship, held on the second Friday of every month.', 'ஒவ்வொரு மாதமும் இரண்டாம் வெள்ளிக்கிழமையன்று நடைபெறும் நீண்ட ஜெப மற்றும் ஆராதனை இரவு.', 'prayer', 'monthly', 5, 2, NULL, NULL, 60
  WHERE NOT EXISTS (SELECT 1 FROM programs WHERE title_en = 'Full Night Prayer');
