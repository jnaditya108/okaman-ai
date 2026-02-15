import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import okaman_logo from '../IMG_1960.PNG';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Send,
  Menu,
  X,
  Plus,
  MessageSquare,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Clipboard,
  Square,
  Coins,
  LogOut,
  CreditCard,
  Info,
  Mail,
  Loader2,
  ChevronDown,
  Gift,
  Instagram,
} from 'lucide-react';
import LiveUsersCounter from '../components/LiveUsersCounter';
import ApplyPromoModal from '../components/ApplyPromoModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// DodoPay URLs mapping
const DODO_PAY_URLS = {
  'plan_1m': 'https://test.checkout.dodopayments.com/buy/pdt_0NYZ1ARRyeZhG8RhYeMXj?quantity=1',
  'plan_3m': 'https://test.checkout.dodopayments.com/buy/pdt_0NYZ1ARRyeZhG8RhYeMXj?quantity=1',
  'plan_6m': 'https://test.checkout.dodopayments.com/buy/pdt_0NYZ1ARRyeZhG8RhYeMXj?quantity=1',
  'plan_12m': 'https://test.checkout.dodopayments.com/buy/pdt_0NYZ1ARRyeZhG8RhYeMXj?quantity=1',
};

const AI_MODELS = [
  { id: 'VEO 3', name: 'VEO 3', description: 'Google Video AI' },
  { id: 'SORA AI', name: 'SORA AI', description: 'OpenAI Video' },
  { id: 'KLING', name: 'KLING', description: 'Kuaishou Video AI' },
];

export default function ChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user, logout, updateCredits, getToken } = useAuth();
  
  // Chat state
  const [chatSessions, setChatSessions] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // UI state
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('VEO 3');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const [showPricing, setShowPricing] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showApplyPromo, setShowApplyPromo] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const token = getToken();

  // Handle payment return redirect params (e.g., ?payment=return&status=success&credits=500)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'return') {
        const status = params.get('status');
        const creditsAdded = parseInt(params.get('credits') || '0', 10) || 0;
        const successValues = ['success', 'completed', 'paid', '1', 'true', 'True'];

        if (status && successValues.includes(String(status))) {
          toast.success(`Payment successful — ${creditsAdded} credits added to your wallet.`);
          if (user && typeof updateCredits === 'function') {
            const current = (user.current_credits || 0);
            updateCredits(current + creditsAdded);
          }
        } else {
          toast.error('Payment was not successful.');
        }

        // Remove query params from URL to avoid repeated handling
        const url = window.location.pathname;
        window.history.replaceState({}, document.title, url);
      }
    } catch (e) {
      // ignore parsing errors
    }
  }, [user, updateCredits]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Define fetch functions with useCallback
  const fetchChatSessions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatSessions(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error('Failed to load chats');
    }
  }, [token]);

  const fetchChat = useCallback(async (id) => {
    try {
      const response = await axios.get(`${API_URL}/api/chats/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentChat(response.data);
      setMessages(response.data.messages);
      setSelectedModel(response.data.model);
    } catch (error) {
      console.error('Error fetching chat:', error);
      toast.error('Failed to load chat');
    }
  }, [token]);

  const fetchPricingPlans = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payments/plans`);
      setPricingPlans(response.data);
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
    }
  }, []);

  // Fetch chat sessions on mount
  useEffect(() => {
    fetchChatSessions();
    fetchPricingPlans();
  }, [fetchChatSessions, fetchPricingPlans]);

  // Load specific chat when chatId changes
  useEffect(() => {
    if (chatId) {
      fetchChat(chatId);
    } else {
      setCurrentChat(null);
      setMessages([]);
    }
  }, [chatId, fetchChat]);

  // Handle window resize - close sidebar on mobile, open on desktop
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsSidebarOpen(isLargeScreen);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/api/chats/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatSessions(chatSessions.filter(c => c.id !== id));
      if (currentChat?.id === id) {
        navigate('/chat');
        setCurrentChat(null);
        setMessages([]);
      }
      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Check credits
    if (user.current_credits <= 0) {
      setShowRefillModal(true);
      return;
    }

    const userMessage = inputValue;
    setInputValue('');
    
    // Add user message to UI immediately
    const tempUserMessage = {
      id: 'temp-' + Date.now(),
      chat_id: currentChat?.id,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/chat/send`,
        {
          chat_id: currentChat?.id,
          content: userMessage,
          model: selectedModel
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Remove temp message and add real AI response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMessage.id);
        return [...filtered, response.data.message];
      });
      
      // Update credits
      updateCredits(response.data.remaining_credits);
      
      // Update current chat or navigate to new chat
      if (currentChat) {
        fetchChat(currentChat.id);
      } else {
        // New chat created, navigate to it
        const newChatId = response.data.message.chat_id;
        navigate(`/chat/${newChatId}`);
        fetchChatSessions();
      }
    } catch (error) {
      // Remove temp user message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      
      if (error.response?.status === 402) {
        setShowRefillModal(true);
      } else {
        toast.error(error.response?.data?.detail || 'Failed to send message');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopGeneration = async () => {
    try {
      await axios.post(
        `${API_URL}/api/chat/stop`,
        { chat_id: currentChat?.id || 'current' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsLoading(false);
      toast.info('Generation stopped');
    } catch (error) {
      console.error('Error stopping generation:', error);
    }
  };

  const copyToClipboard = async (text) => {
    // Try modern clipboard API first
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(text || ''));
        toast.success('Copied to clipboard');
        return;
      }
    } catch (e) {
      console.warn('navigator.clipboard failed, falling back to execCommand', e);
    }

    // Fallback: create a temporary textarea, select and copy
    try {
      const el = document.createElement('textarea');
      el.value = String(text || '');
      // Prevent scrolling to bottom
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(el);
      if (successful) {
        toast.success('Copied to clipboard');
      } else {
        throw new Error('execCommand copy failed');
      }
    } catch (e) {
      console.error('Copy fallback failed', e);
      toast.error('Failed to copy');
    }
  };

  const submitFeedback = async (messageId, isPositive) => {
    // Prevent feedback on optimistic/temporary messages
    if (String(messageId).startsWith('temp-')) {
      toast.error('Feedback unavailable until message is saved');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/feedback`,
        { message_id: messageId, is_positive: isPositive },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setFeedbackGiven(prev => ({ ...prev, [messageId]: isPositive }));
      toast.success(isPositive ? 'Thanks for the feedback!' : "Thanks, we'll improve!");
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to submit feedback';
      toast.error(msg);
    }
  };

  const initiatePurchase = (planId) => {
    let paymentUrl = DODO_PAY_URLS[planId];
    if (paymentUrl) {
      // Add customer email as parameter if available
      if (user && user.email) {
        const separator = paymentUrl.includes('?') ? '&' : '?';
        paymentUrl += `${separator}customer_email=${encodeURIComponent(user.email)}`;
        // append plan id so it round-trips back to our return handler
        paymentUrl += `&plan_id=${encodeURIComponent(planId)}`;
        // append return token (JWT) so we can identify the user on redirect
        if (token) {
          paymentUrl += `&return_token=${encodeURIComponent(token)}`;
        }
      }
      window.open(paymentUrl, '_blank');
      toast.info('Opening DodoPay payment portal. Complete payment to add credits to your wallet.');
    } else {
      toast.error('Payment URL not found for this plan');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex bg-[#0A0A0A] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-72 sidebar transform 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 transition-transform duration-200
        `}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full border-r border-white/5 bg-gradient-to-b from-white/5 to-white/2">
          {/* Sidebar Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <img src={okaman_logo} alt="Okaman" className="w-6 h-6 rounded-full" />
              <span className="font-heading font-bold text-white text-lg">Okaman</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* New Chat Button */}
        <button
          onClick={() => navigate('/chat')}
          className="m-4 flex items-center gap-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors px-4 py-2.5">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Chat</span>
        </button>

        {/* Chat History Label */}
        <div className="px-4 py-3 border-b border-white/5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Chat History</span>
        </div>

        {/* Chat Sessions List */}
        <ScrollArea className="flex-1 px-2 py-2">
          <div className="space-y-1">
            {chatSessions.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No chats yet</p>
            ) : (
              chatSessions.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left group transition-colors
                    ${currentChat?.id === chat.id 
                      ? 'bg-white/10 text-white' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                  `}
                  data-testid={`chat-item-${chat.id}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm">{chat.title}</span>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                    data-testid={`delete-chat-${chat.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => setShowApplyPromo(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            data-testid="apply-promo-sidebar-button"
          >
            <Gift className="w-4 h-4" />
            <span className="text-sm">Apply Promo</span>
          </button>
          <button
            onClick={() => setShowPricing(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            data-testid="pricing-button"
          >
            <CreditCard className="w-4 h-4" />
            <span className="text-sm">Pricing</span>
          </button>
          <button
            onClick={() => setShowAbout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
            data-testid="about-button"
          >
            <Info className="w-4 h-4" />
            <span className="text-sm">About Us</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-red-400 transition-colors"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="header-glass sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-zinc-400 hover:text-white"
              data-testid="menu-button"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <img src={okaman_logo} alt="Okaman" className="w-5 h-5 rounded-full" />
              <span className="font-heading font-semibold text-white">Okaman</span>
            </div>
            {currentChat && (
              <div className="text-sm text-zinc-400">
                {currentChat.title}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <LiveUsersCounter />
            
            <button
              onClick={() => setShowContact(true)}
              className="hidden sm:flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
              data-testid="contact-button"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </button>
            
            {/* Credit Display */}
            <div
              className="credit-badge flex items-center gap-2 rounded-full cursor-pointer hover:bg-white/10 px-3 py-1.5"
              onClick={() => setShowPricing(true)}
              data-testid="credit-display"
            >
              <Coins className="text-yellow-400 w-4 h-4" />
              <span className="text-sm font-medium text-white">
                {user?.current_credits || 0}
              </span>
            </div>

            <button
              onClick={() => setShowApplyPromo(true)}
              className="hidden sm:inline-flex ml-2 items-center gap-2 rounded-lg bg-white/5 text-zinc-200 hover:bg-white/10 px-3 py-1.5 text-sm"
            >
              Apply Promo
            </button>

            {/* User Profile Avatar */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center hover:shadow-lg transition-all cursor-pointer"
                data-testid="user-avatar"
                title={user?.email}
              >
                <span className="text-sm font-bold text-white">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#121212] border border-white/10 shadow-lg z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Account</p>
                    <p className="text-sm text-white font-medium mt-1 break-all">{user?.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowPricing(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Coins className="w-4 h-4" />
                      Credits: {user?.current_credits || 0}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Close user menu when clicking outside */}
        {showUserMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
        )}

        <ApplyPromoModal open={showApplyPromo} onOpenChange={setShowApplyPromo} />

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Welcome Screen / Chat Input Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages Area */}
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6 w-full pb-32">
                {messages.length === 0 ? (
                  // Welcome Screen
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center max-w-2xl animate-fade-in">
                      <img src={okaman_logo} alt="Okaman" className="w-16 h-16 rounded-full mx-auto mb-6" />
                      <h1 className="font-heading font-bold text-white mb-4 text-3xl md:text-4xl">
                        {currentChat ? currentChat.title : 'Welcome to Okaman'}
                      </h1>
                      <p className="text-zinc-400 text-lg mb-8">
                        AI prompt generation for Sora, Veo3, and other AI video generation tools.
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {AI_MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => setSelectedModel(model.id)}
                            className={`
                              px-4 py-2 rounded-full text-sm border transition-colors
                              ${selectedModel === model.id 
                                ? 'bg-white text-black border-white' 
                                : 'border-white/20 text-zinc-400 hover:border-white/40 hover:text-white'}
                            `}
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Chat Messages
                  <div className="space-y-6">
                    {messages.map((msg, index) => (
                      <div 
                        key={msg.id} 
                        className="space-y-4 animate-fade-in" 
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {msg.role === 'user' ? (
                          // User Message
                          <div className="ml-auto max-w-[85%]">
                              <div className="message-user rounded-2xl px-4 py-3">
                                <p className="text-zinc-100 whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              </div>
                          </div>
                        ) : (
                          // AI Response
                          <div className="mr-auto max-w-[85%]">
                            <div className="message-assistant rounded-2xl px-4 py-3">
                              <p className="text-zinc-100 whitespace-pre-wrap">
                                {msg.content}
                              </p>
                            </div>
                            
                            {/* Feedback buttons */}
                            <div className="flex items-center gap-2 mt-2 ml-2">
                              {String(msg.id).startsWith('temp-') ? (
                                <button
                                  onClick={() => toast.error('Copy unavailable until message is saved')}
                                  className="p-1.5 rounded-lg text-zinc-600"
                                  data-testid={`copy-${msg.id}`}
                                  title="Copy unavailable"
                                >
                                  <Clipboard className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => copyToClipboard(msg.content)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                  data-testid={`copy-${msg.id}`}
                                  title="Copy response"
                                >
                                  <Clipboard className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => submitFeedback(msg.id, true)}
                                className={`
                                  p-1.5 rounded-lg transition-colors
                                  ${feedbackGiven[msg.id] === true 
                                    ? 'text-green-400 bg-green-400/10' 
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                                `}
                                data-testid={`feedback-up-${msg.id}`}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => submitFeedback(msg.id, false)}
                                className={`
                                  p-1.5 rounded-lg transition-colors
                                  ${feedbackGiven[msg.id] === false 
                                    ? 'text-red-400 bg-red-400/10' 
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                                `}
                                data-testid={`feedback-down-${msg.id}`}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="mr-auto max-w-[85%] animate-fade-in">
                        <div className="message-assistant rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                              <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                              <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                            </div>
                            <span className="text-zinc-500 text-sm">Generating...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-white/10 bg-[#0A0A0A] p-4">
              <div className="max-w-3xl mx-auto">
                <div className="chat-input rounded-2xl p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger 
                        className="w-36 bg-transparent border-white/10 text-white h-8 text-sm"
                        data-testid="model-selector"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121212] border-white/10">
                        {AI_MODELS.map((model) => (
                          <SelectItem 
                            key={model.id} 
                            value={model.id}
                            className="text-white focus:bg-white/10"
                          >
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe your video idea..."
                      className="flex-1 bg-transparent border-0 resize-none text-white placeholder:text-zinc-600 focus:outline-none focus:ring-0 min-h-[24px] max-h-[200px]"
                      rows={1}
                      data-testid="chat-input"
                      disabled={isLoading}
                    />
                    
                    {isLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 text-zinc-500 text-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                          <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                          <span className="w-2 h-2 bg-zinc-400 rounded-full loading-dot" />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <Button
                          onClick={stopGeneration}
                          size="icon"
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-full"
                          data-testid="stop-button"
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={sendMessage}
                          size="icon"
                          disabled={!inputValue.trim()}
                          className="bg-white text-black hover:bg-zinc-200 rounded-full disabled:opacity-50"
                          data-testid="send-button"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pricing Modal */}
      <Dialog open={showPricing} onOpenChange={setShowPricing}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-white">Pricing Plans</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Choose a plan that fits your needs
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`
                  relative p-6 rounded-2xl border transition-all
                  ${plan.badge === 'Best Value' 
                    ? 'pricing-highlight bg-white/5' 
                    : 'border-white/10 bg-[#121212] hover:border-white/20'}
                `}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-xs font-medium rounded-full">
                    {plan.badge}
                  </span>
                )}
                <h3 className="font-heading font-semibold text-lg text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">₹{plan.price}</span>
                </div>
                <div className="text-zinc-400 text-sm mb-6">
                  <span className="text-white font-semibold">{plan.credits.toLocaleString()}</span> credits
                </div>
                <Button
                  onClick={() => initiatePurchase(plan.id)}
                  className={`
                    w-full rounded-full
                    ${plan.badge === 'Best Value' 
                      ? 'bg-white text-black hover:bg-zinc-200' 
                      : 'bg-white/10 text-white hover:bg-white/20'}
                  `}
                  data-testid={`buy-plan-${plan.id}`}
                >
                  Buy Now
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Refill Credits Modal */}
      <Dialog open={showRefillModal} onOpenChange={setShowRefillModal}>
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              Credits Exhausted
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              You've run out of credits. Purchase more to continue generating prompts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 flex gap-3">
            <Button
              onClick={() => {
                setShowRefillModal(false);
                setShowPricing(true);
              }}
              className="flex-1 bg-white text-black hover:bg-zinc-200 rounded-full"
              data-testid="refill-credits-button"
            >
              View Pricing
            </Button>
            <Button
              onClick={() => setShowRefillModal(false)}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-full"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* About Us Modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white">About Us</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4 text-zinc-400">
            {/* 
              ============================================================
              TODO: ADD YOUR BIO HERE
              ============================================================
              Replace the placeholder text below with your actual bio.
              ============================================================
            */}
            <p>
              Welcome to Okaman - your AI-powered prompt generation platform for video creation.
            </p>
            <p>
              We help creators craft perfect prompts for AI video generation tools like Sora, Veo3, and Kling.
            </p>
            <p className="text-zinc-500 italic">
              "Our mission is to empower creators with the best AI tools to bring their video ideas to life."
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Us Modal */}
      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="bg-[#0A0A0A] border-white/10">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-white">Contact Us</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4 text-zinc-400">
            <p>Have questions or feedback? We'd love to hear from you!</p>
            <div className="space-y-3">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-zinc-500">contact.automateops@gmail.com</span>
              </p>
              <p className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                <a 
                  href="https://www.instagram.com/okaman.ai?igsh=YTc2ZmIxdWlkaHMy&utm_source=qr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  @okaman.ai
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
