"""
Tegarty Prime Backend — v2.0
Real Amazon SP-API integration + Data Transformer + Repricer Logic + Notifications
"""

from fastapi import FastAPI, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json, os, logging
from datetime import datetime, timedelta

# ── Amazon SP-API ──────────────────────────────────────────────────────────────
from sp_api.api import Orders, Inventories, ProductPricing, Sellers
from sp_api.base import SellingApiException, Marketplaces
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tegarty")

app = FastAPI(title="Tegarty Prime API v2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Storage Files ──────────────────────────────────────────────────────────────
DB_FILE        = "credentials_db.json"
CACHE_FILE     = "dashboard_cache.json"
ALERTS_FILE    = "alerts_config.json"
REPRICING_FILE = "repricing_rules.json"

# ── Egypt Marketplace ──────────────────────────────────────────────────────────
# غيّرها لـ Marketplaces.US لو حساب أمريكا
MARKETPLACE = Marketplaces.EG

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class AmazonConfig(BaseModel):
    refresh_token: str
    lwa_app_id: str
    lwa_client_secret: str
    aws_access_key: str
    aws_secret_key: str
    role_arn: str

class RepricingRule(BaseModel):
    asin: str
    sku: str = ""
    floor_price: float
    target_margin: float = 20.0
    undercut_by: float = 0.50
    active: bool = True

class AlertConfig(BaseModel):
    low_stock_threshold: int = 5
    buy_box_alert: bool = True
    late_shipment_alert: bool = True

# ══════════════════════════════════════════════════════════════════════════════
# FILE HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def save_file(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_file(path: str):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def get_credentials() -> Optional[dict]:
    """Build SP-API credentials dict from saved config file."""
    cfg = load_file(DB_FILE)
    if not cfg:
        return None
    return {
        "lwa_app_id":        cfg.get("lwa_app_id"),
        "lwa_client_secret": cfg.get("lwa_client_secret"),
        "aws_access_key":    cfg.get("aws_access_key"),
        "aws_secret_key":    cfg.get("aws_secret_key"),
        "role_arn":          cfg.get("role_arn"),
        "refresh_token":     cfg.get("refresh_token"),
    }

# ══════════════════════════════════════════════════════════════════════════════
# DATA TRANSFORMER  — Amazon raw → Tegarty standard format
# ══════════════════════════════════════════════════════════════════════════════

def transform_order(raw: dict) -> dict:
    """Normalize one Amazon order into Tegarty standard schema."""
    total_obj  = raw.get("OrderTotal", {})
    ship_addr  = raw.get("ShippingAddress", {})
    return {
        "id":           raw.get("AmazonOrderId"),
        "platform":     "amazon",
        "status":       raw.get("OrderStatus"),
        "total":        float(total_obj.get("Amount", 0)),
        "currency":     total_obj.get("CurrencyCode", "EGP"),
        "items_count":  int(raw.get("NumberOfItemsShipped", 0)) + int(raw.get("NumberOfItemsUnshipped", 0)),
        "buyer_city":   ship_addr.get("City", "—"),
        "buyer_state":  ship_addr.get("StateOrRegion", "—"),
        "created_at":   raw.get("PurchaseDate", ""),
        "is_late":      _is_late_shipment(raw),
        "fulfillment":  raw.get("FulfillmentChannel", "—"),  # AFN = FBA, MFN = خودك
    }

def transform_inventory_item(raw: dict) -> dict:
    """Normalize one FBA inventory summary."""
    details = raw.get("inventoryDetails", {})
    return {
        "asin":     raw.get("asin", ""),
        "sku":      raw.get("sellerSku", ""),
        "title":    raw.get("productName", "—"),
        "qty":      details.get("fulfillableQuantity", 0),
        "reserved": details.get("reservedQuantity", {}).get("totalReservedQuantity", 0),
        "inbound":  details.get("inboundWorkingQuantity", 0),
        "platform": "amazon",
    }

def _is_late_shipment(order: dict) -> bool:
    ship_by = order.get("LatestShipDate", "")
    if not ship_by:
        return False
    try:
        deadline = datetime.fromisoformat(ship_by.replace("Z", "+00:00"))
        return (
            datetime.now(deadline.tzinfo) > deadline
            and order.get("OrderStatus") == "Unshipped"
        )
    except Exception:
        return False

# ══════════════════════════════════════════════════════════════════════════════
# ALERT ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def generate_alerts(orders: list, inventory: list) -> list:
    alerts    = []
    cfg       = load_file(ALERTS_FILE) or {}
    threshold = cfg.get("low_stock_threshold", 5)

    # Late shipments alert
    late = [o for o in orders if o.get("is_late")]
    if late:
        alerts.append({
            "type":     "late_shipment",
            "severity": "critical",
            "title":    "Late Shipments",
            "message":  f"يوجد {len(late)} طلبات متأخرة تحتاج شحن فوري",
            "count":    len(late),
        })

    # Low stock alerts (أول 5 بس)
    low_items = [i for i in inventory if 0 < i.get("qty", 0) <= threshold]
    for item in low_items[:5]:
        alerts.append({
            "type":     "low_stock",
            "severity": "warning",
            "title":    "مخزون منخفض",
            "message":  f'"{item.get("title","")[:40]}" — باقي {item.get("qty")} قطع',
            "sku":      item.get("sku"),
        })

    # Out of stock alert
    out_of_stock = [i for i in inventory if i.get("qty", 0) == 0]
    if out_of_stock:
        alerts.append({
            "type":     "out_of_stock",
            "severity": "critical",
            "title":    "نفاد المخزون",
            "message":  f"{len(out_of_stock)} منتجات وصلت للصفر — خطر فقدان الـ Buy Box",
            "count":    len(out_of_stock),
        })

    return alerts

# ══════════════════════════════════════════════════════════════════════════════
# REPRICER LOGIC
# ══════════════════════════════════════════════════════════════════════════════

def compute_new_price(my_price: float, competitor_price: float, rule: dict) -> Optional[float]:
    """
    إذا المنافس أرخص مني → انزل تحته بـ undercut_by جنيه
    لكن لازم السعر يفضل فوق الـ floor_price دايماً
    """
    floor    = float(rule.get("floor_price", 0))
    undercut = float(rule.get("undercut_by", 0.50))

    if competitor_price < my_price:
        new_price = round(competitor_price - undercut, 2)
        return max(new_price, floor)  # مش تنزل تحت الـ floor

    return None  # أنا أرخص — مفيش تغيير

# ══════════════════════════════════════════════════════════════════════════════
# AMAZON SP-API CALLS
# ══════════════════════════════════════════════════════════════════════════════

def fetch_orders(credentials: dict) -> List[dict]:
    """Fetch orders from last 30 days via SP-API."""
    try:
        api = Orders(credentials=credentials, marketplace=MARKETPLACE)
        since = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        resp  = api.get_orders(CreatedAfter=since, MaxResultsPerPage=50)
        raw   = resp.payload.get("Orders", [])
        logger.info(f"✅ Fetched {len(raw)} orders")
        return [transform_order(o) for o in raw]
    except SellingApiException as e:
        logger.error(f"Orders API error: {e}")
        return []
    except Exception as e:
        logger.error(f"Orders unexpected error: {e}")
        return []

def fetch_inventory(credentials: dict) -> List[dict]:
    """Fetch FBA inventory summaries via SP-API."""
    try:
        api  = Inventories(credentials=credentials, marketplace=MARKETPLACE)
        resp = api.get_inventory_summaries(
            granularityType="Marketplace",
            granularityId=MARKETPLACE.marketplace_id,
            details=True,
        )
        items = resp.payload.get("inventorySummaries", [])
        logger.info(f"✅ Fetched {len(items)} inventory SKUs")
        return [transform_inventory_item(i) for i in items]
    except SellingApiException as e:
        logger.error(f"Inventory API error: {e}")
        return []
    except Exception as e:
        logger.error(f"Inventory unexpected error: {e}")
        return []

def fetch_competitor_price(credentials: dict, asin: str) -> Optional[float]:
    """Get lowest competitor listing price for an ASIN."""
    try:
        api  = ProductPricing(credentials=credentials, marketplace=MARKETPLACE)
        resp = api.get_competitive_pricing_for_asins(asins=[asin])
        for item in (resp.payload or []):
            prices = item.get("Product", {}).get("CompetitivePricing", {}).get("CompetitivePrices", [])
            if prices:
                amount = prices[0].get("Price", {}).get("ListingPrice", {}).get("Amount")
                if amount:
                    return float(amount)
    except Exception as e:
        logger.error(f"Pricing error for {asin}: {e}")
    return None

# ══════════════════════════════════════════════════════════════════════════════
# BACKGROUND SYNC JOB
# ══════════════════════════════════════════════════════════════════════════════

def sync_all_data():
    """Full sync: fetch orders + inventory, build alerts, cache everything."""
    credentials = get_credentials()
    if not credentials:
        logger.warning("Sync skipped — no credentials")
        return

    logger.info("🔄 Starting full Amazon sync...")
    orders    = fetch_orders(credentials)
    inventory = fetch_inventory(credentials)
    alerts    = generate_alerts(orders, inventory)

    total_sales   = round(sum(o.get("total", 0) for o in orders), 2)
    late_count    = sum(1 for o in orders if o.get("is_late"))
    unshipped     = sum(1 for o in orders if o.get("status") == "Unshipped")

    cache = {
        "synced_at":       datetime.utcnow().isoformat(),
        "total_sales":     total_sales,
        "total_orders":    len(orders),
        "late_shipments":  late_count,
        "unshipped_count": unshipped,
        "is_connected":    True,
        "alerts":          alerts,
        "orders":          orders[:50],
        "inventory":       inventory[:100],
        "chart_data":      _build_chart(orders),
    }
    save_file(CACHE_FILE, cache)
    logger.info(f"✅ Sync complete — {len(orders)} orders | {len(inventory)} SKUs | {len(alerts)} alerts")

def _build_chart(orders: list) -> list:
    """Aggregate orders by month → chart data."""
    monthly: dict = {}
    for o in orders:
        month = o.get("created_at", "")[:7]  # "2026-05"
        if month:
            monthly[month] = monthly.get(month, 0) + o.get("total", 0)
    result = [{"month": m, "amazon": round(v), "noon": 0} for m, v in sorted(monthly.items())]
    return result[-6:]  # آخر 6 شهور

def _run_repricer_job():
    """Run repricer logic against competitor prices."""
    credentials = get_credentials()
    if not credentials:
        return

    data    = load_file(REPRICING_FILE) or {"rules": [], "results": []}
    rules   = [r for r in data.get("rules", []) if r.get("active", True)]
    results = []

    for rule in rules:
        asin             = rule.get("asin")
        competitor_price = fetch_competitor_price(credentials, asin)
        if not competitor_price:
            continue

        # Use floor_price * 1.1 as a proxy for "my current price" until price-update API is wired
        my_price  = float(rule.get("floor_price", 0)) * 1.10
        new_price = compute_new_price(my_price, competitor_price, rule)

        if new_price and abs(new_price - my_price) > 0.01:
            logger.info(f"Repricer [{asin}]: {my_price} → {new_price} (competitor: {competitor_price})")
            results.append({
                "asin":             asin,
                "sku":              rule.get("sku"),
                "old_price":        my_price,
                "new_price":        new_price,
                "competitor_price": competitor_price,
                "changed_at":       datetime.utcnow().isoformat(),
            })

    data["results"] = results
    data["last_run"] = datetime.utcnow().isoformat()
    save_file(REPRICING_FILE, data)
    logger.info(f"Repricer done — {len(results)} price adjustments")

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── Config ─────────────────────────────────────────────────────────────────────
@app.post("/api/v1/amazon/save-config")
async def save_config(config: AmazonConfig, background_tasks: BackgroundTasks):
    save_file(DB_FILE, config.dict())
    background_tasks.add_task(sync_all_data)
    return {"status": "success", "message": "✅ تم الحفظ — بدأت المزامنة مع أمازون"}

@app.get("/api/v1/amazon/get-config")
async def get_config():
    cfg = load_file(DB_FILE)
    if not cfg:
        return {"status": "empty"}
    masked = {k: (str(v)[:6] + "..." if len(str(v)) > 6 else v) for k, v in cfg.items()}
    return {"status": "connected", "config": masked}

# ── Dashboard ──────────────────────────────────────────────────────────────────
@app.get("/api/v1/dashboard/summary")
async def get_summary(background_tasks: BackgroundTasks):
    cache = load_file(CACHE_FILE)

    if cache:
        # Refresh in background if cache is older than 15 minutes
        try:
            age = (datetime.utcnow() - datetime.fromisoformat(cache["synced_at"])).seconds
            if age > 900:
                background_tasks.add_task(sync_all_data)
        except Exception:
            background_tasks.add_task(sync_all_data)

        return {
            "synced_at":       cache.get("synced_at"),
            "total_sales":     cache.get("total_sales", 0),
            "total_orders":    cache.get("total_orders", 0),
            "late_shipments":  cache.get("late_shipments", 0),
            "unshipped_count": cache.get("unshipped_count", 0),
            "is_connected":    True,
            "alerts":          cache.get("alerts", []),
            "chart_data":      cache.get("chart_data", []),
        }

    creds = get_credentials()
    if creds:
        background_tasks.add_task(sync_all_data)
        return {"is_connected": True, "status": "syncing", "message": "🔄 جاري المزامنة..."}

    return {"is_connected": False, "status": "no_credentials",
            "message": "اذهب لإعدادات الربط وأدخل بيانات Amazon SP-API"}

# ── Orders ─────────────────────────────────────────────────────────────────────
@app.get("/api/v1/orders")
async def get_orders(status: Optional[str] = None, platform: Optional[str] = None):
    cache = load_file(CACHE_FILE)
    if not cache:
        return {"orders": [], "total": 0}
    orders = cache.get("orders", [])
    if status:
        orders = [o for o in orders if o.get("status") == status]
    if platform:
        orders = [o for o in orders if o.get("platform") == platform]
    return {"orders": orders, "total": len(orders)}

# ── Inventory ─────────────────────────────────────────────────────────────────
@app.get("/api/v1/inventory")
async def get_inventory(low_stock: bool = False):
    cache = load_file(CACHE_FILE)
    if not cache:
        return {"inventory": [], "total": 0, "low_stock_count": 0}
    items = cache.get("inventory", [])
    low   = sum(1 for i in items if i.get("qty", 0) <= 5)
    if low_stock:
        items = [i for i in items if i.get("qty", 0) <= 5]
    return {"inventory": items, "total": len(items), "low_stock_count": low}

# ── Repricing ─────────────────────────────────────────────────────────────────
@app.get("/api/v1/pricing")
async def get_pricing():
    return load_file(REPRICING_FILE) or {"rules": [], "results": [], "last_run": None}

@app.post("/api/v1/pricing/rules")
async def save_rule(rule: RepricingRule):
    data  = load_file(REPRICING_FILE) or {"rules": [], "results": []}
    rules = [r for r in data["rules"] if r.get("asin") != rule.asin]
    rules.append(rule.dict())
    data["rules"] = rules
    save_file(REPRICING_FILE, data)
    return {"status": "saved", "rule": rule.dict()}

@app.post("/api/v1/pricing/run")
async def run_repricer(background_tasks: BackgroundTasks):
    if not get_credentials():
        return {"status": "error", "message": "لم يتم ربط حساب أمازون بعد"}
    background_tasks.add_task(_run_repricer_job)
    return {"status": "started", "message": "محرك التسعير يعمل الآن"}

# ── Alerts ─────────────────────────────────────────────────────────────────────
@app.get("/api/v1/alerts")
async def get_alerts():
    cache  = load_file(CACHE_FILE)
    alerts = cache.get("alerts", []) if cache else []
    return {
        "alerts":         alerts,
        "total":          len(alerts),
        "critical_count": sum(1 for a in alerts if a.get("severity") == "critical"),
    }

@app.post("/api/v1/alerts/config")
async def save_alert_config(config: AlertConfig):
    save_file(ALERTS_FILE, config.dict())
    return {"status": "saved", "config": config.dict()}

# ── Manual Sync ────────────────────────────────────────────────────────────────
@app.post("/api/v1/sync")
async def manual_sync(background_tasks: BackgroundTasks):
    if not get_credentials():
        return {"status": "error", "message": "لم يتم ربط حساب أمازون"}
    background_tasks.add_task(sync_all_data)
    return {"status": "started", "message": "🔄 جاري مزامنة البيانات من أمازون..."}

@app.get("/api/v1/sync/status")
async def sync_status():
    cache = load_file(CACHE_FILE)
    if cache:
        return {
            "status":    "synced",
            "last_sync": cache.get("synced_at"),
            "orders":    cache.get("total_orders", 0),
            "inventory": len(cache.get("inventory", [])),
        }
    return {"status": "never_synced"}

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":     "ok",
        "version":    "2.0",
        "connected":  os.path.exists(DB_FILE),
        "has_cache":  os.path.exists(CACHE_FILE),
        "timestamp":  datetime.utcnow().isoformat(),
    }
