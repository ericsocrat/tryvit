"use client";

import { ClipboardList, Pencil, Settings, Trash2 } from "lucide-react";
import { Alert, Button, IconButton, Tooltip } from "@/components/common";

import { CatalogRow, CatalogSection } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

export function OverlaysNavigationScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  return (
    <CatalogSection id="overlays-navigation" title={copy.scenes["overlays-navigation"]}>
      <CatalogRow label="Icon buttons"><IconButton icon={<Pencil size={16} />} label="Edit" variant="primary" /><IconButton icon={<Trash2 size={16} />} label="Delete" variant="danger" /><IconButton icon={<Settings size={16} />} label="Settings" variant="ghost" /><IconButton icon={<ClipboardList size={16} />} label="Copy" variant="secondary" /><IconButton icon={<Pencil size={14} />} label="Small" size="sm" /><IconButton icon={<Pencil size={16} />} label="Medium" size="md" /><IconButton icon={<Pencil size={18} />} label="Large" size="lg" /></CatalogRow>
      <CatalogRow label="Tooltip placements"><Tooltip content="Top tooltip" side="top"><Button variant="secondary" size="sm">Top</Button></Tooltip><Tooltip content="Right tooltip" side="right"><Button variant="secondary" size="sm">Right</Button></Tooltip><Tooltip content="Bottom tooltip" side="bottom"><Button variant="secondary" size="sm">Bottom</Button></Tooltip><Tooltip content="Left tooltip" side="left"><Button variant="secondary" size="sm">Left</Button></Tooltip></CatalogRow>
      <div className="max-w-xl space-y-3"><Alert variant="info" title="Information">This is an informational alert.</Alert><Alert variant="success" title="Success">Operation completed successfully.</Alert><Alert variant="warning" title="Warning">Please review before proceeding.</Alert><Alert variant="error" title="Error" dismissible>Something went wrong. Click ✕ to dismiss.</Alert></div>
    </CatalogSection>
  );
}
