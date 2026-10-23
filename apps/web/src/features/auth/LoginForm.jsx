
import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from './authApi';
import { AuthContext } from '../../context/AuthContext';
import { FaChevronLeft, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function LoginForm() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await loginUser(formData);
      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(
        typeof err === 'string'
          ? err
          : err?.message || 'Unable to sign in. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">

        {/* LEFT SIDE: LOGIN FORM */}
        <section className="flex min-h-screen flex-col bg-white px-6 sm:px-10 lg:px-14 xl:px-20">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">

            {/* Back link */}
            <div className="pt-8 sm:pt-10">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
              >
                <FaChevronLeft className="text-xs" />
                Back to Home
              </Link>
            </div>

            {/* Form */}
            <div className="flex flex-1 flex-col justify-center py-8">
              <div className="mb-7">
                <h1 className="mb-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                  Sign In
                </h1>

                <p className="text-sm leading-6 text-gray-500">
                  Enter your email and password to sign in!
                </p>
              </div>

              {/* Divider */}
              <div className="relative mb-7 flex items-center">
                <div className="flex-grow border-t border-gray-200" />
               
                <div className="flex-grow border-t border-gray-200" />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-gray-800"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="   info@gmail.com "
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-gray-800"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      placeholder="   Enter your password "
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 pr-12 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-800"
                    >
                      {showPassword ? (
                        <FaEye className="text-base" />
                      ) : (
                        <FaEyeSlash className="text-base" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-[#465FFF] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#3641F5] focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? 'Verifying Account...' : 'Sign in'}
                </button>
              </form>

              {/* Register link */}
              <p className="mt-5 text-sm text-gray-700">
                Don&apos;t have an account?{' '}
                <Link
                  to="/auth/register"
                  className="font-medium text-[#465FFF] hover:text-indigo-700"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT SIDE: BRANDING */}
        <section className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#191D50] px-8 lg:flex">

          {/* Grid background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '51px 51px',
              backgroundPosition: 'center center',
              maskImage:
                'linear-gradient(to bottom, transparent 18%, black 38%, black 80%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 18%, black 38%, black 80%, transparent 100%)',
            }}
          />

          {/* Decorative grid squares */}
          <div className="pointer-events-none absolute left-[11%] top-[39%] h-[52px] w-[52px] bg-white/[0.035]" />
          <div className="pointer-events-none absolute left-[21%] top-[44%] h-[52px] w-[52px] bg-white/[0.045]" />
          <div className="pointer-events-none absolute right-[18%] top-[47%] h-[52px] w-[52px] bg-white/[0.045]" />
          <div className="pointer-events-none absolute right-[28%] top-[60%] h-[52px] w-[52px] bg-white/[0.035]" />

          {/* TailAdmin logo and description */}
          <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
            <div className="mb-4 flex items-center justify-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#465FFF]">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  className="h-8 w-8"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="7"
                    width="4"
                    height="18"
                    rx="2"
                    fill="white"
                  />
                  <rect
                    x="14"
                    y="3"
                    width="4"
                    height="26"
                    rx="2"
                    fill="white"
                  />
                  <rect
                    x="23"
                    y="10"
                    width="4"
                    height="15"
                    rx="2"
                    fill="white"
                  />
                </svg>
              </div>

              <h2 className="text-4xl font-semibold tracking-tight text-white">
                TailAdmin
              </h2>
            </div>

            <p className="max-w-sm text-base leading-6 text-indigo-200/80">
              Free and Open-Source Tailwind CSS Admin
              <br />
              Dashboard Template
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
