import { useNavigate } from "react-router-dom";

 export default function ChatButton() {
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
      

        try {
            
            await logoutUser();
            navigate('/chat');
        } catch (err) {
            console.error(err);
        }
    };
    return (
        <button
            onClick={handleSubmit}
            className="rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
        >
            Chat
        </button>
    );
}
 