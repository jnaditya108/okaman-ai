# Chat System Restructuring Guide

## Overview
Your chat system has been restructured from a single-message-per-chat model to a ChatGPT-like structure with:
- Chat sessions that contain multiple messages
- Messages organized as user/assistant pairs
- Scrollable message history within each chat
- Chat list in sidebar showing sessions, not individual messages

## Database Changes Required

### Run this migration on your Supabase database:

```sql
-- Migration: Update chat system to support chat sessions with multiple messages

-- Step 1: Rename old chats table to chats_backup (for data preservation)
ALTER TABLE IF EXISTS chats RENAME TO chats_backup;

-- Step 2: Create new chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    model VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Step 5: Update feedback table to use message_id instead of chat_id
ALTER TABLE feedback RENAME COLUMN chat_id TO message_id;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS fk_feedback_chat_id;
ALTER TABLE feedback ADD CONSTRAINT fk_feedback_message_id FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

-- Step 6: Migrate old data (convert individual chats to chat sessions with messages)
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

-- (Optional) Drop old chats table after verification
-- DROP TABLE chats_backup;
```

## Backend Changes Summary

### Updated API Endpoints:

**GET /api/chats** - Get all chat sessions
```json
Response: [
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "Chat title",
    "model": "VEO 3",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

**GET /api/chats/{chat_id}** - Get full chat with all messages
```json
Response: {
  "id": "uuid",
  "user_id": "uuid",
  "title": "Chat title",
  "model": "VEO 3",
  "messages": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "role": "user",
      "content": "message content",
      "created_at": "timestamp"
    },
    {
      "id": "uuid",
      "chat_id": "uuid",
      "role": "assistant",
      "content": "response content",
      "created_at": "timestamp"
    }
  ],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**POST /api/chat/send** - Send message to chat
```json
Request: {
  "chat_id": "uuid (optional - creates new chat if not provided)",
  "content": "user message",
  "model": "VEO 3"
}

Response: {
  "message": {
    "id": "uuid",
    "chat_id": "uuid",
    "role": "assistant",
    "content": "AI response",
    "created_at": "timestamp"
  },
  "remaining_credits": 49
}
```

**POST /api/feedback** - Submit feedback on message
```json
Request: {
  "message_id": "uuid (changed from chat_id)",
  "is_positive": true
}
```

**DELETE /api/chats/{chat_id}** - Delete entire chat session and all messages

### Key Changes in server.py:
- New models: `MessageResponse`, `ChatSessionResponse`, `ChatSessionListResponse`
- Chat endpoints now work with sessions instead of individual messages
- Send message endpoint now handles both creating new chats and adding to existing ones
- Messages are stored separately with role field ('user' or 'assistant')
- Feedback is now tied to messages instead of chats

## Frontend Changes Summary

### ChatPage.js Structure:
- **Route parameter**: `/chat/:chatId` - renders specific chat
- **Route**: `/chat` - shows welcome screen for new chat

### State Management:
```javascript
const [chatSessions, setChatSessions] = useState([]);  // All user chats
const [currentChat, setCurrentChat] = useState(null);   // Active chat session
const [messages, setMessages] = useState([]);           // Messages in current chat
```

### Key Features:
1. **Sidebar Chat List** - Shows all chat sessions with titles
   - Click to navigate to chat
   - Delete button on hover
   - "New Chat" button at top

2. **Message Display** - Shows all messages in chronological order
   - User messages on right
   - Assistant messages on left
   - Scrollable history
   - Loading indicator while generating

3. **Input Area** - Always visible, disabled during generation
   - Model selector
   - Textarea (disabled when loading)
   - Loading indicator dots
   - Send/Stop button

4. **Chat Navigation**
   - New message → creates new chat session
   - Click chat in sidebar → loads full chat history
   - Click new chat → clears UI and shows welcome screen

## How It Works

### Starting a New Chat:
1. User clicks "New Chat" button
2. UI shows welcome screen with model selector
3. User types message and hits send
4. Backend creates new chat_session and inserts first message
5. Backend sends to N8N, gets response
6. Response message is inserted
7. Frontend navigates to `/chat/{chatId}` showing both messages

### Continuing a Chat:
1. User clicks existing chat in sidebar
2. Frontend fetches full chat_session with all messages
3. All messages display in order
4. User types new message and sends
5. Backend adds message to existing chat_session
6. Response is added as new message
7. Chat is updated in UI

### Feedback:
- Thumbs up/down on AI messages
- Links to specific message ID (not chat ID)
- Updates feedback table with message_id

## Implementation Checklist

- [ ] Run database migration SQL on Supabase
- [ ] Update backend/server.py with new code
- [ ] Update frontend/src/pages/ChatPage.js with new code
- [ ] Update App.js route to support `/chat/:chatId`
- [ ] Test: Start new chat → should create session
- [ ] Test: Send messages → should show both user and AI messages
- [ ] Test: Navigate to chat → should show full history
- [ ] Test: Delete chat → should remove session and all messages
- [ ] Test: Feedback → should work with message IDs

## Rollback (if needed)

If something goes wrong, you can restore the old chats:
```sql
-- This will recreate the old chats table from backup
CREATE TABLE chats AS SELECT * FROM chats_backup;
```

## Notes

- Chat titles are auto-generated from the first user message (first 50 chars)
- Message timestamps are slightly different for user/assistant messages to maintain order
- The old `chats_backup` table is preserved for data safety
- All indexes are created for performance optimization
- Feedback now properly cascades when messages are deleted
