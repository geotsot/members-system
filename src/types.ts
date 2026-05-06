
export interface MemberStatusChange {
  active: boolean;
  timestamp: string;
}

export interface Member {
  id: string;
  fullName: string;
  fatherName: string;
  birthDate: string;
  idNumber: string;
  registrationDate: string;
  active: boolean;
  isDanceMember: boolean;
  statusHistory?: MemberStatusChange[];
  notes?: string;
}

export type SubscriptionType = 'monthly' | 'annual' | 'dance';

export interface Payment {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  period: string; // e.g., "2024" for annual or "2024-05" for monthly/dance
  type: SubscriptionType;
}

export interface AssociationSettings {
  name: string;
  address: string;
  vatNumber: string; // ΑΦΜ
  logoUrl?: string;
  annualFee: number;
  monthlyFee: number;
  danceMonthlyFee: number;
}

export interface AppState {
  members: Member[];
  payments: Payment[];
  settings: AssociationSettings;
}
