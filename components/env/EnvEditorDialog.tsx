"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EnvEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EnvEditorDialog({
  open,
  onOpenChange,
  onSave,
}: EnvEditorDialogProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!value.trim()) {
      toast.error("Value is required");
      return;
    }

    // Validate name format
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
      toast.error(
        "Invalid name format",
        {
          description: "Name must contain only uppercase letters, numbers, and underscores, and start with a letter or underscore",
        }
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/env", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, value }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save environment variable");
      }

      toast.success("Environment variable saved successfully");
      setName("");
      setValue("");
      onOpenChange(false);
      onSave();
    } catch (error: any) {
      toast.error("Failed to save environment variable", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add Environment Variable</DialogTitle>
          <DialogDescription>
            Create a new environment variable. The value will be encrypted at rest.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="MY_API_KEY"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use uppercase letters, numbers, and underscores only
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="value">Value</Label>
            <Textarea
              id="value"
              placeholder="Enter the value..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This value will be encrypted and stored securely
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
