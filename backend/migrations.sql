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

COMMIT;
