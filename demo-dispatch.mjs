import { WebSocket } from 'ws';

function startDemo() {
  console.log(' Starting Zustand TUI Multi-Session Demo...\n');

  // Client 1: Desktop Tab
  const ws1 = new WebSocket('ws://localhost:8080');
  ws1.on('open', () => {
    console.log(' [tab-desktop] Connected');
    ws1.send(JSON.stringify({
      type: 'INIT_STORE',
      sessionId: 'tab-desktop',
      store: 'auth-store',
      state: { user: null, isAuthenticated: false }
    }));

    setTimeout(() => {
      ws1.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-desktop',
        store: 'auth-store',
        action: 'loginUser',
        state: { user: { id: 42, name: 'Lincon', role: 'admin' }, isAuthenticated: true },
        timestamp: Date.now()
      }));
      console.log(' [tab-desktop] Dispatched "loginUser"');
    }, 2000);
  });

  // Client 2: Mobile Tab
  const ws2 = new WebSocket('ws://localhost:8080');
  ws2.on('open', () => {
    console.log(' [tab-mobile] Connected');
    ws2.send(JSON.stringify({
      type: 'INIT_STORE',
      sessionId: 'tab-mobile',
      store: 'booking-store',
      state: { step: 'search', camperId: null, total: 0 }
    }));

    setTimeout(() => {
      ws2.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-mobile',
        store: 'booking-store',
        action: 'selectVehicle',
        state: { step: 'vehicle_selected', camperId: 'vw-california-t6', total: 450 },
        timestamp: Date.now()
      }));
      console.log(' [tab-mobile] Dispatched "selectVehicle"');
    }, 3000);

    // Disconnect mobile tab after 6s to show [Offline] badge in TUI
    setTimeout(() => {
      console.log(' [tab-mobile] Closing connection (simulating closed tab/page unload)...');
      ws2.close();
      console.log(' [tab-mobile] Disconnected -> Notice [Offline] badge in TUI! State remains inspectable.');
    }, 6000);
  });
}

startDemo();
