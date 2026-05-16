/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  LogOut,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { useAssociationData } from './hooks/useAssociationData';
import { Member, Payment, AssociationSettings, SubscriptionType } from './types';
import { ALLOWED_EMAILS } from './constants';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

const stripAccents = (text: string) => {
  const map: { [key: string]: string } = {
    'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ'
  };
  return text.split('').map(char => map[char] || char).join('').toUpperCase();
};

type View = 'dashboard' | 'members' | 'payments' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { members, payments, settings, loading, addMember, updateMember, addPayment, updatePayment, updateSettings } = useAssociationData();
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Set document title dynamically
  useEffect(() => {
    if (settings.name) {
      document.title = settings.name;
    }
  }, [settings.name]);

  // Calculations for dashboard
  const activeMembersCount = members.filter(m => m.active).length;
  const danceMembersCount = members.filter(m => m.active && m.isDanceMember).length;
  const currentYear = new Date().getFullYear();
  const totalReceivedThisYear = payments
    .filter(p => parseISO(p.date).getFullYear() === currentYear)
    .reduce((sum, p) => sum + p.amount, 0);

  const arrears = members.filter(member => {
    const wasActiveThisYear = member.active || (member.statusHistory?.some(h => 
      parseISO(h.timestamp).getFullYear() === currentYear && h.active
    ));
    return wasActiveThisYear;
  }).map(member => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    // Check annual
    const hasPaidAnnual = payments.some(p => 
      p.memberId === member.id && 
      p.type === 'annual' && 
      p.period.toString().trim() === currentYear.toString()
    );
    
    // Check monthly/dance obligations
    let monthlyExpectedDebt = 0;
    const monthlyFee = member.isDanceMember ? settings.danceMonthlyFee : settings.monthlyFee;

    // Total paid for monthly/dance in the current year
    const totalPaidMonthlyThisYear = payments.filter(p => 
      p.memberId === member.id && 
      (p.type === 'dance' || p.type === 'monthly') && 
      p.period.toString().includes(currentYear.toString())
    ).reduce((sum, p) => sum + p.amount, 0);

    if (member.isDanceMember) {
      const regDate = parseISO(member.registrationDate);
      const regYear = regDate.getFullYear();
      const startMonth = regYear === currentYear ? regDate.getMonth() + 1 : 1;
      
      for (let m = startMonth; m < currentMonth; m++) {
        const monthDate = new Date(currentYear, m - 1, 15);
        
        // Check activity status for that specific month
        const historyBefore = member.statusHistory
          ?.filter(h => parseISO(h.timestamp) <= monthDate)
          .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
        
        const wasActiveInMonth = historyBefore && historyBefore.length > 0 
          ? historyBefore[0].active 
          : member.active;

        if (wasActiveInMonth) {
          monthlyExpectedDebt += monthlyFee;
        }
      }
    }

    const monthlyArrears = Math.max(0, monthlyExpectedDebt - totalPaidMonthlyThisYear);
    const monthlyPendingCount = Math.ceil(monthlyArrears / (monthlyFee || 1));

    const totalArrears = (hasPaidAnnual ? 0 : settings.annualFee) + monthlyArrears;

    return {
      ...member,
      pendingAnnual: !hasPaidAnnual,
      monthlyPending: monthlyPendingCount,
      totalArrears
    };
  }).filter(m => m.totalArrears > 0);

  const pendingPaymentsCount = arrears.length;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && u.email && !ALLOWED_EMAILS.includes(u.email)) {
        signOut(auth).then(() => {
          setAuthError('Δεν έχετε δικαίωμα πρόσβασης σε αυτό το σύστημα. Παρακαλώ συνδεθείτε με εξουσιοδοτημένο λογαριασμό.');
          setUser(null);
          setAuthLoading(false);
        });
      } else {
        setUser(u);
        setAuthError(null);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((err) => {
      console.error(err);
      setAuthError('Προέκυψε σφάλμα κατά τη σύνδεση.');
    });
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
          {settings.logoUrl ? (
            <div className="p-2 bg-white rounded-2xl shadow-lg mb-8 inline-block">
              <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 object-contain mx-auto" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-association-gold rounded-3xl flex items-center justify-center text-association-blue font-bold text-4xl mx-auto mb-8 shadow-lg">
              {settings.name?.charAt(0) || 'Π'}
            </div>
          )}
          <h1 className="text-2xl font-serif text-gray-900 mb-2">{settings.name}</h1>
          <p className="text-gray-500 text-sm mb-4">Σύστημα Διαχείρισης Μελών & Συνδρομών</p>
          
          <div className="mb-8 space-y-1">
             <p className="text-xs text-gray-400 italic">{settings.address}</p>
             {settings.vatNumber && (
               <p className="text-[10px] text-gray-400 font-mono tracking-tighter">
                 ΑΦΜ: {settings.vatNumber}
               </p>
             )}
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-left">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 leading-relaxed font-medium">
                {authError}
              </p>
            </div>
          )}
          
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
      <aside className="w-64 bg-association-blue text-white flex flex-col shadow-xl z-20 no-print">
        <div className="p-6 border-b border-white/10">
          <div className="flex flex-col items-center text-center mb-4">
            {settings.logoUrl ? (
              <div className="p-2 bg-white rounded-2xl shadow-lg mb-4">
                <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-association-gold rounded-2xl flex items-center justify-center text-association-blue font-bold text-3xl shadow-lg mb-4">
                Π
              </div>
            )}
            <h1 className="text-xl font-serif text-association-gold font-bold tracking-tight leading-snug px-2">
              {settings.name}
            </h1>
          </div>
          <div className="space-y-1 text-center border-t border-white/5 pt-3">
             <p className="text-xs text-white/70 leading-relaxed italic">
               {settings.address}
             </p>
             {settings.vatNumber && (
               <p className="text-[11px] text-white/40 font-mono tracking-tighter">
                 ΑΦΜ: {settings.vatNumber}
               </p>
             )}
          </div>
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
          <div className="px-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
            © {currentYear} Συστημα διαχειρισης μελων
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm no-print">
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
                    danceMembers: danceMembersCount,
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
                   members={members}
                   searchQuery={searchQuery}
                   onSearch={setSearchQuery}
                   onEdit={(m) => setEditingMember(m)}
                   settings={settings}
                />
              )}

              {currentView === 'payments' && (
                <PaymentsView 
                  members={members}
                  payments={payments}
                  onAddPayment={addPayment}
                  onUpdatePayment={updatePayment}
                  settings={settings}
                  arrears={arrears}
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
    <div className="space-y-8 no-print">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" />} 
          label="Σύνολο Μελών" 
          value={stats.totalMembers} 
          subtext={stripAccents(`${stats.activeMembers} Ενεργά`)}
        />
        <StatCard 
          icon={<CheckCircle2 className="text-indigo-600" />} 
          label="Τμήματα Χορού" 
          value={stats.danceMembers} 
          subtext={stripAccents("Εγγεγραμμένοι χορευτές")}
        />
        <StatCard 
          icon={<TrendingUp className="text-green-600" />} 
          label="Έσοδα Έτους" 
          value={`${stats.totalRevenueYear}€`} 
          subtext={stripAccents("Συνολικές εισπράξεις")}
        />
        <StatCard 
          icon={<AlertCircle className="text-orange-600" />} 
          label="Εκκρεμότητες" 
          value={stats.pending} 
          subtext={stripAccents("Μέλη με οφειλές")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                      <p className="text-xs text-gray-500">{stripAccents(p.type === 'annual' ? 'Ετήσια' : 'Μηνιαία')} ΣΥΝΔΡΟΜΗ ({p.period})</p>
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

function MembersView({ members, searchQuery, onSearch, onEdit, settings }: { members: Member[], searchQuery: string, onSearch: (s: string) => void, onEdit: (m: Member) => void, settings: AssociationSettings }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Sort members by registration date to calculate A/A consistently
  const sortedMembers = [...members].sort((a, b) => 
    parseISO(a.registrationDate).getTime() - parseISO(b.registrationDate).getTime() ||
    a.fullName.localeCompare(b.fullName)
  );

  const filteredMembers = sortedMembers.filter(m => {
    const matchesSearch = m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         m.idNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && m.active) || 
                         (filter === 'inactive' && !m.active);
    return matchesSearch && matchesFilter;
  }).map(m => ({
    ...m,
    index: sortedMembers.findIndex(sm => sm.id === m.id) + 1
  }));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Αναζήτηση..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 focus:border-association-blue outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>

          <div className="flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filter === f 
                    ? 'bg-association-blue text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'ΟΛΑ' : f === 'active' ? 'ΕΝΕΡΓΑ' : 'ΑΝΕΝΕΡΓΑ'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2 no-print">
          <button 
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium active:scale-95 shadow-sm whitespace-nowrap"
            title="Εκτύπωση"
          >
            <Printer size={18} />
            Εκτύπωση
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 italic font-mono text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-normal w-16 whitespace-nowrap">Α/Α</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">Ονοματεπωνυμο / Πατρωνυμο</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">ΑΔΤ</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">Ημ. Γεννησης</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">Ημ. Εγγραφης</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">Κατασταση</th>
                <th className="px-6 py-4 font-normal text-right whitespace-nowrap">Ενεργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                    Δεν βρέθηκαν μέλη.
                  </td>
                </tr>
              ) : (
                filteredMembers.map(m => (
                  <tr key={m.id} className="hover:bg-association-blue/5 transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono text-gray-400">{m.index}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${m.memberType === 'member' ? 'bg-association-blue' : 'bg-association-gold'}`} title={m.memberType === 'member' ? 'Μέλος' : 'Φίλος'} />
                        <div>
                          <p className="font-serif font-semibold text-gray-800">{m.fullName}</p>
                          <p className="text-xs text-gray-500">του {m.fatherName} <span className="opacity-50 ml-1 italic text-[10px]">({m.memberType === 'member' ? 'Μέλος' : 'Φίλος'})</span></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{m.idNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(m.birthDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(m.registrationDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        m.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.active ? 'ΕΝΕΡΓΟ' : 'ΑΝΕΝΕΡΓΟ'}
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

      {/* Printable Area */}
      <div className="print-only">
        <div className="print-header mb-8 pb-6 border-b-2 border-association-blue">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                )}
                <div>
                  <h1 className="text-2xl font-serif font-bold text-association-blue leading-tight">{settings.name}</h1>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-gray-600 italic">{settings.address}</p>
                    {settings.vatNumber && <p className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">ΑΦΜ: {settings.vatNumber}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-association-blue text-white px-4 py-2 rounded-lg inline-block mb-2">
                  <p className="text-sm font-bold tracking-widest uppercase">
                    ΚΑΤΑΣΤΑΣΗ ΜΕΛΩΝ {filter === 'active' ? '(ΕΝΕΡΓΑ)' : filter === 'inactive' ? '(ΑΝΕΝΕΡΓΑ)' : ''}
                  </p>
                </div>
                <p className="text-xs text-gray-500 font-mono italic">Ημερομηνία εκτύπωσης: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
           </div>
        </div>

        <table className="w-full border-collapse">
           <thead className="print-table-header">
              <tr className="bg-gray-50 uppercase text-[10px] tracking-wider">
                <th className="whitespace-nowrap">A/A</th>
                <th className="whitespace-nowrap">Ονοματεπωνυμο</th>
                <th className="whitespace-nowrap">Ημ. Εγγραφης</th>
                <th className="whitespace-nowrap">Κατασταση</th>
              </tr>
           </thead>
           <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td>{m.index}</td>
                  <td>{m.fullName} <span className="text-[9px] uppercase tracking-tighter opacity-70">({m.memberType === 'member' ? 'ΜΕΛ.' : 'ΦΙΛ.'})</span></td>
                  <td>{format(parseISO(m.registrationDate), 'dd/MM/yyyy')}</td>
                  <td>{m.active ? 'ΕΝΕΡΓΟ' : 'ΑΝΕΝΕΡΓΟ'}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50 uppercase text-[10px] border-t-2 border-black">
                 <td colSpan={3} className="text-right py-2 px-4">Συνολο μελων:</td>
                 <td className="py-2 px-4">{filteredMembers.length}</td>
              </tr>
           </tbody>
        </table>
        
        <div className="mt-12 flex justify-end">
           <div className="text-center w-64 border-t border-black pt-2">
              <p className="font-bold text-xs uppercase underline">Ο ΓΡΑΜΜΑΤΕΑΣ</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsView({ members, payments, onAddPayment, onUpdatePayment, settings, arrears }: { members: Member[], payments: Payment[], onAddPayment: (p: any) => void, onUpdatePayment: (id: string, p: any) => void, settings: any, arrears: any[] }) {
  const [selectedMember, setSelectedMember] = useState('');
  const [amount, setAmount] = useState(settings.annualFee.toString());
  const [type, setType] = useState<SubscriptionType>('annual');
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<'log' | 'arrears'>('log');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const handleEditClick = (p: Payment) => {
    setEditingPaymentId(p.id);
    setSelectedMember(p.memberId);
    setAmount(p.amount.toString());
    setType(p.type);
    setPeriod(p.period);
    setActiveTab('log');
  };

  const handleCancelEdit = () => {
    setEditingPaymentId(null);
    setSelectedMember('');
    setAmount(settings.annualFee.toString());
    setType('annual');
    setPeriod(new Date().getFullYear().toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    
    const paymentData = {
      memberId: selectedMember,
      amount: Math.max(1, Math.floor(parseFloat(amount) || 1)),
      date: editingPaymentId ? payments.find(p => p.id === editingPaymentId)?.date || new Date().toISOString() : new Date().toISOString(),
      type,
      period
    };

    if (editingPaymentId) {
      onUpdatePayment(editingPaymentId, paymentData);
      setEditingPaymentId(null);
      alert('Η πληρωμή ενημερώθηκε επιτυχώς!');
    } else {
      onAddPayment(paymentData);
      alert('Η πληρωμή καταχωρήθηκε επιτυχώς!');
    }
    
    setSelectedMember('');
  };

  const arrearsTotal = arrears.reduce((sum, m) => sum + m.totalArrears, 0);

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
               <Plus size={20} className={editingPaymentId ? "text-association-gold" : "text-association-blue"} />
               {editingPaymentId ? 'Επεξεργασία Πληρωμής' : 'Καταχώρηση Συνδρομής'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  ΜΕΛΟΣ
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

              {selectedMember && (() => {
                const memberArrears = arrears.find(a => a.id === selectedMember);
                if (!memberArrears || memberArrears.totalArrears === 0) return null;
                return (
                  <div className="flex items-center justify-between p-3 bg-association-gold/10 border border-association-gold/20 rounded-xl">
                    <div>
                      <p className="text-[10px] text-association-gold font-bold uppercase tracking-wider">ΟΦΕΙΛΟΜΕΝΟ ΠΟΣΟ</p>
                      <p className="font-bold text-gray-800">{memberArrears.totalArrears}€</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAmount(memberArrears.totalArrears.toString())}
                      className="bg-association-gold text-association-blue px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"
                    >
                      ΧΡΗΣΗ ΠΟΣΟΥ
                    </button>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    ΤΥΠΟΣ
                  </label>
                  <select 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                    value={type}
                    onChange={(e) => {
                      const val = e.target.value as SubscriptionType;
                      setType(val);
                      if (val === 'annual') setAmount(settings.annualFee.toString());
                      else if (val === 'dance') setAmount(settings.danceMonthlyFee.toString());
                      else setAmount(settings.monthlyFee.toString());
                      
                      setPeriod(val === 'annual' ? new Date().getFullYear().toString() : format(new Date(), 'yyyy-MM'));
                    }}
                  >
                    <option value="annual">Ετήσια (Γενική)</option>
                    <option value="dance">Μηνιαία (Χορευτικό)</option>
                    <option value="monthly">Μηνιαία (Γενική)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    ΠΟΣΟ (€)
                  </label>
                  <input 
                    type="number" 
                    step="1"
                    min="1"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmount(val);
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  ΠΕΡΙΟΔΟΣ (ΕΤΟΣ Η ΜΗΝΑΣ)
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="π.χ. 2026 ή 2026-05 ή ΙΑΝ-ΑΠΡ 2026"
                  required
                />
                <p className="text-[9px] text-gray-400 mt-1 ml-1 italic">
                  * Μπορείτε να εισάγετε εύρος μηνών (π.χ. "Μήνες 1-4 2026") για μαζικές πληρωμές.
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                {editingPaymentId && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 border border-gray-200 text-gray-500 py-3 rounded-xl font-medium shadow-sm active:scale-95 transition-all hover:bg-gray-50"
                  >
                    Ακύρωση
                  </button>
                )}
                <button 
                  type="submit"
                  className={`flex-[2] text-white py-3 rounded-xl font-medium shadow-lg active:scale-95 transition-all hover:bg-opacity-90 ${editingPaymentId ? 'bg-association-gold' : 'bg-association-blue'}`}
                >
                  {editingPaymentId ? 'Ενημέρωση Πληρωμής' : 'Καταχώρηση Πληρωμής'}
                </button>
              </div>
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
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-l-4 border-association-gold group">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{member?.fullName || 'Άγνωστο Μέλος'}</p>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {p.type === 'annual' ? 'Ετησια' : 'Μηνιαια'} συνδρομη {p.period}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-bold text-association-blue text-lg">{p.amount}€</p>
                          <p className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{format(parseISO(p.date), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                        <button 
                          onClick={() => handleEditClick(p)}
                          className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-association-blue"
                          title="Επεξεργασία"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end no-print">
            <button 
              onClick={() => setTimeout(() => window.print(), 50)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium active:scale-95 shadow-sm"
            >
              <Printer size={18} />
              Εκτύπωση Οφειλών
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden no-print">
            <div className="p-6 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
              <AlertCircle className="text-orange-600" size={20} />
              <p className="text-sm font-medium text-orange-800">
                Παρακάτω εμφανίζονται τα ενεργά μέλη που δεν έχουν εξοφλήσει την <strong>ετήσια συνδρομή</strong> για το έτος {new Date().getFullYear()}.
              </p>
           </div>
           <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 italic font-mono text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-normal whitespace-nowrap">Μελος</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">ΑΔΤ</th>
                <th className="px-6 py-4 font-normal whitespace-nowrap">Ημ. Εγγραφης</th>
                <th className="px-6 py-4 font-normal text-right whitespace-nowrap">Ενεργεια</th>
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
                      <div className="flex gap-1 mt-1">
                        {m.pendingAnnual && <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded border border-red-100">Ετήσια</span>}
                        {m.monthlyPending > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1 rounded border border-orange-100">{m.monthlyPending} Μήνες Χορ.</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{m.idNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{format(parseISO(m.registrationDate), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-right">
                       <p className="font-bold text-association-blue text-sm mb-1">{m.totalArrears}€</p>
                       <button 
                          onClick={() => {
                            setSelectedMember(m.id);
                            setActiveTab('log');
                          }}
                          className="text-[10px] font-bold text-association-gold hover:underline uppercase"
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

        {/* Printable Area for Arrears */}
        <div className="print-only">
          <div className="print-header">
             <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-association-blue">{settings.name}</h1>
                  <p className="text-sm text-gray-600">{settings.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase underline mb-1">ΚΑΤΑΣΤΑΣΗ ΟΦΕΙΛΩΝ</p>
                  <p className="text-xs text-gray-700">ΕΤΗΣΙΑ ΣΥΝΔΡΟΜΗ {new Date().getFullYear()}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Ημερομηνία εκτύπωσης: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                </div>
             </div>
          </div>

          <table className="w-full border-collapse">
             <thead className="print-table-header">
                <tr className="bg-gray-50 uppercase text-[10px] tracking-wider">
                  <th className="whitespace-nowrap text-center" style={{ width: '80px', minWidth: '80px' }}>Α/Α</th>
                  <th className="whitespace-nowrap">Ονοματεπωνυμο</th>
                  <th className="whitespace-nowrap">Πατρωνυμο</th>
                  <th className="whitespace-nowrap">ΑΔΤ</th>
                  <th className="whitespace-nowrap text-right">Ποσο</th>
                </tr>
             </thead>
             <tbody>
                {arrears.map((m, idx) => (
                  <tr key={m.id}>
                    <td>{idx + 1}</td>
                    <td>{m.fullName}</td>
                    <td>{m.fatherName}</td>
                    <td>{m.idNumber}</td>
                    <td className="text-right">{m.totalArrears}€</td>
                  </tr>
                ))}
             </tbody>
          </table>
          
          <div className="mt-8 flex justify-between items-end">
            <p className="text-xs italic">Σημείωση: Οι οφειλές περιλαμβάνουν την ετήσια συνδρομή και τυχόν μηνιαίες συνδρομές χορευτικού.</p>
            <div className="text-right">
              <p className="text-lg font-bold">Σύνολο: {arrearsTotal}€</p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function SettingsView({ settings, onUpdate }: { settings: AssociationSettings, onUpdate: (s: Partial<AssociationSettings>) => void }) {
  const [formData, setFormData] = useState({
    ...settings,
    name: settings.name || '',
    address: settings.address || '',
    vatNumber: settings.vatNumber || '',
    logoUrl: settings.logoUrl || ''
  });

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
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΕΠΩΝΥΜΙΑ ΣΥΛΛΟΓΟΥ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΑΦΜ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.vatNumber || ''}
                onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΔΙΕΥΘΥΝΣΗ / ΕΔΡΑ</label>
            <input 
              type="text" 
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
              value={formData.address || ''}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">URL ΛΟΓΟΤΥΠΟΥ (ΕΙΚΟΝΑ)</label>
            <div className="flex gap-4">
              <input 
                type="text" 
                className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl || ''}
                onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
              />
              {formData.logoUrl && (
                <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 object-contain rounded border border-gray-100 bg-white" referrerPolicy="no-referrer" />
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΕΤΗΣΙΑ (€)</label>
              <input 
                type="number" 
                step="1"
                min="1"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.annualFee ?? 1}
                onChange={(e) => setFormData({...formData, annualFee: parseInt(e.target.value) || 1})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΜΗΝΙΑΙΑ (€)</label>
              <input 
                type="number" 
                step="1"
                min="1"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.monthlyFee ?? 1}
                onChange={(e) => setFormData({...formData, monthlyFee: parseInt(e.target.value) || 1})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΧΟΡΕΥΤΙΚΟ (€)</label>
              <input 
                type="number" 
                step="1"
                min="1"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.danceMonthlyFee ?? 1}
                onChange={(e) => setFormData({...formData, danceMonthlyFee: parseInt(e.target.value) || 1})}
              />
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
    memberType: member?.memberType || 'member',
    isDanceMember: member?.isDanceMember ?? false,
    notes: member?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="bg-association-blue p-6 text-white flex justify-between items-center no-print">
          <h3 className="text-xl font-serif text-association-gold">
            {member ? 'Επεξεργασία Μέλους' : 'Εγγραφή Νέου Μέλους'}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6 no-print">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΟΝΟΜΑΤΕΠΩΝΥΜΟ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΙΔΙΟΤΗΤΑ</label>
              <select 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none font-medium"
                value={formData.memberType}
                onChange={(e) => setFormData({...formData, memberType: e.target.value as 'member' | 'friend'})}
              >
                <option value="member">Μέλος</option>
                <option value="friend">Φίλος</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΠΑΤΡΩΝΥΜΟ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.fatherName}
                onChange={(e) => setFormData({...formData, fatherName: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΑΡΙΘΜΟΣ ΤΑΥΤΟΤΗΤΑΣ</label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.idNumber}
                onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΗΜ. ΓΕΝΝΗΣΗΣ</label>
              <input 
                type="date" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.birthDate}
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΗΜ. ΕΓΓΡΑΦΗΣ</label>
              <input 
                type="date" 
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none"
                value={formData.registrationDate}
                onChange={(e) => setFormData({...formData, registrationDate: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
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

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="danceMember" 
                checked={formData.isDanceMember} 
                onChange={(e) => setFormData({...formData, isDanceMember: e.target.checked})}
                className="w-5 h-5 accent-association-gold"
              />
              <label htmlFor="danceMember" className="text-sm font-medium text-gray-700 underline underline-offset-4 decoration-association-blue/30">Μέλος Χορευτικού</label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">ΣΗΜΕΙΩΣΕΙΣ</label>
            <textarea 
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-association-blue/20 outline-none min-h-[100px]"
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Στοιχεία επικοινωνίας, παρατηρήσεις κλπ..."
            />
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
