import { useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import AdminChatController from '../features/chat/adminChatController';
import ChatWindow from '../features/chat/chatWindow';

export default function Chat() {
    const { user } = useContext(AuthContext);
    const [socket] = useState(() => io(import.meta.env.VITE_API_URL, {
        withCredentials: true
    }));
    const [activeRoomId, setActiveRoomId] = useState(null);

    useEffect(() => () => socket.disconnect(), [socket]);

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {user?.role === "ADMIN" && (
                <AdminChatController
                    currentRoomId={activeRoomId}
                    onRoomCreated={(room) => setActiveRoomId(room.id)}
                />
            )}

            <div className="flex-1 p-4 max-w-5xl w-full mx-auto flex flex-col h-full overflow-hidden">
                <ChatWindow
                    roomId={activeRoomId}
                    socket={socket}
                    currentUser={user}
                />
            </div>
        </div>
    );
}
