"use client";

import { useEffect, useState } from "react";
import { SettingsForm } from "@/components/user/SettingsForm";
import { NotificationsForm } from "@/components/user/NotificationsForm";
import { ApiKeysTable } from "@/components/user/ApiKeysTable";
import { CreateApiKeyModal } from "@/components/user/CreateApiKeyModal";
import { ToastProvider, useToast } from "@/components/ui/toast";

interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  language: string;
  timezone: string;
  notifications: {
    email?: boolean;
    sms?: boolean;
    agentAlerts?: boolean;
    workflowAlerts?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  expiresAt?: string | null;
  revoked: boolean;
}

function UserSettingsPageContent() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { addToast } = useToast();

  // Fetch settings and API keys
  useEffect(() => {
    async function fetchData() {
      try {
        const [settingsRes, apiKeysRes] = await Promise.all([
          fetch("/api/user/settings"),
          fetch("/api/user/api-keys"),
        ]);

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData.data);
        }

        if (apiKeysRes.ok) {
          const apiKeysData = await apiKeysRes.json();
          setApiKeys(apiKeysData.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        addToast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [addToast]);

  // Save settings
  const handleSaveSettings = async (data: any) => {
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      const updated = await response.json();
      setSettings(updated.data);

      addToast({
        title: "Success",
        description: "Settings saved successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      addToast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  // Create API key
  const handleCreateApiKey = async (name: string) => {
    try {
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error("Failed to create API key");

      const result = await response.json();

      // Refresh API keys list
      const apiKeysRes = await fetch("/api/user/api-keys");
      if (apiKeysRes.ok) {
        const apiKeysData = await apiKeysRes.json();
        setApiKeys(apiKeysData.data);
      }

      addToast({
        title: "Success",
        description: "API key created successfully",
        variant: "success",
      });

      return { apiKey: result.data.apiKey };
    } catch (error) {
      console.error("Failed to create API key:", error);
      addToast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
      return null;
    }
  };

  // Revoke API key
  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/user/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke API key");

      // Refresh API keys list
      const apiKeysRes = await fetch("/api/user/api-keys");
      if (apiKeysRes.ok) {
        const apiKeysData = await apiKeysRes.json();
        setApiKeys(apiKeysData.data);
      }

      addToast({
        title: "Success",
        description: "API key revoked successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to revoke API key:", error);
      addToast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">User Settings</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">User Settings</h1>
        <div className="text-muted-foreground">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">User Settings</h1>

      <div className="space-y-8">
        {/* Profile Preferences */}
        <SettingsForm
          initialSettings={{
            theme: settings.theme,
            language: settings.language,
            timezone: settings.timezone,
          }}
          onSave={handleSaveSettings}
        />

        {/* Notification Preferences */}
        <NotificationsForm
          initialNotifications={settings.notifications}
          onSave={handleSaveSettings}
        />

        {/* API Keys */}
        <ApiKeysTable
          apiKeys={apiKeys}
          onRevoke={handleRevokeApiKey}
          onCreateNew={() => setShowCreateModal(true)}
        />
      </div>

      {/* Create API Key Modal */}
      <CreateApiKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateApiKey}
      />
    </div>
  );
}

export default function UserSettingsPage() {
  return (
    <ToastProvider>
      <UserSettingsPageContent />
    </ToastProvider>
  );
}
