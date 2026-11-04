-- contract: is_admin is unused since #211 (admin is ADMIN_EMAILS) and #213 (schema no longer reads it).
ALTER TABLE `profiles` DROP COLUMN `is_admin`;