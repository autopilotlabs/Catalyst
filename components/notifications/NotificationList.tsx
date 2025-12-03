"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
}

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
}

export function NotificationList({
  notifications,
  onMarkAsRead,
}: NotificationListProps) {
  const getTypeColor = (type: string) => {
    if (type.includes("failed") || type.includes("error")) {
      return "bg-red-100 text-red-800 border-red-300";
    }
    if (type.includes("completed") || type.includes("success")) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (type.includes("blocked") || type.includes("warning")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getTypeBadge = (type: string) => {
    // Format type for display
    return type
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No notifications
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re all caught up!
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 hover:bg-gray-50 transition-colors ${
            !notification.read ? "bg-blue-50" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(
                    notification.type
                  )}`}
                >
                  {getTypeBadge(notification.type)}
                </span>
                {!notification.read && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
                    New
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                {notification.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {notification.message}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            {!notification.read && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="ml-4 flex-shrink-0 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
