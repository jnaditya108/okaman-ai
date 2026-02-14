# Google OAuth 2.0 Setup Guide

This guide explains how to configure Google OAuth 2.0 for your Okaman application.

## Overview

The application now supports "Continue with Google" authentication on both Login and Register pages. When users authenticate with Google, the system:

1. Verifies the Google ID token on the backend
2. Creates a new user account if they don't exist (with 50 free credits)
3. Logs them in if they already have an account
4. Returns an application JWT token for session management

## Backend Setup (Python/FastAPI)

### 1. Install Dependencies

The required packages are already in `backend/requirements.txt`:
```bash
google-auth==2.28.1
PyJWT==2.8.1
```

Install them:
```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

Add these to your `.env` file in the `backend/` directory:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Google Cloud Setup

To get your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Search for "Google+ API" in the search bar
   - Click on it and press "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Add authorized redirect URIs:
     - `http://localhost:3000/login` (for development)
     - `http://localhost:3000/signup` (for development)
     - `https://yourdomain.com/login` (for production)
     - `https://yourdomain.com/signup` (for production)
5. Copy the Client ID and Client Secret

## Frontend Setup (React)

### 1. Install Dependencies

The package is already in `frontend/package.json`:
```bash
@react-oauth/google: ^0.12.1
```

Install all dependencies:
```bash
cd frontend
yarn install
# or
npm install
```

### 2. Set Environment Variables

Add this to your `.env` file in the `frontend/` directory:

```bash
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
REACT_APP_BACKEND_URL=http://localhost:8000
```

For production:
```bash
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
REACT_APP_BACKEND_URL=https://your-api-domain.com
```

### 3. Restart the Frontend

After setting environment variables, restart your development server:
```bash
yarn start
```

## API Endpoint

### POST `/api/auth/google`

**Request:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ..."
}
```

**Response (Success - 200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "current_credits": 50,
    "created_at": "2026-02-14T10:30:00+00:00"
  }
}
```

**Response (Invalid Token - 401):**
```json
{
  "detail": "Invalid Google token: ..."
}
```

## How It Works

### Authentication Flow

```
User clicks "Continue with Google"
        ↓
Google OAuth consent screen appears
        ↓
User approves
        ↓
Frontend receives ID token
        ↓
Frontend sends ID token to backend (/api/auth/google)
        ↓
Backend verifies token with Google
        ↓
Backend checks if user exists in database
        ├─ If exists: Log them in
        └─ If not: Create new account with 50 free credits
        ↓
Backend returns JWT token
        ↓
Frontend stores JWT in localStorage
        ↓
User is redirected to /chat
```

### Database Changes

When a new user signs up with Google:
- A new user record is created with:
  - Email from Google account
  - No password (OAuth users don't have passwords)
  - 50 free credits
  - Created timestamp

The user can later add a password if they want to use email/password login.

## Security Notes

✅ **What's Secure:**
- ID tokens are verified server-side using Google's public certificates
- Tokens are signed and time-validated
- User emails are verified by Google (email_verified: true)
- JWT tokens have expiration (24 hours by default)
- OAuth redirect URIs are validated

⚠️ **Important:**
- Always keep `GOOGLE_CLIENT_SECRET` secret (never expose in frontend)
- Only the Client ID is used in frontend code
- Update redirect URIs when deploying to production
- Use HTTPS in production for all OAuth callbacks

## Testing

### Manual Testing

1. Go to `http://localhost:3000/login` or `/signup`
2. Click "Continue with Google"
3. Sign in with your Google account
4. You should be redirected to the chat page
5. Check browser console and network tab for any errors

### Backend Testing

Test the endpoint directly:
```bash
curl -X POST http://localhost:8000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"id_token": "your-google-id-token"}'
```

## Troubleshooting

### "Google OAuth not configured on server"
- Check that `GOOGLE_CLIENT_ID` is set in backend `.env`
- Restart the backend server after setting environment variables

### "Invalid Google token"
- Ensure the frontend is sending the correct `id_token`
- Verify the token is fresh (not expired)
- Check that the `GOOGLE_CLIENT_ID` in backend matches the frontend

### "Invalid issuer"
- This means the token wasn't issued by Google
- Ensure you're using Google's official library
- Check that token verification is using the correct client ID

### Redirect URI mismatch
- Add all used redirect URIs to Google Cloud Console
- Ensure URIs match exactly (including protocol and path)
- Separate URIs for development and production if needed

## Production Deployment

### Before Going Live

1. ✅ Update `GOOGLE_CLIENT_ID` in frontend `.env`
2. ✅ Add production redirect URIs in Google Cloud Console
3. ✅ Update `REACT_APP_BACKEND_URL` to production domain
4. ✅ Verify `GOOGLE_CLIENT_SECRET` is set in backend `.env`
5. ✅ Test authentication flow on production domain
6. ✅ Enable HTTPS for all OAuth callbacks

### Environment Variables

**Backend (.env):**
```bash
GOOGLE_CLIENT_ID=prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=prod-secret-key
```

**Frontend (.env.production):**
```bash
REACT_APP_GOOGLE_CLIENT_ID=prod-client-id.apps.googleusercontent.com
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

## Support

For issues with Google OAuth setup, check:
- [Google Cloud Console Documentation](https://console.cloud.google.com/)
- [@react-oauth/google Documentation](https://github.com/react-oauth/react-oauth.github.io)
- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)

For backend verification issues:
- [google-auth Python Library](https://github.com/googleapis/google-auth-library-python)
- [JWT Token Verification](https://developers.google.com/identity/protocols/oauth2/web-server#verifyingthetoken)
