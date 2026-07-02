-- Migration: Add User Roles
-- Description: Add role-based access control to the users table

-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'tenant' NOT NULL;

-- Add check constraint for valid roles
ALTER TABLE users ADD CONSTRAINT valid_user_roles CHECK (role IN ('admin', 'landlord', 'tenant', 'property_manager'));

-- Create an index on the role column for efficient querying
CREATE INDEX idx_users_role ON users(role);
