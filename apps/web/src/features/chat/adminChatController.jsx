import ChatWindow from "./chatWindow";
import { useAuth } from "../../context/WorkspaceContext";

export default function AdminChatController() {
  const { role } = useAuth();
  return <ChatWindow canManage={role === "ADMIN"} />;
}
