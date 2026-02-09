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
# DATABASE CONFIGURATION - PostgreSQL (Supabase/NeonDB)
# ============================================================
# TODO: Add your Supabase/NeonDB connection string here
# Format: postgresql://user:password@host:port/database
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
# TODO: Add your n8n webhook URL here
N8N_WEBHOOK_URL = os.environ.get('N8N_WEBHOOK_URL', '')

# ============================================================
# DODO PAYMENTS CONFIGURATION
# ============================================================
# TODO: Add your Dodo Payments API credentials here
# DODO_API_KEY = os.environ.get('DODO_API_KEY', '')
# DODO_SECRET_KEY = os.environ.get('DODO_SECRET_KEY', '')
# DODO_WEBHOOK_SECRET = os.environ.get('DODO_WEBHOOK_SECRET', '')

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
    """Initialize database connection pool and create tables"""
    global db_pool
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not configured. Database features will be unavailable.")
        return
    
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        
        async with db_pool.acquire() as conn:
            # Create users table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    username VARCHAR(100),
                    current_credits INTEGER DEFAULT 50,
                    last_payment_date TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            # Create chats table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS chats (
                    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                    title VARCHAR(255) DEFAULT 'New Chat',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            # Create messages table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    chat_id UUID REFERENCES chats(chat_id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    model VARCHAR(50),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            # Create feedback table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS feedback (
                    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    message_id UUID REFERENCES messages(message_id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                    value INTEGER NOT NULL CHECK (value IN (0, 1)),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
            # Create payments table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS payments (
                    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
                    amount DECIMAL(10, 2) NOT NULL,
                    currency VARCHAR(10) DEFAULT 'INR',
                    credits_purchased INTEGER NOT NULL,
                    plan_name VARCHAR(50),
                    payment_provider VARCHAR(50),
                    provider_payment_id VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            ''')
            
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
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
    username: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    username: Optional[str]
    current_credits: int
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Chat Models
class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatResponse(BaseModel):
    chat_id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

class MessageCreate(BaseModel):
    content: str
    model: str = "VEO 3"

class MessageResponse(BaseModel):
    message_id: str
    chat_id: str
    user_id: str
    role: str
    content: str
    model: Optional[str]
    created_at: datetime

class SendMessageRequest(BaseModel):
    chat_id: str
    content: str
    model: str = "VEO 3"

class SendMessageResponse(BaseModel):
    user_message: MessageResponse
    ai_message: MessageResponse
    remaining_credits: int

class StopGenerationRequest(BaseModel):
    chat_id: str

# Feedback Models
class FeedbackCreate(BaseModel):
    message_id: str
    value: int = Field(..., ge=0, le=1)

class FeedbackResponse(BaseModel):
    feedback_id: str
    message_id: str
    user_id: str
    value: int
    created_at: datetime

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
            'SELECT user_id, email, username, current_credits, created_at FROM users WHERE user_id = $1',
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
        
        # Create user
        password_hash = get_password_hash(user_data.password)
        user = await conn.fetchrow(
            '''INSERT INTO users (email, password_hash, username, current_credits)
               VALUES ($1, $2, $3, 50) RETURNING user_id, email, username, current_credits, created_at''',
            user_data.email, password_hash, user_data.username or user_data.email.split('@')[0]
        )
    
    user_dict = dict(user)
    access_token = create_access_token(data={"sub": str(user_dict["user_id"])})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            user_id=str(user_dict["user_id"]),
            email=user_dict["email"],
            username=user_dict["username"],
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
            'SELECT user_id, email, username, password_hash, current_credits, created_at FROM users WHERE email = $1',
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
            username=user_dict["username"],
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
        username=current_user["username"],
        current_credits=current_user["current_credits"],
        created_at=current_user["created_at"]
    )

# ============================================================
# CHAT ENDPOINTS
# ============================================================
@api_router.post("/chats", response_model=ChatResponse)
async def create_chat(chat_data: ChatCreate, current_user: dict = Depends(get_current_user)):
    """Create a new chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chat = await conn.fetchrow(
            '''INSERT INTO chats (user_id, title) VALUES ($1, $2)
               RETURNING chat_id, user_id, title, created_at, updated_at''',
            current_user["user_id"], chat_data.title
        )
    
    return ChatResponse(
        chat_id=str(chat["chat_id"]),
        user_id=str(chat["user_id"]),
        title=chat["title"],
        created_at=chat["created_at"],
        updated_at=chat["updated_at"]
    )

@api_router.get("/chats", response_model=List[ChatResponse])
async def get_chats(current_user: dict = Depends(get_current_user)):
    """Get all chats for current user"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chats = await conn.fetch(
            '''SELECT chat_id, user_id, title, created_at, updated_at 
               FROM chats WHERE user_id = $1 ORDER BY updated_at DESC''',
            current_user["user_id"]
        )
    
    return [
        ChatResponse(
            chat_id=str(c["chat_id"]),
            user_id=str(c["user_id"]),
            title=c["title"],
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        ) for c in chats
    ]

@api_router.get("/chats/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        chat = await conn.fetchrow(
            '''SELECT chat_id, user_id, title, created_at, updated_at 
               FROM chats WHERE chat_id = $1 AND user_id = $2''',
            uuid.UUID(chat_id), current_user["user_id"]
        )
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return ChatResponse(
        chat_id=str(chat["chat_id"]),
        user_id=str(chat["user_id"]),
        title=chat["title"],
        created_at=chat["created_at"],
        updated_at=chat["updated_at"]
    )

@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            'DELETE FROM chats WHERE chat_id = $1 AND user_id = $2',
            uuid.UUID(chat_id), current_user["user_id"]
        )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Chat not found")
    
    return {"message": "Chat deleted successfully"}

@api_router.get("/chats/{chat_id}/messages", response_model=List[MessageResponse])
async def get_chat_messages(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages for a chat"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Verify chat belongs to user
        chat = await conn.fetchrow(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND user_id = $2',
            uuid.UUID(chat_id), current_user["user_id"]
        )
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        messages = await conn.fetch(
            '''SELECT message_id, chat_id, user_id, role, content, model, created_at
               FROM messages WHERE chat_id = $1 ORDER BY created_at ASC''',
            uuid.UUID(chat_id)
        )
    
    return [
        MessageResponse(
            message_id=str(m["message_id"]),
            chat_id=str(m["chat_id"]),
            user_id=str(m["user_id"]),
            role=m["role"],
            content=m["content"],
            model=m["model"],
            created_at=m["created_at"]
        ) for m in messages
    ]

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
        
        # Verify chat exists
        chat = await conn.fetchrow(
            'SELECT chat_id FROM chats WHERE chat_id = $1 AND user_id = $2',
            uuid.UUID(request.chat_id), user_id
        )
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Save user message
        user_msg = await conn.fetchrow(
            '''INSERT INTO messages (chat_id, user_id, role, content, model)
               VALUES ($1, $2, 'user', $3, $4)
               RETURNING message_id, chat_id, user_id, role, content, model, created_at''',
            uuid.UUID(request.chat_id), user_id, request.content, request.model
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
                            "chat_id": request.chat_id,
                            "prompt": request.content,
                            "model": request.model,
                            "current_credits": user["current_credits"]
                        }
                    )
                    response.raise_for_status()
                    data = response.json()
                    ai_response_content = data.get("response", "No response from AI")
                    new_credits = data.get("remaining_credits", user["current_credits"] - 1)
            except Exception as e:
                logger.error(f"n8n webhook error: {e}")
                ai_response_content = f"Error connecting to AI service: {str(e)}"
                new_credits = user["current_credits"] - 1
        else:
            # Deduct 1 credit if n8n not configured (for testing)
            new_credits = max(0, user["current_credits"] - 1)
        
        # Update user credits
        await conn.execute(
            'UPDATE users SET current_credits = $1 WHERE user_id = $2',
            new_credits, user_id
        )
        
        # Save AI message
        ai_msg = await conn.fetchrow(
            '''INSERT INTO messages (chat_id, user_id, role, content, model)
               VALUES ($1, $2, 'assistant', $3, $4)
               RETURNING message_id, chat_id, user_id, role, content, model, created_at''',
            uuid.UUID(request.chat_id), user_id, ai_response_content, request.model
        )
        
        # Update chat timestamp
        await conn.execute(
            'UPDATE chats SET updated_at = NOW(), title = $1 WHERE chat_id = $2',
            request.content[:50] if request.content else "New Chat",
            uuid.UUID(request.chat_id)
        )
    
    return SendMessageResponse(
        user_message=MessageResponse(
            message_id=str(user_msg["message_id"]),
            chat_id=str(user_msg["chat_id"]),
            user_id=str(user_msg["user_id"]),
            role=user_msg["role"],
            content=user_msg["content"],
            model=user_msg["model"],
            created_at=user_msg["created_at"]
        ),
        ai_message=MessageResponse(
            message_id=str(ai_msg["message_id"]),
            chat_id=str(ai_msg["chat_id"]),
            user_id=str(ai_msg["user_id"]),
            role=ai_msg["role"],
            content=ai_msg["content"],
            model=ai_msg["model"],
            created_at=ai_msg["created_at"]
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
# FEEDBACK ENDPOINT
# ============================================================
@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(feedback_data: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    """Submit feedback for a message"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        # Check if feedback already exists
        existing = await conn.fetchrow(
            'SELECT feedback_id FROM feedback WHERE message_id = $1 AND user_id = $2',
            uuid.UUID(feedback_data.message_id), current_user["user_id"]
        )
        
        if existing:
            # Update existing feedback
            feedback = await conn.fetchrow(
                '''UPDATE feedback SET value = $1, created_at = NOW()
                   WHERE message_id = $2 AND user_id = $3
                   RETURNING feedback_id, message_id, user_id, value, created_at''',
                feedback_data.value, uuid.UUID(feedback_data.message_id), current_user["user_id"]
            )
        else:
            # Create new feedback
            feedback = await conn.fetchrow(
                '''INSERT INTO feedback (message_id, user_id, value)
                   VALUES ($1, $2, $3)
                   RETURNING feedback_id, message_id, user_id, value, created_at''',
                uuid.UUID(feedback_data.message_id), current_user["user_id"], feedback_data.value
            )
    
    return FeedbackResponse(
        feedback_id=str(feedback["feedback_id"]),
        message_id=str(feedback["message_id"]),
        user_id=str(feedback["user_id"]),
        value=feedback["value"],
        created_at=feedback["created_at"]
    )

# ============================================================
# PAYMENT ENDPOINTS (DODO PAYMENTS)
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
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # ============================================================
    # TODO: DODO PAYMENTS INTEGRATION
    # ============================================================
    # 1. Initialize Dodo Payments SDK
    # 2. Create payment order with plan details
    # 3. Get checkout URL
    # Example:
    # dodo_client = DodoPayments(api_key=DODO_API_KEY, secret_key=DODO_SECRET_KEY)
    # order = dodo_client.create_order(
    #     amount=plan.price,
    #     currency=plan.currency,
    #     customer_email=current_user["email"],
    #     metadata={"plan_id": plan.id, "user_id": str(current_user["user_id"])}
    # )
    # checkout_url = order.checkout_url
    
    payment_id = str(uuid.uuid4())
    checkout_url = f"https://checkout.dodopayments.com/placeholder/{payment_id}"
    
    async with db_pool.acquire() as conn:
        await conn.execute(
            '''INSERT INTO payments (payment_id, user_id, amount, credits_purchased, plan_name, payment_provider, status)
               VALUES ($1, $2, $3, $4, $5, 'dodo', 'pending')''',
            uuid.UUID(payment_id), current_user["user_id"], plan.price, plan.credits, plan.name
        )
    
    return PaymentResponse(payment_id=payment_id, checkout_url=checkout_url)

@api_router.post("/payments/webhook")
async def payment_webhook(request: Request):
    """Handle Dodo Payments webhook"""
    # ============================================================
    # TODO: VERIFY WEBHOOK SIGNATURE
    # ============================================================
    # signature = request.headers.get("X-Dodo-Signature")
    # body = await request.body()
    # if not verify_dodo_signature(body, signature, DODO_WEBHOOK_SECRET):
    #     raise HTTPException(status_code=400, detail="Invalid signature")
    
    data = await request.json()
    
    payment_id = data.get("payment_id")
    status = data.get("status")
    
    if not payment_id or not status:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        payment = await conn.fetchrow(
            'SELECT user_id, credits_purchased, status FROM payments WHERE payment_id = $1',
            uuid.UUID(payment_id)
        )
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        if payment["status"] == "completed":
            return {"message": "Payment already processed"}
        
        if status == "success" or status == "completed":
            # Update payment status
            await conn.execute(
                "UPDATE payments SET status = 'completed', provider_payment_id = $1 WHERE payment_id = $2",
                data.get("provider_payment_id", ""), uuid.UUID(payment_id)
            )
            
            # Add credits to user
            await conn.execute(
                '''UPDATE users SET 
                   current_credits = current_credits + $1,
                   last_payment_date = NOW()
                   WHERE user_id = $2''',
                payment["credits_purchased"], payment["user_id"]
            )
            
            logger.info(f"Payment {payment_id} completed. Added {payment['credits_purchased']} credits.")
        else:
            await conn.execute(
                "UPDATE payments SET status = $1 WHERE payment_id = $2",
                status, uuid.UUID(payment_id)
            )
    
    return {"message": "Webhook processed"}

@api_router.get("/payments/status/{payment_id}")
async def get_payment_status(payment_id: str, current_user: dict = Depends(get_current_user)):
    """Get payment status"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    async with db_pool.acquire() as conn:
        payment = await conn.fetchrow(
            '''SELECT payment_id, amount, credits_purchased, plan_name, status, created_at
               FROM payments WHERE payment_id = $1 AND user_id = $2''',
            uuid.UUID(payment_id), current_user["user_id"]
        )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {
        "payment_id": str(payment["payment_id"]),
        "amount": float(payment["amount"]),
        "credits_purchased": payment["credits_purchased"],
        "plan_name": payment["plan_name"],
        "status": payment["status"],
        "created_at": payment["created_at"].isoformat()
    }

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
