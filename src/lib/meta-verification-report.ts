/**
 * Read-only verification report for the Messenger connection.
 *
 * Three evidence tracks are reported separately so one can never borrow
 * another's proof: Meta App/Page approval, Page webhook subscription, and
 * old-token revocation. Every track starts unverified with no invented
 * timestamp; a track changes only when authoritative evidence exists.
 */

export type VerificationTrackId = "app_approval" | "page_subscription" | "token_revocation";

export type VerificationTrack = {
  id: VerificationTrackId;
  label: { bn: string; en: string };
  status: "unverified";
  /** Always null until a genuine check happened; never fabricated. */
  checkedAt: null;
  evidence: { bn: string; en: string };
  blocker: { bn: string; en: string };
};

export type MetaVerificationReport = {
  /** This report is preparation evidence only — no live provider call was made. */
  generatedFrom: "preparation_only";
  tracks: VerificationTrack[];
};

export function metaVerificationReport(): MetaVerificationReport {
  return {
    generatedFrom: "preparation_only",
    tracks: [
      {
        id: "app_approval",
        label: { bn: "Messenger অনুমোদন (App Review)", en: "Messenger approval (App Review)" },
        status: "unverified",
        checkedAt: null,
        evidence: {
          bn: "প্রমাণ নেই: App Review-এ pages_messaging অনুমোদন, Live mode ও Advanced Access যাচাই হয়নি।",
          en: "No evidence: App Review pages_messaging approval, Live mode and Advanced Access are unverified.",
        },
        blocker: {
          bn: "Meta for Developers → App Review → Permissions and Features-এর স্ক্রিনশট বা /inbox-এর IT PIN পরীক্ষা দরকার।",
          en: "Needs the Meta for Developers → App Review → Permissions and Features screenshot or the /inbox IT PIN check.",
        },
      },
      {
        id: "page_subscription",
        label: { bn: "Page subscription", en: "Page subscription" },
        status: "unverified",
        checkedAt: null,
        evidence: {
          bn: "প্রমাণ নেই: App ও Page উভয় স্তরে messages subscription যাচাই হয়নি; webhook নিবন্ধন অজানা।",
          en: "No evidence: messages subscriptions at App and Page level are unverified; webhook registration is unknown.",
        },
        blocker: {
          bn: "Webhooks → Page সেটিংসের স্ক্রিনশট বা /inbox-এর IT PIN পরীক্ষা দরকার; callback এখনও নিবন্ধনের উপযুক্ত নয়।",
          en: "Needs the Webhooks → Page settings screenshot or the /inbox IT PIN check; the callback is not ready to register yet.",
        },
      },
      {
        id: "token_revocation",
        label: { bn: "পুরোনো token বাতিল", en: "Old token revocation" },
        status: "unverified",
        checkedAt: null,
        evidence: {
          bn: "প্রমাণ নেই: নতুন token সেভ হয়েছে, কিন্তু চ্যাট/ফাইলে উন্মুক্ত পুরোনো token Meta-তে বাতিল হয়েছে বলে যাচাই হয়নি।",
          en: "No evidence: a replacement token is saved, but the exposed old token is not verified as revoked at Meta.",
        },
        blocker: {
          bn: "মালিককে Meta-তে পুরোনো token বাতিল করতে হবে; শুধু নতুন token সেভ করা বাতিলের প্রমাণ নয়।",
          en: "The owner must revoke the old token at Meta; saving a replacement is not proof of revocation.",
        },
      },
    ],
  };
}
