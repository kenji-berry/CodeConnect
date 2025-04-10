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
  const prevAuthStateRef = useRef<boolean | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const handleProtectedLink = (e: React.MouseEvent, path: string) => {
    if (!loggedIn) {
      e.preventDefault();
      localStorage.setItem('redirectAfterLogin', path);
      router.push('/login');
    }
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
            <Link 
              href="/" 
              className={`transition-all duration-200 cursor-pointer ${
                pathname === '/'
                ? 'text-orange border-b-2 border-orange pb-1 font-bold' 
                : 'text-off-white opacity-60 hover:opacity-90 hover:text-orange'
              }`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link 
              href={loggedIn ? "/contributions" : "#"} 
              onClick={(e) => !loggedIn && handleProtectedLink(e, "/contributions")}
              className={`transition-all duration-200 cursor-pointer ${
                pathname === '/contributions'
                ? loggedIn ? 'text-orange border-b-2 border-orange pb-1 font-bold' : 'text-gray-500 opacity-40'
                : loggedIn 
                  ? 'text-off-white opacity-60 hover:opacity-90 hover:text-orange' 
                  : 'text-gray-500 opacity-40 hover:opacity-60'
              }`}
            >
              Your Contributions
            </Link>
          </li>
          <li>
            <Link 
              href={loggedIn ? "/post-project" : "#"} 
              onClick={(e) => !loggedIn && handleProtectedLink(e, "/post-project")}
              className={`transition-all duration-200 cursor-pointer ${
                pathname === '/post-project'
                ? loggedIn ? 'text-orange border-b-2 border-orange pb-1 font-bold' : 'text-gray-500 opacity-40'
                : loggedIn 
                  ? 'text-off-white opacity-60 hover:opacity-90 hover:text-orange' 
                  : 'text-gray-500 opacity-40 hover:opacity-60'
              }`}
            >
              Post A Project
            </Link>
          </li>
          <li>
            <Link 
              href={loggedIn ? "/settings" : "#"} 
              onClick={(e) => !loggedIn && handleProtectedLink(e, "/settings")}
              className={`transition-all duration-200 cursor-pointer ${
                pathname === '/settings'
                ? loggedIn ? 'text-orange border-b-2 border-orange pb-1 font-bold' : 'text-gray-500 opacity-40'
                : loggedIn 
                  ? 'text-off-white opacity-60 hover:opacity-90 hover:text-orange' 
                  : 'text-gray-500 opacity-40 hover:opacity-60'
              }`}
            >
              Settings
            </Link>
          </li>
          <li>
            <Link 
              href="/about" 
              className={`transition-all duration-200 cursor-pointer ${
                pathname === '/about'
                ? 'text-orange border-b-2 border-orange pb-1 font-bold' 
                : 'text-off-white opacity-60 hover:opacity-90 hover:text-orange'
              }`}
            >
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
        notification={notification}
        onClose={() => setNotification(null)}
      />
      )}
    </nav>
  );
};

export default NavBar;