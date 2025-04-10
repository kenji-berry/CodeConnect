"use client";

import React, { useEffect } from 'react';

interface NotificationProps {
  notification: { message: string; type: 'success' | 'error' }; // Single notification object
  onClose: () => void; // Function to close the notification
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  useEffect(() => {
    // Auto-dismiss notification after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [notification, onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
      <div
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
            onClick={onClose}
            className="ml-4 text-white hover:text-gray-200 transition-colors"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notification;