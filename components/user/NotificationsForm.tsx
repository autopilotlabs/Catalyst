"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

interface NotificationsFormProps {
  initialNotifications: {
    email?: boolean;
    sms?: boolean;
    agentAlerts?: boolean;
    workflowAlerts?: boolean;
  };
  onSave: (notifications: any) => Promise<void>;
}

export function NotificationsForm({
  initialNotifications,
  onSave,
}: NotificationsFormProps) {
  const [email, setEmail] = useState(initialNotifications.email ?? true);
  const [sms, setSms] = useState(initialNotifications.sms ?? false);
  const [agentAlerts, setAgentAlerts] = useState(
    initialNotifications.agentAlerts ?? true
  );
  const [workflowAlerts, setWorkflowAlerts] = useState(
    initialNotifications.workflowAlerts ?? true
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        notifications: {
          email,
          sms,
          agentAlerts,
          workflowAlerts,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>

          <div className="space-y-4">
            {/* Email Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email">Email Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email notifications for important events
                </p>
              </div>
              <Switch
                id="email"
                checked={email}
                onCheckedChange={setEmail}
              />
            </div>

            {/* SMS Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sms">SMS Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive text message notifications
                </p>
              </div>
              <Switch id="sms" checked={sms} onCheckedChange={setSms} />
            </div>

            {/* Agent Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="agentAlerts">Agent Failure Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when agent executions fail
                </p>
              </div>
              <Switch
                id="agentAlerts"
                checked={agentAlerts}
                onCheckedChange={setAgentAlerts}
              />
            </div>

            {/* Workflow Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="workflowAlerts">Workflow Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about workflow status changes
                </p>
              </div>
              <Switch
                id="workflowAlerts"
                checked={workflowAlerts}
                onCheckedChange={setWorkflowAlerts}
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Notifications"}
        </Button>
      </form>
    </Card>
  );
}
