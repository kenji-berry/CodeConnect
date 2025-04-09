"use client";

import React, { useEffect } from 'react';

export interface NotificationItem {
  id: string;
  message: string;
  type: 'success' | 'error';
  timestamp: number;
}

interface NotificationProps {
  notifications: NotificationItem[];
  onClose: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ notifications, onClose }) => {
  useEffect(() => {
    // Set up auto-dismiss timers for each notification
    const timers = notifications.map(notification => {
      return setTimeout(() => {
        onClose(notification.id);
      }, 3000);
    });

    // Clean up timers when component unmounts or notifications change
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, onClose]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            marginTop: `${index * 10}px`, // Offset each notification
            opacity: 1 - (index * 0.15), // Make older notifications slightly transparent
            zIndex: 100 - index, // Stack newer notifications on top
            transform: `translateY(${index * 5}px) scale(${1 - index * 0.05})`, // Slight scale effect
          }}
          className={`
            notification-item
            my-1 px-4 py-2 rounded shadow-lg text-white w-full max-w-md
            transition-all duration-300 ease-in-out
            pointer-events-auto
            animate-slide-down 
            ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}
          `}
        >
          <div className="flex justify-between items-center">
            <span className="pr-4">{notification.message}</span>
            <button 
              onClick={() => onClose(notification.id)} 
              className="ml-4 text-white hover:text-gray-200 transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Notification;