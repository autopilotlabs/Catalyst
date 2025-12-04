"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Check } from "lucide-react"
import { toast } from "sonner"

interface Workspace {
  id: string
  name: string
  role: string
}

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
}

interface MeResponse {
  user: User
  workspaces: Workspace[]
}

export function WorkspaceSelector() {
  const router = useRouter()
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    // Fetch user info and workspaces
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then((data: MeResponse) => {
        setData(data)
        
        // Try to get the active workspace from settings
        return fetch("/api/user/settings/workspace")
          .then((res) => res.ok ? res.json() : null)
          .then((settings) => {
            if (settings?.data?.defaultWorkspaceId) {
              setCurrentWorkspaceId(settings.data.defaultWorkspaceId)
            } else if (data.workspaces.length > 0) {
              setCurrentWorkspaceId(data.workspaces[0].id)
            }
          })
          .catch(() => {
            // Fallback to first workspace if settings fetch fails
            if (data.workspaces.length > 0) {
              setCurrentWorkspaceId(data.workspaces[0].id)
            }
          })
      })
      .catch((err) => {
        console.error("Failed to load workspaces:", err)
        toast.error("Failed to load workspaces")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (switching || workspaceId === currentWorkspaceId) return
    
    setSwitching(true)
    try {
      const res = await fetch("/api/workspace/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId }),
      })

      if (!res.ok) {
        throw new Error("Failed to switch workspace")
      }

      const workspace = data?.workspaces.find((w) => w.id === workspaceId)
      toast.success(`Switched to ${workspace?.name || "workspace"}`)
      
      setCurrentWorkspaceId(workspaceId)
      
      // Reload page to refresh all data
      window.location.reload()
    } catch (err) {
      console.error("Failed to switch workspace:", err)
      toast.error("Failed to switch workspace")
    } finally {
      setSwitching(false)
    }
  }

  // Don't render if not authenticated or no data
  if (loading || !data) {
    return null
  }

  // Don't render if no workspaces
  if (data.workspaces.length === 0) {
    return null
  }

  const currentWorkspace = data.workspaces.find(
    (w) => w.id === currentWorkspaceId
  ) || data.workspaces[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={switching}>
          {currentWorkspace.name}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Your Workspaces
        </div>
        <DropdownMenuSeparator />
        {data.workspaces.map((workspace) => {
          const isActive = workspace.id === currentWorkspaceId
          return (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleSwitchWorkspace(workspace.id)}
              className="cursor-pointer"
              disabled={isActive}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="font-medium">{workspace.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {workspace.role}
                  </span>
                </div>
                {isActive && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
