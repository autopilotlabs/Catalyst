"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

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
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then((data: MeResponse) => {
        setData(data)
        // Default to first workspace if no active workspace
        if (data.workspaces.length > 0 && !currentWorkspaceId) {
          setCurrentWorkspaceId(data.workspaces[0].id)
        }
      })
      .catch((err) => {
        console.error("Failed to load workspaces:", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (switching) return
    
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

      setCurrentWorkspaceId(workspaceId)
      router.refresh()
      router.push("/")
    } catch (err) {
      console.error("Failed to switch workspace:", err)
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
      <DropdownMenuContent align="end" className="w-56">
        {data.workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSwitchWorkspace(workspace.id)}
            className="cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{workspace.name}</span>
              <span className="text-xs text-muted-foreground">{workspace.role}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
