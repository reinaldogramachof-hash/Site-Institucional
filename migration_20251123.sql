-- Migration to add email verification and user type columns to the users table
-- Executed on 2025-11-23

ALTER TABLE users
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token TEXT,
ADD COLUMN email_verification_expires TIMESTAMPTZ,
ADD COLUMN "type" TEXT DEFAULT 'customer';

-- Add an index for the verification token to speed up lookups
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);

-- Add a check constraint for the user type
ALTER TABLE users
ADD CONSTRAINT check_user_type CHECK (type IN ('customer', 'admin'));
