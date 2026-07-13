-- Migration: Add image_url column to wishlist table
-- Purpose: Support displaying images for wishlist items

ALTER TABLE wishlist ADD COLUMN image_url TEXT;

-- Optional: Add COMMENT/documentation in migration
-- image_url can be either a data URL (base64 embedded image) or an external URL
-- For MVP, we recommend using base64 data URLs for simplicity
