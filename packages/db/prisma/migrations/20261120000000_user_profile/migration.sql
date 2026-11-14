-- Profile fields for the people page.
ALTER TABLE "users" ADD COLUMN "job_title" TEXT,
ADD COLUMN "department" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "timezone" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "avatar_key" TEXT;
