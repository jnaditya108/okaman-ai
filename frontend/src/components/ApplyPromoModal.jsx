import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function ApplyPromoModal({ open, onOpenChange }) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken, updateCredits } = useAuth();

  const handleApply = async (e) => {
    e && e.preventDefault();
    const trimmed = (code || '').trim();
    if (!trimmed) return toast.error('Enter a promo code');

    setIsLoading(true);
    try {
      const token = getToken();
      const response = await axios.post(
        `${BACKEND_URL}/api/promos/apply`,
        { code: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || 'Promo applied');
      if (response.data.new_credits != null) {
        updateCredits(response.data.new_credits);
      }
      setCode('');
      onOpenChange(false);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to apply promo';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Apply Promo Code</DialogTitle>
          <DialogDescription>Enter your promo code to redeem credits.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleApply} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promo-code">Promo Code</Label>
            <Input
              id="promo-code"
              type="text"
              placeholder="WELCOME100"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...
              </>
            ) : (
              'Apply Promo'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
