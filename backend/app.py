from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI(title="Tegarty Prime Persistent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# مسار ملف تخزين البيانات الفعلي
DB_FILE = "credentials_db.json"

class AmazonConfig(BaseModel):
    refresh_token: str
    lwa_app_id: str
    lwa_client_secret: str
    aws_access_key: str
    aws_secret_key: str
    role_arn: str

def save_to_file(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f)

def load_from_file():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                return json.load(f)
        except: return None
    return None

@app.post("/api/v1/amazon/save-config")
async def save_config(config: AmazonConfig):
    save_to_file(config.dict())
    return {"status": "success", "message": "تم حفظ الإعدادات بنجاح في قاعدة البيانات ✅"}

@app.get("/api/v1/amazon/get-config")
async def get_config():
    config = load_from_file()
    if config:
        return config
    return {"status": "empty"}

@app.get("/api/v1/dashboard/summary")
async def get_summary():
    config = load_from_file()
    return {
        "total_sales": "4,5 مليون",
        "net_profit": "1,3 مليون",
        "total_orders": 142,
        "is_connected": True if config else False,
        "account_health_score": 196,
        "platforms_chart": [{"month": "مايو", "amazon": 210000, "noon": 85000}]
    }

# Endpoints فارغة لضمان عدم حدوث أخطاء في الـ Sidebar
@app.get("/api/v1/inventory")
async def get_i(): return []
@app.get("/api/v1/pricing")
async def get_p(): return []
@app.get("/api/v1/orders")
async def get_o(): return []