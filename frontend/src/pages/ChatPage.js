import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
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
  Sparkles,
  Send,
  Menu,
  X,
  Plus,
  MessageSquare,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Square,
  Coins,
  LogOut,
  CreditCard,
  Info,
  Mail,
  Loader2,
  Check,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AI_MODELS = [
  { id: 'VEO 3', name: 'VEO 3', description: 'Google Video AI' },
  { id: 'SORA AI', name: 'SORA AI', description: 'OpenAI Video' },
  { id: 'KLING', name: 'KLING', description: 'Kuaishou Video AI' },
];

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, logout, updateCredits, getToken } = useAuth();
  
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('VEO 3');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const authHeaders = {
    headers: { Authorization: `Bearer ${getToken()}` }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch chats on mount
  useEffect(() => {
    fetchChats();
    fetchPricingPlans();
  }, []);

  // Load chat when chatId changes
  useEffect(() => {
    if (chatId) {
      loadChat(chatId);
    } else {
      setCurrentChat(null);
      setMessages([]);
    }
  }, [chatId]);

  const fetchChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chats`, authHeaders);
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchPricingPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payments/plans`);
      setPricingPlans(response.data);
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
    }
  };

  const loadChat = async (id) => {
    try {
      const [chatResponse, messagesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/chats/${id}`, authHeaders),
        axios.get(`${API_URL}/api/chats/${id}/messages`, authHeaders)
      ]);
      setCurrentChat(chatResponse.data);
      setMessages(messagesResponse.data);
    } catch (error) {
      console.error('Error loading chat:', error);
      navigate('/chat');
    }
  };

  const createNewChat = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/chats`,
        { title: 'New Chat' },
        authHeaders
      );
      setChats([response.data, ...chats]);
      navigate(`/chat/${response.data.chat_id}`);
      setIsSidebarOpen(false);
    } catch (error) {
      toast.error('Failed to create new chat');
    }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/api/chats/${id}`, authHeaders);
      setChats(chats.filter(c => c.chat_id !== id));
      if (chatId === id) {
        navigate('/chat');
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

    // Create chat if none exists
    let targetChatId = chatId;
    if (!targetChatId) {
      try {
        const response = await axios.post(
          `${API_URL}/api/chats`,
          { title: inputValue.slice(0, 50) },
          authHeaders
        );
        targetChatId = response.data.chat_id;
        setChats([response.data, ...chats]);
        navigate(`/chat/${targetChatId}`, { replace: true });
      } catch (error) {
        toast.error('Failed to create chat');
        return;
      }
    }

    const userMessage = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg = {
      message_id: 'temp-user-' + Date.now(),
      role: 'user',
      content: userMessage,
      model: selectedModel,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await axios.post(
        `${API_URL}/api/chat/send`,
        {
          chat_id: targetChatId,
          content: userMessage,
          model: selectedModel
        },
        authHeaders
      );

      // Replace temp message with real ones
      setMessages(prev => {
        const filtered = prev.filter(m => m.message_id !== tempUserMsg.message_id);
        return [...filtered, response.data.user_message, response.data.ai_message];
      });

      // Update credits
      updateCredits(response.data.remaining_credits);
      
      // Refresh chats list
      fetchChats();
    } catch (error) {
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.message_id !== tempUserMsg.message_id));
      
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
    if (!chatId) return;
    try {
      await axios.post(
        `${API_URL}/api/chat/stop`,
        { chat_id: chatId },
        authHeaders
      );
      setIsLoading(false);
      toast.info('Generation stopped');
    } catch (error) {
      console.error('Error stopping generation:', error);
    }
  };

  const submitFeedback = async (messageId, value) => {
    try {
      await axios.post(
        `${API_URL}/api/feedback`,
        { message_id: messageId, value },
        authHeaders
      );
      setFeedbackGiven(prev => ({ ...prev, [messageId]: value }));
      toast.success(value === 1 ? 'Thanks for the feedback!' : 'Thanks, we\'ll improve!');
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  const initiatePurchase = async (planId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/payments/initiate`,
        { plan_id: planId },
        authHeaders
      );
      // Open checkout URL
      window.open(response.data.checkout_url, '_blank');
      toast.info('Payment window opened. Complete payment to add credits.');
    } catch (error) {
      toast.error('Failed to initiate payment');
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
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-white" />
              <span className="font-heading font-bold text-lg text-white">Okaman</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button
              onClick={createNewChat}
              className="w-full bg-white text-black hover:bg-zinc-200 rounded-full font-medium"
              data-testid="new-chat-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Chat History */}
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.chat_id}
                  onClick={() => {
                    navigate(`/chat/${chat.chat_id}`);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                    group transition-colors
                    ${chatId === chat.chat_id 
                      ? 'bg-white/10 text-white' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                  `}
                  data-testid={`chat-item-${chat.chat_id}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm">{chat.title}</span>
                  <button
                    onClick={(e) => deleteChat(chat.chat_id, e)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                    data-testid={`delete-chat-${chat.chat_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/5 space-y-2">
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
              <Sparkles className="w-5 h-5 text-white" />
              <span className="font-heading font-semibold text-white">Okaman</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowContact(true)}
              className="hidden sm:flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
              data-testid="contact-button"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </button>
            <Button
              onClick={createNewChat}
              variant="ghost"
              className="hidden sm:flex text-zinc-400 hover:text-white"
              data-testid="header-new-chat"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
            
            {/* Credit Display */}
            <div 
              className="credit-badge flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/10"
              onClick={() => setShowPricing(true)}
              data-testid="credit-display"
            >
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">
                {user?.current_credits || 0}
              </span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!chatId && messages.length === 0 ? (
            // Welcome Screen
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-2xl animate-fade-in">
                <Sparkles className="w-16 h-16 text-white mx-auto mb-6" />
                <h1 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
                  Welcome to Okaman
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
            // Messages
            <ScrollArea className="flex-1">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {messages.map((message, index) => (
                  <div
                    key={message.message_id}
                    className={`animate-fade-in ${message.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[85%]'}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={`
                        rounded-2xl px-4 py-3
                        ${message.role === 'user' 
                          ? 'message-user' 
                          : 'message-assistant'}
                      `}
                    >
                      {message.role === 'assistant' && message.model && (
                        <div className="text-xs text-zinc-500 mb-2 font-mono">
                          {message.model}
                        </div>
                      )}
                      <p className="text-zinc-100 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                    
                    {/* Feedback buttons for AI messages */}
                    {message.role === 'assistant' && !message.message_id.startsWith('temp-') && (
                      <div className="flex items-center gap-2 mt-2 ml-2">
                        <button
                          onClick={() => submitFeedback(message.message_id, 1)}
                          className={`
                            p-1.5 rounded-lg transition-colors
                            ${feedbackGiven[message.message_id] === 1 
                              ? 'text-green-400 bg-green-400/10' 
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                          `}
                          data-testid={`feedback-up-${message.message_id}`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => submitFeedback(message.message_id, 0)}
                          className={`
                            p-1.5 rounded-lg transition-colors
                            ${feedbackGiven[message.message_id] === 0 
                              ? 'text-red-400 bg-red-400/10' 
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                          `}
                          data-testid={`feedback-down-${message.message_id}`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
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
            </ScrollArea>
          )}

          {/* Input Area */}
          <div className="p-4">
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
                  />
                  
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
              You can include:
              - Your name and title
              - Company information
              - Mission statement
              - Contact details
              - Social media links
              ============================================================
            */}
            <p>
              Welcome to Okaman - your AI-powered prompt generation platform for video creation.
            </p>
            <p>
              We help creators craft perfect prompts for AI video generation tools like Sora, Veo3, and Kling.
            </p>
            <p className="text-zinc-500 italic">
              [Your bio and company information goes here]
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
            {/* 
              ============================================================
              TODO: ADD YOUR CONTACT INFORMATION HERE
              ============================================================
              Replace the placeholder text below with your contact details:
              - Email address
              - Phone number
              - Social media handles
              - Support hours
              ============================================================
            */}
            <p>Have questions or feedback? We'd love to hear from you!</p>
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-zinc-500">[Your email here]</span>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
