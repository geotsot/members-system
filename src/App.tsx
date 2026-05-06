/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  CreditCard, 
  Plus, 
  Search,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  UserPlus,
  Settings,
  Upload,
  Globe,
  LogIn,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { useAssociationData } from './hooks/useAssociationData';
import { Member, Payment, AssociationSettings } from './types';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

type View = 'dashboard' | 'members' | 'payments' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { members, payments, settings, loading, addMember, updateMember, addPayment, updateSettings } = useAssociationData();
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Calculations for dashboard
  const activeMembersCount = members.filter(m => m.active).length;
  const currentYear = new Date().getFullYear();
  const totalReceivedThisYear = payments
    .filter(p => parseISO(p.date).getFullYear() === currentYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingPaymentsCount = members.filter(member => {
    // Only care about members who were active at some point during the current year
    const wasActiveThisYear = member.active || (member.statusHistory?.some(h => 
      parseISO(h.timestamp).getFullYear() === currentYear && h.active
    ));

    if (!wasActiveThisYear) return false;

    // Basic logic: if they haven't paid this year's annual fee
    const hasPaidThisYear = payments.some(p => 
      p.memberId === member.id && 
      p.type === 'annual' && 
      p.period === currentYear.toString()
    );
    return !hasPaidThisYear;
  }).length;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(console.error);
  };

  const handleLogout = () => {
    signOut(auth).catch(console.error);
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-association-blue border-t-association-gold rounded-full mb-4"
        />
        <p className="text-gray-500 font-serif italic">Φόρτωση συστήματος...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-association-blue text-white p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-3xl shadow-2xl text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-association-gold rounded-3xl flex items-center justify-center text-association-blue font-bold text-4xl mx-auto mb-8 shadow-lg">
            Π
          </div>
          <h1 className="text-2xl font-serif text-gray-900 mb-2">Ποντιακός Σύλλογος</h1>
          <p className="text-gray-500 text-sm mb-8">Σύστημα Διαχείρισης Μελών & Συνδρομών</p>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-association-blue text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-opacity-90 transition-all shadow-md active:scale-95"
          >
            <LogIn size={20} />
            Είσοδος με Google
          </button>
          
          <p className="mt-8 text-[10px] text-gray-400 font-mono tracking-widest uppercase">
            ΠΡΟΣΒΑΣΗ ΜΟΝΟ ΓΙΑ ΕΞΟΥΣΙΟΔΟΤΗΜΕΝΟΥΣ
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-association-blue text-white flex flex-col shadow-xl z-20">
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded bg-white p-1" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-association-gold rounded flex items-center justify-center text-association-blue font-bold text-xl">
                Π
              </div>
            )}
          </div>
          <h1 className="text-lg font-serif text-association-gold font-bold tracking-tight leading-tight">
            {settings.name}
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/60 mt-2 font-mono">
            ΣΥΣΤΗΜΑ ΔΙΑΧΕΙΡΙΣΗΣ
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="Πίνακας Ελέγχου" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<Users size={18} />} 
            label="Μέλη" 
            active={currentView === 'members'} 
            onClick={() => setCurrentView('members')} 
          />
          <NavItem 
            icon={<CreditCard size={18} />} 
            label="Συνδρομές" 
            active={currentView === 'payments'} 
            onClick={() => setCurrentView('payments')} 
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="Ρυθμίσεις" 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 px-2">
            {user.photoURL && (
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-medium truncate">{user.displayName}</p>
              <button 
                onClick={handleLogout}
                className="text-[10px] text-white/50 hover:text-association-gold flex items-center gap-1 mt-1 font-mono uppercase tracking-tighter"
              >
                <LogOut size={10} /> ΑΠΟΣΥΝΔΕΣΗ
              </button>
            </div>
          </div>
          <div className="px-2 text-[10px] text-white/40 font-mono">
            © 2026 ΑΥΤΟΝΟΜΟ ΣΥΣΤΗΜΑ
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-gray-700 capitalize">
              {currentView === 'dashboard' ? 'Επισκόπηση' : 
               currentView === 'members' ? 'Διαχείριση Μελών' : 
               currentView === 'payments' ? 'Οικονομικά' : 
               'Ρυθμίσεις Συλλόγου'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsMemberModalOpen(true)}
                className="bg-association-blue text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-opacity-90 transition-all shadow-md active:scale-95"
             >
                <UserPlus size={18} />
                Νέο Μέλος
             </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {currentView === 'dashboard' && (
                <DashboardView 
                  stats={{
                    totalMembers: members.length,
                    activeMembers: activeMembersCount,
                    totalRevenueYear: totalReceivedThisYear,
                    pending: pendingPaymentsCount
                  }} 
                  recentPayments={payments.slice(-5).reverse().map(p => ({
                    ...p,
                    memberName: members.find(m => m.id === p.memberId)?.fullName || 'Άγνωστο'
                  }))}
                />
              )}

              {currentView === 'members' && (
                <MembersView 
                   members={members.filter(m => 
                     m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     m.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
                   )}
                   searchQuery={searchQuery}
                   onSearch={setSearchQuery}
                   onEdit={(m) => setEditingMember(m)}
                />
              )}

              {currentView === 'payments' && (
                <PaymentsView 
                  members={members}
                  payments={payments}
                  onAddPayment={addPayment}
                  settings={settings}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView 
                  settings={settings}
                  onUpdate={updateSettings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {(isMemberModalOpen || editingMember) && (
            <MemberModal 
              member={editingMember || undefined}
              onClose={() => {
                setIsMemberModalOpen(false);
                setEditingMember(null);
              }} 
              onSave={(m) => {
                if (editingMember) {
                  updateMember(editingMember.id, m);
                } else {
                  addMember({
                    ...m,
                    statusHistory: [{ active: m.active, timestamp: new Date().toISOString() }]
                  });
                }
                setIsMemberModalOpen(false);
                setEditingMember(null);
              }}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-white/10 text-association-gold shadow-inner font-medium border-l-4 border-association-gold' 
          : 'text-white/70 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm tracking-wide">{label}</span>
    </button>
  );
}

function DashboardView({ stats, recentPayments }: { stats: any, recentPayments: any[] }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" />} 
          label="Σύνολο Μελών" 
          value={stats.totalMembers} 
          subtext={`${stats.activeMembers} Ενεργά`}
        />
        <StatCard 
          icon={<TrendingUp className="text-green-600" />} 
          label="Έσοδα Έτους" 
          value={`${stats.totalRevenueYear}€`} 
          subtext="Τρέχον έτος"
        />
        <StatCard 
          icon={<AlertCircle className="text-orange-600" />} 
          label="Οικονομικές Εκκρεμότητες" 
          value={stats.pending} 
          subtext="Μέλη χωρίς συνδρομή έτους"
        />
        <StatCard 
          icon={<CheckCircle2 className="text-indigo-600" />} 
          label="Ενεργά Μέλη" 
          value={`${Math.round((stats.activeMembers / (stats.totalMembers || 1)) * 100)}%`} 
          subtext="Ποσοστό συμμετοχής"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-serif mb-6 text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-4">
             <LayoutDashboard size={20} className="text-association-blue" />
             Πρόσφατες Πληρωμές
          </h3>
          <div className="space-y-4">
            {recentPayments.length === 0 ? (
              <p className="text-center py-12 text-gray-400 italic">Δεν υπάρχουν πρόσφατες πληρωμές.</p>
            ) : (
              recentPayments.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-association-blue shadow-sm border border-gray-100">
                      {p.type === 'annual' ? 'Ε' : 'Μ'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{p.memberName}</p>
                      <p className="text-xs text-gray-500">{p.type === 'annual' ? 'Ετήσια' : 'Μηνιαία'} συνδρομή ({p.period})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-association-blue">{p.amount}€</p>
                    <p className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{format(parseISO(p.date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-association-blue text-white rounded-2xl shadow-lg p-6 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-700"></div>
          <div>
            <h3 className="text-xl font-serif text-association-gold mb-2">Σημείο Ενημέρωσης</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Καλωσορίσατε στο σύστημα διαχείρισης του Ποντιακού Συλλόγου. 
              Όλα τα δεδομένα αποθηκεύονται τοπικά σε αυτόν τον υπολογιστή.
            </p>
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-sm">
               <Calendar size={18} className="text-association-gold" />
               <span>Σήμερα: {format(new Date(), 'dd MMMM yyyy')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext }: { icon: React.ReactNode, label: string, value: string | number, subtext: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="p-3 bg-gray-50 rounded-xl">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
        <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
        <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider font-semibold">{subtext}</p>
      </div>
    </div>
  );
}

function MembersView({ members, searchQuery, onSearch, onEdit }: { members: Member[], searchQuery: string, onSearch: (s: string) => void, onEdit: (m: Member) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Αναζήτηση με όνομα ή ΑΔΤ..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 focus:border-association-blue outline-none transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 italic font-mono text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-normal">Ονοματεπώνυμο / Πατρώνυμο</th>
                <th className="px-6 py-4 font-normal">ΑΔΤ</th>
                <th className="px-6 py-4 font-normal">Ημ. Γέννησης</th>
                <th className="px-6 py-4 font-normal">Ημ. Εγγραφής</th>
                <th className="px-6 py-4 font-normal">Κατάσταση</th>
                <th className="px-6 py-4 font-normal text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                    Δεν βρέθηκαν μέλη.
                  </td>
                </tr>
              ) : (
                members.map(m => (
                  <tr key={m.id} className="hover:bg-association-blue/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-serif font-semibold text-gray-800">{m.fullName}</p>
                        <p className="text-xs text-gray-500">του {m.fatherName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{m.idNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(m.birthDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(m.registrationDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        m.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.active ? 'Ενεργό' : 'Ανενεργό'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                        onClick={() => onEdit(m)}
                        className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-association-blue transition-all border border-transparent hover:border-gray-100"
                        title="Επεξεργασία"
                       >
                          <Settings size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaymentsView({ members, payments, onAddPayment, settings }: { members: Member[], payments: Payment[], onAddPayment: (p: any) => void, settings: any }) {
  const [selectedMember, setSelectedMember] = useState('');
  const [amount, setAmount] = useState(settings.annualFee.toString());
  const [type, setType] = useState<'annual' | 'monthly'>('annual');
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<'log' | 'arrears'>('log');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    
    onAddPayment({
      memberId: selectedMember,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      type,
      period
    });
    
    setSelectedMember('');
    alert('Η πληρωμή καταχωρήθηκε επιτυχώς!');
  };

  const arrears = members.filter(m => m.active).map(member => {
    const currentYear = new Date().getFullYear().toString();
    const hasPaidAnnual = payments.some(p => p.memberId === member.id && p.type === 'annual' && p.period === currentYear);
    return {
      ...member,
      pendingAnnual: !hasPaidAnnual
    };
  }).filter(m => m.pendingAnnual);

  return (
    <div className="space-y-8">
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('log')}
          className={`pb-4 px-2 text-sm font-medium transition-all ${activeTab === 'log' ? 'border-b-2 border-association-blue text-association-blue' : 'text-gray-400'}`}
        >
          Καταχώρηση & Ιστορικό
        </button>
        <button 
          onClick={() => setActiveTab('arrears')}
          className={`pb-4 px-2 text-sm font-medium transition-all ${activeTab === 'arrears' ? 'border-b-2 border-association-blue text-association-blue' : 'text-gray-400'}`}
        >
          Οικονομικές Εκκρεμότητες ({arrears.length})
        </button>
      </div>

      {activeTab === 'log' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
            <h3 className="text-lg font-serif mb-6 text-gray-800 flex items-center gap-2">
               <Plus size={20} className="text-association-blue" />
               Καταχώρηση Συνδρομής
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Μέλος
                </label>
                <select 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  required
                >
                  <option value="">Επιλογή μέλους...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Τύπος
                  </label>
                  <select 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                    value={type}
                    onChange={(e) => {
                      const val = e.target.value as 'annual' | 'monthly';
                      setType(val);
                      setAmount(val === 'annual' ? settings.annualFee.toString() : settings.monthlyFee.toString());
                      setPeriod(val === 'annual' ? new Date().getFullYear().toString() : format(new Date(), 'yyyy-MM'));
                    }}
                  >
                    <option value="annual">Ετήσια</option>
                    <option value="monthly">Μηνιαία</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Ποσό (€)
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Περίοδος (Έτος ή Μήνας)
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="π.χ. 2024 ή 2024-05"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-association-blue text-white py-3 rounded-xl font-medium mt-4 shadow-lg active:scale-95 transition-all hover:bg-opacity-90"
              >
                Καταχώρηση Πληρωμής
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-serif mb-6 text-gray-800 border-b border-gray-50 pb-4">
               Ιστορικό Πληρωμών
            </h3>
            <div className="space-y-4">
              {payments.length === 0 ? (
                <p className="text-center py-12 text-gray-400 italic">Δεν υπάρχουν πληρωμές ακόμα.</p>
              ) : (
                payments.slice(-10).reverse().map(p => {
                  const member = members.find(m => m.id === p.memberId);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-l-4 border-association-gold">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{member?.fullName || 'Άγνωστο Μέλος'}</p>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {p.type === 'annual' ? 'Ετήσια' : 'Μηνιαία'} συνδρομή {p.period}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-association-blue text-lg">{p.amount}€</p>
                        <p className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{format(parseISO(p.date), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
              <AlertCircle className="text-orange-600" size={20} />
              <p className="text-sm font-medium text-orange-800">
                Παρακάτω εμφανίζονται τα ενεργά μέλη που δεν έχουν εξοφλήσει την <strong>ετήσια συνδρομή</strong> για το έτος {new Date().getFullYear()}.
              </p>
           </div>
           <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 italic font-mono text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-normal">Μέλος</th>
                <th className="px-6 py-4 font-normal">ΑΔΤ</th>
                <th className="px-6 py-4 font-normal">Ημ. Εγγραφής</th>
                <th className="px-6 py-4 font-normal text-right">Ενέργεια</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {arrears.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                    Όλα τα ενεργά μέλη είναι οικονομικά τακτοποιημένα!
                  </td>
                </tr>
              ) : (
                arrears.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-serif font-bold text-gray-800">{m.fullName}</p>
                      <p className="text-xs text-gray-500">του {m.fatherName}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{m.idNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{format(parseISO(m.registrationDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-right">
                       <button 
                          onClick={() => {
                            setSelectedMember(m.id);
                            setActiveTab('log');
                          }}
                          className="text-xs font-bold text-association-blue hover:underline"
                       >
                          ΕΞΟΦΛΗΣΗ
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
           </table>
        </div>
      )}
    </div>
  );
}

function SettingsView({ settings, onUpdate }: { settings: AssociationSettings, onUpdate: (s: Partial<AssociationSettings>) => void }) {
  const [formData, setFormData] = useState(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    alert('Οι ρυθμίσεις αποθηκεύτηκαν!');
  };

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-association-blue text-white flex items-center gap-3">
          <Settings size={22} className="text-association-gold" />
          <h3 className="text-lg font-serif italic text-white">Στοιχεία Συλλόγου</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Επωνυμία Συλλόγου</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΑΦΜ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.vatNumber}
                onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Διεύθυνση / Έδρα</label>
            <input 
              type="text" 
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">URL Λογοτύπου (Εικόνα)</label>
            <div className="flex gap-4">
              <input 
                type="text" 
                className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
              />
              {formData.logoUrl && (
                <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 object-contain rounded border border-gray-100 bg-white" referrerPolicy="no-referrer" />
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Ετήσια Συνδρομή (€)</label>
              <input 
                type="number" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.annualFee}
                onChange={(e) => setFormData({...formData, annualFee: parseFloat(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Μηνιαία Συνδρομή (€)</label>
              <input 
                type="number" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.monthlyFee}
                onChange={(e) => setFormData({...formData, monthlyFee: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div className="pt-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
            <Globe className="text-association-blue shrink-0 mt-1" size={20} />
            <div>
              <h4 className="font-bold text-association-blue text-sm mb-1">Συγχρονισμός Δεδομένων</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Το σύστημα υποστηρίζει αυτόματο συγχρονισμό στο Cloud μέσω Firebase. 
                Μόλις ολοκληρωθεί η ρύθμιση από τον διαχειριστή, τα δεδομένα σας θα είναι προσβάσιμα από παντού και θα παραμένουν διαθέσιμα ακόμα και χωρίς σύνδεση.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              className="w-full py-4 bg-association-gold text-white rounded-xl font-bold font-serif shadow-lg hover:brightness-110 active:scale-95 transition-all text-lg"
            >
              Ενημέρωση Στοιχείων
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MemberModal({ member, onClose, onSave }: { member?: Member, onClose: () => void, onSave: (m: Omit<Member, 'id'>) => void }) {
  const [formData, setFormData] = useState({
    fullName: member?.fullName || '',
    fatherName: member?.fatherName || '',
    birthDate: member?.birthDate || '',
    idNumber: member?.idNumber || '',
    registrationDate: member?.registrationDate || format(new Date(), 'yyyy-MM-dd'),
    active: member?.active ?? true,
    notes: member?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="bg-association-blue p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-serif text-association-gold">
            {member ? 'Επεξεργασία Μέλους' : 'Εγγραφή Νέου Μέλους'}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Ονοματεπώνυμο</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Πατρώνυμο</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.fatherName}
                onChange={(e) => setFormData({...formData, fatherName: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Αριθμός Ταυτότητας</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.idNumber}
                onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Ημ. Γέννησης</label>
              <input 
                type="date" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.birthDate}
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Ημ. Εγγραφής</label>
              <input 
                type="date" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.registrationDate}
                onChange={(e) => setFormData({...formData, registrationDate: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="active" 
              checked={formData.active} 
              onChange={(e) => setFormData({...formData, active: e.target.checked})}
              className="w-5 h-5 accent-association-blue"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700 underline underline-offset-4 decoration-association-gold/30">Ενεργό Μέλος</label>
          </div>

          <div className="pt-6 flex gap-4">
             <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Ακύρωση
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-association-gold text-white rounded-xl font-medium shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              {member ? 'Ενημέρωση' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
