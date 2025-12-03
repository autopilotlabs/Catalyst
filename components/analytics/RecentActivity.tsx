"use client";

import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: string;
  context: any;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

interface RecentActivityProps {
  data: Activity[] | null;
  loading: boolean;
}

export function RecentActivity({ data, loading }: RecentActivityProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <p className="text-center text-gray-500 py-8">No recent activity</p>
      </Card>
    );
  }

  const getEventTypeColor = (type: string) => {
    if (type.includes("completed")) return "bg-green-100 text-green-800";
    if (type.includes("triggered")) return "bg-blue-100 text-blue-800";
    if (type.includes("received")) return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
  };

  const formatEventType = (type: string) => {
    return type
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(
                    activity.type
                  )}`}
                >
                  {formatEventType(activity.type)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {activity.user && (
                <p className="text-sm text-gray-600">{activity.user.name}</p>
              )}
              {activity.context && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {JSON.stringify(activity.context).slice(0, 100)}...
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
