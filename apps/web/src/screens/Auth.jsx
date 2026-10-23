
import LoginForm from '../features/auth/LoginForm';
import RegisterForm from '../features/auth/RegisterForm';
import {useParams} from 'react-router-dom';

export default function Auth() {
    const { mode } = useParams();

    return (
        <div className="auth-screen-layout">
            <div className="auth-sidebar">
                <h1>My Enterprise Platform</h1>
                <p>Access your centralized development and configuration console dashboard safely.</p>
            </div>

            <div className="auth-content-area">
                <div className="auth-form-wrapper" style={{ maxWidth: '400px', width: '100%' }}>
                   { mode === 'login' ? <LoginForm /> : <RegisterForm /> }
                </div>
            </div>
        </div>
    );
}
