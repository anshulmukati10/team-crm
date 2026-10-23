
import 'react';
import { Outlet, Navigate } from 'react-router-dom';

export default function Layout() {
  const isAuthenticated = localStorage.getItem('token') !== null;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <Navbar />
      
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <Footer />
    </div>
  );
}
