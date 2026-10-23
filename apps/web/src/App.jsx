import { BrowserRouter, Routes, Route} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Auth from './screens/Auth';
import Home from './screens/Home';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Profile from './screens/Profile';
import Chat from './screens/Chat';



export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />}/>
          <Route path="/auth/:mode" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route element={<Layout />}>
            <Route path="auth/profile" element={<Profile />} />
            <Route path="/chat" element={<Chat />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

