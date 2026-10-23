import { createContext, useState } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null)
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return ( null + "  " + e ); 
      }
    }
    return null;
  });




const login = (user, token) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
    setUser(user)
};

const logout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
};

return (
    <AuthContext.Provider value={{ user, login, logout}}  >
        {children}
    </AuthContext.Provider>
)

}