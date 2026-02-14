# Email Verification & Password Reset Implementation Guide

## Overview
The email verification system is used in two flows:
1. **Signup Flow**: Verify email during account creation
2. **Forgot Password Flow**: Verify email before resetting password

Both flows use the same N8N webhook for sending OTPs via email.

## Signup Flow

### Backend Process
1. **POST /api/auth/register**
   - User submits email and password
   - Backend validates email not already registered
   - Generates 6-digit OTP
   - Stores OTP + password temporarily (expires in 10 minutes)
   - Sends OTP to N8N webhook
   - Returns: `{"message": "...", "test_otp": "123456"}` (test_otp only in development)

2. **POST /api/auth/verify-signup**
   - User submits email and OTP from email
   - Backend verifies OTP
   - Creates user account with 50 free credits
   - Clears OTP from store
   - Returns JWT token for automatic login
   - Returns: `{"access_token": "jwt_token", "token_type": "bearer", "user": {...}}`

### Frontend Process
1. User enters email/password on SignupPage
2. Clicks "Create Account"
3. System sends OTP request to backend
4. EmailVerificationModal opens automatically
5. User enters 6-digit OTP from email
6. System verifies OTP and creates account
7. Automatic redirect to /chat with login token

### SignupPage Components
- **Input Fields**: Email, Password (with visibility toggle)
- **EmailVerificationModal**: Shows OTP entry dialog
- **Google OAuth**: Alternative signup method

---

## Forgot Password Flow

### Backend Process
1. **POST /api/auth/forgot-password**
   - User submits email
   - Backend checks if user exists
   - Generates 6-digit OTP
   - Stores OTP (expires in 10 minutes)
   - Sends OTP to N8N webhook
   - Returns: Generic message (doesn't reveal if email exists)

2. **POST /api/auth/verify-otp**
   - User submits email and OTP
   - Backend verifies OTP
   - Enforces 3-attempt limit
   - Returns: `{"success": true, "message": "OTP verified successfully"}`

3. **POST /api/auth/reset-password**
   - User submits email, OTP, and new password
   - Backend verifies OTP one more time
   - Validates password (min 6 chars, must match)
   - Updates password_hash in database
   - Clears OTP from store
   - Returns JWT token for automatic login
   - Returns: `{"access_token": "jwt_token", "token_type": "bearer", "user": {...}}`

### Frontend Process
1. User clicks "Forgot?" on LoginPage
2. ForgotPasswordModal opens (3-step form)
3. **Step 1**: Enter email, click "Send OTP"
4. **Step 2**: Enter 6-digit OTP from email
5. **Step 3**: Enter new password (with confirmation)
6. System verifies everything and logs user in
7. Automatic redirect to /chat

### LoginPage Components
- **ForgotPasswordModal**: 3-step wizard
  - Step 1: Email input
  - Step 2: OTP verification
  - Step 3: New password + confirm
- **Back Button**: Navigate between steps

---

## N8N Webhook Integration

### Webhook Endpoint
```
POST https://finance-manager-adi108.duckdns.org/webhook/pass-change
```

### Request Payload (from backend)
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "user_name": "user@example.com",
  "type": "signup" // or "forgot-password"
}
```

### N8N Workflow
1. Receive webhook with email and OTP
2. Send email to user with OTP code
3. Email should include:
   - 6-digit code: `{{otp}}`
   - Expiration: 10 minutes
   - Action button or instructions

### Optional: N8N Response
N8N can optionally call backend webhook to confirm email sent:
```
POST http://localhost:8000/webhook/password-change
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

## Data Models

### ForgotPasswordRequest
```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
```

### VerifyOTPRequest
```python
class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
```

### ResetPasswordRequest
```python
class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str
    confirm_password: str
```

### OTPVerifyResponse
```python
class OTPVerifyResponse(BaseModel):
    success: bool
    message: str
```

---

## In-Memory OTP Storage

```python
otp_store = {
    "user@example.com": {
        "otp": "123456",
        "password": "hashed_password",  # Only for signup
        "expires_at": datetime,
        "attempts": 0,
        "type": "signup" or "forgot-password"
    }
}
```

---

## Security Features

### Signup Flow
✅ Email enumeration protection (doesn't reveal if email exists)
✅ Password validation (min 6 characters, must match)
✅ OTP expiration (10 minutes)
✅ 3 failed attempt limit
✅ Temporary password storage during verification
✅ User gets 50 free credits on signup
✅ Automatic login with JWT token

### Password Reset Flow
✅ Email enumeration protection
✅ OTP expiration (10 minutes)
✅ 3 failed attempt limit
✅ Password confirmation required
✅ Password length validation (min 6 chars)
✅ Automatic login after successful reset
✅ OTP cleared from store after use

---

## Frontend Components

### EmailVerificationModal.jsx
- **Props**:
  - `open`: Boolean to show/hide modal
  - `onOpenChange`: Callback to control visibility
  - `email`: Email address to verify
  - `onSuccess`: Callback after successful verification
  - `isSignup`: Boolean to determine flow type

- **Features**:
  - 6-digit OTP input
  - Development mode shows test OTP
  - Loading states
  - Error handling
  - Toast notifications

### ForgotPasswordModal.jsx
- **3-Step Wizard**:
  1. Email input → Send OTP
  2. OTP verification → 6-digit input
  3. Password reset → New password + confirm

- **Features**:
  - Password visibility toggles
  - Back button to previous step
  - Loading states
  - Form validation
  - Toast notifications
  - Automatic redirect to /chat on success

### SignupPage.js
- Removed username field (optional)
- Updated to use OTP verification flow
- Integrated EmailVerificationModal
- Shows test OTP in development mode

### LoginPage.js
- Added ForgotPasswordModal
- "Forgot?" button on password field
- Modal opens when clicked

---

## Testing

### Development Mode
In development, OTP is returned in API response:
```json
{
  "message": "OTP sent...",
  "test_otp": "123456"
}
```

Frontend shows toast with test OTP and displays it in modal.

### Manual Testing Steps

**Signup:**
1. Go to /signup
2. Enter email and password
3. Click "Create Account"
4. OTP sent (check backend logs)
5. Enter OTP in modal
6. Auto-redirect to /chat

**Forgot Password:**
1. Go to /login
2. Click "Forgot?"
3. Enter email, click "Send OTP"
4. Enter OTP from email
5. Enter new password
6. Auto-redirect to /chat

---

## Production Considerations

1. **Redis Migration**: Replace in-memory `otp_store` with Redis for scaling
2. **Audit Logging**: Log password reset attempts to database
3. **Rate Limiting**: Implement endpoint rate limiting
4. **Email Templates**: Use professional HTML email templates via N8N
5. **OTP Expiration**: Consider shorter timeout (5 minutes) in production
6. **Monitoring**: Alert on multiple failed OTP attempts
7. **HTTPS Only**: Ensure all endpoints use HTTPS in production
8. **Environment Config**: All webhook URLs in .env file

---

## API Endpoints Summary

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | /api/auth/register | Request signup OTP | ✅ Implemented |
| POST | /api/auth/verify-signup | Create account after OTP | ✅ Implemented |
| POST | /api/auth/forgot-password | Request password reset OTP | ✅ Implemented |
| POST | /api/auth/verify-otp | Verify password reset OTP | ✅ Implemented |
| POST | /api/auth/reset-password | Update password | ✅ Implemented |
| POST | /webhook/password-change | N8N confirmation | ✅ Implemented |

---

## Files Modified

### Backend
- `backend/server.py`: 
  - Modified `/api/auth/register` to send OTP
  - Added `/api/auth/verify-signup` for account creation
  - Enhanced `/api/auth/forgot-password` with better logging
  - Enhanced `/api/auth/verify-otp` with detailed logging
  - Added `/api/auth/reset-password` for password reset
  - Added `/webhook/password-change` for N8N confirmation

### Frontend
- `frontend/src/components/EmailVerificationModal.jsx` (NEW)
- `frontend/src/components/ForgotPasswordModal.jsx` (modified)
- `frontend/src/pages/SignupPage.js` (modified)
- `frontend/src/pages/LoginPage.js` (modified)

