# Okaman - AI Prompt Generation Platform

## Original Problem Statement
Build a complete, mobile-responsive web application named "Okaman" with a minimalist, Shadcn UI-inspired dark theme for AI prompt generation for Sora, Veo3, and other AI video generation tools.

## Architecture
- **Frontend**: React 19 with Tailwind CSS, Shadcn UI components
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL (Supabase) - CONNECTED
- **Authentication**: JWT-based custom auth
- **Integrations**: n8n webhook (configured), Dodo Payments (placeholder)

## User Personas
1. **Content Creators**: Need AI prompts for video generation tools
2. **AI Enthusiasts**: Exploring various AI video tools (Sora, Veo3, Kling)
3. **Marketing Teams**: Creating video content at scale

## Core Requirements (Static)
1. User authentication (signup/login with JWT)
2. Credit-based usage system (50 free credits on signup)
3. Chat interface with model selector (VEO 3, SORA AI, KLING)
4. Chat history persistence
5. Feedback system (thumbs up/down)
6. Pricing plans via Dodo Payments
7. n8n webhook integration for AI responses

## What's Been Implemented (Feb 9, 2026)
### Backend
- [x] FastAPI server with JWT authentication
- [x] User registration and login endpoints
- [x] Chat CRUD operations (create, read, delete)
- [x] Message handling with n8n webhook integration
- [x] Feedback endpoint (thumbs up/down)
- [x] Pricing plans endpoint (4 tiers)
- [x] Payment initiation endpoint (Dodo placeholder)
- [x] Payment webhook handler
- [x] Credit tracking and verification

### Frontend
- [x] Login page with Okaman branding
- [x] Signup page with free credits mention
- [x] Chat interface with model selector
- [x] Sidebar with chat history, pricing, about, logout
- [x] Header with credit display, new chat, contact
- [x] Pricing modal with 4 plans
- [x] Refill credits modal when credits exhausted
- [x] About Us modal (placeholder for bio)
- [x] Contact Us modal (placeholder for contact info)
- [x] Feedback buttons on AI messages
- [x] Stop generation button
- [x] Dark minimalist theme (Manrope + Inter fonts)

### Database Schema (PostgreSQL)
- users: user_id, email, password_hash, username, current_credits, last_payment_date, created_at
- chats: chat_id, user_id, title, created_at, updated_at
- messages: message_id, chat_id, user_id, role, content, model, created_at
- feedback: feedback_id, message_id, user_id, value, created_at
- payments: payment_id, user_id, amount, currency, credits_purchased, plan_name, payment_provider, provider_payment_id, status, created_at

## Prioritized Backlog

### P0 (Critical - User Must Provide)
- [ ] PostgreSQL connection string (DATABASE_URL)
- [ ] n8n webhook URL
- [ ] Dodo Payments API credentials

### P1 (High Priority)
- [ ] Implement actual Dodo Payments SDK integration
- [ ] Payment success callback handling
- [ ] Email verification on signup
- [ ] Password reset functionality

### P2 (Medium Priority)
- [ ] Chat export functionality
- [ ] User profile settings
- [ ] Usage analytics dashboard
- [ ] Rate limiting

### P3 (Low Priority)
- [ ] Dark/Light theme toggle
- [ ] Multiple language support
- [ ] Mobile app (React Native)

## Next Tasks
1. **User provides DATABASE_URL** → Full auth and chat functionality enabled
2. **User provides n8n webhook URL** → Real AI responses integrated
3. **User adds Dodo Payments credentials** → Payment processing enabled
4. **User updates About Us and Contact sections** → Replace placeholder content

## Configuration Files to Update
- `/app/backend/.env` - Add DATABASE_URL, N8N_WEBHOOK_URL, Dodo credentials
- `/app/frontend/src/pages/ChatPage.js` - Update About Us and Contact Us content (search for TODO comments)
