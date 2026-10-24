-- Custom SQL migration file, put your code below! --
-- FX-3: Foxing keeps no Google tokens (apps/web/app/lib/auth.server.ts databaseHooks). Data only.
UPDATE `account` SET `access_token` = NULL, `refresh_token` = NULL, `id_token` = NULL, `access_token_expires_at` = NULL, `refresh_token_expires_at` = NULL;
