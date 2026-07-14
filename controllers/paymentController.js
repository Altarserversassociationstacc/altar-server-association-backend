import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FaCircleNotch, FaSearch, FaHistory, FaCheckCircle, 
  FaExclamationTriangle, FaDownload, FaWallet, FaTag,
  FaSlidersH, FaSave, FaGraduationCap, FaCalendarAlt
} from 'react-icons/fa';

// 📌 STANDARDIZED CONSTANTS
const ACADEMIC_SESSIONS = ['2025/2026', '2026/2027', '2027/2028', '2028/2029', '2029/2030'];
const ACADEMIC_LEVELS = ['100L', '200L', '300L', '400L', '500L'];
const NARRATIONS = [
      'Sessional Dues', 
      'Sendforth levy and Appeal fund card', 
      'Donation', 
      'Other Clearance'
];

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '');

// ==========================================
// 💡 MODULAR SUB-COMPONENTS
// ==========================================

const MetricCard = ({ title, value, subtext, icon: Icon, variant = 'primary' }) => (
  <div className={`bg-[#0a0a0a] border border-[#1a110b] px-6 py-5 rounded-2xl flex items-center gap-5 shadow-lg transition-all duration-300 hover:border-[#3d2b1f] ${variant === 'secondary' ? 'opacity-75 hover:opacity-100' : ''}`}>
    <div className={`p-3 rounded-xl ${variant === 'primary' ? 'bg-emerald-950/30 text-emerald-500' : 'bg-amber-950/30 text-amber-500'}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">{title}</p>
      <p className={`text-xl md:text-2xl font-mono font-bold mt-1 ${variant === 'primary' ? 'text-emerald-400' : 'text-amber-500'}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-600 mt-1">{subtext}</p>
    </div>
  </div>
);

const FilterSelect = ({ icon: Icon, value, onChange, options, defaultLabel }) => (
  <div className="relative flex items-center w-full">
    {Icon && <Icon className="absolute left-3 text-gray-600 pointer-events-none" size={12} />}
    <select
      value={value}
      onChange={onChange}
      className={`w-full bg-[#111111] border border-[#2a1b12] rounded-lg pr-8 py-2.5 text-xs text-gray-400 focus:outline-none focus:border-[#8b4513] focus:ring-1 focus:ring-[#8b4513]/30 cursor-pointer appearance-none transition-all ${Icon ? 'pl-8' : 'pl-3'}`}
    >
      <option value="all">{defaultLabel}</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
    <div className="absolute right-3 pointer-events-none text-gray-600 text-[8px]">▼</div>
  </div>
);

// ==========================================
// 🚀 MAIN LEDGER COMPONENT
// ==========================================

const AdminPaymentLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [feeConfigs, setFeeConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🔍 Consolidated Filter State
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    narration: 'all',
    level: 'all',
    session: 'all'
  });

  // 🎛️ Form State
  const [form, setForm] = useState({
    narration: NARRATIONS[0],
    amount: ''
  });
  
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // 🛡️ Normalized Auth Token Retrieval
  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('adminToken') || 
                localStorage.getItem('admintoken') || 
                localStorage.getItem('token'); 
    
    if (!token || token === 'null' || token === 'undefined') {
      return { 'Content-Type': 'application/json' };
    }

    token = token.replace(/^"|"$/g, '');

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  // 🔄 Unified Sync Engine with Memory Cleanup
  const fetchData = useCallback(async (signal) => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      console.error("Auth Token Missing. Halting sync stream.");
      setLoading(false);
      return;
    }

    try {
      const [ledgerRes, matrixRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/payment/history`, { headers, signal }),
        fetch(`${API_BASE_URL}/api/payment/fee-matrix`, { headers, signal })
      ]);

      if (ledgerRes.ok) {
        const ledgerOutput = await ledgerRes.json();
        if (ledgerOutput.success) {
          const cleanLedger = ledgerOutput.data.filter(item => item.status !== 'pending');
          setLedger(cleanLedger);
        }
      }

      if (matrixRes.ok) {
        const matrixOutput = await matrixRes.json();
        if (matrixOutput.success) {
          setFeeConfigs(matrixOutput.data);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Could not synchronize data matrices:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // 📥 Filter Update Handler
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // 📡 Update or Create Configuration Rule
  const handleUpdateFeeMatrix = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const numericAmount = Number(form.amount);
    if (!numericAmount || numericAmount <= 0) {
      return setFeedback({ type: 'error', message: 'Please declare a valid numeric currency valuation.' });
    }

    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      return setFeedback({ type: 'error', message: 'Session expired. Please log in again.' });
    }

    setIsUpdatingConfig(true);
    const endpoint = `${API_BASE_URL}/api/payment/update-fee-matrix`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers, 
        body: JSON.stringify({
          narration: form.narration,
          amount: numericAmount
        })
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        setFeedback({
          type: 'success',
          message: `${form.narration} updated to ₦${numericAmount.toLocaleString()} successfully.`
        });
        
        setForm({ narration: NARRATIONS[0], amount: '' });
        fetchData();
      } else {
        throw new Error(data.message || 'Failed updating gateway matrix configuration.');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Network link verification timeout.' });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // 🔍 Multi-Layer Memory Filter Engine
  const filteredLedger = useMemo(() => {
    return ledger.filter(item => {
      const query = filters.search.toLowerCase();
      const safeName = (item.studentName || '').toLowerCase();
      const safeRef = (item.reference || '').toLowerCase();
      const safeLevel = (item.targetLevel || '').toLowerCase();
      const safeNarration = (item.narration || '').toLowerCase();
      
      const matchesSearch = safeName.includes(query) || safeRef.includes(query);
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesNarration = filters.narration === 'all' || safeNarration === filters.narration.toLowerCase();
      const matchesLevel = filters.level === 'all' || safeLevel === filters.level.toLowerCase();
      const matchesSession = filters.session === 'all' || item.academicYear === filters.session;
      
      return matchesSearch && matchesStatus && matchesNarration && matchesLevel && matchesSession;
    });
  }, [ledger, filters]);

  // 📊 Fast Memoized Stats Panel (Gross amounts only)
  const stats = useMemo(() => {
    const successfulTxs = filteredLedger.filter(item => item.status === 'success');
    const gross = successfulTxs.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return {
      totalGross: gross,
      successCount: successfulTxs.length
    };
  }, [filteredLedger]);

  // 📥 Enterprise-Safe CSV Export (Gross amounts only)
  const exportToCSV = () => {
    if (filteredLedger.length === 0) return;
    const headers = ["Date", "Student Name", "Reference", "Narration", "Level", "Session", "Amount Paid (NGN)", "Status"];
    
    const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const csvContent = [
      headers.join(","),
      ...filteredLedger.map(row => {
        const date = new Date(row.createdAt || row.paidAt).toLocaleDateString();
        return [
          escapeCSV(date),
          escapeCSV(row.studentName),
          escapeCSV(row.reference),
          escapeCSV(row.narration),
          escapeCSV(row.targetLevel),
          escapeCSV(row.academicYear),
          escapeCSV(row.amount),
          escapeCSV(row.status)
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `payment_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); 
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white">
        <FaCircleNotch className="animate-spin text-[#d2b48c] mb-4" size={32} />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d2b48c] animate-pulse">Syncing Ledger Matrix...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-gray-100 font-sans min-h-screen w-full p-4 md:p-6 transition-all">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER ZONE */}
        <header className="border-b border-[#2a1b12] pb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-2xl font-serif text-[#d2b48c] tracking-wide uppercase flex items-center gap-3">
                <FaHistory className="text-[#8b4513]" size={20} /> Payment  Ledger
              </h2>
              <p className="text-gray-500 text-xs mt-1">Manage payment policies and track clearances.</p>
            </div>
          </div>
        </header>

        {/* METRICS & CONFIGURATION WRAPPER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* RATE CONFIGURATION PANEL */}
          <div className="bg-[#0a0a0a] border border-[#3d2b1f] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#d2b48c] flex items-center gap-2">
                  <FaSlidersH className="text-[#8b4513]" size={12} /> Fee Matrix Registry
                </h3>
              </div>
              
              <form onSubmit={handleUpdateFeeMatrix} className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500 block mb-1">Target Account Narration</label>
                  <select 
                    value={form.narration}
                    disabled={isUpdatingConfig}
                    onChange={(e) => setForm(prev => ({ ...prev, narration: e.target.value }))}
                    className="w-full bg-[#111111] border border-[#2a1b12] text-xs rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none focus:border-[#8b4513] focus:ring-1 focus:ring-[#8b4513]/25"
                  >
                    {NARRATIONS.map(narr => (
                      <option key={narr} value={narr}>{narr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500 block mb-1">Enforced Value Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-500">₦</span>
                    <input 
                      type="number" 
                      required
                      value={form.amount}
                      disabled={isUpdatingConfig}
                      placeholder="e.g. 5000"
                      onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full bg-[#111111] border border-[#2a1b12] font-mono text-xs rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:border-[#8b4513] focus:ring-1 focus:ring-[#8b4513]/25"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isUpdatingConfig}
                  className="w-full bg-[#8b4513] hover:bg-[#a0522d] disabled:bg-[#3d2b1f] text-white py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {isUpdatingConfig ? (
                    <><FaCircleNotch className="animate-spin" size={10} /> Broadcasting...</>
                  ) : (
                    <><FaSave size={10} /> Deploy </>
                  )}
                </button>
              </form>

              {feedback.message && (
                <div className={`mt-3 p-3 rounded-lg text-[10px] tracking-wide border flex items-start gap-2 animate-fadeIn ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
                    : 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                }`}>
                  {feedback.type === 'success' ? (
                    <FaCheckCircle size={12} className="shrink-0 mt-0.5" />
                  ) : (
                    <FaExclamationTriangle size={12} className="shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* DYNAMIC METRICS BOARDS */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
            <MetricCard 
              title="Total Revenue Collected"
              value={`₦${stats.totalGross.toLocaleString()}`}
              subtext={`${stats.successCount} Successful Clearances`}
              icon={FaWallet}
              variant="primary"
            />
            <MetricCard 
              title="Successful Clearances"
              value={stats.successCount}
              subtext="Total Paid Transactions Recorded"
              icon={FaCheckCircle}
              variant="secondary"
            />
          </div>

        </div>

        {/* COMPREHENSIVE QUERY & ACTION BAR */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-[#0a0a0a] p-4 rounded-xl border border-[#1a110b]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 flex-1">
            
            <div className="relative w-full">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
              <input 
                type="text" 
                placeholder="Search Student or Ref..." 
                value={filters.search}
                className="w-full bg-[#111111] border border-[#2a1b12] rounded-lg pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8b4513] focus:ring-1 focus:ring-[#8b4513]/25 transition-colors"
                onChange={e => handleFilterChange('search', e.target.value)}
              />
            </div>

            <FilterSelect 
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              options={['success', 'failed']}
              defaultLabel="All Statuses"
            />

            <FilterSelect 
              icon={FaTag}
              value={filters.narration}
              onChange={e => handleFilterChange('narration', e.target.value)}
              options={NARRATIONS}
              defaultLabel="All Narrations"
            />

            <FilterSelect 
              icon={FaGraduationCap}
              value={filters.level}
              onChange={e => handleFilterChange('level', e.target.value)}
              options={ACADEMIC_LEVELS}
              defaultLabel="All Academic Levels"
            />

            <FilterSelect 
              icon={FaCalendarAlt}
              value={filters.session}
              onChange={e => handleFilterChange('session', e.target.value)}
              options={ACADEMIC_SESSIONS}
              defaultLabel="All Sessions"
            />

          </div>

          <button 
            onClick={exportToCSV}
            disabled={filteredLedger.length === 0}
            className="flex items-center justify-center gap-2 bg-[#111111] hover:bg-[#1a110b] disabled:opacity-40 disabled:pointer-events-none border border-[#2a1b12] hover:border-[#8b4513] text-[#d2b48c] px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap self-stretch xl:self-auto shrink-0"
          >
            <FaDownload size={12} /> Export CSV Audit
          </button>
        </div>

        {/* CENTRALIZED DATABASE VIEWPORTS */}
        <div className="bg-[#0a0a0a] border border-[#2a1b12] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2a1b12] bg-[#111111] text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                  <th className="p-4 whitespace-nowrap">Student Identity</th>
                  <th className="p-4 whitespace-nowrap">Reference ID</th>
                  <th className="p-4 whitespace-nowrap">Narration Purpose</th>
                  <th className="p-4 whitespace-nowrap">Academic Scope</th>
                  <th className="p-4 whitespace-nowrap">Amount Paid (₦)</th>
                  <th className="p-4 text-center whitespace-nowrap">Gate Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#1a110b]">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-16 text-center text-gray-600 uppercase tracking-widest text-[10px] font-bold">
                      No matching financial records discovered in the matrix.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row) => (
                    <tr key={row._id || row.reference} className="hover:bg-[#111111] transition-colors group">
                      <td className="p-4">
                        <p className="font-sans font-bold text-gray-200 group-hover:text-[#d2b48c] transition-colors">{row.studentName}</p>
                        <p className="text-[9px] text-gray-600 mt-0.5 font-mono">
                          {new Date(row.createdAt || row.paidAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="p-4 text-gray-500 font-mono text-[10px] tracking-wider">{row.reference}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#1a110b] text-[#d2b48c] border border-[#3d2b1f]">
                          <FaTag size={8} className="text-[#8b4513]" />
                          {row.narration}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 text-[11px]">
                        <span className="font-bold text-gray-300">{row.targetLevel || 'N/A'}</span> 
                        <span className="opacity-30 mx-2">|</span> 
                        {row.academicYear || 'N/A'}
                      </td>
                      <td className="p-4 font-mono font-bold text-emerald-400 tracking-wide">
                        {Number(row.amount).toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        {row.status === 'success' ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-900/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-500 shadow-inner">
                            <FaCheckCircle size={10} /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-rose-950/20 border border-rose-900/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-rose-500 shadow-inner">
                            <FaExclamationTriangle size={10} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPaymentLedger;