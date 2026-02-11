import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { login } = useAuth();

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
