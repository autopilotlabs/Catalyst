"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJsonWithRateLimitHandling } from "@/lib/fetch-with-handling";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, FileIcon } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    name: string;
  } | null;
  refs: Array<{
    id: string;
    entityType: string;
    entityId: string | null;
  }>;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    try {
      const data = await fetchJsonWithRateLimitHandling<{ success: boolean; files: FileItem[] }>(
        "/api/files"
      );

      setFiles(data.files || []);
    } catch (error: any) {
      toast.error("Failed to fetch files", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("File uploaded successfully");
        setUploadDialogOpen(false);
        setSelectedFile(null);
        await fetchFiles();
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (error: any) {
      toast.error("Failed to upload file", {
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("File downloaded");
    } catch (error: any) {
      toast.error("Failed to download file", {
        description: error.message,
      });
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      toast.success("File deleted successfully");
      await fetchFiles();
    } catch (error: any) {
      toast.error("Failed to delete file", {
        description: error.message,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Files</h1>
            <p className="text-muted-foreground mt-2">
              Manage uploaded files for use in agents, workflows, memory, and evals.
            </p>
          </div>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
                <DialogDescription>
                  Upload a file to your workspace storage. Maximum file size: 100MB.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedFile(null);
                    }}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                    {isUploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <FileIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No files uploaded</h3>
            <p className="text-muted-foreground mt-2">
              Upload files to use them in your agents, workflows, and more.
            </p>
            <Button className="mt-4" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Your First File
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {file.name}
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.size)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{file.mimeType}</Badge>
                    </TableCell>
                    <TableCell>
                      {file.createdBy ? (
                        <div>
                          <div className="font-medium">{file.createdBy.name || file.createdBy.email}</div>
                          {file.createdBy.name && (
                            <div className="text-xs text-muted-foreground">{file.createdBy.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </TableCell>
                    <TableCell>
                      {file.refs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {file.refs.map((ref) => (
                            <Badge key={ref.id} variant="secondary" className="text-xs">
                              {ref.entityType}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file.id, file.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.id, file.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-8 p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Using Files</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Once uploaded, files can be referenced in:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              <Badge className="mr-2">Agents</Badge>
              Attach files as context or knowledge base
            </li>
            <li className="flex items-center">
              <Badge className="mr-2">Workflows</Badge>
              Use files as inputs or outputs in workflow steps
            </li>
            <li className="flex items-center">
              <Badge className="mr-2">Memory</Badge>
              Link files to memory entries for semantic search
            </li>
            <li className="flex items-center">
              <Badge className="mr-2">Evals</Badge>
              Use files as test fixtures and expected outputs
            </li>
            <li className="flex items-center">
              <Badge className="mr-2">Triggers</Badge>
              Attach files to events for processing
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
