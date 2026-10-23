// src/pages/Home.jsx
import 'react';
import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center p-8 text-center font-sans">
            <header className="mb-10 max-w-2xl">
                <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                    Welcome to Our Platform
                </h1>
                <p className="text-xl text-gray-600">
                    The centralized workspace for managing your microservices, dashboard configurations, and team collaborations securely.
                </p>
            </header>

            <div className="flex gap-4">
                <Link to="/auth/register" className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                    Sign Up
                </Link>

                <a href="#features" className="rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                    Learn More
                </a>
            </div>
        </div>
    );
}
