import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function EmailVerificationModal({ open, onOpenChange, email, onSuccess, isSignup = false }) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = isSignup ? '/api/auth/verify-signup' : '/api/auth/verify-otp';
      const response = await axios.post(`${BACKEND_URL}${endpoint}`, {
        email: email,
        otp: otp
      });
      
      toast.success(isSignup ? 'Email verified! Account created.' : 'Email verified successfully!');
      
      // Call success callback with response data
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      // Reset and close modal
      setOtp('');
      onOpenChange(false);
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid OTP. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOtp('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify Your Email</DialogTitle>
          <DialogDescription>
            Enter the OTP sent to {email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-otp">Enter OTP</Label>
            <Input
              id="email-otp"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLoading}
              maxLength="6"
              className="tracking-widest text-center text-lg"
            />
            <p className="text-xs text-gray-500">Check your email for the 6-digit code</p>
          </div>
          
          <Button 
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Email'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
