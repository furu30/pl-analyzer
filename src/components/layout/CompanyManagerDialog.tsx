"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAppStore, getSavedSlots, deleteSlot, renameSlot } from "@/lib/store";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface CompanyManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CompanyManagerDialog({
  open,
  onOpenChange,
}: CompanyManagerDialogProps) {
  const { activeSlotId, switchToSlot, createNewCompany, saveCurrentAsSlot } =
    useAppStore();
  const [slots, setSlots] = useState(getSavedSlots());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refreshSlots = useCallback(() => {
    setSlots(getSavedSlots());
  }, []);

  useEffect(() => {
    if (open) {
      // ダイアログを開くたびに現在のデータをスロットに保存
      saveCurrentAsSlot();
      refreshSlots();
    }
  }, [open, saveCurrentAsSlot, refreshSlots]);

  const handleSwitch = (slotId: string) => {
    if (slotId === activeSlotId) return;
    switchToSlot(slotId);
    refreshSlots();
    toast.success("企業データを切り替えました");
    onOpenChange(false);
  };

  const handleNewCompany = () => {
    createNewCompany();
    refreshSlots();
    toast.success("新しい企業を作成しました");
    onOpenChange(false);
  };

  const handleStartRename = (slotId: string, currentName: string) => {
    setEditingId(slotId);
    setEditName(currentName);
  };

  const handleConfirmRename = () => {
    if (!editingId || !editName.trim()) return;
    renameSlot(editingId, editName.trim());
    setEditingId(null);
    refreshSlots();
    toast.success("企業名を変更しました");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleDelete = (slotId: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;
    deleteSlot(slotId);
    refreshSlots();
    toast.success(`「${name}」を削除しました`);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            企業管理
          </DialogTitle>
          <DialogDescription>
            分析対象の企業を切り替え・管理できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              保存済みの企業データはありません
            </p>
          ) : (
            slots.map((slot) => {
              const isActive = slot.id === activeSlotId;
              const isEditing = editingId === slot.id;

              return (
                <div
                  key={slot.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-gray-50 border-gray-200 cursor-pointer"
                  }`}
                  onClick={() => !isEditing && handleSwitch(slot.id)}
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirmRename();
                            if (e.key === "Escape") handleCancelRename();
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmRename();
                          }}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRename();
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {slot.companyName || slot.name}
                          </span>
                          {isActive && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              現在
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(slot.savedAt)}
                        </p>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(slot.id, slot.name);
                        }}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                        title="名前を変更"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(slot.id, slot.companyName || slot.name);
                          }}
                          className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Separator />

        <Button onClick={handleNewCompany} className="w-full" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          新しい企業を作成
        </Button>
      </DialogContent>
    </Dialog>
  );
}
