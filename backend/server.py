from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import asyncpg
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx
from google.auth.transport import requests
from google.oauth2 import id_token

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============================================================
# DATABASE CONFIGURATION - PostgreSQL (Supabase)
# ============================================================
DATABASE_URL = os.environ.get('DATABASE_URL', '')

# ============================================================
# JWT CONFIGURATION
# ============================================================
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# ============================================================
# GOOGLE OAUTH CONFIGURATION
# ============================================================
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')

# ============================================================
# N8N WEBHOOK CONFIGURATION
# ============================================================
N8N_WEBHOOK_URL = os.environ.get('N8N_WEBHOOK_URL', '')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="Okaman API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Database connection pool
db_pool: Optional[asyncpg.Pool] = None

# ============================================================
# OTP STORAGE (In-memory cache for temporary OTP storage)
# In production, use Redis or database
# ============================================================
otp_store = {}  # Format: {email: {"otp": "123456", "expires_at": datetime}}

import random
import string

def generate_otp(length: int = 6) -> str:
    """Generate a random 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=length))

# Configure CORS middleware FIRST (before router)
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
cors_origins = [origin.strip() for origin in cors_origins]  # Remove whitespace
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# DATABASE INITIALIZATION
# ============================================================
async def init_db():
    """Initialize database connection pool"""
    global db_pool
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not configured. Database features will be unavailable.")
        return
    
    try:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL, 
            min_size=2, 
            max_size=10,
            ssl='require',
            statement_cache_size=0
        )
        logger.info("Database connected successfully")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")

async def close_db():
    """Close database connection pool"""
    global db_pool
    if db_pool:
        await db_pool.close()

# ============================================================
# PYDANTIC MODELS
# ============================================================

# Auth Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleOAuthToken(BaseModel):
    id_token: str
    """Google OAuth ID token from frontend"""

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    """User email to send OTP to"""

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    """OTP sent to user's email"""

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str
    confirm_password: str
    """Password reset with OTP verification"""

class N8NPasswordChangeWebhook(BaseModel):
    email: EmailStr
    otp: str
    """Webhook from N8N containing OTP"""

class OTPVerifyResponse(BaseModel):
    success: bool
    message: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    current_credits: int
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Chat Models
class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str  # 'user' or 'assistant'
    content: str
    created_at: datetime

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    model: str
    messages: List[MessageResponse]
    created_at: datetime
    updated_at: datetime

class ChatSessionListResponse(BaseModel):
    id: str
    user_id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

class SendMessageRequest(BaseModel):
    chat_id: Optional[str] = None
    content: str
    model: str = "VEO 3"

class SendMessageResponse(BaseModel):
    message: MessageResponse
    remaining_credits: int

class StopGenerationRequest(BaseModel):
    chat_id: str

# Feedback Models
class FeedbackCreate(BaseModel):
    message_id: str
    is_positive: bool

class FeedbackResponse(BaseModel):
    id: str
    message_id: str
    is_positive: bool

# Payment Models
class PricingPlan(BaseModel):
    id: str
    name: str
    credits: int
    price: int
    currency: str = "INR"
    duration_months: int
    badge: Optional[str] = None

class PaymentInitiate(BaseModel):
    plan_id: str

class PaymentResponse(BaseModel):
    payment_id: str
    checkout_url: str

# ============================================================
# AUTHENTICATION HELPERS
# ============================================================
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_google_token(token: str) -> dict:
    """
    Verify Google OAuth ID token and return claims.
    
    Args:
        token: Google OAuth ID token from frontend
        
    Returns:
        Dictionary containing token claims (email, email_verified, name, picture, etc.)
        
    Raises:
        ValueError: If token is invalid
    """
    try:
        # Verify the token with Google's public certificates
        request_obj = requests.Request()
        claim = id_token.verify_oauth2_token(token, request_obj, GOOGLE_CLIENT_ID)
        
        # Verify the token is from Google
        if claim['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Invalid issuer')
            
        return claim
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        raise ValueError(f"Invalid Google token: {str(e)}")

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return current user"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT user_id, email, current_credits, created_at FROM users WHERE user_id = $1',
            uuid.UUID(user_id)
        )
    
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return dict(user)

# ============================================================
# PRICING PLANS
# ============================================================
PRICING_PLANS = [
    PricingPlan(id="plan_1m", name="1 Month", credits=500, price=199, duration_months=1),
    PricingPlan(id="plan_3m", name="3 Months", credits=1700, price=599, duration_months=3),
    PricingPlan(id="plan_6m", name="6 Months", credits=3500, price=1149, duration_months=6, badge="Bulk Discount"),
    PricingPlan(id="plan_12m", name="1 Year", credits=7500, price=2299, duration_months=12, badge="Best Value"),
]

# ============================================================
# AUTH ENDPOINTS
# ============================================================
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    """
    Request email verification during signup.
    Sends OTP to user's email via N8N.
    
    Args:
        user_data: Email and password
        
    Returns:
        Message confirming OTP was sent (includes test_otp in development)
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if user already exists
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow('SELECT user_id FROM users WHERE email = $1', user_data.email)
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password length
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Generate OTP for email verification
    otp = generate_otp()
    
    # Store OTP and password temporarily (expires in 10 minutes)
    expiration_time = datetime.now(timezone.utc) + timedelta(minutes=10)
    otp_store[user_data.email] = {
        "otp": otp,
        "password": user_data.password,  # Store password temporarily for account creation
        "expires_at": expiration_time,
        "attempts": 0,
        "type": "signup"  # Mark this as signup OTP
    }
    
    logger.info(f"Signup OTP generated for {user_data.email}: {otp} (expires at {expiration_time})")
    
    # Send OTP via N8N webhook
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://finance-manager-adi108.duckdns.org/webhook/pass-change",
                json={
                    "email": user_data.email,
                    "otp": otp,
                    "user_name": user_data.email,
                    "type": "signup"
                },
                timeout=10.0
            )
    except Exception as e:
        logger.error(f"Failed to send signup OTP via N8N: {e}")
    
    # In development, return the OTP for testing purposes
    is_development = os.environ.get('ENVIRONMENT', 'development').lower() == 'development'
    response = {"message": "OTP sent to your email. Please verify to complete signup."}
    if is_development:
        response["test_otp"] = otp  # Only for development/testing
        logger.info(f"DEVELOPMENT MODE: OTP returned in response for testing")
    
    return response

@api_router.post("/auth/verify-signup", response_model=TokenResponse)
async def verify_signup(request: VerifyOTPRequest):
    """
    Verify email OTP and create user account.
    
    Args:
        request: Contains email and OTP
        
    Returns:
        JWT token and user info
    """
    logger.info(f"Signup verification attempt for {request.email} with OTP: {request.otp}")
    
    if request.email not in otp_store:
        logger.warning(f"No OTP found in store for {request.email}")
        raise HTTPException(status_code=400, detail="No verification request found. Please sign up again.")
    
    otp_data = otp_store[request.email]
    
    # Check if this is a signup OTP
    if otp_data.get("type") != "signup":
        logger.warning(f"OTP type mismatch for {request.email}")
        raise HTTPException(status_code=400, detail="Invalid verification request. Please sign up again.")
    
    logger.info(f"OTP data found: stored_otp={otp_data['otp']}, received_otp={request.otp}, expires_at={otp_data['expires_at']}, attempts={otp_data['attempts']}")
    
    # Check if OTP has expired
    now = datetime.now(timezone.utc)
    if now > otp_data["expires_at"]:
        logger.warning(f"OTP expired for {request.email}. Now: {now}, Expires at: {otp_data['expires_at']}")
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="OTP has expired. Please sign up again.")
    
    # Check attempt limit (3 attempts max)
    if otp_data["attempts"] >= 3:
        logger.warning(f"Too many failed attempts for {request.email}")
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please sign up again.")
    
    # Verify OTP (case-sensitive, exact match)
    if str(otp_data["otp"]) != str(request.otp).strip():
        otp_data["attempts"] += 1
        remaining = 3 - otp_data["attempts"]
        logger.warning(f"Invalid OTP for {request.email}. Attempt {otp_data['attempts']}/3. Expected: {otp_data['otp']}, Got: {request.otp}")
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # OTP verified successfully, create user account
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check one more time if user doesn't exist (race condition check)
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow('SELECT user_id FROM users WHERE email = $1', request.email)
        if existing:
            del otp_store[request.email]
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user with 50 free credits
        password_hash = get_password_hash(otp_data["password"])
        user = await conn.fetchrow(
            '''INSERT INTO users (email, password_hash, current_credits)
               VALUES ($1, $2, 50) RETURNING user_id, email, current_credits, created_at''',
            request.email, password_hash
        )
    
    # Clear OTP from store
    del otp_store[request.email]
    
    logger.info(f"User account created after email verification for {request.email}")
    
    # Generate JWT token for automatic login
    user_dict = dict(user)
    access_token = create_access_token(data={"sub": str(user_dict["user_id"])})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=str(user_dict["user_id"]),
            email=user_dict["email"],
            current_credits=user_dict["current_credits"],
            created_at=user_dict["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """Login and get access token"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT user_id, email, password_hash, current_credits, created_at FROM users WHERE email = $1',
            user_data.email
        )
    
    # ❌ CRITICAL SECURITY CHECK: Ensure user exists and has a password
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user["password_hash"] is None:
        raise HTTPException(
            status_code=401, 
            detail="This account uses Google Login. Please sign in with Google."
        )
    
    # Proceed with normal password verification
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_dict = dict(user)
    access_token = create_access_token(data={"sub": str(user_dict["user_id"])})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=str(user_dict["user_id"]),
            email=user_dict["email"],
            current_credits=user_dict["current_credits"],
            created_at=user_dict["created_at"]
        )
    )

@api_router.post("/auth/google", response_model=TokenResponse)
async def google_oauth(oauth_data: GoogleOAuthToken):
    """
    Authenticate user with Google OAuth token.
    
    If user doesn't exist, create a new account with 50 free credits.
    If user exists, log them in.
    
    Args:
        oauth_data: Contains the Google OAuth ID token from frontend
        
    Returns:
        TokenResponse with JWT token and user info
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500, 
            detail="Google OAuth not configured on server"
        )
    
    try:
        # Verify the Google token
        google_claims = verify_google_token(oauth_data.id_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    
    # Extract user info from token
    email = google_claims.get('email')
    name = google_claims.get('name', '')
    picture = google_claims.get('picture', '')
    email_verified = google_claims.get('email_verified', False)
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in Google token")
    
    async with db_pool.acquire() as conn:
        # Check if user exists
        user = await conn.fetchrow(
            'SELECT user_id, email, current_credits, created_at FROM users WHERE email = $1',
            email
        )
        
        if user:
            # User exists, log them in
            user_dict = dict(user)
        else:
            # User doesn't exist, create new account with 50 free credits
            user = await conn.fetchrow(
                '''INSERT INTO users (email, current_credits)
                   VALUES ($1, 50) RETURNING user_id, email, current_credits, created_at''',
                email
            )
            user_dict = dict(user)
            logger.info(f"New user created via Google OAuth: {email}")
    
    # Create JWT token
    access_token = create_access_token(data={"sub": str(user_dict["user_id"])})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=str(user_dict["user_id"]),
            email=user_dict["email"],
            current_credits=user_dict["current_credits"],
            created_at=user_dict["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        user_id=str(current_user["user_id"]),
        email=current_user["email"],
        current_credits=current_user["current_credits"],
        created_at=current_user["created_at"]
    )

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request password reset. Sends OTP to user's email via N8N.
    
    Args:
        request: Contains user email
        
    Returns:
        Message confirming OTP was sent (includes test_otp in development)
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if user exists
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT user_id, email FROM users WHERE email = $1',
            request.email
        )
    
    if not user:
        # Don't reveal if email exists (security best practice)
        return {"message": "If account exists, OTP will be sent to email"}
    
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP temporarily (expires in 10 minutes)
    expiration_time = datetime.now(timezone.utc) + timedelta(minutes=10)
    otp_store[request.email] = {
        "otp": otp,
        "expires_at": expiration_time,
        "attempts": 0
    }
    
    logger.info(f"OTP generated for {request.email}: {otp} (expires at {expiration_time})")
    
    # Send OTP via N8N webhook
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://finance-manager-adi108.duckdns.org/webhook/pass-change",
                json={
                    "email": request.email,
                    "otp": otp,
                    "user_name": user.get("email", "User")
                },
                timeout=10.0
            )
    except Exception as e:
        logger.error(f"Failed to send OTP via N8N: {e}")
    
    # In development, return the OTP for testing purposes
    # In production, remove this for security
    is_development = os.environ.get('ENVIRONMENT', 'development').lower() == 'development'
    response = {"message": "If account exists, OTP will be sent to email"}
    if is_development:
        response["test_otp"] = otp  # Only for development/testing
        logger.info(f"DEVELOPMENT MODE: OTP returned in response for testing")
    
    return response

@api_router.post("/auth/verify-otp", response_model=OTPVerifyResponse)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify the OTP sent to user's email.
    
    Args:
        request: Contains email and OTP
        
    Returns:
        Success status
    """
    logger.info(f"OTP verification attempt for {request.email} with OTP: {request.otp}")
    
    if request.email not in otp_store:
        logger.warning(f"No OTP found in store for {request.email}")
        logger.info(f"Current OTP store keys: {list(otp_store.keys())}")
        raise HTTPException(status_code=400, detail="No OTP request found for this email. Request a new OTP.")
    
    otp_data = otp_store[request.email]
    logger.info(f"OTP data found: stored_otp={otp_data['otp']}, received_otp={request.otp}, expires_at={otp_data['expires_at']}, attempts={otp_data['attempts']}")
    
    # Check if OTP has expired
    now = datetime.now(timezone.utc)
    if now > otp_data["expires_at"]:
        logger.warning(f"OTP expired for {request.email}. Now: {now}, Expires at: {otp_data['expires_at']}")
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")
    
    # Check attempt limit (3 attempts max)
    if otp_data["attempts"] >= 3:
        logger.warning(f"Too many failed attempts for {request.email}")
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="Too many failed attempts. Request a new OTP.")
    
    # Verify OTP (case-sensitive, exact match)
    if str(otp_data["otp"]) != str(request.otp).strip():
        otp_data["attempts"] += 1
        remaining = 3 - otp_data["attempts"]
        logger.warning(f"Invalid OTP for {request.email}. Attempt {otp_data['attempts']}/3. Expected: {otp_data['otp']}, Got: {request.otp}")
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")
    
    # OTP verified successfully
    logger.info(f"OTP verified successfully for {request.email}")
    return OTPVerifyResponse(success=True, message="OTP verified successfully")

@api_router.post("/auth/reset-password", response_model=TokenResponse)
async def reset_password(request: ResetPasswordRequest):
    """
    Reset user password after OTP verification.
    
    Args:
        request: Contains email, OTP, and new password
        
    Returns:
        JWT token for automatic login
    """
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Verify passwords match
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Verify password length
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Verify OTP
    if request.email not in otp_store:
        raise HTTPException(status_code=400, detail="Invalid OTP request")
    
    otp_data = otp_store[request.email]
    
    if otp_data["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.now(timezone.utc) > otp_data["expires_at"]:
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Update password in database
    password_hash = get_password_hash(request.new_password)
    
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING user_id, email, current_credits, created_at',
            password_hash,
            request.email
        )
    
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    # Clear OTP from store
    del otp_store[request.email]
    
    logger.info(f"Password reset for {request.email}")
    
    # Generate JWT token
    user_dict = dict(user)
    access_token = create_access_token(data={"sub": str(user_dict["user_id"])})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=str(user_dict["user_id"]),
            email=user_dict["email"],
            current_credits=user_dict["current_credits"],
            created_at=user_dict["created_at"]
        )
    )

@app.post("/webhook/password-change")
async def password_change_webhook(webhook_data: N8NPasswordChangeWebhook):
    """
    Webhook endpoint for N8N to send OTP.
    This is called by N8N after sending the email.
    
    Args:
        webhook_data: Contains email and OTP from N8N
        
    Returns:
        Confirmation
    """
    logger.info(f"Received password change webhook for {webhook_data.email}")
    return {"status": "received", "email": webhook_data.email}

# ============================================================
# CHAT ENDPOINTS (Adapted to your Supabase schema)
# ============================================================
@api_router.get("/chats", response_model=List[ChatSessionListResponse])
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get all chat sessions for current user"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chats = await conn.fetch(
            '''SELECT id, user_id, title, model, created_at, updated_at
               FROM chat_sessions 
               WHERE user_id = $1 
               ORDER BY updated_at DESC''',
            current_user["user_id"]
        )
    
    return [
        ChatSessionListResponse(
            id=str(c["id"]),
            user_id=str(c["user_id"]),
            title=c["title"],
            model=c["model"],
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        ) for c in chats
    ]

@api_router.get("/chats/{chat_id}", response_model=ChatSessionResponse)
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chat session with all messages"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chat = await conn.fetchrow(
            '''SELECT id, user_id, title, model, created_at, updated_at
               FROM chat_sessions 
               WHERE id = $1 AND user_id = $2''',
            uuid.UUID(chat_id), current_user["user_id"]
        )
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        messages = await conn.fetch(
            '''SELECT id, chat_id, role, content, created_at
               FROM messages 
               WHERE chat_id = $1 
               ORDER BY created_at ASC''',
            uuid.UUID(chat_id)
        )
    
    return ChatSessionResponse(
        id=str(chat["id"]),
        user_id=str(chat["user_id"]),
        title=chat["title"],
        model=chat["model"],
        messages=[
            MessageResponse(
                id=str(m["id"]),
                chat_id=str(m["chat_id"]),
                role=m["role"],
                content=m["content"],
                created_at=m["created_at"]
            ) for m in messages
        ],
        created_at=chat["created_at"],
        updated_at=chat["updated_at"]
    )

@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat session and all its messages"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Delete feedback first (if exists)
        await conn.execute(
            '''DELETE FROM feedback 
               WHERE message_id IN (
                   SELECT id FROM messages WHERE chat_id = $1
               )''',
            uuid.UUID(chat_id)
        )
        # Delete messages
        await conn.execute('DELETE FROM messages WHERE chat_id = $1', uuid.UUID(chat_id))
        # Delete chat session
        result = await conn.execute(
            'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2',
            uuid.UUID(chat_id), current_user["user_id"]
        )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return {"message": "Chat deleted successfully"}

# ============================================================
# MESSAGE SENDING (N8N INTEGRATION)
# ============================================================
@api_router.post("/chat/send", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a message and get AI response via n8n webhook"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user_id = current_user["user_id"]
    
    async with db_pool.acquire() as conn:
        # Check credits
        user = await conn.fetchrow('SELECT current_credits FROM users WHERE user_id = $1', user_id)
        if user["current_credits"] <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits. Please refill.")
        
        # Create or get chat session
        chat_id = None
        if request.chat_id:
            # Verify chat exists
            chat = await conn.fetchrow(
                'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
                uuid.UUID(request.chat_id), user_id
            )
            if not chat:
                raise HTTPException(status_code=404, detail="Chat not found")
            chat_id = uuid.UUID(request.chat_id)
        else:
            # Create new chat session
            chat_id = uuid.uuid4()
            # Generate title from first message
            title = request.content[:50] + "..." if len(request.content) > 50 else request.content
            await conn.execute(
                '''INSERT INTO chat_sessions (id, user_id, title, model)
                   VALUES ($1, $2, $3, $4)''',
                chat_id, user_id, title, request.model
            )
        
        # Save user message
        user_message = await conn.fetchrow(
            '''INSERT INTO messages (chat_id, role, content)
               VALUES ($1, 'user', $2)
               RETURNING id, chat_id, role, content, created_at''',
            chat_id, request.content
        )
        
        # Call n8n webhook
        ai_response_content = "AI response placeholder - n8n webhook not configured"
        new_credits = user["current_credits"]
        
        if N8N_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        N8N_WEBHOOK_URL,
                        json={
                            "user_id": str(user_id),
                            "prompt": request.content,
                            "model": request.model,
                            "current_credits": user["current_credits"]
                        }
                    )
                    response.raise_for_status()
                    data = response.json()
                    ai_response_content = data.get("response", data.get("output", str(data)))
                    new_credits = data.get("remaining_credits", user["current_credits"] - 1)
            except Exception as e:
                logger.error(f"n8n webhook error: {e}")
                ai_response_content = f"Error connecting to AI service. Please try again."
                new_credits = max(0, user["current_credits"] - 1)
        else:
            # Deduct 1 credit if n8n not configured (for testing)
            new_credits = max(0, user["current_credits"] - 1)
        
        # Update user credits
        await conn.execute(
            'UPDATE users SET current_credits = $1 WHERE user_id = $2',
            new_credits, user_id
        )
        
        # Save AI response message
        ai_message = await conn.fetchrow(
            '''INSERT INTO messages (chat_id, role, content)
               VALUES ($1, 'assistant', $2)
               RETURNING id, chat_id, role, content, created_at''',
            chat_id, ai_response_content
        )
        
        # Update chat session timestamp
        await conn.execute(
            'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
            chat_id
        )
    
    return SendMessageResponse(
        message=MessageResponse(
            id=str(ai_message["id"]),
            chat_id=str(ai_message["chat_id"]),
            role=ai_message["role"],
            content=ai_message["content"],
            created_at=ai_message["created_at"]
        ),
        remaining_credits=new_credits
    )

@api_router.post("/chat/stop")
async def stop_generation(request: StopGenerationRequest, current_user: dict = Depends(get_current_user)):
    """Send stop signal to n8n webhook"""
    if N8N_WEBHOOK_URL:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    N8N_WEBHOOK_URL,
                    json={
                        "action": "STOP",
                        "user_id": str(current_user["user_id"]),
                        "chat_id": request.chat_id
                    }
                )
        except Exception as e:
            logger.error(f"Stop generation error: {e}")
    
    return {"message": "Stop signal sent"}

# ============================================================
# FEEDBACK ENDPOINT (Adapted to message-based schema)
# ============================================================
@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(feedback_data: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    """Submit feedback for a message"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Check if feedback already exists
        existing = await conn.fetchrow(
            'SELECT id FROM feedback WHERE message_id = $1',
            uuid.UUID(feedback_data.message_id)
        )
        
        if existing:
            # Update existing feedback
            feedback = await conn.fetchrow(
                '''UPDATE feedback SET is_positive = $1
                   WHERE message_id = $2
                   RETURNING id, message_id, is_positive''',
                feedback_data.is_positive, uuid.UUID(feedback_data.message_id)
            )
        else:
            # Create new feedback
            feedback = await conn.fetchrow(
                '''INSERT INTO feedback (message_id, is_positive)
                   VALUES ($1, $2)
                   RETURNING id, message_id, is_positive''',
                uuid.UUID(feedback_data.message_id), feedback_data.is_positive
            )
    
    return FeedbackResponse(
        id=str(feedback["id"]),
        message_id=str(feedback["message_id"]),
        is_positive=feedback["is_positive"]
    )

# ============================================================
# PAYMENT ENDPOINTS
# ============================================================
@api_router.get("/payments/plans", response_model=List[PricingPlan])
async def get_pricing_plans():
    """Get available pricing plans"""
    return PRICING_PLANS

@api_router.post("/payments/initiate", response_model=PaymentResponse)
async def initiate_payment(payment_data: PaymentInitiate, current_user: dict = Depends(get_current_user)):
    """Initiate a payment with Dodo Payments"""
    plan = next((p for p in PRICING_PLANS if p.id == payment_data.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # TODO: Integrate with Dodo Payments
    payment_id = str(uuid.uuid4())
    checkout_url = f"https://checkout.dodopayments.com/placeholder/{payment_id}"
    
    return PaymentResponse(payment_id=payment_id, checkout_url=checkout_url)

@api_router.post("/payments/webhook")
async def payment_webhook(request: Request):
    """Handle Dodo Payments webhook"""
    data = await request.json()
    
    payment_id = data.get("payment_id")
    user_id = data.get("user_id")
    credits = data.get("credits", 0)
    status = data.get("status")
    
    if status == "success" or status == "completed":
        if db_pool and user_id:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    '''UPDATE users SET 
                       current_credits = current_credits + $1,
                       last_payment_date = NOW()
                       WHERE user_id = $2''',
                    credits, uuid.UUID(user_id)
                )
            logger.info(f"Payment {payment_id} completed. Added {credits} credits to user {user_id}.")
    
    return {"message": "Webhook processed"}

# ============================================================
# CREDITS ENDPOINT
# ============================================================
@api_router.get("/credits")
async def get_credits(current_user: dict = Depends(get_current_user)):
    """Get current user's credit balance"""
    return {"credits": current_user["current_credits"]}

# ============================================================
# HEALTH CHECK
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "Okaman API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    db_status = "connected" if db_pool else "disconnected"
    return {"status": "healthy", "database": db_status}

# Include the router in the main app
app.include_router(api_router)

@app.on_event("startup")
async def startup():
    await init_db()

@app.on_event("shutdown")
async def shutdown():
    await close_db()
