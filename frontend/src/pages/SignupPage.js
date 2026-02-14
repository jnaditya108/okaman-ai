import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();

  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (response) => {
      setIsLoading(true);
      try {
        await loginWithGoogle(response.access_token);
        toast.success('Account created! Welcome to Okaman.');
      } catch (error) {
        const message = error.response?.data?.detail || 'Google signup failed. Please try again.';
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error('Google signup failed. Please try again.');
    },
    flow: 'implicit',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, username || undefined);
      toast.success('Account created! Welcome to Okaman.');
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1770031079091-c6356e82ea9b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHw0fHxhYnN0cmFjdCUyMGRhcmslMjBmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGJhY2tncm91bmQlMjBtaW5pbWFsaXN0fGVufDB8fHx8MTc3MDY2Mzk4NXww&ixlib=rb-4.1.0&q=85')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-10 h-10 text-white" />
            <h1 className="font-heading text-4xl font-bold text-white">Okaman</h1>
          </div>
          <p className="text-xl text-zinc-300 max-w-md leading-relaxed">
            Welcome to the AI prompt generation for Sora, Veo3, and other AI video generation tools by Okaman.
          </p>
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>50 free credits to get started</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Generate prompts for any AI video tool</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>Save and organize your chat history</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
            <Sparkles className="w-8 h-8 text-white" />
            <h1 className="font-heading text-3xl font-bold text-white">Okaman</h1>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="font-heading text-3xl font-bold text-white">Create account</h2>
            <p className="text-zinc-400">Get started with 50 free credits</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">Username (optional)</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="signup-username-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="signup-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="signup-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500">Minimum 6 characters</p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-medium rounded-full btn-glow"
              disabled={isLoading}
              data-testid="signup-submit-button"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Or continue with</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Google OAuth Button */}
          <Button
            onClick={() => handleGoogleSignup()}
            disabled={isLoading}
            className="w-full h-12 bg-white/10 text-white hover:bg-white/20 border border-white/20 font-medium rounded-full transition-colors"
            data-testid="google-signup-button"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <p className="mt-8 text-center text-zinc-400">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline font-medium" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
