export type TuiClientMessage =
  | {
      type: 'INIT_STORE';
      store: string;
      state: unknown;
    }
  | {
      type: 'SET_STATE';
      store: string;
      state: unknown;
    };
