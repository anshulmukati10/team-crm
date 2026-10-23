import { useState, useEffect, useRef } from 'react';
import { removeMember } from './chatApi';
import { getMessages } from './chatApi';
import SendMessage from '../chat/messageInput';

export default function ChatWindow({ roomId, socket, currentUser }) {
    const [messages, setMessages] = useState([]);
    const chatEndRef = useRef(null);

    


useEffect(() => {
    if (!roomId || !socket) return; 

    const fetchMessages = async () => {
        try {
            const res = await getMessages(roomId);
            setMessages(res ?? []);
        } catch (err) {
            console.error("Could not fetch chat history logs", err);
        }
    };

    fetchMessages();
    socket.emit('join_room', roomId);
}, [ roomId, socket]);

useEffect(() => {
    if (!socket || !roomId) return;

    const handleIncomingMessage = (newMessage) => {
        if (newMessage.roomId === roomId) {
            setMessages((prev) => [...prev, newMessage]);
        }
    };

    socket.on('receive_message', handleIncomingMessage);

    return () => {
        socket.off('receive_message', handleIncomingMessage);
    };
}, [socket, roomId]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleEvictUser = async (data) => {
        if (!window.confirm("Evict this member from this secure chat group channel?")) return;
        try {
            await removeMember(data);
            alert("User evicted successfully.");
        } catch (err) {
            throw err?.response?.data?.message;
        }
    };

    if (!roomId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
                Select or build a room channel to initiate operations.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/50">
                {messages.map((msg) => {
                    const isOwnMessage = msg.userId === currentUser?.id;
                    const isAdminSender = msg.user?.role === 'ADMIN';

                    return (
                        <div key={msg.id} className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 mb-0.5 text-xs text-gray-500 px-1">
                                <span className="font-semibold text-gray-700">{msg.user?.name}</span>
                                <span className={`text-[10px] px-1 rounded font-bold tracking-tight uppercase ${isAdminSender ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {msg.user?.role}
                                </span>
                                
                                {currentUser?.role === 'ADMIN' && !isAdminSender && (
                                    <button 
                                        onClick={() => handleEvictUser({roomId , memberId : msg.userId})}
                                        className="text-red-500 hover:text-red-700 ml-2 font-medium hover:underline text-[10px]"
                                        title="Kick user from this group chat"
                                    >
                                        ✕ Kick
                                    </button>
                                )}
                            </div>

                            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-xs text-sm ${
                                isOwnMessage 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}>
                                <p className="leading-relaxed break-words">{msg.text}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>

            <SendMessage roomId={roomId} socket={socket} currentUser={currentUser} />
        </div>
    );
}
