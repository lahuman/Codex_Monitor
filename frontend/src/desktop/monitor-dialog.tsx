import type { ComponentProps } from "react";
import { DialogContent } from "@/components/ui/dialog";

export function MonitorDialogContent({
  className = "",
  ...props
}: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={`monitor-dialog ${className}`} {...props} />;
}
