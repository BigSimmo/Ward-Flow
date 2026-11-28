// The kit's form controls live one file each (phone script budget, PR #1742): a page that draws one
// control no longer loads them all. Import from "@/components/wf"; this file keeps the old path
// working for the controls still imported by it.
export { Field } from "./form-field";
export { TextInput, Textarea } from "./form-text";
