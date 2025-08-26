from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Literal
import uuid
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import re
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Fixed IST Timezone - Indian Standard Time (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Get current time in IST - permanently fixed to Indian timezone"""
    utc_now = datetime.now(timezone.utc)
    return utc_now.astimezone(IST)

def get_ist_date():
    """Get current date in IST"""
    return get_ist_now().date()

# Custom JSON encoder that preserves timezone information
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()  # This preserves timezone info like +05:30
        return super().default(obj)

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

# Define Permission constants
PERMISSIONS = {
    "create_challan": "Create Challans",
    "view_all_challans": "View All Challans", 
    "view_own_challans": "View Own Challans",
    "delete_challan": "Delete Challans",
    "modify_challan": "Modify Challans",
    "view_reports": "View Reports",
    "manage_users": "Manage Users",
    "manage_permissions": "Manage Permissions"
}

# Default permissions for roles
DEFAULT_PERMISSIONS = {
    "admin": list(PERMISSIONS.keys()),
    "supervisor": ["create_challan", "view_all_challans", "delete_challan", "modify_challan", "view_reports"],
    "data_entry": ["create_challan", "view_own_challans"]
}

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    role: Literal["admin", "supervisor", "data_entry"]
    permissions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=get_ist_now)
    is_active: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

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

class ChallanTotals(BaseModel):
    total_bags: float = 0.0
    total_kgs: float = 0.0

class Challan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challan_number: str
    vehicle_no: Optional[str] = None  # Made optional for backward compatibility
    items: List[ChallanItem]
    totals: ChallanTotals
    created_by: str
    created_at: datetime = Field(default_factory=get_ist_now)
    items_hindi: Optional[List[Dict]] = None
    vehicle_no_hindi: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ChallanCreate(BaseModel):
    vehicle_no: str
    items: List[ChallanItem]
    
    @validator('vehicle_no')
    def validate_vehicle_no(cls, v):
        # Validate vehicle number format: XX-XX-XX-XXXX
        pattern = r'^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{4}$'
        if not re.match(pattern, v.upper()):
            raise ValueError('Vehicle number must be in format XX-XX-XX-XXXX (e.g., MH-12-AB-1234)')
        return v.upper()

class TranslationRequest(BaseModel):
    text: str

class ReportQuery(BaseModel):
    report_type: Literal["daily", "weekly", "monthly", "yearly", "custom"]
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class UserPermissionUpdate(BaseModel):
    user_id: str
    permissions: List[str]

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = get_ist_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
    
    # Convert ObjectId to string and remove _id field for Pydantic
    if "_id" in user:
        user.pop("_id")
    
    return User(**user)

def check_permission(user: User, permission: str) -> bool:
    """Check if user has specific permission"""
    return permission in user.permissions

def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(current_user: User = Depends(get_current_user)):
        if not check_permission(current_user, permission):
            raise HTTPException(status_code=403, detail=f"Permission '{permission}' required")
        return current_user
    return decorator

async def get_next_challan_number():
    """Get next challan number with YYYY/MM/DD-XXX format that resets daily"""
    today = get_ist_date()
    date_prefix = today.strftime("%Y/%m/%d")
    
    # Find the highest challan number for today using IST timezone
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=IST)
    today_end = today_start + timedelta(days=1)
    
    last_challan = await db.challans.find_one(
        {"created_at": {"$gte": today_start, "$lt": today_end}},
        sort=[("created_at", -1)]
    )
    
    if last_challan:
        # Extract the sequence number from the last challan
        last_number = last_challan["challan_number"]
        sequence_part = last_number.split("-")[-1]
        next_sequence = int(sequence_part) + 1
    else:
        next_sequence = 1
    
    # Format: YYYY/MM/DD-XXX (3 digit sequence)
    return f"{date_prefix}-{next_sequence:03d}"

def calculate_totals(items: List[ChallanItem]) -> ChallanTotals:
    """Calculate total bags and kgs from items"""
    total_bags = sum(item.quantity for item in items if item.unit == "bags")
    total_kgs = sum(item.quantity for item in items if item.unit == "kgs")
    return ChallanTotals(total_bags=total_bags, total_kgs=total_kgs)

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
    
    # Hash password and create user with default permissions
    hashed_password = hash_password(user_data.password)
    default_perms = DEFAULT_PERMISSIONS.get(user_data.role, [])
    
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        role=user_data.role,
        permissions=default_perms
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
    
    # Ensure user has permissions (for existing users)
    if "permissions" not in user or not user["permissions"]:
        default_perms = DEFAULT_PERMISSIONS.get(user["role"], [])
        await db.users.update_one(
            {"username": user["username"]},
            {"$set": {"permissions": default_perms}}
        )
        user["permissions"] = default_perms
    
    access_token = create_access_token({"sub": user["username"]})
    # Convert ObjectId to string and remove MongoDB _id field
    user_info = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
    if "_id" in user:
        user_info["_id"] = str(user["_id"])
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_info
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    user_dict = current_user.dict()
    user_dict.pop("password_hash", None)
    user_dict.pop("_id", None)  # Remove MongoDB _id if present
    return user_dict

@api_router.post("/translate", response_model=dict)
async def translate_text(request: TranslationRequest, current_user: User = Depends(get_current_user)):
    hindi_text = await translate_to_hindi(request.text)
    return {"english": request.text, "hindi": hindi_text}

@api_router.post("/challans")
async def create_challan(challan_data: ChallanCreate, current_user: User = Depends(require_permission("create_challan"))):
    challan_number = await get_next_challan_number()
    
    # Calculate totals
    totals = calculate_totals(challan_data.items)
    
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
    
    # Translate vehicle number label to Hindi
    vehicle_no_hindi = await translate_to_hindi("Vehicle No")
    
    # Add totals to Hindi items
    hindi_totals = {
        "total_bags": totals.total_bags,
        "total_kgs": totals.total_kgs,
        "total_bags_hindi": await translate_to_hindi("Total Bags"),
        "total_kgs_hindi": await translate_to_hindi("Total Kgs")
    }
    
    # Create IST timestamp
    ist_now = get_ist_now()
    
    challan = {
        "id": str(uuid.uuid4()),
        "challan_number": challan_number,
        "vehicle_no": challan_data.vehicle_no,
        "items": [item.dict() for item in challan_data.items],
        "totals": totals.dict(),
        "items_hindi": items_hindi,
        "vehicle_no_hindi": vehicle_no_hindi,
        "created_by": current_user.username,
        "created_at": ist_now,  # Store IST datetime
        "hindi_totals": hindi_totals
    }
    
    await db.challans.insert_one(challan)
    
    # Return response with preserved timezone
    response_data = challan.copy()
    response_data["created_at"] = ist_now.isoformat()  # Manually format to preserve timezone
    
    return JSONResponse(content=response_data)

@api_router.get("/challans", response_model=List[Challan])
async def get_challans(current_user: User = Depends(get_current_user)):
    if check_permission(current_user, "view_all_challans"):
        # User can see all challans
        challans = await db.challans.find().sort("created_at", -1).to_list(100)
    elif check_permission(current_user, "view_own_challans"):
        # User can only see their own challans
        challans = await db.challans.find({"created_by": current_user.username}).sort("created_at", -1).to_list(100)
    else:
        raise HTTPException(status_code=403, detail="No permission to view challans")
    
    # Handle backward compatibility for challans without vehicle_no
    processed_challans = []
    for challan in challans:
        if "vehicle_no" not in challan:
            challan["vehicle_no"] = None
        processed_challans.append(Challan(**challan))
    
    return processed_challans

@api_router.get("/challans/{challan_id}", response_model=Challan)
async def get_challan(challan_id: str, current_user: User = Depends(get_current_user)):
    challan = await db.challans.find_one({"id": challan_id})
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    
    # Check permissions
    can_view_all = check_permission(current_user, "view_all_challans")
    can_view_own = check_permission(current_user, "view_own_challans")
    
    if not can_view_all and (not can_view_own or challan["created_by"] != current_user.username):
        raise HTTPException(status_code=403, detail="Not authorized to view this challan")
    
    return Challan(**challan)

@api_router.delete("/challans/{challan_id}")
async def delete_challan(challan_id: str, current_user: User = Depends(require_permission("delete_challan"))):
    result = await db.challans.delete_one({"id": challan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challan not found")
    
    return {"message": "Challan deleted successfully"}

@api_router.post("/reports")
async def get_reports(report_query: ReportQuery, current_user: User = Depends(require_permission("view_reports"))):
    # Calculate date range based on report type (all in IST)
    now = get_ist_now()
    
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
        start_date = datetime.combine(report_query.start_date, datetime.min.time()).replace(tzinfo=IST)
        end_date = datetime.combine(report_query.end_date, datetime.max.time()).replace(tzinfo=IST)
    
    # Query challans in date range
    challans = await db.challans.find({
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(1000)
    
    # Aggregate data
    item_totals = {}
    total_challans = len(challans)
    total_bags_all = 0.0
    total_kgs_all = 0.0
    
    for challan in challans:
        for item in challan["items"]:
            item_key = f"{item['name']} ({item['unit']})"
            if item_key not in item_totals:
                item_totals[item_key] = 0
            item_totals[item_key] += item["quantity"]
        
        # Add to overall totals
        if "totals" in challan:
            total_bags_all += challan["totals"].get("total_bags", 0)
            total_kgs_all += challan["totals"].get("total_kgs", 0)
    
    # Handle backward compatibility for challans without vehicle_no
    processed_challans = []
    for challan in challans:
        if "vehicle_no" not in challan:
            challan["vehicle_no"] = None
        processed_challans.append(Challan(**challan))
    
    return {
        "report_type": report_query.report_type,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_challans": total_challans,
        "total_bags_all": total_bags_all,
        "total_kgs_all": total_kgs_all,
        "item_totals": item_totals,
        "challans": processed_challans
    }

@api_router.get("/users", response_model=List[dict])
async def get_users(current_user: User = Depends(require_permission("manage_users"))):
    users = await db.users.find().to_list(1000)
    # Clean up ObjectId fields for each user
    clean_users = []
    for user in users:
        clean_user = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
        if "_id" in user:
            clean_user["_id"] = str(user["_id"])
        clean_users.append(clean_user)
    return clean_users

@api_router.get("/permissions")
async def get_available_permissions(current_user: User = Depends(require_permission("manage_permissions"))):
    return {"permissions": PERMISSIONS}

@api_router.put("/users/{user_id}/permissions")
async def update_user_permissions(user_id: str, permission_update: UserPermissionUpdate, current_user: User = Depends(require_permission("manage_permissions"))):
    # Validate permissions
    valid_permissions = set(PERMISSIONS.keys())
    invalid_permissions = set(permission_update.permissions) - valid_permissions
    if invalid_permissions:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {list(invalid_permissions)}")
    
    # Update user permissions
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"permissions": permission_update.permissions}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User permissions updated successfully"}

# Initialize admin user on startup
@app.on_event("startup")
async def create_admin_user():
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        admin_user = User(
            username="admin",
            email="admin@challan.com",
            password_hash=hash_password("admin123"),
            role="admin",
            permissions=DEFAULT_PERMISSIONS["admin"]
        )
        await db.users.insert_one(admin_user.dict())
        print(f"Admin user created: username=admin, password=admin123")
        print(f"Current IST time: {get_ist_now().isoformat()}")

# Include the router in the main app
app.include_router(api_router)

# Custom response middleware to preserve datetime timezone information
@app.middleware("http")
async def custom_response_middleware(request, call_next):
    response = await call_next(request)
    return response

# Override JSONResponse to use custom encoder
def custom_jsonable_encoder(obj):
    """Custom encoder that preserves datetime timezone information"""
    if isinstance(obj, datetime):
        return obj.isoformat()  # Preserves timezone like +05:30
    elif isinstance(obj, list):
        return [custom_jsonable_encoder(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: custom_jsonable_encoder(value) for key, value in obj.items()}
    elif hasattr(obj, '__dict__'):
        return custom_jsonable_encoder(obj.__dict__)
    else:
        return jsonable_encoder(obj)

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