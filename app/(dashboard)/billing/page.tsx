"use client";

import { useEffect, useState, Suspense } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionStatus } from "@/components/billing/SubscriptionStatus";
import { UpgradeCard } from "@/components/billing/UpgradeCard";
import { useSearchParams } from "next/navigation";

interface BillingStatus {
  status: string;
  hasActiveSubscription: boolean;
  periodStart?: string;
  periodEnd?: string;
  stripeCustomerId?: string;
}

function BillingContent() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchBillingStatus();

    // Check for success or canceled query params
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      // Refresh status after successful checkout
      setTimeout(() => {
        fetchBillingStatus();
      }, 2000);
    }
  }, [searchParams]);

  const fetchBillingStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/billing/status");
      if (!response.ok) {
        throw new Error("Failed to fetch billing status");
      }
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching billing status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error("Error creating checkout:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/billing`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }

      const data = await response.json();
      
      // Redirect to Stripe Billing Portal
      window.location.href = data.url;
    } catch (error) {
      console.error("Error creating portal session:", error);
      alert("Failed to open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <>
      <SignedOut>
        <div className="flex items-center justify-center h-screen">
          <p>Please sign in to manage your billing.</p>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="container mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-muted-foreground">
              Manage your subscription and billing settings
            </p>
          </div>

          {/* Success/Canceled Messages */}
          {searchParams.get("success") === "true" && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="pt-6">
                <p className="text-green-800">
                  ✓ Subscription activated successfully! Your payment has been processed.
                </p>
              </CardContent>
            </Card>
          )}

          {searchParams.get("canceled") === "true" && (
            <Card className="border-yellow-500 bg-yellow-50">
              <CardContent className="pt-6">
                <p className="text-yellow-800">
                  Checkout was canceled. You can try again anytime.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Current Subscription Status */}
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Loading billing status...
                </p>
              </CardContent>
            </Card>
          ) : status ? (
            <div className="grid gap-6 md:grid-cols-2">
              <SubscriptionStatus
                status={status.status}
                periodStart={status.periodStart}
                periodEnd={status.periodEnd}
              />
              
              {status.hasActiveSubscription && status.stripeCustomerId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Manage Subscription</CardTitle>
                    <CardDescription>
                      Update payment method, view invoices, or cancel your subscription
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="w-full"
                    >
                      {portalLoading ? "Loading..." : "Open Billing Portal"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}

          {/* Upgrade Plans */}
          {!status?.hasActiveSubscription && (
            <>
              <div className="pt-6">
                <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
                <p className="text-muted-foreground">
                  Select a plan that fits your needs
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <UpgradeCard
                  title="Starter"
                  description="Perfect for small teams"
                  price="$29"
                  priceId="price_1SaDfARKrV5NzzWoIWjrL8iP"
                  features={[
                    "Up to 1,000 agent runs/month",
                    "5 active agents",
                    "Basic workflows",
                    "Email support",
                  ]}
                  onUpgrade={handleUpgrade}
                />
                <UpgradeCard
                  title="Pro"
                  description="For growing businesses"
                  price="$99"
                  priceId="price_1SaDfBRKrV5NzzWo6UtOg5ic"
                  features={[
                    "Up to 10,000 agent runs/month",
                    "Unlimited agents",
                    "Advanced workflows",
                    "Priority support",
                    "Custom integrations",
                  ]}
                  onUpgrade={handleUpgrade}
                />
                <UpgradeCard
                  title="Enterprise"
                  description="For large organizations"
                  price="$299"
                  priceId="price_1SaDfDRKrV5NzzWo6utrsZCL"
                  features={[
                    "Unlimited agent runs",
                    "Unlimited agents",
                    "Enterprise workflows",
                    "24/7 dedicated support",
                    "Custom integrations",
                    "SLA guarantee",
                  ]}
                  onUpgrade={handleUpgrade}
                />
              </div>
            </>
          )}
        </div>
      </SignedIn>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="text-center">Loading billing information...</div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
