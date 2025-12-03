"use client";

import { useEffect, useState } from "react";
import { MemberRow } from "@/components/members/MemberRow";

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
  updatedAt: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/members");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load members");
      }

      const data = await response.json();
      setMembers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleRoleUpdate = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update role");
      }

      // Reload members after successful update
      await loadMembers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Team Members</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Team Members</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-gray-600 mt-2">
            Manage workspace members and their permissions
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                    Member
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onRoleUpdate={handleRoleUpdate}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {members.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No members found
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Role Permissions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Owner:</strong> Full access to all features including billing and member management</li>
            <li><strong>Admin:</strong> Can manage agents, workflows, triggers, and view audit logs</li>
            <li><strong>Member:</strong> Can use agents, workflows, triggers, analytics, and memory</li>
            <li><strong>Viewer:</strong> Read-only access (cannot access billing or audit logs)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
