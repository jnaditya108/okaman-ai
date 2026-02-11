-- Fix script: Update feedback table foreign key constraint to reference messages table

-- Step 1: Drop the old foreign key constraint if it exists
ALTER TABLE IF EXISTS feedback DROP CONSTRAINT IF EXISTS fk_feedback_chat_id;
ALTER TABLE IF EXISTS feedback DROP CONSTRAINT IF EXISTS feedback_chat_id_fkey;

-- Step 2: Add the new foreign key constraint to reference messages table
ALTER TABLE feedback 
ADD CONSTRAINT fk_feedback_message_id FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Verify the constraint was added
SELECT constraint_name, table_name, column_name 
FROM information_schema.key_column_usage 
WHERE table_name = 'feedback';
