
export type RecipientItem = {
  id: string;
  name: string;
  masked?: string;
  pan_last4?: string | null;
};

export type CardItem = {
  id: string;
  holder: string;
  bank: string;
  masked: string;
  balance?: number;
  currency?: string;
};

export type RecipientChoicesEvt = {
  type: "RECIPIENT_CHOICES";
  session_id: string;
  list: RecipientItem[];
  amount: number;
};

export type CardChoicesEvt = {
  type: "CARD_CHOICES";
  session_id: string;
  list: CardItem[];
  amount: number;
};

export type CodeRequiredEvt = {
  type: "CODE_REQUIRED";
  payment_id: string;
  expires_in: number;
};

export type StreamEvt = RecipientChoicesEvt | CardChoicesEvt | CodeRequiredEvt | Record<string, unknown>;

export type ChatMessage = {
  role: "user" | "assistant";
  query: string;
  recipientChoices?: {
    list: RecipientItem[];
    sessionId: string;
    amount: number;
  };
  cardChoices?: {
    list: CardItem[];
    sessionId: string;
    amount: number;
  };
  otpRequired?: {
    paymentId: string;
    expiresIn: number;
  };
};

export type ChatResponse = { answer: string };
