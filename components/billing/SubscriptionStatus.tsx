"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubscriptionStatusProps {
  status: string;
  periodStart?: string;
  periodEnd?: string;
}

export function SubscriptionStatus({
  status,
  periodStart,
  periodEnd,
}: SubscriptionStatusProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "trialing":
        return <Badge variant="secondary">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "canceled":
        return <Badge variant="outline">Canceled</Badge>;
      case "incomplete":
        return <Badge variant="outline">Incomplete</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Status</div>
          {getStatusBadge()}
        </div>
        {periodStart && (
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Current Period Start
            </div>
            <div className="text-sm">{formatDate(periodStart)}</div>
          </div>
        )}
        {periodEnd && (
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Current Period End
            </div>
            <div className="text-sm">{formatDate(periodEnd)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
