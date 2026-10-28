import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log(' Connected to Zustand TUI!\n');

  // 1. Register initial stores
  ws.send(JSON.stringify({
    type: 'INIT_STORE',
    store: 'auth-store',
    state: { user: null, isAuthenticated: false }
  }));

  ws.send(JSON.stringify({
    type: 'INIT_STORE',
    store: 'booking-store',
    state: { step: 'search', camperId: null, total: 0 }
  }));

  console.log('-> Initialized "auth-store" and "booking-store"');

  // 2. Dispatch live actions sequentially every 2 seconds
  const updates = [
    {
      store: 'auth-store',
      action: 'loginUser',
      state: { user: { id: 42, name: 'Lincon', role: 'admin' }, isAuthenticated: true },
      desc: 'User logged in'
    },
    {
      store: 'booking-store',
      action: 'selectVehicle',
      state: { step: 'vehicle_selected', camperId: 'vw-california-t6', total: 450 },
      desc: 'Selected VW California'
    },
    {
      store: 'booking-store',
      action: 'addInsurance',
      state: { step: 'insurance_added', camperId: 'vw-california-t6', total: 530, insurance: 'premium' },
      desc: 'Added premium insurance'
    },
    {
      store: 'booking-store',
      action: 'completeBooking',
      state: { step: 'confirmed', camperId: 'vw-california-t6', total: 530, bookingId: 'BK-99120' },
      desc: 'Booking completed'
    }
  ];

  let i = 0;
  const timer = setInterval(() => {
    if (i < updates.length) {
      const u = updates[i];
      ws.send(JSON.stringify({
        type: 'ACTION',
        store: u.store,
        action: u.action,
        state: u.state,
        timestamp: Date.now()
      }));
      console.log(`[${new Date().toLocaleTimeString()}] Dispatched "${u.action}" to ${u.store}: "${u.desc}"`);
      i++;
    } else {
      clearInterval(timer);
      console.log('\n Dispatches complete. Keep TUI open to inspect, or press Ctrl+C to exit.');
    }
  }, 2000);
});

ws.on('error', (err) => {
  console.error('Connection error. Is the TUI running on port 8080?', err.message);
});
