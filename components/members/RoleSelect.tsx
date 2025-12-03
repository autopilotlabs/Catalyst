"use client";

interface RoleSelectProps {
  currentRole: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}

const roles = [
  { value: "owner", label: "Owner", color: "text-purple-700 bg-purple-100" },
  { value: "admin", label: "Admin", color: "text-blue-700 bg-blue-100" },
  { value: "member", label: "Member", color: "text-green-700 bg-green-100" },
  { value: "viewer", label: "Viewer", color: "text-gray-700 bg-gray-100" },
];

export function RoleSelect({ currentRole, onChange, disabled }: RoleSelectProps) {
  const currentRoleData = roles.find((r) => r.value === currentRole);

  return (
    <select
      value={currentRole}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium
        border border-gray-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${currentRoleData?.color || "text-gray-700 bg-gray-100"}
      `}
    >
      {roles.map((role) => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
