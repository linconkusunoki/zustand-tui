import { WebSocket } from 'ws';

function startDemo() {
  console.log(' Starting Zustand TUI Multi-Session Demo...\n');

  // Client 1: Desktop Tab (auth & preferences)
  const ws1 = new WebSocket('ws://localhost:8080');
  ws1.on('open', () => {
    console.log(' [tab-desktop] Connected');
    ws1.send(JSON.stringify({
      type: 'INIT_STORE',
      sessionId: 'tab-desktop',
      store: 'auth-store',
      state: { user: null, isAuthenticated: false, theme: 'light' }
    }));

    setTimeout(() => {
      ws1.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-desktop',
        store: 'auth-store',
        action: 'loginUser',
        state: {
          user: { id: 42, name: 'Alex Rivera', role: 'admin' },
          isAuthenticated: true,
          theme: 'dark'
        },
        timestamp: Date.now()
      }));
      console.log(' [tab-desktop] Dispatched "loginUser"');
    }, 2000);
  });

  // Client 2: Mobile Tab (shopping cart & checkout)
  const ws2 = new WebSocket('ws://localhost:8080');
  ws2.on('open', () => {
    console.log(' [tab-mobile] Connected');
    ws2.send(JSON.stringify({
      type: 'INIT_STORE',
      sessionId: 'tab-mobile',
      store: 'cart-store',
      state: { items: [], total: 0, status: 'empty' }
    }));

    setTimeout(() => {
      ws2.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-mobile',
        store: 'cart-store',
        action: 'addItem',
        state: {
          items: [{ id: 'item-101', name: 'Mechanical Keyboard', price: 120, qty: 1 }],
          total: 120,
          status: 'pending'
        },
        timestamp: Date.now()
      }));
      console.log(' [tab-mobile] Dispatched "addItem"');
    }, 2500);

    setTimeout(() => {
      ws2.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-mobile',
        store: 'cart-store',
        action: 'applyCoupon',
        state: {
          items: [{ id: 'item-101', name: 'Mechanical Keyboard', price: 120, qty: 1 }],
          coupon: 'SUMMER20',
          discount: 24,
          total: 96,
          status: 'pending'
        },
        timestamp: Date.now()
      }));
      console.log(' [tab-mobile] Dispatched "applyCoupon"');
    }, 4500);

    setTimeout(() => {
      ws2.send(JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-mobile',
        store: 'cart-store',
        action: 'checkoutOrder',
        state: {
          items: [{ id: 'item-101', name: 'Mechanical Keyboard', price: 120, qty: 1 }],
          coupon: 'SUMMER20',
          discount: 24,
          total: 96,
          status: 'completed',
          orderId: 'ORD-89412'
        },
        timestamp: Date.now()
      }));
      console.log(' [tab-mobile] Dispatched "checkoutOrder"');
    }, 6500);

    // Disconnect mobile tab after 8.5s to show [Offline] badge in TUI
    setTimeout(() => {
      console.log(' [tab-mobile] Closing connection (simulating closed tab/page reload)...');
      ws2.close();
      console.log(' [tab-mobile] Disconnected -> Notice [Offline] badge in TUI! State remains inspectable.');
    }, 8500);
  });
}

startDemo();
