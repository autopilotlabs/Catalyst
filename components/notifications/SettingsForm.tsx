"use client";

import { useState, useEffect } from "react";

interface NotificationSettings {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  webhookUrl: string | null;
  webhookEnabled: boolean;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    inAppEnabled: true,
    webhookUrl: null,
    webhookEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notifications/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Notification Settings
        </h3>
        <div className="mt-6 space-y-6">
          {/* Email Notifications */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="emailEnabled"
                name="emailEnabled"
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, emailEnabled: e.target.checked })
                }
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="emailEnabled"
                className="font-medium text-gray-700"
              >
                Email Notifications
              </label>
              <p className="text-gray-500">
                Receive notifications via email for important events.
              </p>
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="inAppEnabled"
                name="inAppEnabled"
                type="checkbox"
                checked={settings.inAppEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, inAppEnabled: e.target.checked })
                }
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label
                htmlFor="inAppEnabled"
                className="font-medium text-gray-700"
              >
                In-App Notifications
              </label>
              <p className="text-gray-500">
                Show notifications in the application.
              </p>
            </div>
          </div>

          {/* Webhook Notifications */}
          <div className="space-y-2">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="webhookEnabled"
                  name="webhookEnabled"
                  type="checkbox"
                  checked={settings.webhookEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhookEnabled: e.target.checked,
                    })
                  }
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="webhookEnabled"
                  className="font-medium text-gray-700"
                >
                  Webhook Notifications
                </label>
                <p className="text-gray-500">
                  Send notifications to an external webhook URL.
                </p>
              </div>
            </div>

            {settings.webhookEnabled && (
              <div className="ml-7">
                <label
                  htmlFor="webhookUrl"
                  className="block text-sm font-medium text-gray-700"
                >
                  Webhook URL
                </label>
                <input
                  type="url"
                  id="webhookUrl"
                  name="webhookUrl"
                  value={settings.webhookUrl || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, webhookUrl: e.target.value })
                  }
                  placeholder="https://example.com/webhook"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Settings saved successfully!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
