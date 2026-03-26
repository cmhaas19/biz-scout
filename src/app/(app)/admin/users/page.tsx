"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  is_disabled: boolean;
  kumo_token: boolean;
  buyer_profile_complete: boolean;
  evaluations_count: number;
  created_at: string;
  updated_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function toggleRole(userId: string, currentRole: string) {
    setActionLoading(true);
    const newRole = currentRole === "admin" ? "member" : "admin";
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchUsers();
    setActionLoading(false);
    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => prev ? { ...prev, role: newRole } : null);
    }
  }

  async function toggleDisabled(userId: string, currentDisabled: boolean) {
    setActionLoading(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_disabled: !currentDisabled }),
    });
    await fetchUsers();
    setActionLoading(false);
    if (selectedUser?.id === userId) {
      setSelectedUser((prev) =>
        prev ? { ...prev, is_disabled: !currentDisabled } : null
      );
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500">{users.length} registered users</p>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-gray-500">No users yet.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kumo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evaluations</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-gray-100 last:border-0 cursor-pointer transition-colors",
                        selectedUser?.id === u.id ? "bg-primary/5" : "hover:bg-gray-50/50"
                      )}
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{u.display_name || "Unnamed"}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={u.role === "admin" ? "bg-primary/10 text-primary" : ""}
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_disabled ? (
                          <Badge variant="destructive" className="text-xs">Disabled</Badge>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.kumo_token ? (
                          <span className="text-xs text-emerald-600 font-medium">Connected</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.buyer_profile_complete ? (
                          <span className="text-xs text-emerald-600 font-medium">Complete</span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Incomplete</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{u.evaluations_count}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatRelativeTime(u.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedUser && (
          <div className="w-[320px] shrink-0 border border-gray-200 rounded-lg bg-white p-5 space-y-4 self-start">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedUser.display_name}</h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className={selectedUser.role === "admin" ? "bg-primary/10 text-primary" : ""}>
                {selectedUser.role}
              </Badge>
              {selectedUser.is_disabled && <Badge variant="destructive">Disabled</Badge>}
              <Badge variant="outline">
                {selectedUser.kumo_token ? "Kumo Connected" : "No Kumo"}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Evaluations</span>
                <span className="font-medium">{selectedUser.evaluations_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Buyer Profile</span>
                <span className="font-medium">{selectedUser.buyer_profile_complete ? "Complete" : "Incomplete"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Joined</span>
                <span className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                disabled={actionLoading}
                onClick={() => toggleRole(selectedUser.id, selectedUser.role)}
              >
                {selectedUser.role === "admin" ? "Demote to Member" : "Promote to Admin"}
              </Button>
              <Button
                variant={selectedUser.is_disabled ? "default" : "destructive"}
                className="w-full"
                size="sm"
                disabled={actionLoading}
                onClick={() => toggleDisabled(selectedUser.id, selectedUser.is_disabled)}
              >
                {selectedUser.is_disabled ? "Enable Account" : "Disable Account"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
