import { integrationPreparation } from "@/lib/integration-readiness";

type Text = { bn: string; en: string };
export type IntegrationStatus = {
  id: "messenger" | "whatsapp" | "windsor" | "drive" | "os";
  name: string;
  state: "inactive" | "unverified";
  verifiedAt: string | null;
  evidence: Text;
  blocker: Text;
  steps: Text[];
};

/** Public preparation only. No secret inventory, provider calls or live health claims. */
export function integrationStatus(): IntegrationStatus[] {
  const preparation = integrationPreparation();
  return [
    {
      id: "messenger", name: "Messenger", state: "inactive", verifiedAt: preparation.verification.messenger.checkedAt,
      evidence: { bn: "নমুনা ইনবক্স ও signed webhook স্বাক্ষর পরীক্ষার ব্যবস্থা আছে; বাস্তব বার্তা গ্রহণ বন্ধ।", en: "Demo inbox and signed webhook validation are prepared; real message ingestion is disabled." },
      blocker: preparation.verification.messenger.reason,
      steps: [
        { bn: "Meta App-এর Live mode, App Review ও pages_messaging অনুমোদনের প্রমাণ যাচাই করুন।", en: "Verify evidence of Meta App Live mode, App Review and pages_messaging approval." },
        { bn: "সঠিক Page-এর সম্মতি এবং App ও Page—দুই স্তরে messages subscription যাচাই করুন। IT-সুরক্ষিত পরীক্ষাটি ইনবক্সে আছে।", en: "Verify consent for the correct Page and messages subscriptions at both App and Page levels. The IT-protected diagnostic is in the inbox." },
        { bn: "নিরাপদ বার্তা সংরক্ষণ, মালিকানা ও পুনরায় আসা বার্তার নিয়ম পর্যালোচনা করুন; আলাদা প্রকাশ-অনুমতির পর বাস্তব signed বার্তা সংরক্ষণ ও ইনবক্সে পড়ে দেখুন।", en: "Review durable storage, ownership and replay handling; after separate release approval, verify a real signed message is stored and reads back in the inbox." },
        { bn: "লিড তৈরির আগে কর্মী নাম, ফোন ও সম্মতি নিশ্চিত করবেন; নতুন লিড LeadHub-এর অনির্ধারিত তালিকায় যাবে।", en: "Staff must confirm name, phone and consent before lead intake; new leads belong in the unassigned LeadHub queue." },
      ],
    },
    {
      id: "whatsapp", name: "WhatsApp", state: "unverified", verifiedAt: null,
      evidence: { bn: "ফোনের WhatsApp কাজের রিপোর্ট ও Business সংযোগ আলাদা; রিপোর্ট বা মেসেজ খোলা পৌঁছানোর প্রমাণ নয়।", en: "Phone WhatsApp work reports and the Business connection are separate; a report or opened message is not delivery evidence." },
      blocker: { bn: "বর্তমান Business সংযোগ, callback গন্তব্য ও সংরক্ষিত delivery প্রমাণ এখানে যাচাই করা হয়নি।", en: "The current Business connection, callback destination and stored delivery evidence have not been verified here." },
      steps: [
        { bn: "Lovable Connectors-এ সঠিক WhatsApp Business নম্বর ও অ্যাকাউন্টের প্রবেশাধিকার যাচাই করুন।", en: "Verify the intended WhatsApp Business number and account access in Lovable Connectors." },
        { bn: "Incoming messages এই CRM-এ আসছে কি না দেখুন; গন্তব্য বদলালে আগের প্রকল্পে বার্তা যাওয়া বন্ধ হবে।", en: "Check that Incoming messages targets this CRM; changing the destination stops callbacks to the previous project." },
        { bn: "প্রকাশিত signed receiver, নিরাপদ সংরক্ষণ এবং একই বার্তার sent/delivered/read/failed callback মিলিয়ে যাচাই করুন।", en: "Verify the deployed signed receiver, durable storage and matching sent/delivered/read/failed callbacks for the same message." },
        { bn: "গ্রাহকের ২৪ ঘণ্টার reply window-এর বাইরে অনুমোদিত template ব্যবহার করুন; পরীক্ষার আসল পাঠানো ও পৌঁছানোর প্রমাণ রাখুন।", en: "Use an approved template outside the customer’s 24-hour reply window; retain genuine send and delivery evidence for the test." },
      ],
    },
    {
      id: "windsor", name: "Windsor.ai", state: "inactive", verifiedAt: preparation.verification.windsor.checkedAt,
      evidence: { bn: "শুধু পড়ার রিপোর্ট প্রস্তুতি আছে; বাস্তব বিজ্ঞাপন রিপোর্ট আনা বন্ধ।", en: "Read-only reporting preparation exists; live ads reporting is disabled." },
      blocker: preparation.verification.windsor.reason,
      steps: [
        { bn: "উন্মুক্ত পুরোনো key বাতিল করুন; নতুনটি শুধু নিরাপদ Secrets ফর্মে রাখুন, চ্যাটে নয়।", en: "Revoke the exposed old key; save its replacement only through the secure Secrets form, not chat." },
        { bn: "সঠিক workspace ও বিজ্ঞাপন অ্যাকাউন্টে শুধু রিপোর্ট পড়ার অনুমতি নিশ্চিত করুন।", en: "Confirm the intended workspace and read-only reporting permission for the ad account." },
        { bn: "অফিশিয়াল API ঠিকানা, field, তারিখ, সময় অঞ্চল, মুদ্রা, pagination ও সীমার নিয়ম যাচাই করুন।", en: "Verify the official API endpoint, fields, date semantics, timezone, currency, pagination and limits." },
        { bn: "আলাদা অনুমোদনের পর সীমিত ১–৩১ দিনের রিপোর্ট পরীক্ষা করুন; অ্যাকাউন্টের দিনের তথ্যকে প্রমাণ ছাড়া ঢাকার দিন হিসেবে ধরবেন না।", en: "After separate authorization, test a bounded 1–31-day report; do not reinterpret account-day data as Dhaka days without evidence." },
      ],
    },
    {
      id: "drive", name: "Google Drive", state: "unverified", verifiedAt: null,
      evidence: { bn: "অনুমোদিত ফোল্ডারের ডকুমেন্ট পড়া ও রেকর্ডিং backup যাচাইয়ের ব্যবস্থা আছে; বর্তমান প্রবেশাধিকার বা ফাইল পরীক্ষা হয়নি।", en: "Approved-folder document reading and recording backup checks exist; current access and files have not been checked." },
      blocker: { bn: "বর্তমান সংযোগে প্রকল্প-মালিকের প্রবেশাধিকার, নির্দিষ্ট ফোল্ডার ও আসল backup ফাইলের প্রমাণ যাচাই বাকি।", en: "Project-owner access to the current connection, specific folders and actual backup files remain unverified." },
      steps: [
        { bn: "Connectors-এ প্রকল্প-মালিকের Can use প্রবেশাধিকার যাচাই করুন; না থাকলে সংযোগের Owner-কে Sharing থেকে দিতে বলুন।", en: "Verify the project owner has Can use access in Connectors; otherwise ask the connection Owner to grant it under Sharing." },
        { bn: "শুধু অনুমোদিত Documents & Summaries এবং Audit & Compliance ফোল্ডারের প্রবেশাধিকার পরীক্ষা করুন; পুরো Drive পড়বেন না।", en: "Check only approved Documents & Summaries and Audit & Compliance folders; do not read the whole Drive." },
        { bn: "IT Console-এ সংরক্ষিত ডকুমেন্ট ও শেষ পড়ার সময় মিলিয়ে দেখুন; এটি রেকর্ডিং backup-এর প্রমাণ নয়।", en: "Check stored documents and last indexing time in IT Console; this does not prove recording backups." },
        { bn: "রেকর্ডারের নির্দিষ্ট recording-এর আসল Drive ফাইল মিলিয়ে যাচাই করুন; সামারি বা configured চিহ্নকে backup ধরবেন না।", en: "Verify the actual Drive file for a specific recording in Recorder; summaries and configured flags do not prove backup." },
      ],
    },
    {
      id: "os", name: "Winstone OS", state: "unverified", verifiedAt: null,
      evidence: { bn: "Signed inbound event ও অনুমোদিত বুকিংয়ের outbound সারি তৈরি আছে; বর্তমান দুই দিকের delivery পরীক্ষা হয়নি।", en: "Signed inbound events and an approved-booking outbound queue are implemented; current delivery in either direction has not been checked." },
      blocker: { bn: "বর্তমান HTTPS গন্তব্য, স্বাক্ষর ও একই event-এর দুই সিস্টেমে সংরক্ষিত ফলাফল যাচাই বাকি।", en: "The current HTTPS destination, signing setup and persisted result of the same event in both systems remain unverified." },
      steps: [
        { bn: "IT কর্তৃপক্ষ সঠিক HTTPS OS গন্তব্য ও দুই পাশে server-only signing secret নিরাপদে কনফিগার আছে কি না যাচাই করবেন।", en: "IT must verify the intended HTTPS OS destination and secure server-only signing configuration on both sides." },
        { bn: "আলাদা অনুমোদিত পরীক্ষায় signed event এবং একই event আবার পাঠালে idempotency যাচাই করুন; কৃত্রিম live লিড বা বুকিং তৈরি করবেন না।", en: "In a separately authorized test, verify a signed event and replay idempotency; do not fabricate live leads or bookings." },
        { bn: "HQ/IT অনুমোদনের পরের বুকিংয়ের সারি, পাঠানোর ফলাফল ও OS-এর সংরক্ষিত একই event মিলিয়ে দেখুন।", en: "Match the queue and send result of an HQ/IT-approved booking with the same persisted OS event." },
        { bn: "ওয়েবসাইটের site visit request-কে এজেন্ট/HQ নিশ্চিত না করা পর্যন্ত site visit হিসেবে দেখাবেন না।", en: "Do not treat a website site-visit request as a site visit until agent/HQ confirmation." },
      ],
    },
  ];
}