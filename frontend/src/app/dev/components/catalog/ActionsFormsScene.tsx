"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Checkbox, Input, Select, Textarea, Toggle } from "@/components/common";

import { CatalogRow, CatalogSection } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

export function ActionsFormsScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const [toggle, setToggle] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <CatalogSection id="actions-forms" title={copy.scenes["actions-forms"]}>
      <CatalogRow label="Button variants"><Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><Button loading>Loading</Button><Button disabled>Disabled</Button><Button fullWidth>Full width</Button></CatalogRow>
      <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2"><Input label="Default" placeholder="Type here…" /><Input label="With error" error="This field is required" defaultValue="bad" /><Input label="With hint" hint="Max 100 characters" /><Input label="With icon" icon={<Search size={16} />} placeholder="Search…" /><Input label="Disabled" disabled defaultValue="Cannot edit" /><Input label="Small" size="sm" placeholder="Small input" /></div>
      <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2"><Select label="Category" placeholder="Choose…" options={[{ value: "chips", label: "Chips" }, { value: "drinks", label: "Drinks" }, { value: "cereals", label: "Cereals" }]} /><Select label="With error" error="Required" options={[{ value: "a", label: "Option A" }]} /></div>
      <div className="max-w-md"><Textarea label="Notes" hint="Optional notes" showCount currentLength={42} maxLength={500} defaultValue="Example text content for the textarea component." /></div>
      <CatalogRow label="Controls"><Toggle label="Off" checked={toggle} onChange={setToggle} /><Toggle label="On" checked={true} onChange={() => {}} /><Toggle label="Disabled" checked={false} onChange={() => {}} disabled /><Toggle label="Small" checked={true} onChange={() => {}} size="sm" /><Checkbox label="Default" checked={checked} onChange={() => setChecked(!checked)} /><Checkbox label="Checked" checked={true} onChange={() => {}} /><Checkbox label="Indeterminate" indeterminate onChange={() => {}} /><Checkbox label="Disabled" disabled onChange={() => {}} /></CatalogRow>
    </CatalogSection>
  );
}
