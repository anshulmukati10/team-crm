import  { useState } from 'react';

export default function SendMessage({ roomId, socket }) {
    const [text, setText] = useState('');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!text.trim() || !socket) return;

        socket.emit('send_message', {
            text: text.trim(),
            roomId: roomId
        });
        setText('');
    };
    
    return (
        <form onSubmit={handleFormSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input 
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message securely..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400"
            />
            <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-xs flex items-center justify-center"
            >
                Send
            </button>
        </form>
    );
}
