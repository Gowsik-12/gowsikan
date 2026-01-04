export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioData?: string; // Base64 audio
  groundingLinks?: { title: string; uri: string }[];
  feedback?: 'helpful' | 'not-helpful';
}

export interface Holiday {
  date: string;
  name: string;
}

export interface HandbookSection {
  title: string;
  content: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface CompanyConfig {
  name: string;
  handbookSections: HandbookSection[];
  holidays: Holiday[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}