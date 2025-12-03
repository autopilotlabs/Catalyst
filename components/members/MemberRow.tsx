"use client";

import { useState } from "react";
import { RoleSelect } from "./RoleSelect";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface Member {
  id: string;
  role: string;
  user: User;
  createdAt: string;
}

interface MemberRowProps {
  member: Member;
  onRoleUpdate: (memberId: string, newRole: string) => Promise<void>;
}

export function MemberRow({ member, onRoleUpdate }: MemberRowProps) {
  const [updating, setUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === member.role) return;

    setUpdating(true);
    try {
      await onRoleUpdate(member.id, newRole);
    } finally {
      setUpdating(false);
    }
  };

  const displayName =
    member.user.firstName && member.user.lastName
      ? `${member.user.firstName} ${member.user.lastName}`
      : member.user.email;

  const joinedDate = new Date(member.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <tr className={updating ? "opacity-50" : ""}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {member.user.imageUrl ? (
            <img
              src={member.user.imageUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="font-medium text-gray-900">{displayName}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-gray-600">{member.user.email}</td>
      <td className="py-3 px-4">
        <RoleSelect
          currentRole={member.role}
          onChange={handleRoleChange}
          disabled={updating}
        />
      </td>
      <td className="py-3 px-4 text-gray-600">{joinedDate}</td>
    </tr>
  );
}
