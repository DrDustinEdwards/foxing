-- Custom SQL migration file, put your code below! --
-- Foxing signs in with a passkey, an email link, Google or Apple; passwords are gone. Delete the
-- stored password hashes (Better Auth's "credential" accounts). Data only. Apply after the
-- release without passwords is live, since the release before it still signs in with them.
DELETE FROM `account` WHERE `provider_id` = 'credential';
