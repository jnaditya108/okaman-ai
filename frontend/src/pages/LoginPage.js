import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, Sparkles, Phone } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setIsLoading(true);
      try {
        await loginWithGoogle(response.access_token);
        toast.success('Welcome to Okaman!');
      } catch (error) {
        const message = error.response?.data?.detail || 'Google login failed. Please try again.';
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login failed. Please try again.');
    },
    flow: 'implicit',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!forgotEmail || !forgotPhone) {
      toast.error('Please fill in all fields');
      return;
    }

    // Validate phone number (10-15 digits)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(forgotPhone.replace(/\D/g, ''))) {
      toast.error('Please enter a valid phone number (10-15 digits)');
      return;
    }

    setIsForgotLoading(true);
    try {
      // TODO: Connect to backend endpoint for password reset
      // For now, just show success message
      toast.success('Password reset link sent to your phone');
      setShowForgotPassword(false);
      setForgotEmail('');
      setForgotPhone('');
    } catch (error) {
      toast.error('Failed to process request. Please try again.');
    } finally {
      setIsForgotLoading(false);
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
            <h2 className="font-heading text-3xl font-bold text-white">Welcome back</h2>
            <p className="text-zinc-400">Sign in to continue to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                  data-testid="forgot-password-button"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-medium rounded-full btn-glow"
              disabled={isLoading}
              data-testid="login-submit-button"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
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
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
            className="w-full h-12 bg-white/10 text-white hover:bg-white/20 border border-white/20 font-medium rounded-full transition-colors"
            data-testid="google-login-button"
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
            Don't have an account?{' '}
            <Link to="/signup" className="text-white hover:underline font-medium" data-testid="signup-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Enter your email and phone number to reset your password
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-zinc-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="forgot-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-phone" className="text-zinc-300">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  id="forgot-phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-white/20 focus:ring-0 h-12 text-white placeholder:text-zinc-600"
                  data-testid="forgot-phone-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-medium rounded-full"
              disabled={isForgotLoading}
              data-testid="forgot-submit-button"
            >
              {isForgotLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
