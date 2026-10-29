import { MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startMyWhatsappCall } from "@/lib/call-reports.functions";
import { getAdminToken } from "@/lib/local-session";
import { openWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type Props = {
  phone: string | null | undefined;
  leadId?: string | null;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "ghost" | "outline";
  className?: string;
  ariaLabel?: string;
};

/**
 * Single WhatsApp entry point for the CRM. Always opens WhatsApp OUTSIDE the
 * app (native app on Android, new tab otherwise) — never framed/embedded — and
 * logs the hand-off against the lead timeline.
 */
export function WhatsAppAction({
  phone,
  leadId,
  label = "হোয়াটসঅ্যাপ",
  size = "sm",
  variant = "secondary",
  className,
  ariaLabel,
}: Props) {
  const handleClick = () => {
    // External chat composers cannot enforce CRM template restrictions.
    toast.info("অনুমোদিত টেমপ্লেট পাঠাতে My Desk-এর WhatsApp ইনবক্স ব্যবহার করুন");
  };

  // WhatsApp call: the server opens the mandatory report first (same gate as a
  // SIM call), then WhatsApp opens. The report popup appears on return.
  const handleCall = async () => {
    if (!leadId) return;
    try {
      const res = await startMyWhatsappCall({ data: { adminToken: getAdminToken(), leadId } });
      if (res.blocked) {
        toast.error("reason" in res && res.reason ? String(res.reason) : "এখন কল শুরু করা যাবে না");
        return;
      }
    } catch (error) {
      toast.error((error as Error).message || "WhatsApp কল শুরু করা যায়নি");
      return;
    }
    const result = openWhatsApp(phone, null);
    if (!result.ok) {
      toast.error("WhatsApp খোলা যায়নি — কলের পর রিপোর্ট জমা দিন");
      return;
    }
    toast.success("কল শেষে রিপোর্ট জমা দিন — WhatsApp কল");
  };

  const trigger = (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1", className)}
      onClick={leadId ? undefined : handleClick}
      aria-label={ariaLabel}
    >
      <MessageCircle className="size-4" /> {label}
    </Button>
  );
  if (!leadId) return trigger;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => void handleCall()}>
          <Phone className="size-4" /> WhatsApp কল (রিপোর্ট লাগবে)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleClick}>
          <MessageCircle className="size-4" /> অনুমোদিত টেমপ্লেট
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
