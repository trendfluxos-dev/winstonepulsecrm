/** Display/recovery hints only; never grants access or replaces a server gate. */
export type AccessLock = "inactive" | "pending_approval" | "rejected" | "briefing_required" | "maintenance_locked" | "device_conflict" | "sim_conflict" | "sim_invalid";
export function accountLock(profile: { is_active: boolean; approval_status: string | null }): AccessLock | null {
  if (profile.approval_status === "rejected") return "rejected";
  if (!profile.is_active) return "inactive";
  if (profile.approval_status !== "approved") return "pending_approval";
  return null;
}
export const ACCESS_RECOVERY: Record<AccessLock, { title: { bn: string; en: string }; recovery: { bn: string; en: string }; authority: "it" | "hq" | "architect" | "agent"; grantsAccess: false }> = {
  inactive: { title: { bn: "অ্যাকাউন্ট নিষ্ক্রিয়", en: "Account inactive" }, recovery: { bn: "আইটি কনসোলের কাছে অ্যাকাউন্ট পুনরায় চালুর অনুরোধ করুন। সাইন ইন করলেই অনুমতি ফিরবে না।", en: "Ask IT Console to review account activation. Signing in again does not restore access." }, authority: "it", grantsAccess: false },
  pending_approval: { title: { bn: "অনুমোদনের অপেক্ষায়", en: "Awaiting approval" }, recovery: { bn: "আইটি কনসোলের অ্যাকাউন্ট অনুমোদন প্রয়োজন; Executive HQ-এর কাজের রিভিউ আলাদা।", en: "Account approval belongs to IT Console; Executive HQ work reviews are separate." }, authority: "it", grantsAccess: false },
  rejected: { title: { bn: "অ্যাকাউন্ট অনুমোদন বাতিল", en: "Account approval rejected" }, recovery: { bn: "ভুল মনে হলে আইটি কনসোলের কাছে অ্যাকাউন্ট পর্যালোচনার অনুরোধ করুন।", en: "Ask IT Console to review the rejected account if this is incorrect." }, authority: "it", grantsAccess: false },
  briefing_required: { title: { bn: "আজকের ব্রিফিং পড়া বাকি", en: "Daily briefing required" }, recovery: { bn: "আজকের ব্রিফিং পড়ে স্বীকার করুন; সার্ভার নিশ্চিত করলে কাজ চলবে।", en: "Read and acknowledge today's briefing; work resumes only after server confirmation." }, authority: "agent", grantsAccess: false },
  maintenance_locked: { title: { bn: "সিস্টেম লক আছে", en: "System maintenance lock" }, recovery: { bn: "আইটি পেমেন্ট প্রমাণ জমা দেবে; অনুমোদিত আর্কিটেক্ট যাচাই ও পুনরায় প্রবেশের সিদ্ধান্ত নেবেন।", en: "IT submits payment evidence; the authorized Architect verifies it and decides access recovery." }, authority: "architect", grantsAccess: false },
  device_conflict: { title: { bn: "ডিভাইসের অনুমতি মেলেনি", en: "Device access conflict" }, recovery: { bn: "নিজের অ্যাকাউন্টে সাইন ইন করুন; ডিভাইসের অনুমতি আইটি কনসোল দিয়ে যাচাই করান।", en: "Sign in to your own account and ask IT Console to review the device binding." }, authority: "it", grantsAccess: false },
  sim_conflict: { title: { bn: "সিম অন্য অ্যাকাউন্টে যুক্ত", en: "SIM belongs to another account" }, recovery: { bn: "নিজের সিম ব্যবহার করুন; ভুল সংযোগ হলে আইটি কনসোল যাচাই করবে, নিজে বদলানো হবে না।", en: "Use your own SIM; IT Console must review an incorrect binding. No automatic transfer." }, authority: "it", grantsAccess: false },
  sim_invalid: { title: { bn: "সিম নম্বর যাচাই হয়নি", en: "SIM number not verified" }, recovery: { bn: "সঠিক নিজের সিম নম্বর দিন এবং আবার সাইন ইন করুন; প্রয়োজনে আইটি কনসোলের সহায়তা নিন।", en: "Enter your own valid SIM number and sign in again; ask IT Console if needed." }, authority: "it", grantsAccess: false },
};