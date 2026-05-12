from pydantic import BaseModel
from typing import List, Optional

class Product(BaseModel):
    sku: str # الباركود الفريد للمنتج
    title: str # العنوان الأساسي
    description: str # الوصف الشامل
    price: float # سعر البيع بالجنيه
    cost: float # التكلفة الحقيقية (خامات + ورشة)
    images: List[str] # روابط الصور
    inventory: int # المخزون المتاح حالياً
    category: str # فئة المنتج (مثلاً: كراسي، طاولات)
    