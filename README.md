# Tegarty Prime v2.0 — دليل التشغيل الكامل

## ما الجديد في v2.0؟
- ✅ **Amazon SP-API حقيقي** — يسحب الأوردرات والمخزون الفعلي
- ✅ **Data Transformer** — يحول بيانات أمازون لصيغة موحدة
- ✅ **Repricer Logic** — محرك تسعير آلي مع Floor Price
- ✅ **Smart Alerts** — تنبيهات تلقائية: متأخر، مخزون منخفض، نفاد
- ✅ **Background Sync** — مزامنة تلقائية كل 15 دقيقة
- ✅ **6 صفحات مكتملة** — Dashboard, Orders, Inventory, Pricing, Alerts, Settings

---

## تشغيل البروجكت

### 1. تشغيل الـ Backend
```bash
cd backend

# تفعيل الـ venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Mac/Linux

# تثبيت المكتبات (لو محتاج)
pip install -r requirements.txt

# تشغيل السيرفر
uvicorn app:app --reload --port 8000
```

السيرفر هيشتغل على: http://127.0.0.1:8000
API Docs على: http://127.0.0.1:8000/docs

### 2. تشغيل الـ Frontend
```bash
cd frontend
npm install    # مرة واحدة بس
npm start
```

الواجهة هتشتغل على: http://localhost:3000

---

## الـ Endpoints الجديدة

| Method | Endpoint | الوظيفة |
|--------|----------|---------|
| GET | /health | فحص حالة السيرفر |
| POST | /api/v1/amazon/save-config | حفظ الـ credentials |
| GET | /api/v1/dashboard/summary | ملخص الداشبورد (من الـ cache) |
| POST | /api/v1/sync | مزامنة يدوية فورية |
| GET | /api/v1/sync/status | حالة آخر مزامنة |
| GET | /api/v1/orders | كل الطلبات |
| GET | /api/v1/inventory | المخزون + عدد المنخفض |
| GET | /api/v1/pricing | قواعد وتنائج التسعير |
| POST | /api/v1/pricing/rules | إضافة قاعدة تسعير |
| POST | /api/v1/pricing/run | تشغيل الـ Repricer |
| GET | /api/v1/alerts | التنبيهات النشطة |

---

## الملفات المحفوظة (في مجلد backend/)

| الملف | المحتوى |
|-------|---------|
| credentials_db.json | بيانات الـ API Keys (مشفرة بالـ JSON) |
| dashboard_cache.json | آخر بيانات مزامنة (orders, inventory, alerts) |
| repricing_rules.json | قواعد التسعير ونتائج آخر تشغيل |
| alerts_config.json | إعدادات حدود التنبيهات |

---

## المرحلة الجاية (v3.0)
- [ ] Noon API integration (Connector Pattern)
- [ ] تحديث السعر الفعلي على أمازون عبر SP-API
- [ ] Telegram Bot notifications
- [ ] Deploy على AWS Lightsail (شغال 24/7)
- [ ] Cron Job تلقائي كل 15 دقيقة بدل الـ manual sync
