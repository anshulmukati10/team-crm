import { useState, useEffect } from 'react';

import { createChat, getAllUsers , removeMember } from './chatApi';

export default function AdminChatController({ currentRoomId, onRoomCreated }) {
    const [users, setUsers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const  res  = await getAllUsers();
                setUsers(res ?? []);
            } catch (err) {
                console.error("Failed to load user directories", err);
            }
        };
        fetchUsers();
    }, []);

    const handleCheckboxChange = (userId) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) return setError('Group name is required');
        const data =  { groupName, memberIds :  selectedUsers };
        try {
            const  res = await createChat( data )
            setShowCreateModal(false);
            setGroupName('');
            setSelectedUsers([]);
            setError('');
            if (onRoomCreated) onRoomCreated(res);
            alert('Group Chat created successfully!');
        } catch (err) {
            setError(err.response?.data?.message || 'Error generating workspace');
        }
    };

    const handleRemoveUser = async (userId) => {
        if (!currentRoomId) return alert('Select an active group room context first');
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        try {
            const data = { roomId: currentRoomId, memberId: userId };
            await removeMember(data);
            alert('Member removed successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to remove member');
        }
    };

    return (
        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Admin Workspace Panel</h3>
                    <p className="text-xs text-gray-500">Exclusively managing creation, entry and structural membership.</p>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
                    >
                        + Create Group
                    </button>
                </div>
            </div>

            {currentRoomId && users.length > 0 && (
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Active Room Quick Actions</h4>
                    <div className="flex flex-wrap gap-2">
                        {users.map(user => (
                            <div key={user.id} className="flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200/60 text-xs">
                                <span className="font-medium text-gray-800">{user.name}</span>
                                <span className="text-[10px] text-gray-400 font-semibold bg-gray-200 px-1 rounded uppercase">{user.role}</span>
                                <button 
                                    onClick={() => handleRemoveUser(user.id)}
                                    className="text-red-500 hover:text-red-700 font-bold ml-1 transition"
                                    title={`Kick ${user.name} from current group`}
                                >
                                    ✕ Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Group Chat</h2>
                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Group Title</label>
                                <input 
                                    type="text" 
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-900"
                                    placeholder="e.g., Logistics Sync"
                                />
                            </div>

                            <div>
                                <label  className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Select Members (Non-Admins)</label>
                                <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-2 bg-gray-50">
                                    {users.map(user => (
                                        <label key={user.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-sm">
                                            <input 
                                                type="checkbox"
                                                checked={selectedUsers.includes(user.id)}
                                                onChange={() => handleCheckboxChange(user.id)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="font-medium text-gray-800">{user.name}</span>
                                            <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded uppercase">{user.role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500">{error}</p>}

                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3 py-1.5 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-xl hover:bg-indigo-700"
                                >
                                    Build Group
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
