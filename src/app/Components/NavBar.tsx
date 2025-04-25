"use client";

import React, { useEffect, useState, useRef } from 'react';
import Logo from './Logo';
import Link from 'next/link';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';
import Notification from './Notification';
import { supabase } from '@/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

const NavBar = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const prevAuthStateRef = useRef<boolean | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleProtectedLink = (e: React.MouseEvent, path: string) => {
    if (!loggedIn) {
      e.preventDefault();
      localStorage.setItem('redirectAfterLogin', path);
      router.push('/login');
    }
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const lastAuthEventKey = 'last_auth_event';
    const debounceTimeMs = 5000; 
    
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
      console.log('Tab visibility changed:', isTabVisibleRef.current ? 'visible' : 'hidden');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isLoggedIn = !!session;
      setLoggedIn(isLoggedIn);
      prevAuthStateRef.current = isLoggedIn;
      setLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const isCurrentlyLoggedIn = !!session;
      
      if (
        (event === 'SIGNED_IN' || event === 'SIGNED_OUT') && 
        prevAuthStateRef.current !== isCurrentlyLoggedIn &&
        isTabVisibleRef.current
      ) {
        const now = Date.now();
        const lastEvent = localStorage.getItem(lastAuthEventKey);
        
        if (!lastEvent || now - parseInt(lastEvent) > debounceTimeMs) {
          localStorage.setItem(lastAuthEventKey, now.toString());
          
          /*
          setNotification({
            message: isCurrentlyLoggedIn ? 'Logged in successfully' : 'Logged out successfully',
            type: 'success'
          });
          */
        }
      }
      
      setLoggedIn(isCurrentlyLoggedIn);
      prevAuthStateRef.current = isCurrentlyLoggedIn;
    });

    // Close the menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      authListener?.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks = [
    { href: '/', label: 'Home', protected: false },
    { href: '/contributions', label: 'Your Contributions', protected: true },
    { href: '/post-project', label: 'Post A Project', protected: true },
    { href: '/settings', label: 'Settings', protected: true },
    { href: '/about', label: 'About Us', protected: false }
  ];

  const renderNavLink = (href: string, label: string, isProtected: boolean) => {
    return (
      <Link 
        href={href}
        onClick={(e) => {
          if (isProtected && !loggedIn) {
            e.preventDefault();
            handleProtectedLink(e, href);
          }
        }}
        className={`transition-all duration-200 cursor-pointer ${
          pathname === href
          ? isProtected && !loggedIn 
            ? 'text-gray-500 opacity-40' 
            : 'text-orange border-b-2 border-orange pb-1 font-bold'
          : isProtected && !loggedIn 
            ? 'text-gray-500 opacity-40 hover:opacity-60' 
            : 'text-off-white opacity-60 hover:opacity-90 hover:text-orange'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className='w-full bg-transparent flex justify-between px-3 pt-3 relative' ref={menuRef}>
      <div className='flex flex-1 items-center'>
        <Link href="/">
          <Logo rem={2.5}/>
        </Link>
        
        {/* Desktop Navigation */}
        <ul className='hidden md:flex gap-5 ml-6 inria-sans-bold mt-1 text-sm'>
          {navLinks.map((link, index) => (
            <li key={index}>
              {renderNavLink(link.href, link.label, link.protected)}
            </li>
          ))}
        </ul>
        
        {/* Hamburger menu button for mobile */}
        <button 
          className='md:hidden ml-4 text-off-white hover:text-orange transition-colors p-2'
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      
      {/* Login/Logout buttons */}
      <div className='flex items-center'>
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[--title-red]"></div>
          </div>
        ) : (
          loggedIn ? <LogoutButton /> : <LoginButton />
        )}
      </div>
      
      {/* Mobile dropdown menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-[var(--muted-red)] rounded-lg shadow-lg z-50">
          <ul className="py-2 px-3 flex flex-col gap-3">
            {navLinks.map((link, index) => (
              <li key={index} className="py-2 border-b border-gray-800 last:border-b-0">
                {renderNavLink(link.href, link.label, link.protected)}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {notification && (
        <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
      )}
    </nav>
  );
};

export default NavBar;