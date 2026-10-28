export type TuiClientMessage =
  | {
      type: 'INIT_STORE';
      sessionId: string;
      store: string;
      state: unknown;
    }
  | {
      type: 'SET_STATE';
      sessionId: string;
      store: string;
      state: unknown;
      action?: string;
      timestamp?: number;
    }
  | {
      type: 'ACTION';
      sessionId: string;
      store: string;
      action: string;
      state: unknown;
      timestamp: number;
    };

export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export type OutgoingTuiMessage = DistributiveOmit<TuiClientMessage, 'sessionId'> & {
  sessionId?: string;
};
