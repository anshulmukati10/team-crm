import LogoutButton from "../LogoutButton";
import ChatButton from "../ChatButton";

export default function Navbar() {


    return (
        <nav className="relative bg-zinc-900 px-6 py-4 text-white shadow-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between">

                <div className="text-2xl font-bold tracking-wide">MyApp</div>


                <ul className="hidden items-center gap-6 md:flex">
                    <li>
                        <a href="#home" className="text-sm font-medium transition-colors hover:text-cyan-400">Home</a>
                    </li>
                    <li>
                        <a href="#profile" className="text-sm font-medium transition-colors hover:text-cyan-400">Profile</a>
                    </li>
                    <li>
                        <LogoutButton/>
                    </li> 
                    <li>
                        <ChatButton/>
                    </li>
                </ul>
            </div>
        </nav>
    );
}
