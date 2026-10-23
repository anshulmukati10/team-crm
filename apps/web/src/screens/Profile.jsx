import 'react';
import { useState } from 'react';
import LogoutButton from '../components/LogoutButton';
import { getUserProfile, updateUserProfile } from '../features/auth/authApi';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';



export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });


    const navigate = useNavigate();


    const handleChange = (e) => {
        e.preventDefault();
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const updatedProfile = await updateUserProfile(formData);
            setProfile(updatedProfile);
            navigate('/profile');
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getUserProfile();
                setProfile(data);
            } catch (err) {
                console.error(err);
            }
        };

        fetchProfile();
    }, []);
    return (
        (
            <>
                <div>
                    <form onSubmit={handleUpdateProfile}>
                        <ul>
                            <li>
                                <div className="input-group">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        placeholder={profile ? profile.name : 'John Doe'}
                                    />
                                </div>
                            </li>
                            <li>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        placeholder={profile?.email}
                                    />
                                </div>
                            </li>
                            <li>
                                <div className="input-group">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        placeholder="*******"
                                    />
                                </div>
                            </li>
                            <li>
                                <div className="input-group">
                                    <label>Role</label>
                                    {profile?.role}
                                    
                                </div>
                            </li>
                        </ul>

                    </form>
                    <div>
                        <button type="submit" >Update Profile</button>
                    </div>
                    <div>
                        <LogoutButton />
                    </div>
                </div>
            </>
        )
    )
}