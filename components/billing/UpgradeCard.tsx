"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UpgradeCardProps {
  title: string;
  description: string;
  price: string;
  priceId: string;
  features: string[];
  onUpgrade: (priceId: string) => Promise<void>;
}

export function UpgradeCard({
  title,
  description,
  price,
  priceId,
  features,
  onUpgrade,
}: UpgradeCardProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      await onUpgrade(priceId);
    } catch (error) {
      console.error("Upgrade failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-3xl font-bold">{price}</div>
          <div className="text-sm text-muted-foreground">per month</div>
        </div>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="text-sm flex items-start">
              <span className="mr-2">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Loading..." : "Upgrade Now"}
        </Button>
      </CardContent>
    </Card>
  );
}
