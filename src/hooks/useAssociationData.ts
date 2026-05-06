import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AppState, Member, Payment, AssociationSettings } from '../types';

const INITIAL_SETTINGS: AssociationSettings = {
  name: 'Ποντιακός Σύλλογος',
  address: '',
  vatNumber: '',
  logoUrl: '',
  annualFee: 20,
  monthlyFee: 2,
  danceMonthlyFee: 10,
};

export function useAssociationData() {
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AssociationSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid || null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    setLoading(true);

    // Settings sync (Publicly readable)
    const settingsDoc = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsDoc,
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as AssociationSettings);
        } else if (userId) { // Only initialize if authenticated
          // Initialize settings if they don't exist
          setDoc(settingsDoc, INITIAL_SETTINGS).catch(err => 
            handleFirestoreError(err, OperationType.WRITE, 'settings/global')
          );
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/global')
    );

    if (!userId) {
      setMembers([]);
      setPayments([]);
      setLoading(false);
      return () => unsubSettings();
    }

    const membersQuery = query(collection(db, 'members'));
    const unsubMembers = onSnapshot(membersQuery, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
        setMembers(data);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'members')
    );

    // Payments sync
    const paymentsQuery = query(collection(db, 'payments'));
    const unsubPayments = onSnapshot(paymentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setPayments(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'payments')
    );

    return () => {
      unsubMembers();
      unsubPayments();
      unsubSettings();
    };
  }, [userId]);

  const addMember = async (member: Omit<Member, 'id'>) => {
    try {
      await addDoc(collection(db, 'members'), member);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    try {
      const member = members.find(m => m.id === id);
      if (member && 'active' in updates && updates.active !== member.active) {
        const history = member.statusHistory || [];
        updates.statusHistory = [...history, { 
          active: updates.active as boolean, 
          timestamp: new Date().toISOString() 
        }];
      }
      await updateDoc(doc(db, 'members', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${id}`);
    }
  };

  const deleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    try {
      await addDoc(collection(db, 'payments'), payment);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
    }
  };

  const updatePayment = async (id: string, updates: Partial<Payment>) => {
    try {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.amount !== undefined) sanitizedUpdates.amount = Math.max(1, Math.floor(sanitizedUpdates.amount));
      await updateDoc(doc(db, 'payments', id), sanitizedUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${id}`);
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `payments/${id}`);
    }
  };

  const updateSettings = async (updates: Partial<AssociationSettings>) => {
    try {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.annualFee !== undefined) sanitizedUpdates.annualFee = Math.max(1, Math.floor(sanitizedUpdates.annualFee));
      if (sanitizedUpdates.monthlyFee !== undefined) sanitizedUpdates.monthlyFee = Math.max(1, Math.floor(sanitizedUpdates.monthlyFee));
      if (sanitizedUpdates.danceMonthlyFee !== undefined) sanitizedUpdates.danceMonthlyFee = Math.max(1, Math.floor(sanitizedUpdates.danceMonthlyFee));
      
      await updateDoc(doc(db, 'settings', 'global'), sanitizedUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    }
  };

  return {
    members,
    payments,
    settings,
    loading,
    addMember,
    updateMember,
    deleteMember,
    addPayment,
    updatePayment,
    deletePayment,
    updateSettings
  };
}
