"use client";

import React, { useEffect, useState, useRef } from 'react';
import Logo from './Logo';
import Link from 'next/link';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';
import Notification from './Notification';
import { supabase } from '@/supabaseClient';

const NavBar = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Use a ref to track the previous auth state
  const prevAuthStateRef = useRef<boolean | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);
  
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
        isTabVisibleRef.current // Only show notification if tab is visible
      ) {
        const now = Date.now();
        const lastEvent = localStorage.getItem(lastAuthEventKey);
        
        if (!lastEvent || now - parseInt(lastEvent) > debounceTimeMs) {
          localStorage.setItem(lastAuthEventKey, now.toString());
          
          setNotification({
            message: isCurrentlyLoggedIn ? 'Logged in successfully' : 'Logged out successfully',
            type: 'success'
          });
        }
      }
      
      setLoggedIn(isCurrentlyLoggedIn);
      prevAuthStateRef.current = isCurrentlyLoggedIn;
    });

    return () => {
      authListener?.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <nav className='w-full bg-transparent flex justify-between px-3 pt-3'>
      <div className='flex'>
        <Link href="/">
          <Logo rem={2.5}/>
        </Link>
        <ul className='flex gap-5 ml-6 inria-sans-bold mt-1 text-sm'>
          <li>
            <Link href="/contributions" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
              Your Contributions
            </Link>
          </li>
          <li>
            <Link href="/post-project" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
              Post A Project
            </Link>
          </li>
          <li>
            <Link href="/about" className='text-off-white hover:text-orange transition-colors cursor-pointer'>
              About Us
            </Link>
          </li>
        </ul>
      </div>
      <div>
        {loading ? (
          <p>Loading...</p>
        ) : (
          loggedIn ? <LogoutButton /> : <LoginButton />
        )}
      </div>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </nav>
  );
};

export default NavBar;