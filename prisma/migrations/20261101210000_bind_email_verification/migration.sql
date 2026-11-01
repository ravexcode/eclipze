-- Binds email verification codes to the browser that requested them and stores the
-- credentials chosen at sign-up, so verifying an email never keeps a password set by
-- someone else. All columns are nullable; existing rows are not modified.
ALTER TABLE "verification_codes" ADD COLUMN "pendingPasswordHash" TEXT,
ADD COLUMN "pendingUsername" TEXT,
ADD COLUMN "requesterTokenHash" TEXT;
