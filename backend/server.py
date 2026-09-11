from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, ReturnDocument
import os
import logging
import uuid
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta, time as dtime
from typing import List, Optional, Literal
from enum import Enum

import jwt
from pwdlib import PasswordHash
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'campuscrave-dev-secret-change-me')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_DAYS = 7

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("dummy-never-used-password")
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="CampusCrave API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("campuscrave")


# ---------------------------------------------------------------------------
# Enums & Models
# ---------------------------------------------------------------------------
class Role(str, Enum):
    STUDENT = "STUDENT"
    KITCHEN_STAFF = "KITCHEN_STAFF"
    ADMIN = "ADMIN"


class OrderStatus(str, Enum):
    PLACED = "PLACED"
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    COLLECTED = "COLLECTED"
    CANCELLED = "CANCELLED"


STATUS_FLOW = [
    OrderStatus.PLACED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.COLLECTED,
]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    role: Optional[Role] = Role.STUDENT  # allowed here for demo so kitchen/admin can self-register


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CartItemIn(BaseModel):
    menu_item_id: str
    qty: int = Field(ge=1, le=20)


class CreateOrderRequest(BaseModel):
    items: List[CartItemIn]
    slot_id: str
    payment_method: Literal["UPI", "CAMPUS_CARD", "CASH"]


class StatusUpdateRequest(BaseModel):
    status: OrderStatus


class StockToggleRequest(BaseModel):
    in_stock: bool


class MenuItemIn(BaseModel):
    name: str
    description: str = ""
    price: float = Field(ge=0)
    category: str
    dietary: Literal["VEG", "NON_VEG"]
    image_url: str = ""
    in_stock: bool = True
    available_from: str = "00:00"   # HH:MM
    available_until: str = "23:59"  # HH:MM


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    dietary: Optional[Literal["VEG", "NON_VEG"]] = None
    image_url: Optional[str] = None
    in_stock: Optional[bool] = None
    available_from: Optional[str] = None
    available_until: Optional[str] = None


class SlotCapacityRequest(BaseModel):
    capacity: int = Field(ge=0, le=500)


class RatingRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=280)


# ---------------------------------------------------------------------------
# Realtime WebSocket connection manager (live order tracker push)
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.by_order: dict = {}

    async def connect(self, ws: WebSocket, order_id: str):
        await ws.accept()
        self.by_order.setdefault(order_id, set()).add(ws)

    def disconnect(self, ws: WebSocket, order_id: str):
        conns = self.by_order.get(order_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self.by_order.pop(order_id, None)

    async def broadcast(self, order_id: str, message: dict):
        for ws in list(self.by_order.get(order_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws, order_id)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": now_utc(),
        "exp": now_utc() + timedelta(days=ACCESS_TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user or user.get("disabled"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


def require_roles(*allowed: Role):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in {r.value for r in allowed}:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}


def _hhmm_to_time(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


def is_item_available_now(item: dict) -> bool:
    """Time-based availability check using local server time (HH:MM window)."""
    now_local = datetime.now().time()
    try:
        start = _hhmm_to_time(item.get("available_from", "00:00"))
        end = _hhmm_to_time(item.get("available_until", "23:59"))
    except Exception:
        return True
    return start <= now_local <= end


def serialize_menu_item(item: dict) -> dict:
    within_window = is_item_available_now(item)
    return {
        "id": item["id"],
        "name": item["name"],
        "description": item.get("description", ""),
        "price": item["price"],
        "category": item["category"],
        "dietary": item["dietary"],
        "image_url": item.get("image_url", ""),
        "in_stock": item.get("in_stock", True),
        "available_from": item.get("available_from", "00:00"),
        "available_until": item.get("available_until", "23:59"),
        "within_time_window": within_window,
        "available": item.get("in_stock", True) and within_window,
    }


def slot_status(booked: int, capacity: int) -> str:
    if capacity <= 0:
        return "FULL"
    ratio = booked / capacity
    if booked >= capacity:
        return "FULL"
    if ratio >= 0.7:
        return "FILLING"
    return "OPEN"


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


async def ensure_slots_current():
    """Daily slot reset: if the stored slot-day is not today, reset booked
    counts to 0 for all slots so capacity is accurate every new day."""
    today = today_str()
    meta = await db.meta.find_one({"key": "slot_day"})
    if meta and meta.get("value") == today:
        return
    await db.time_slots.update_many({}, {"$set": {"booked": 0, "day": today}})
    await db.meta.update_one(
        {"key": "slot_day"}, {"$set": {"value": today}}, upsert=True
    )
    logger.info(f"Slots reset for {today}")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register", status_code=201)
async def register(body: RegisterRequest):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "password_hash": password_hash.hash(body.password),
        "role": (body.role or Role.STUDENT).value,
        "disabled": False,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    return {"access_token": create_token(user), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        password_hash.verify(body.password, DUMMY_HASH)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not password_hash.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_token(user), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------------------
# Menu routes
# ---------------------------------------------------------------------------
@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", ASCENDING).to_list(100)
    return cats


@api_router.get("/menu")
async def get_menu(user: dict = Depends(get_current_user)):
    items = await db.menu_items.find({"deleted_at": None}, {"_id": 0}).to_list(1000)
    return [serialize_menu_item(i) for i in items]


# ---------------------------------------------------------------------------
# Slot routes
# ---------------------------------------------------------------------------
@api_router.get("/slots")
async def get_slots(user: dict = Depends(get_current_user)):
    await ensure_slots_current()
    slots = await db.time_slots.find({}, {"_id": 0}).sort("start_min", ASCENDING).to_list(100)
    out = []
    for s in slots:
        booked = s.get("booked", 0)
        cap = s.get("capacity", 0)
        out.append({
            "id": s["id"],
            "label": s["label"],
            "part_of_day": s.get("part_of_day", "Afternoon"),
            "capacity": cap,
            "booked": booked,
            "remaining": max(cap - booked, 0),
            "status": slot_status(booked, cap),
        })
    return out


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
@api_router.post("/orders", status_code=201)
async def create_order(body: CreateOrderRequest, user: dict = Depends(require_roles(Role.STUDENT, Role.ADMIN))):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    await ensure_slots_current()

    # 1. Validate + price items server-side (never trust client prices)
    order_items = []
    total = 0.0
    for ci in body.items:
        item = await db.menu_items.find_one({"id": ci.menu_item_id, "deleted_at": None})
        if not item:
            raise HTTPException(status_code=404, detail=f"Item not found: {ci.menu_item_id}")
        if not item.get("in_stock", True) or not is_item_available_now(item):
            raise HTTPException(status_code=409, detail=f"'{item['name']}' is currently unavailable")
        line_total = item["price"] * ci.qty
        total += line_total
        order_items.append({
            "menu_item_id": item["id"],
            "name": item["name"],
            "price": item["price"],
            "dietary": item["dietary"],
            "qty": ci.qty,
        })

    # 2. Atomically reserve slot capacity (prevents overbooking under concurrency).
    #    find_one_and_update on a single doc is atomic on standalone MongoDB and
    #    only increments 'booked' while booked < capacity.
    slot = await db.time_slots.find_one_and_update(
        {"id": body.slot_id, "$expr": {"$lt": ["$booked", "$capacity"]}},
        {"$inc": {"booked": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not slot:
        exists = await db.time_slots.find_one({"id": body.slot_id})
        if not exists:
            raise HTTPException(status_code=404, detail="Time slot not found")
        raise HTTPException(status_code=409, detail="Selected pickup slot is full. Please pick another slot.")

    # 3. Create the order
    ts = now_utc()
    token = "CC-" + str(random.randint(1000, 9999)) + "-" + uuid.uuid4().hex[:4].upper()
    order = {
        "id": str(uuid.uuid4()),
        "token": token,
        "user_id": user["id"],
        "user_name": user["name"],
        "items": order_items,
        "total": round(total, 2),
        "slot_id": slot["id"],
        "slot_label": slot["label"],
        "slot_start_min": slot.get("start_min", 0),
        "payment_method": body.payment_method,
        "status": OrderStatus.PLACED.value,
        "status_history": [{"status": OrderStatus.PLACED.value, "at": ts.isoformat()}],
        "rating": None,
        "rating_comment": None,
        "created_at": ts.isoformat(),
        "updated_at": ts.isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    return order


@api_router.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == Role.STUDENT.value and order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    return order


# ---------------------------------------------------------------------------
# Kitchen
# ---------------------------------------------------------------------------
@api_router.get("/kitchen/orders")
async def kitchen_orders(user: dict = Depends(require_roles(Role.KITCHEN_STAFF, Role.ADMIN))):
    active = [OrderStatus.PLACED.value, OrderStatus.PREPARING.value, OrderStatus.READY_FOR_PICKUP.value]
    orders = await db.orders.find({"status": {"$in": active}}, {"_id": 0}).to_list(500)
    orders.sort(key=lambda o: (o.get("slot_start_min", 0), o.get("created_at", "")))

    # Batch aggregator across active orders
    agg: dict = {}
    for o in orders:
        for it in o["items"]:
            key = it["name"]
            agg[key] = agg.get(key, 0) + it["qty"]
    aggregate = [{"name": k, "qty": v} for k, v in sorted(agg.items(), key=lambda x: -x[1])]

    return {"orders": orders, "aggregate": aggregate}


@api_router.patch("/orders/{order_id}/status")
async def advance_status(order_id: str, body: StatusUpdateRequest,
                         user: dict = Depends(require_roles(Role.KITCHEN_STAFF, Role.ADMIN))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ts = now_utc()
    new_status = body.status.value
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {"status": new_status, "updated_at": ts.isoformat()},
            "$push": {"status_history": {"status": new_status, "at": ts.isoformat()}},
        },
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    # Push instant update to any live order-tracker subscribers
    await manager.broadcast(order_id, {"type": "status", "order_id": order_id, "status": new_status})
    return updated


@api_router.post("/orders/{order_id}/rating")
async def rate_order(order_id: str, body: RatingRequest, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == Role.STUDENT.value and order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order["status"] != OrderStatus.COLLECTED.value:
        raise HTTPException(status_code=409, detail="You can rate an order after it is collected")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"rating": body.rating, "rating_comment": body.comment.strip(), "rated_at": now_utc().isoformat()}},
    )
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.websocket("/ws")
async def ws_order_updates(websocket: WebSocket, order_id: str):
    await manager.connect(websocket, order_id)
    try:
        while True:
            # Keep the socket open; ignore any inbound messages (heartbeat/ping).
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, order_id)
    except Exception:
        manager.disconnect(websocket, order_id)


# ---------------------------------------------------------------------------
# Stock toggle (Kitchen + Admin) - fast 86'ing
# ---------------------------------------------------------------------------
@api_router.patch("/menu/{item_id}/stock")
async def toggle_stock(item_id: str, body: StockToggleRequest,
                       user: dict = Depends(require_roles(Role.KITCHEN_STAFF, Role.ADMIN))):
    result = await db.menu_items.update_one(
        {"id": item_id, "deleted_at": None}, {"$set": {"in_stock": body.in_stock}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return serialize_menu_item(item)


# ---------------------------------------------------------------------------
# Admin - Menu CRUD
# ---------------------------------------------------------------------------
@api_router.post("/admin/menu", status_code=201)
async def create_menu_item(body: MenuItemIn, user: dict = Depends(require_roles(Role.ADMIN))):
    item = body.model_dump()
    item["id"] = str(uuid.uuid4())
    item["deleted_at"] = None
    item["created_at"] = now_utc().isoformat()
    await db.menu_items.insert_one(item)
    item.pop("_id", None)
    return serialize_menu_item(item)


@api_router.patch("/admin/menu/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate, user: dict = Depends(require_roles(Role.ADMIN))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.menu_items.update_one({"id": item_id, "deleted_at": None}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    return serialize_menu_item(item)


@api_router.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(require_roles(Role.ADMIN))):
    result = await db.menu_items.update_one(
        {"id": item_id, "deleted_at": None}, {"$set": {"deleted_at": now_utc().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin - Slot throttling
# ---------------------------------------------------------------------------
@api_router.patch("/admin/slots/{slot_id}")
async def set_slot_capacity(slot_id: str, body: SlotCapacityRequest, user: dict = Depends(require_roles(Role.ADMIN))):
    result = await db.time_slots.update_one({"id": slot_id}, {"$set": {"capacity": body.capacity}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot = await db.time_slots.find_one({"id": slot_id}, {"_id": 0})
    booked = slot.get("booked", 0)
    cap = slot.get("capacity", 0)
    return {"id": slot["id"], "label": slot["label"], "capacity": cap, "booked": booked,
            "remaining": max(cap - booked, 0), "status": slot_status(booked, cap)}


# ---------------------------------------------------------------------------
# Admin - Analytics
# ---------------------------------------------------------------------------
@api_router.get("/admin/analytics")
async def analytics(user: dict = Depends(require_roles(Role.ADMIN))):
    orders = await db.orders.find({"status": {"$ne": OrderStatus.CANCELLED.value}}, {"_id": 0}).to_list(5000)

    total_revenue = round(sum(o["total"] for o in orders), 2)
    total_orders = len(orders)
    avg_order = round(total_revenue / total_orders, 2) if total_orders else 0.0

    # Revenue & count per pickup slot (peak interval distribution)
    by_slot: dict = {}
    for o in orders:
        key = o.get("slot_label", "—")
        entry = by_slot.setdefault(key, {"label": key, "start": o.get("slot_start_min", 0), "orders": 0, "revenue": 0.0})
        entry["orders"] += 1
        entry["revenue"] += o["total"]
    peak = sorted(by_slot.values(), key=lambda x: x["start"])
    for p in peak:
        p["revenue"] = round(p["revenue"], 2)

    # Top sellers
    sellers: dict = {}
    for o in orders:
        for it in o["items"]:
            entry = sellers.setdefault(it["name"], {"name": it["name"], "qty": 0, "revenue": 0.0})
            entry["qty"] += it["qty"]
            entry["revenue"] += it["price"] * it["qty"]
    top_sellers = sorted(sellers.values(), key=lambda x: -x["qty"])[:6]
    for t in top_sellers:
        t["revenue"] = round(t["revenue"], 2)

    # Status breakdown
    status_counts: dict = {}
    for o in orders:
        status_counts[o["status"]] = status_counts.get(o["status"], 0) + 1

    # Ratings & feedback
    rated = [o for o in orders if o.get("rating")]
    rated_count = len(rated)
    avg_rating = round(sum(o["rating"] for o in rated) / rated_count, 2) if rated_count else 0.0
    recent_feedback = [
        {
            "order_token": o["token"],
            "user_name": o.get("user_name", ""),
            "rating": o["rating"],
            "comment": o.get("rating_comment", ""),
        }
        for o in sorted(rated, key=lambda x: x.get("rated_at", ""), reverse=True)[:8]
    ]

    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "avg_order": avg_order,
        "peak_intervals": peak,
        "top_sellers": top_sellers,
        "status_counts": status_counts,
        "avg_rating": avg_rating,
        "rated_count": rated_count,
        "recent_feedback": recent_feedback,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "CampusCrave API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data (idempotent)
# ---------------------------------------------------------------------------
CATEGORIES_SEED = [
    {"id": "cat-meals", "name": "Meals", "order": 1},
    {"id": "cat-snacks", "name": "Snacks", "order": 2},
    {"id": "cat-beverages", "name": "Beverages", "order": 3},
]

MENU_SEED = [
    {"id": "m-veg-burger", "name": "Veg Burger", "description": "Crispy patty, lettuce, house sauce", "price": 90, "category": "Meals", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "m-chicken-burger", "name": "Chicken Burger", "description": "Grilled chicken, cheese, mayo", "price": 130, "category": "Meals", "dietary": "NON_VEG", "image_url": "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "m-paneer-wrap", "name": "Paneer Wrap", "description": "Spiced paneer, veggies, mint", "price": 110, "category": "Meals", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "m-veg-thali", "name": "Veg Thali", "description": "Dal, sabzi, roti, rice, salad", "price": 150, "category": "Meals", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "m-masala-dosa", "name": "Masala Dosa", "description": "Crispy dosa, potato masala, chutney", "price": 80, "category": "Meals", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "11:00"},
    {"id": "s-fries", "name": "French Fries", "description": "Golden salted fries", "price": 60, "category": "Snacks", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "s-samosa", "name": "Samosa (2 pc)", "description": "Crispy spiced potato samosas", "price": 40, "category": "Snacks", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "s-nuggets", "name": "Chicken Nuggets", "description": "6 pc crispy nuggets", "price": 100, "category": "Snacks", "dietary": "NON_VEG", "image_url": "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "s-maggi", "name": "Masala Maggi", "description": "Hot buttery masala noodles", "price": 50, "category": "Snacks", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "b-cold-coffee", "name": "Cold Coffee", "description": "Chilled creamy cold coffee", "price": 70, "category": "Beverages", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "b-masala-chai", "name": "Masala Chai", "description": "Spiced Indian tea", "price": 20, "category": "Beverages", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
    {"id": "b-lemonade", "name": "Fresh Lemonade", "description": "Zesty mint lemonade", "price": 40, "category": "Beverages", "dietary": "VEG", "image_url": "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&q=80", "in_stock": True, "available_from": "00:00", "available_until": "23:59"},
]

DEMO_USERS = [
    {"email": "parthj8328@gmail.com", "name": "Parth Jadhav", "password": "password123", "role": "STUDENT"},
    {"email": "chavanritesh2207@gmail.com", "name": "Ritesh Chavan", "password": "password123", "role": "KITCHEN_STAFF"},
    {"email": "priticchavan2105@gmail.com", "name": "Priti Chavan", "password": "password123", "role": "ADMIN"},
]


def build_slots() -> list:
    """15-minute pickup slots from 11:00 to 15:00."""
    slots = []
    for total_min in range(11 * 60, 15 * 60, 15):
        start_h, start_m = divmod(total_min, 60)
        end_min = total_min + 15
        end_h, end_m = divmod(end_min, 60)

        def fmt(h, m):
            suffix = "AM" if h < 12 else "PM"
            hh = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
            return f"{hh}:{m:02d} {suffix}"

        label = f"{fmt(start_h, start_m)} – {fmt(end_h, end_m)}"
        part = "Morning" if start_h < 12 else "Afternoon"
        slots.append({
            "id": f"slot-{start_h:02d}{start_m:02d}",
            "label": label,
            "part_of_day": part,
            "start_min": total_min,
            "capacity": 10,
            "booked": 0,
            "day": today_str(),
        })
    return slots


@app.on_event("startup")
async def seed_data():
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.menu_items.create_index([("id", ASCENDING)], unique=True)
    await db.orders.create_index([("id", ASCENDING)], unique=True)
    await db.orders.create_index([("status", ASCENDING)])

    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([dict(c) for c in CATEGORIES_SEED])
        logger.info("Seeded categories")

    if await db.menu_items.count_documents({}) == 0:
        docs = []
        for m in MENU_SEED:
            d = dict(m)
            d["deleted_at"] = None
            d["created_at"] = now_utc().isoformat()
            docs.append(d)
        await db.menu_items.insert_many(docs)
        logger.info("Seeded menu items")

    if await db.time_slots.count_documents({}) == 0:
        await db.time_slots.insert_many(build_slots())
        logger.info("Seeded time slots")

    await ensure_slots_current()

    for u in DEMO_USERS:
        if not await db.users.find_one({"email": u["email"]}):
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid,
                "user_id": uid,
                "email": u["email"],
                "name": u["name"],
                "password_hash": password_hash.hash(u["password"]),
                "role": u["role"],
                "disabled": False,
                "created_at": now_utc().isoformat(),
            })
            logger.info(f"Seeded demo user {u['email']}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
