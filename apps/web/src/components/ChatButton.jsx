import { Link } from "react-router";
import { Icon } from "./ui/Navbar";

export default function ChatButton({ className = "" }) {
  return (
    <Link aria-label="Open team chat" className={className} to="/chat">
      <Icon name="chat" size={18} />
      <span>Team chat</span>
    </Link>
  );
}
