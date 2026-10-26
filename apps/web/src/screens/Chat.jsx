import { ROLES, useAuth } from "../context/WorkspaceContext";
import AdminChatController from "../features/chat/adminChatController";
import ChatWindow from "../features/chat/chatWindow";

export default function Chat() {
  const { role } = useAuth();

  if (role === ROLES.ADMIN) {
    return <AdminChatController />;
  }

  return <ChatWindow canManage={false} />;
}
