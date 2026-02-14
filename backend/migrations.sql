-- Migration: Update chat system to support chat sessions with multiple messages
-- This migration creates a new schema for chat sessions and messages

-- Step 1: Rename old chats table to chats_backup (for data preservation)
ALTER TABLE IF EXISTS chats RENAME TO chats_backup;

-- Step 2: Update feedback table to use message_id instead of chat_id
ALTER TABLE IF EXISTS feedback RENAME COLUMN chat_id TO message_id;

-- Step 3: Create new chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    model VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON feedback(message_id);

-- Step 6: Ensure feedback table has proper constraints
ALTER TABLE feedback 
DROP CONSTRAINT IF EXISTS fk_feedback_chat_id,
ADD CONSTRAINT fk_feedback_message_id FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Step 7: Migrate old data (convert individual chats to chat sessions with messages)
-- This script will convert each row from chats_backup into a chat_session with two messages
INSERT INTO chat_sessions (id, user_id, title, model, created_at, updated_at)
SELECT 
    id,
    user_id,
    COALESCE(user_prompt, 'Chat')::text,
    COALESCE(model_used, 'VEO 3'),
    created_at,
    created_at
FROM chats_backup
ON CONFLICT DO NOTHING;

-- Insert user messages from old chats
INSERT INTO messages (chat_id, role, content, created_at)
SELECT 
    id,
    'user',
    user_prompt,
    created_at
FROM chats_backup
WHERE user_prompt IS NOT NULL;

-- Insert AI response messages from old chats
INSERT INTO messages (chat_id, role, content, created_at)
SELECT 
    id,
    'assistant',
    ai_response,
    created_at + INTERVAL '1 second'
FROM chats_backup
WHERE ai_response IS NOT NULL;

-- Step 8: (Optional) Drop old chats table after verification
-- ALTER TABLE feedback DROP CONSTRAINT fk_feedback_chat_id;
-- DROP TABLE chats_backup;
-- Drop after you've verified the data migration is successful

-- Step 9: Create promo_codes table for promotional credit redemptions
CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    credits INT NOT NULL CHECK (credits >= 0),
    max_uses INT NULL,
    uses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NULL
);

-- Optional index for lookups by expiration
CREATE INDEX IF NOT EXISTS idx_promo_codes_expires_at ON promo_codes(expires_at);

-- Step 10: Insert a demo promo code (admin can insert others manually)
INSERT INTO promo_codes (code, credits, max_uses, uses, expires_at)
VALUES ('WELCOME100', 100, 1000, 0, NULL)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Step 11: Ensure feedback foreign key references the new messages table
-- This fixes errors where feedback FK still points to legacy chats_backup.
-- Run this after migrating chat sessions/messages from the old schema.
ALTER TABLE IF EXISTS feedback DROP CONSTRAINT IF EXISTS feedback_chat_id_fkey;
ALTER TABLE IF EXISTS feedback DROP CONSTRAINT IF EXISTS fk_feedback_message_id;
ALTER TABLE IF EXISTS feedback
    ADD CONSTRAINT fk_feedback_message_id FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Optional: backfill messages from legacy chats_backup if migration wasn't run.
-- Only run if `messages` table exists and `chats_backup` contains rows not present in `messages`.
-- INSERT INTO messages (id, chat_id, role, content, created_at)
-- SELECT id, id as chat_id, 'user', user_prompt, created_at FROM chats_backup WHERE user_prompt IS NOT NULL
-- ON CONFLICT (id) DO NOTHING;

-- End of migrations

-- Step 12: Create promo_redemptions table to track which user redeemed which promo
CREATE TABLE IF NOT EXISTS promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (promo_code, user_id)
);

-- Index to quickly lookup redemptions by user
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user_id ON promo_redemptions(user_id);

COMMIT;
