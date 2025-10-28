"use client";

import { MoreVertical } from "lucide-react";

interface Activity {
  user: string;
  action: string;
  doc: string;
  time: string;
}

interface ActivitiesProps {
  activities: Activity[];
}

export default function Activities({ activities }: ActivitiesProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Activities</h3>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start gap-3">
              <div
                className={`w-8 h-8 ${getAvatarColor(
                  index
                )} rounded-full flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-white text-xs font-medium">
                  {getInitials(activity.user)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span>{" "}
                      <span className="text-gray-600">{activity.action}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.doc}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
