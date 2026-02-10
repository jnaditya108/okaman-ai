import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Zap, Video, MessageSquare, ArrowRight, Check } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 header-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-white" />
            <span className="font-heading font-bold text-xl text-white">Okaman</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="text-zinc-400 hover:text-white" data-testid="nav-login">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-white text-black hover:bg-zinc-200 rounded-full px-6" data-testid="nav-signup">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background Effect */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1770031079091-c6356e82ea9b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHw0fHxhYnN0cmFjdCUyMGRhcmslMjBmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGJhY2tncm91bmQlMjBtaW5pbWFsaXN0fGVufDB8fHx8MTc3MDY2Mzk4NXww&ixlib=rb-4.1.0&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-transparent to-[#0A0A0A]" />
        
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-8 animate-fade-in">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-zinc-300">50 Free Credits on Signup</span>
          </div>
          
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            AI Prompt Generation for
            <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
              Video Creation Tools
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
            Welcome to the AI prompt generation for Sora, Veo3, and other AI video generation tools by Okaman.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Link to="/signup">
              <Button className="bg-white text-black hover:bg-zinc-200 rounded-full px-8 py-6 text-lg font-medium btn-glow" data-testid="hero-get-started">
                Start Creating Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg" data-testid="hero-signin">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Supported Models */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-zinc-500 mb-8">Generate prompts for leading AI video tools</p>
          <div className="flex flex-wrap justify-center gap-6">
            {['SORA AI', 'VEO 3', 'KLING'].map((model, index) => (
              <div 
                key={model}
                className="px-8 py-4 rounded-2xl border border-white/10 bg-white/5 animate-fade-in"
                style={{ animationDelay: `${index * 100 + 400}ms` }}
              >
                <span className="font-heading font-semibold text-white">{model}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Everything You Need
          </h2>
          <p className="text-zinc-400 text-center mb-16 max-w-2xl mx-auto">
            Craft perfect prompts for any AI video generation tool
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Video className="w-8 h-8" />,
                title: 'Multi-Model Support',
                description: 'Generate optimized prompts for Sora, Veo3, Kling, and more AI video tools.'
              },
              {
                icon: <MessageSquare className="w-8 h-8" />,
                title: 'Chat History',
                description: 'Save and organize all your prompts. Access them anytime for reference.'
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: 'Credit System',
                description: 'Pay only for what you use. Flexible plans starting from just ₹199.'
              }
            ].map((feature, index) => (
              <div 
                key={feature.title}
                className="p-8 rounded-2xl border border-white/5 bg-[#121212] hover:border-white/10 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-white mb-6">
                  {feature.icon}
                </div>
                <h3 className="font-heading font-semibold text-xl text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 relative">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1760978632061-ad00f48789ae?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGJhY2tncm91bmQlMjBtaW5pbWFsaXN0fGVufDB8fHx8MTc3MDY2Mzk4NXww&ixlib=rb-4.1.0&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        
        <div className="relative max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Simple Pricing
          </h2>
          <p className="text-zinc-400 text-center mb-16">
            Choose a plan that works for you
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: '1 Month', credits: 500, price: 199 },
              { name: '3 Months', credits: 1700, price: 599 },
              { name: '6 Months', credits: 3500, price: 1149, badge: 'Popular' },
              { name: '1 Year', credits: 7500, price: 2299, badge: 'Best Value' }
            ].map((plan, index) => (
              <div 
                key={plan.name}
                className={`
                  relative p-6 rounded-2xl border transition-all animate-fade-in
                  ${plan.badge === 'Best Value' 
                    ? 'border-white/30 bg-white/5 shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
                    : 'border-white/10 bg-[#121212] hover:border-white/20'}
                `}
                style={{ animationDelay: `${index * 100}ms` }}
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
                <p className="text-zinc-400 text-sm mb-6">
                  <span className="text-white font-semibold">{plan.credits.toLocaleString()}</span> credits
                </p>
                <Link to="/signup">
                  <Button 
                    className={`
                      w-full rounded-full
                      ${plan.badge === 'Best Value' 
                        ? 'bg-white text-black hover:bg-zinc-200' 
                        : 'bg-white/10 text-white hover:bg-white/20'}
                    `}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Create?
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Start with 50 free credits. No credit card required.
          </p>
          <Link to="/signup">
            <Button className="bg-white text-black hover:bg-zinc-200 rounded-full px-10 py-6 text-lg font-medium btn-glow" data-testid="cta-signup">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="font-heading font-semibold text-white">Okaman</span>
          </div>
          <p className="text-zinc-500 text-sm">
            © 2024 Okaman. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-zinc-400 hover:text-white text-sm">
              Sign In
            </Link>
            <Link to="/signup" className="text-zinc-400 hover:text-white text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
