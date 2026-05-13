import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, TrendingUp, ShoppingCart, AlertTriangle,
  RefreshCcw, Box, Truck, Zap, ShieldCheck, Settings, Save,
  Bell, DollarSign, BarChart2, ArrowUpRight, ArrowDownRight,
  CheckCircle, XCircle, Clock, Warehouse
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const API = 'http://127.0.0.1:8000';

const fmt = (n) =>
  n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)} مليون ج.م`
  : n >= 1_000   ? `${(n/1_000).toFixed(1)} ألف ج.م`
  : `${n ?? 0} ج.م`;

const Logo = () => (
  <div className="flex items-center gap-3 px-1">
    <div className="bg-yellow-400 p-2 rounded-xl flex-shrink-0">
      <Box size={22} className="text-blue-800" />
    </div>
    <div className="leading-tight">
      <p className="text-sm font-black text-white tracking-tight uppercase">Tegarty Prime</p>
      <p className="text-[8px] text-slate-500 uppercase tracking-widest">Full Control v2.0</p>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-semibold
      ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="flex-1">{label}</span>
    {badge > 0 && (
      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{badge}</span>
    )}
  </div>
);

const KPICard = ({ title, value, sub, icon, color = 'blue', trend }) => {
  const palette = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red:   'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{title}</p>
        <div className={`p-1.5 rounded-lg ${palette[color]}`}>{icon}</div>
      </div>
      <p className="text-xl font-black text-slate-800 mb-1 tracking-tight">{value ?? '—'}</p>
      {sub && (
        <p className={`text-[10px] flex items-center gap-1
          ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
          {trend === 'up'   && <ArrowUpRight size={11}/>}
          {trend === 'down' && <ArrowDownRight size={11}/>}
          {sub}
        </p>
      )}
    </div>
  );
};

const AlertBadge = ({ alert }) => {
  const styles = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    warning:  'bg-amber-50 border-amber-200 text-amber-700',
    info:     'bg-blue-50 border-blue-200 text-blue-700',
  };
  const icons = {
    critical: <XCircle size={14} className="flex-shrink-0 mt-0.5"/>,
    warning:  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/>,
    info:     <Bell size={14} className="flex-shrink-0 mt-0.5"/>,
  };
  const s = alert.severity || 'info';
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${styles[s]}`}>
      {icons[s]}
      <div>
        <p className="font-semibold text-xs">{alert.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
      </div>
    </div>
  );
};

const StatusChip = ({ status }) => {
  const map = {
    Unshipped:           { label: 'لم يُشحن',    cls: 'bg-amber-100 text-amber-700' },
    Shipped:             { label: 'تم الشحن',     cls: 'bg-blue-100 text-blue-700' },
    Delivered:           { label: 'تم التوصيل',  cls: 'bg-green-100 text-green-700' },
    Canceled:            { label: 'ملغي',         cls: 'bg-red-100 text-red-700' },
    Pending:             { label: 'معلق',         cls: 'bg-slate-100 text-slate-600' },
    PendingAvailability: { label: 'انتظار',       cls: 'bg-slate-100 text-slate-600' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${cls}`}>{label}</span>;
};

const InputGroup = ({ label, value, onChange, type = 'text' }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      placeholder={`Enter ${label}...`}
    />
  </div>
);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab,  setActiveTab]  = useState('dashboard');
  const [loading,    setLoading]    = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [lastSync,   setLastSync]   = useState(null);

  const [summary,   setSummary]   = useState({});
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [pricing,   setPricing]   = useState({ rules: [], results: [] });

  const [config, setConfig] = useState({
    refresh_token: '', lwa_app_id: '', lwa_client_secret: '',
    aws_access_key: '', aws_secret_key: '', role_arn: ''
  });
  const [newRule, setNewRule] = useState({
    asin: '', sku: '', floor_price: '', undercut_by: '0.50'
  });

  const fetchSummary = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/dashboard/summary`);
      const d = await r.json();
      setSummary(d);
      setAlerts(d.alerts || []);
      if (d.synced_at) setLastSync(new Date(d.synced_at).toLocaleTimeString('ar-EG'));
    } catch (e) { console.error('summary', e); }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/orders`);
      const d = await r.json();
      setOrders(d.orders || []);
    } catch (e) { console.error('orders', e); }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/inventory`);
      const d = await r.json();
      setInventory(d.inventory || []);
    } catch (e) { console.error('inventory', e); }
  }, []);

  const fetchPricing = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/pricing`);
      const d = await r.json();
      setPricing(d);
    } catch (e) { console.error('pricing', e); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/alerts`);
      const d = await r.json();
      setAlerts(d.alerts || []);
    } catch (e) { console.error('alerts', e); }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchSummary();
    fetchOrders();
    fetchInventory();
    fetchPricing();
    fetchAlerts();
    const id = setInterval(() => { fetchSummary(); fetchAlerts(); }, 60000);
    return () => clearInterval(id);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === 'orders')    fetchOrders();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'pricing')   fetchPricing();
    if (activeTab === 'alerts')    fetchAlerts();
  }, [activeTab]);

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/amazon/save-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      alert(d.message);
      fetchSummary();
    } catch (e) { alert('خطأ في الاتصال بالسيرفر'); }
    setLoading(false);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/api/v1/sync`, { method: 'POST' });
      setTimeout(() => {
        fetchSummary(); fetchOrders(); fetchInventory();
        setSyncing(false);
      }, 4000);
    } catch (e) { setSyncing(false); }
  };

  const handleRunRepricer = async () => {
    try {
      const r = await fetch(`${API}/api/v1/pricing/run`, { method: 'POST' });
      const d = await r.json();
      alert(d.message);
      setTimeout(fetchPricing, 3000);
    } catch (e) { alert('خطأ'); }
  };

  const handleSaveRule = async () => {
    if (!newRule.asin || !newRule.floor_price) return alert('أدخل ASIN والسعر الأدنى');
    try {
      await fetch(`${API}/api/v1/pricing/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRule,
          floor_price: parseFloat(newRule.floor_price),
          undercut_by: parseFloat(newRule.undercut_by),
        }),
      });
      setNewRule({ asin: '', sku: '', floor_price: '', undercut_by: '0.50' });
      fetchPricing();
    } catch (e) { alert('خطأ في الحفظ'); }
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const lateOrders     = orders.filter(o => o.is_late).length;
  const lowStock       = inventory.filter(i => i.qty <= 5).length;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-sm text-center border border-slate-100">
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-400 p-4 rounded-2xl">
              <Box size={40} className="text-blue-800"/>
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Tegarty Prime</h1>
          <p className="text-xs text-slate-400 mb-8 uppercase tracking-widest">Full Control v2.0</p>
          <button
            onClick={() => setIsLoggedIn(true)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-blue-900 transition-all shadow-lg"
          >
            Enter System
          </button>
        </div>
      </div>
    );
  }

  const tabLabel = {
    dashboard: 'الرئيسية', orders: 'مدير الطلبات',
    inventory: 'المخزون الذكي', pricing: 'محرك التسعير',
    alerts: 'التنبيهات', settings: 'توصيل الحسابات',
  };

  return (
    <div className="min-h-screen bg-slate-100 flex" dir="rtl">

      {/* SIDEBAR */}
      <aside className="w-56 bg-slate-900 text-white fixed h-full z-30 flex flex-col">
        <div className="p-4 border-b border-slate-800 mb-2">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={16}/>} label="الرئيسية"       active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
          <NavItem icon={<ShoppingCart size={16}/>}    label="مدير الطلبات"   active={activeTab==='orders'}    onClick={()=>setActiveTab('orders')}    badge={lateOrders}/>
          <NavItem icon={<Warehouse size={16}/>}       label="المخزون الذكي"  active={activeTab==='inventory'} onClick={()=>setActiveTab('inventory')} badge={lowStock}/>
          <NavItem icon={<DollarSign size={16}/>}      label="محرك التسعير"   active={activeTab==='pricing'}   onClick={()=>setActiveTab('pricing')}/>
          <NavItem icon={<Bell size={16}/>}            label="التنبيهات"      active={activeTab==='alerts'}    onClick={()=>setActiveTab('alerts')}    badge={criticalAlerts}/>
          <NavItem icon={<Settings size={16}/>}        label="توصيل الحسابات" active={activeTab==='settings'}  onClick={()=>setActiveTab('settings')}/>
        </nav>
        {lastSync && (
          <div className="px-4 py-3 border-t border-slate-800">
            <p className="text-[10px] text-slate-500">آخر مزامنة: {lastSync}</p>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main className="flex-1 mr-56 p-6">

        {/* TOPBAR */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-black text-slate-800">{tabLabel[activeTab]}</h1>
            <p className="text-xs text-slate-400">Tegarty Prime — Amazon SP-API v2.0</p>
          </div>
          <div className="flex gap-2 items-center">
            {summary.is_connected
              ? <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full font-semibold">
                  <CheckCircle size={12}/> متصل بأمازون
                </span>
              : <span className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full font-semibold">
                  <XCircle size={12}/> غير متصل
                </span>
            }
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''}/>
              {syncing ? 'جاري المزامنة...' : 'مزامنة'}
            </button>
          </div>
        </div>

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {summary.status === 'no_credentials' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 flex items-center gap-3">
                <AlertTriangle size={18}/>
                <span>لم يتم ربط حساب أمازون.{' '}
                  <button onClick={()=>setActiveTab('settings')} className="underline font-bold">
                    اذهب للإعدادات
                  </button>
                </span>
              </div>
            )}
            {summary.status === 'syncing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700 flex items-center gap-3">
                <RefreshCcw size={18} className="animate-spin"/>
                <span>جاري جلب البيانات من أمازون لأول مرة... انتظر دقيقة.</span>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-5 gap-4">
              <KPICard title="إجمالي المبيعات"  value={fmt(summary.total_sales)}   sub="آخر 30 يوم"          icon={<TrendingUp size={14}/>}    color="blue"  trend="up"/>
              <KPICard title="إجمالي الطلبات"   value={summary.total_orders}       sub="من أمازون"           icon={<ShoppingCart size={14}/>}  color="slate"/>
              <KPICard title="لم تُشحن"         value={summary.unshipped_count}    sub="تحتاج إجراء"         icon={<Clock size={14}/>}         color="amber" trend={summary.unshipped_count > 0 ? 'down' : null}/>
              <KPICard title="شحنات متأخرة"     value={summary.late_shipments}     sub="تجاوزت الموعد"       icon={<Truck size={14}/>}         color={summary.late_shipments > 0 ? 'red' : 'green'}/>
              <KPICard title="تنبيهات حرجة"     value={criticalAlerts}             sub="تحتاج مراجعة فورية"  icon={<Bell size={14}/>}          color={criticalAlerts > 0 ? 'red' : 'green'}/>
            </div>

            {/* Alerts strip */}
            {alerts.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {alerts.slice(0, 3).map((a, i) => <AlertBadge key={i} alert={a}/>)}
              </div>
            )}

            {/* Chart */}
            {summary.chart_data?.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-slate-700 text-sm">تحليل الأداء — آخر 6 شهور</p>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>Amazon
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>Noon
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary.chart_data} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="month" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}
                      tickFormatter={v => v>=1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                    <Tooltip formatter={v => [`${v.toLocaleString()} ج.م`]}/>
                    <Bar dataKey="amazon" name="Amazon" fill="#3b82f6" radius={[4,4,0,0]}/>
                    <Bar dataKey="noon"   name="Noon"   fill="#f59e0b" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">
                {summary.is_connected
                  ? 'سيظهر الرسم البياني بعد أول مزامنة ناجحة'
                  : 'اربط حساب أمازون لعرض بيانات المبيعات'}
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ───────────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <KPICard title="إجمالي الطلبات" value={orders.length}                                   icon={<ShoppingCart size={14}/>}  color="slate"/>
              <KPICard title="لم تُشحن"        value={orders.filter(o=>o.status==='Unshipped').length} icon={<Clock size={14}/>}         color="amber"/>
              <KPICard title="تم الشحن"        value={orders.filter(o=>o.status==='Shipped').length}   icon={<Truck size={14}/>}         color="blue"/>
              <KPICard title="متأخرة"          value={orders.filter(o=>o.is_late).length}              icon={<AlertTriangle size={14}/>} color="red"/>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-bold text-sm text-slate-700">الطلبات — آخر 30 يوم</p>
                <span className="text-xs text-slate-400">مصدر: Amazon SP-API</span>
              </div>
              {orders.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  {summary.is_connected ? 'جاري تحميل الطلبات...' : 'قم بربط حساب أمازون أولاً'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-right">
                        {['Order ID','الحالة','القيمة','المدينة','التاريخ',''].map((h,i) => (
                          <th key={i} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map((o, i) => (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${o.is_late ? 'bg-red-50/40' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{o.id}</td>
                          <td className="px-4 py-3"><StatusChip status={o.status}/></td>
                          <td className="px-4 py-3 font-bold text-slate-700">{o.total?.toFixed(0)} {o.currency}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{o.buyer_city}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{o.created_at?.slice(0,10)}</td>
                          <td className="px-4 py-3">
                            {o.is_late && (
                              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">متأخر</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INVENTORY ────────────────────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <KPICard title="إجمالي SKUs"   value={inventory.length}                                 icon={<Package size={14}/>}       color="slate"/>
              <KPICard title="مخزون منخفض"   value={inventory.filter(i=>i.qty<=5&&i.qty>0).length}   icon={<AlertTriangle size={14}/>}  color="amber"/>
              <KPICard title="نفاد المخزون"  value={inventory.filter(i=>i.qty===0).length}            icon={<XCircle size={14}/>}       color="red"/>
              <KPICard title="في الطريق"      value={inventory.reduce((s,i)=>s+(i.inbound||0),0)}     icon={<Truck size={14}/>}         color="blue"/>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-bold text-sm text-slate-700">مخزون FBA — أمازون</p>
                <span className="text-xs text-slate-400">مصدر: Amazon SP-API</span>
              </div>
              {inventory.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  {summary.is_connected ? 'جاري تحميل المخزون...' : 'قم بربط حساب أمازون أولاً'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-right">
                        {['المنتج','SKU','متاح','محجوز','قادم','الحالة'].map((h,i) => (
                          <th key={i} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {inventory.map((item, i) => (
                        <tr key={i} className={`hover:bg-slate-50
                          ${item.qty===0 ? 'bg-red-50/30' : item.qty<=5 ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-4 py-3 text-xs text-slate-700 max-w-xs truncate">{item.title}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku}</td>
                          <td className="px-4 py-3 font-black text-slate-800">{item.qty}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{item.reserved}</td>
                          <td className="px-4 py-3 text-blue-500 text-xs">{item.inbound}</td>
                          <td className="px-4 py-3">
                            {item.qty === 0
                              ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">نفاد</span>
                              : item.qty <= 5
                              ? <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">منخفض</span>
                              : <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">جيد</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRICING ──────────────────────────────────────────────────────── */}
        {activeTab === 'pricing' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-slate-700">محرك التسعير الآلي</p>
                <button
                  onClick={handleRunRepricer}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  <Zap size={14}/> تشغيل الآن
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                المنطق: لو المنافس نزل سعره → انزل تحته بـ X جنيه. لكن لا تنزل أبداً تحت الـ Floor Price.
              </p>

              {/* Add rule */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <p className="text-xs font-bold text-slate-600 mb-3 uppercase">إضافة قاعدة تسعير جديدة</p>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <InputGroup label="ASIN"        value={newRule.asin}        onChange={v=>setNewRule({...newRule,asin:v})}/>
                  <InputGroup label="SKU"         value={newRule.sku}         onChange={v=>setNewRule({...newRule,sku:v})}/>
                  <InputGroup label="Floor Price" value={newRule.floor_price} onChange={v=>setNewRule({...newRule,floor_price:v})} type="number"/>
                  <InputGroup label="Undercut بـ" value={newRule.undercut_by} onChange={v=>setNewRule({...newRule,undercut_by:v})} type="number"/>
                </div>
                <button
                  onClick={handleSaveRule}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700"
                >
                  <Save size={13}/> حفظ القاعدة
                </button>
              </div>

              {pricing.rules?.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-right">
                      {['ASIN','Floor Price','Undercut','الحالة'].map((h,i)=>(
                        <th key={i} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pricing.rules.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{r.asin}</td>
                        <td className="px-3 py-2 font-bold text-green-600">{r.floor_price} ج.م</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">-{r.undercut_by} ج.م</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">نشط</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {pricing.results?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="font-bold text-slate-700 mb-3 text-sm">
                  نتائج آخر تشغيل — {pricing.last_run?.slice(0,10)}
                </p>
                <div className="space-y-2">
                  {pricing.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 text-xs">
                      <span className="font-mono text-slate-600">{r.asin}</span>
                      <span>
                        <span className="text-slate-400">{r.old_price} ج.م</span>
                        {' → '}
                        <span className="font-bold text-green-600">{r.new_price} ج.م</span>
                      </span>
                      <span className="text-slate-400">منافس: {r.competitor_price} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS ───────────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <KPICard title="إجمالي التنبيهات" value={alerts.length}                                    icon={<Bell size={14}/>}          color="slate"/>
              <KPICard title="حرجة"             value={alerts.filter(a=>a.severity==='critical').length} icon={<XCircle size={14}/>}       color="red"/>
              <KPICard title="تحذيرات"          value={alerts.filter(a=>a.severity==='warning').length}  icon={<AlertTriangle size={14}/>} color="amber"/>
            </div>
            <div className="space-y-3">
              {alerts.length === 0
                ? <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
                    لا توجد تنبيهات حالياً ✅
                  </div>
                : alerts.map((a, i) => <AlertBadge key={i} alert={a}/>)
              }
            </div>
          </div>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-black text-slate-800 mb-1">Amazon SP-API Integration</h2>
              <p className="text-xs text-slate-400 mb-6">
                أدخل بيانات الـ API Keys الخاصة بحساب أمازون للبائعين. البيانات محفوظة محلياً فقط.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Refresh Token"     value={config.refresh_token}     onChange={v=>setConfig({...config,refresh_token:v})}/>
                <InputGroup label="LWA Client ID"     value={config.lwa_app_id}        onChange={v=>setConfig({...config,lwa_app_id:v})}/>
                <InputGroup label="LWA Client Secret" value={config.lwa_client_secret} onChange={v=>setConfig({...config,lwa_client_secret:v})}/>
                <InputGroup label="AWS Access Key"    value={config.aws_access_key}    onChange={v=>setConfig({...config,aws_access_key:v})}/>
                <InputGroup label="AWS Secret Key"    value={config.aws_secret_key}    onChange={v=>setConfig({...config,aws_secret_key:v})}/>
                <InputGroup label="Role ARN"          value={config.role_arn}          onChange={v=>setConfig({...config,role_arn:v})}/>
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="mt-5 flex items-center justify-center gap-3 w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
              >
                <Save size={16}/>
                {loading ? 'جاري الحفظ...' : 'حفظ وبدء المزامنة'}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700 mb-2">كيف تحصل على هذه البيانات:</p>
              <p>• <strong>LWA Client ID & Secret:</strong> من Seller Central ← Apps & Services ← Develop Apps</p>
              <p>• <strong>Refresh Token:</strong> من عملية OAuth بعد تسجيل التطبيق في Amazon Developer</p>
              <p>• <strong>AWS Access Key & Secret:</strong> من AWS IAM Console ← Create User ← Programmatic Access</p>
              <p>• <strong>Role ARN:</strong> من AWS IAM ← Roles ← الـ Role اللي أنشأته لـ SP-API</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
