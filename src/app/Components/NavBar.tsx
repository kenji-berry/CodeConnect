"use client";

import React, { useEffect, useState } from 'react';
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
  const [notificationShown, setNotificationShown] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setLoggedIn(!!session);
      setLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setLoggedIn(!!session);
      if (event === 'SIGNED_IN' && !notificationShown) {
        setNotification({ message: 'Logged in successfully', type: 'success' });
        setNotificationShown(true);
      } else if (event === 'SIGNED_OUT') {
        setNotification({ message: 'Logged out successfully', type: 'success' });
        setNotificationShown(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [notificationShown]);

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