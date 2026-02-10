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
            statement_cache_size=0  # Disable prepared statements for pgbouncer compatibility
        )
        logger.info("Database connected successfully")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

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
class ChatResponse(BaseModel):
    id: str
    user_id: str
    model_used: Optional[str]
    user_prompt: Optional[str]
    ai_response: Optional[str]
    created_at: datetime

class SendMessageRequest(BaseModel):
    chat_id: Optional[str] = None
    content: str
    model: str = "VEO 3"

class SendMessageResponse(BaseModel):
    chat: ChatResponse
    remaining_credits: int

class StopGenerationRequest(BaseModel):
    chat_id: str

# Feedback Models
class FeedbackCreate(BaseModel):
    chat_id: str
    is_positive: bool

class FeedbackResponse(BaseModel):
    id: str
    chat_id: str
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
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Register a new user"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Check if user exists
        existing = await conn.fetchrow('SELECT user_id FROM users WHERE email = $1', user_data.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user with 50 free credits
        password_hash = get_password_hash(user_data.password)
        user = await conn.fetchrow(
            '''INSERT INTO users (email, password_hash, current_credits)
               VALUES ($1, $2, 50) RETURNING user_id, email, current_credits, created_at''',
            user_data.email, password_hash
        )
    
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
    
    if not user or not verify_password(user_data.password, user["password_hash"]):
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

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        user_id=str(current_user["user_id"]),
        email=current_user["email"],
        current_credits=current_user["current_credits"],
        created_at=current_user["created_at"]
    )

# ============================================================
# CHAT ENDPOINTS (Adapted to your Supabase schema)
# ============================================================
@api_router.get("/chats", response_model=List[ChatResponse])
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get all chats for current user"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chats = await conn.fetch(
            '''SELECT id, user_id, model_used, user_prompt, ai_response, created_at 
               FROM chats WHERE user_id = $1 ORDER BY created_at DESC''',
            current_user["user_id"]
        )
    
    return [
        ChatResponse(
            id=str(c["id"]),
            user_id=str(c["user_id"]),
            model_used=c["model_used"],
            user_prompt=c["user_prompt"],
            ai_response=c["ai_response"],
            created_at=c["created_at"]
        ) for c in chats
    ]

@api_router.get("/chats/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chat = await conn.fetchrow(
            '''SELECT id, user_id, model_used, user_prompt, ai_response, created_at 
               FROM chats WHERE id = $1 AND user_id = $2''',
            uuid.UUID(chat_id), current_user["user_id"]
        )
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return ChatResponse(
        id=str(chat["id"]),
        user_id=str(chat["user_id"]),
        model_used=chat["model_used"],
        user_prompt=chat["user_prompt"],
        ai_response=chat["ai_response"],
        created_at=chat["created_at"]
    )

@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Delete feedback first (foreign key constraint)
        await conn.execute('DELETE FROM feedback WHERE chat_id = $1', uuid.UUID(chat_id))
        # Then delete chat
        result = await conn.execute(
            'DELETE FROM chats WHERE id = $1 AND user_id = $2',
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
        
        # Save chat to database (your schema)
        chat = await conn.fetchrow(
            '''INSERT INTO chats (user_id, model_used, user_prompt, ai_response)
               VALUES ($1, $2, $3, $4)
               RETURNING id, user_id, model_used, user_prompt, ai_response, created_at''',
            user_id, request.model, request.content, ai_response_content
        )
    
    return SendMessageResponse(
        chat=ChatResponse(
            id=str(chat["id"]),
            user_id=str(chat["user_id"]),
            model_used=chat["model_used"],
            user_prompt=chat["user_prompt"],
            ai_response=chat["ai_response"],
            created_at=chat["created_at"]
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
# FEEDBACK ENDPOINT (Adapted to your schema)
# ============================================================
@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(feedback_data: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    """Submit feedback for a chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Check if feedback already exists
        existing = await conn.fetchrow(
            'SELECT id FROM feedback WHERE chat_id = $1',
            uuid.UUID(feedback_data.chat_id)
        )
        
        if existing:
            # Update existing feedback
            feedback = await conn.fetchrow(
                '''UPDATE feedback SET is_positive = $1
                   WHERE chat_id = $2
                   RETURNING id, chat_id, is_positive''',
                feedback_data.is_positive, uuid.UUID(feedback_data.chat_id)
            )
        else:
            # Create new feedback
            feedback = await conn.fetchrow(
                '''INSERT INTO feedback (chat_id, is_positive)
                   VALUES ($1, $2)
                   RETURNING id, chat_id, is_positive''',
                uuid.UUID(feedback_data.chat_id), feedback_data.is_positive
            )
    
    return FeedbackResponse(
        id=str(feedback["id"]),
        chat_id=str(feedback["chat_id"]),
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

@app.on_event("shutdown")
async def shutdown():
    await close_db()
