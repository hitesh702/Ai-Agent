export type StartOutboundCallInput = {
  callId: string;
  customerNumber: string;
  customerName: string;
  agent: {
    id: string;
    name: string;
    language: string;
    voice: string | null;
    systemPrompt: string | null;
    objective: string | null;
  };
  business: {
    id: string;
    name: string;
    description: string | null;
    phone: string | null;
    address: string | null;
  };
  lead: {
    id: string;
    name: string;
    phone: string;
    notes: string | null;
  };
  knowledge: Array<{
    category: string;
    title: string;
    content: string;
  }>;
  serverUrl?: string;
};

export type ProviderCallSnapshot = {
  providerCallId: string;
  status: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  endedReason?: string;
  interest?: string;
  requirement?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  customerSentiment?: string;
  raw: Record<string, unknown>;
};

export interface TelephonyProvider {
  readonly name: string;
  isConfigured(): boolean;
  startOutboundCall(
    input: StartOutboundCallInput,
  ): Promise<{ providerCallId: string }>;
  fetchCall(providerCallId: string): Promise<ProviderCallSnapshot>;
}
