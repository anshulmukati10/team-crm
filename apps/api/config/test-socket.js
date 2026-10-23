import { io } from 'socket.io-client';

// 1. Connect to your API server
const socket = io('http://localhost:8000');

// Define your real database targets
const TARGET_ROOM_ID = "c203ac0f-813d-4ad5-819d-319863ad58dc";
const TARGET_USER_ID = 2;

socket.on('connect', () => {
  console.log(`✅ Connected to server with Socket ID: ${socket.id}`);

  // 2. Join the correct room channel
  console.log(`🚪 Sending join_room for: ${TARGET_ROOM_ID}`);
  socket.emit('join_room', TARGET_ROOM_ID);

  // 3. Wait 1 second to ensure room join finishes, then send message
  setTimeout(() => {
    console.log('📤 Sending test message payload...');
    socket.emit('send_message', {
      text: "Is this thing on? Testing live pipeline text.",
      userId: TARGET_USER_ID,
      roomId: TARGET_ROOM_ID
    });
  }, 1000);
});

// 4. Listen for the broadcasted response from the server
socket.on('receive_message', (data) => {
  console.log('🎉 SUCCESS! Received message back from server:');
  console.dir(data, { depth: null });
  
  // Clean up and exit
  socket.disconnect();
  process.exit(0);
});

// 5. Handle connection errors cleanly
socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});
