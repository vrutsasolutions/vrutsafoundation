// Every piece of public wording and configuration lives in the foundation_settings table
// and is edited in the admin panel. Nothing about the foundation is hard-coded here
// except its name; empty settings simply hide the matching section on the website.

export type Settings = Record<string, string>;

export const SETTING_DEFAULTS: Settings = {
  org_name: "Vrutsa Foundation",
  publish_mode: "immediate",
  donation_amounts: "500,1000,2500,5000",
};

export type SettingField = {
  key: string; label: string; type?: "text" | "textarea" | "image" | "select";
  help?: string; options?: { value: string; label: string }[]; rows?: number;
};
export type SettingGroup = { title: string; description?: string; fields: SettingField[] };

export const CONTENT_GROUPS: SettingGroup[] = [
  { title: "Homepage", description: "Shown at the top of the homepage. Add slides under Homepage slides.", fields: [
    { key: "hero_title", label: "Mission statement (headline)", help: "One strong sentence in the foundation's own words." },
    { key: "hero_subtitle", label: "Short description", type: "textarea", rows: 3 },
    { key: "about_short", label: "Who we are (short introduction)", type: "textarea", rows: 4 },
  ]},
  { title: "About us", fields: [
    { key: "about_long", label: "About Vrutsa Foundation", type: "textarea", rows: 8, help: "Leave a blank line between paragraphs." },
    { key: "mission", label: "Mission", type: "textarea", rows: 3 },
    { key: "vision", label: "Vision", type: "textarea", rows: 3 },
    { key: "purpose", label: "Our purpose", type: "textarea", rows: 3 },
    { key: "objectives", label: "Objectives", type: "textarea", rows: 6, help: "One objective per line." },
    { key: "approach", label: "Our approach", type: "textarea", rows: 5 },
    { key: "commitment", label: "Our commitment to society", type: "textarea", rows: 4 },
    { key: "commitment_image", label: "Our commitment photograph", type: "image",
      help: "Shown beside the Our commitment text on the About page. Landscape photographs work best. Remove it to show the text on its own." },
    { key: "about_image", label: "About photograph", type: "image" },
  ]},
  { title: "Founder message", fields: [
    { key: "founder_name", label: "Founder name" },
    { key: "founder_title", label: "Founder title" },
    { key: "founder_intro", label: "Short introduction (homepage)", type: "textarea", rows: 3 },
    { key: "founder_quote", label: "Quotation (optional, homepage)", type: "textarea", rows: 2 },
    { key: "founder_message", label: "Full message (About page)", type: "textarea", rows: 7 },
    { key: "founder_photo", label: "Founder photograph", type: "image" },
  ]},
  { title: "Legal pages", description: "Have these reviewed by the foundation's legal adviser before launch.", fields: [
    { key: "privacy_policy", label: "Privacy policy", type: "textarea", rows: 12 },
    { key: "terms", label: "Terms and conditions", type: "textarea", rows: 12 },
    { key: "donation_information", label: "Donation information (refunds, use of funds, tax status)", type: "textarea", rows: 6,
      help: "Mention 80G or any tax benefit only if the foundation holds a valid approval." },
  ]},
];

export const SETTINGS_GROUPS: SettingGroup[] = [
  { title: "Donations", description: "Donations go straight to the foundation's bank account. Upload only the QR code issued by the foundation's bank or UPI provider.", fields: [
    { key: "upi_qr_url", label: "Official UPI QR code", type: "image" },
    { key: "upi_payee_name", label: "Account name shown in the UPI app", help: "Donors check this name before paying." },
    { key: "upi_id", label: "Official UPI ID" },
    { key: "bank_instructions", label: "Bank transfer instructions", type: "textarea", rows: 5, help: "Account name, bank, branch, account number and IFSC as printed on official documents." },
    { key: "donation_amounts", label: "Suggested amounts (₹)", help: "Comma separated, for example 500,1000,2500" },
    { key: "donation_purposes", label: "Donation purposes", type: "textarea", rows: 4, help: "One per line. Leave empty to hide the purpose choice." },
    { key: "receipt_signatory", label: "Receipt signatory (name and title)" },
    { key: "registration_details", label: "Registration details printed on receipts", help: "For example the trust or society registration number." },
  ]},
  { title: "Contact details", fields: [
    { key: "address", label: "Official address", type: "textarea", rows: 3 },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "whatsapp", label: "WhatsApp number", help: "With country code, digits only. Example: 919876543210" },
    { key: "office_lat", label: "Office latitude (optional, for the map)" },
    { key: "office_lng", label: "Office longitude (optional, for the map)" },
  ]},
  { title: "Social media", fields: [
    { key: "social_facebook", label: "Facebook link" }, { key: "social_instagram", label: "Instagram link" },
    { key: "social_youtube", label: "YouTube link" }, { key: "social_linkedin", label: "LinkedIn link" },
    { key: "social_x", label: "X link" },
  ]},
  { title: "Founder notifications", description: "Operational emails to the founder. Founder and representative notices always go by email, never WhatsApp.", fields: [
    { key: "founder_notify_email", label: "Send founder notifications to" },
    { key: "founder_alerts_volunteers", label: "Email me for every new volunteer", type: "select", options: [{ value: "on", label: "Yes" }, { value: "off", label: "No (I will use the dashboard)" }] },
    { key: "founder_alerts_content", label: "Email me when a district publishes, edits or deletes activities and events", type: "select", options: [{ value: "on", label: "Yes" }, { value: "off", label: "No" }] },
  ]},
  { title: "Publishing", description: "What happens when a district administrator presses Publish.", fields: [
    { key: "publish_mode", label: "District content", type: "select", options: [
      { value: "immediate", label: "Publish immediately" },
      { value: "approval", label: "Send to the founder for approval" },
      { value: "draft", label: "Keep as a draft" },
    ]},
  ]},
];

export const ALL_SETTING_KEYS = new Set([...CONTENT_GROUPS, ...SETTINGS_GROUPS].flatMap((g) => g.fields.map((f) => f.key)).concat("org_name"));