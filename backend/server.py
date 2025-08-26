from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
import uuid
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-here')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Initialize LLM Chat for translation
emergent_llm_key = os.environ.get('EMERGENT_LLM_KEY')

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    role: Literal["admin", "supervisor", "data_entry"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Literal["admin", "supervisor", "data_entry"]

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class ChallanItem(BaseModel):
    name: str
    quantity: float
    unit: Literal["bags", "kgs"]

class Challan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challan_number: int
    items: List[ChallanItem]
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    items_hindi: Optional[List[Dict]] = None

class ChallanCreate(BaseModel):
    items: List[ChallanItem]

class TranslationRequest(BaseModel):
    text: str

class ReportQuery(BaseModel):
    report_type: Literal["daily", "weekly", "monthly", "yearly", "custom"]
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return User(**user)

async def get_next_challan_number():
    # Get the highest challan number and increment by 1
    last_challan = await db.challans.find_one(sort=[("challan_number", -1)])
    if last_challan:
        return last_challan["challan_number"] + 1
    return 1001  # Starting number

async def translate_to_hindi(text: str) -> str:
    try:
        chat = LlmChat(
            api_key=emergent_llm_key,
            session_id=f"translation-{uuid.uuid4()}",
            system_message="You are a translation expert. Translate the given English text to Hindi. Only provide the Hindi translation, nothing else."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(text=f"Translate to Hindi: {text}")
        response = await chat.send_message(user_message)
        return response.strip()
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # Return original if translation fails

# Routes
@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Hash password and create user
    hashed_password = hash_password(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        role=user_data.role
    )
    
    await db.users.insert_one(user.dict())
    return {"message": "User created successfully"}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is inactive")
    
    access_token = create_access_token({"sub": user["username"]})
    user_info = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    user_dict = current_user.dict()
    user_dict.pop("password_hash", None)
    return user_dict

@api_router.post("/translate", response_model=dict)
async def translate_text(request: TranslationRequest, current_user: User = Depends(get_current_user)):
    hindi_text = await translate_to_hindi(request.text)
    return {"english": request.text, "hindi": hindi_text}

@api_router.post("/challans", response_model=Challan)
async def create_challan(challan_data: ChallanCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor", "data_entry"]:
        raise HTTPException(status_code=403, detail="Not authorized to create challans")
    
    challan_number = await get_next_challan_number()
    
    # Translate items to Hindi
    items_hindi = []
    for item in challan_data.items:
        hindi_name = await translate_to_hindi(item.name)
        hindi_unit = await translate_to_hindi(item.unit)
        items_hindi.append({
            "name": hindi_name,
            "quantity": item.quantity,
            "unit": hindi_unit
        })
    
    challan = Challan(
        challan_number=challan_number,
        items=challan_data.items,
        items_hindi=items_hindi,
        created_by=current_user.username
    )
    
    await db.challans.insert_one(challan.dict())
    return challan

@api_router.get("/challans", response_model=List[Challan])
async def get_challans(current_user: User = Depends(get_current_user)):
    if current_user.role == "data_entry":
        # Data entry users can only see their own challans
        challans = await db.challans.find({"created_by": current_user.username}).sort("created_at", -1).to_list(100)
    else:
        # Admin and supervisor can see all challans
        challans = await db.challans.find().sort("created_at", -1).to_list(100)
    
    return [Challan(**challan) for challan in challans]

@api_router.get("/challans/{challan_id}", response_model=Challan)
async def get_challan(challan_id: str, current_user: User = Depends(get_current_user)):
    challan = await db.challans.find_one({"id": challan_id})
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    
    # Check permissions
    if current_user.role == "data_entry" and challan["created_by"] != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized to view this challan")
    
    return Challan(**challan)

@api_router.delete("/challans/{challan_id}")
async def delete_challan(challan_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete challans")
    
    result = await db.challans.delete_one({"id": challan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challan not found")
    
    return {"message": "Challan deleted successfully"}

@api_router.post("/reports")
async def get_reports(report_query: ReportQuery, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized to view reports")
    
    # Calculate date range based on report type
    now = datetime.now(timezone.utc)
    
    if report_query.report_type == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
    elif report_query.report_type == "weekly":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=7)
    elif report_query.report_type == "monthly":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = start_date.replace(month=start_date.month + 1) if start_date.month < 12 else start_date.replace(year=start_date.year + 1, month=1)
        end_date = next_month
    elif report_query.report_type == "yearly":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date.replace(year=start_date.year + 1)
    elif report_query.report_type == "custom":
        if not report_query.start_date or not report_query.end_date:
            raise HTTPException(status_code=400, detail="Start and end dates required for custom reports")
        start_date = datetime.combine(report_query.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(report_query.end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Query challans in date range
    challans = await db.challans.find({
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(1000)
    
    # Aggregate data
    item_totals = {}
    total_challans = len(challans)
    
    for challan in challans:
        for item in challan["items"]:
            item_key = f"{item['name']} ({item['unit']})"
            if item_key not in item_totals:
                item_totals[item_key] = 0
            item_totals[item_key] += item["quantity"]
    
    return {
        "report_type": report_query.report_type,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_challans": total_challans,
        "item_totals": item_totals,
        "challans": [Challan(**challan) for challan in challans]
    }

@api_router.get("/users", response_model=List[dict])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view users")
    
    users = await db.users.find().to_list(1000)
    return [{k: v for k, v in user.items() if k != "password_hash"} for user in users]

# Initialize admin user on startup
@app.on_event("startup")
async def create_admin_user():
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        admin_user = User(
            username="admin",
            email="admin@challan.com",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        await db.users.insert_one(admin_user.dict())
        print("Admin user created: username=admin, password=admin123")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()