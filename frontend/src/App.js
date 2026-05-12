import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, TrendingUp, ShoppingCart, AlertTriangle, RefreshCcw, 
  Box, Truck, Zap, ShieldCheck, Settings, Save
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line } from 'recharts';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState({ stats: {} });
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState({
    refresh_token: '', lwa_app_id: '', lwa_client_secret: '',
    aws_access_key: '', aws_secret_key: '', role_arn: ''
  });

  // دالة تحميل البيانات المحفوظة من السيرفر
  const loadSavedConfig = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/amazon/get-config');
      const savedData = await res.json();
      if (savedData.status !== "empty") {
        setConfig(savedData);
      }
    } catch (e) { console.log("لا توجد بيانات سابقة"); }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/dashboard/summary');
      const json = await res.json();
      setData({ stats: json });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/amazon/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const result = await res.json();
      alert(result.message);
      fetchAllData();
    } catch (e) { alert("خطأ في الاتصال بالسيرفر"); }
    setLoading(false);
  };

  useEffect(() => { 
    if (isLoggedIn) {
      loadSavedConfig(); // تحميل البيانات المحفوظة فور الدخول
      fetchAllData();
    } 
  }, [isLoggedIn]);

  const Logo = () => (
    <div className="bg-yellow-400 p-5 rounded-2xl w-full flex items-center gap-3">
      <Box size={40} className="text-[#1E40AF]" />
      <div className="flex flex-col items-start leading-[0.9]">
        <span className="text-[22px] font-black text-[#1E40AF] tracking-tighter uppercase">Tegarty</span>
        <span className="text-[22px] font-black text-[#1E40AF] tracking-tighter uppercase">Prime</span>
        <p className="text-[7px] font-bold text-[#1E40AF] mt-1 opacity-70 italic">MANAGEMENT & E-COMMERCE</p>
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6 text-right" dir="rtl">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center border border-slate-100">
          <Logo />
          <button onClick={() => setIsLoggedIn(true)} className="w-full mt-10 py-5 bg-[#0F172A] text-white rounded-2xl font-black text-xl hover:bg-blue-900 shadow-xl transition-all tracking-tighter italic uppercase">Enter System</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex font-sans text-right" dir="rtl">
      <aside className="w-72 bg-[#0F172A] text-white fixed h-full z-30 shadow-2xl border-l border-slate-800">
        <div className="p-4"><Logo /></div>
        <nav className="p-4 space-y-2 mt-4 font-bold">
          <NavItem icon={<LayoutDashboard size={18}/>} label="الرئيسية" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Settings size={18}/>} label="توصيل الحسابات" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      <main className="flex-1 mr-72 p-8 transition-all">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-3xl shadow-sm border border-white">
          <div className="flex gap-3">
             <button onClick={() => setActiveTab('settings')} className="flex items-center gap-2 bg-[#1D4ED8] text-white px-5 py-2.5 rounded-xl font-black text-sm active:scale-95"><Settings size={18}/> إعدادات الربط</button>
             <button onClick={fetchAllData} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 shadow-sm"><RefreshCcw size={18} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-5 gap-4 mb-6">
              <MetricCard title="إجمالي المبيعات" value={data.stats.total_sales} sub="محدث من البيانات" color="blue" icon={<TrendingUp size={16}/>} />
              <MetricCard title="صافي الربح" value={data.stats.net_profit} sub="عن +8% الشهر السابق" color="emerald" icon={<TrendingUp size={16}/>} />
              <MetricCard title="إجمالي الطلبات" value={data.stats.total_orders} sub="عن +5% الشهر السابق" color="slate" icon={<ShoppingCart size={16}/>} />
              <MetricCard title="حالة الربط" value={data.stats.is_connected ? "متصل ✅" : "غير متصل ❌"} sub="Amazon SP-API" color={data.stats.is_connected ? "emerald" : "rose"} icon={<Zap size={16}/>} />
              <MetricCard title="صحة الحساب" value={data.stats.account_health_score} sub="Good" color="emerald" icon={<ShieldCheck size={16}/>} />
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center py-20 font-black italic uppercase tracking-tighter">
               {data.stats.is_connected ? "Tegarty Prime is now synced with your live store data" : "Please complete the integration in settings to see live data"}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in slide-in-from-bottom font-bold text-right">
            <h2 className="text-2xl font-black mb-8 italic uppercase tracking-tighter">Amazon Integration Keys</h2>
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 grid grid-cols-2 gap-6">
               <InputGroup label="Refresh Token" value={config.refresh_token} onChange={(v)=>setConfig({...config, refresh_token:v})} />
               <InputGroup label="LWA Client ID" value={config.lwa_app_id} onChange={(v)=>setConfig({...config, lwa_app_id:v})} />
               <InputGroup label="LWA Client Secret" value={config.lwa_client_secret} onChange={(v)=>setConfig({...config, lwa_client_secret:v})} />
               <InputGroup label="AWS Access Key" value={config.aws_access_key} onChange={(v)=>setConfig({...config, aws_access_key:v})} />
               <InputGroup label="AWS Secret Key" value={config.aws_secret_key} onChange={(v)=>setConfig({...config, aws_secret_key:v})} />
               <InputGroup label="Role ARN" value={config.role_arn} onChange={(v)=>setConfig({...config, role_arn:v})} />
               
               <div className="col-span-2 pt-6">
                  <button onClick={handleSaveConfig} className="flex items-center justify-center gap-3 w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                     <Save size={20}/> حفظ وإتمام الربط
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Fixed Input Component
function InputGroup({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] uppercase font-black text-slate-400 mb-2">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-50 border border-slate-100 p-4 rounded-xl font-sans text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        placeholder={`Enter ${label}...`}
      />
    </div>
  );
}

function MetricCard({ title, value, sub, color, icon }) {
  const colors = { blue: 'text-blue-600 bg-blue-50', emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50', slate: 'text-slate-600 bg-slate-50' };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm font-black italic tracking-tighter">
      <div className="flex justify-between items-start mb-3 font-black italic tracking-tighter uppercase tracking-tighter italic tracking-tighter italic tracking-tighter italic tracking-tighter">
        <p className="text-[11px] text-slate-400 uppercase tracking-widest">{title}</p>
        <div className={`p-1.5 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <h3 className="text-2xl text-slate-800 mb-1">{value}</h3>
      <p className={`text-[9px] ${color === 'rose' ? 'text-rose-500' : 'text-emerald-500'}`}>{sub}</p>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl cursor-pointer transition-all font-black text-sm uppercase tracking-tighter italic ${active ? 'bg-blue-600 text-white shadow-xl translate-x-[-5px]' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
      {icon} <span>{label}</span>
    </div>
  );
}

export default App;