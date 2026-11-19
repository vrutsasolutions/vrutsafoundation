import type { Settings } from "./settings";

/* Default Privacy Policy and Terms & Conditions for Vrutsa Foundation.
   They describe what this website actually does. They are shown until the founder pastes replacement
   text under Admin → Founder profile and content → Legal pages.

   NOT LEGAL ADVICE. Items marked REVIEW below must be confirmed by a qualified Indian legal professional
   before launch. Nothing here states a registration number, 80G / 12A status or FCRA permission, because
   none has been supplied or verified. */

export type LegalBlock = string | string[];           // a paragraph, or a bulleted list
export type LegalSection = { heading: string; blocks: LegalBlock[] };
export const LEGAL_UPDATED = "17 November 2026";

const contact = (s: Settings) => s.email || "vrutsafoundation@gmail.com";
const identity = (s: Settings) =>
  `${s.org_name || "Vrutsa Foundation"}${s.address ? `, ${s.address.replace(/\s*\n\s*/g, ", ")}` : ""}`;

export function privacyPolicy(s: Settings): LegalSection[] {
  const mail = contact(s);
  return [
    { heading: "1. Who we are", blocks: [
      `This website is run by ${identity(s)} (“the Foundation”, “we”, “us”). We decide why and how the personal information described here is used.`,
      `Questions about privacy can be sent to ${mail}.`,
    ]},
    { heading: "2. What this policy covers", blocks: [
      "This policy explains what personal information we collect through this website, why we collect it, who can see it, how long we keep it and the choices you have.",
      // REVIEW: confirm the statutes cited and their commencement status on the launch date.
      "We handle personal information in line with the Information Technology Act, 2000 and the rules made under it, and with the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 as their provisions come into force.",
    ]},
    { heading: "3. Information we collect", blocks: [
      "You can read this website without giving us any personal information. We collect information only when you choose to do one of the following.",
      [
        "Create an account: your name, email address, optional mobile number and a password. Passwords are stored only in protected (hashed) form by our authentication provider; we cannot read them. If you sign in with Google, we receive your name and email address from Google.",
        "Register as a volunteer: full name, date of birth, optional gender, email address, mobile number, state, district, city, house address, occupation, why you want to volunteer, skills, availability and an optional photograph for your ID card.",
        "Apply to be a District Representative: the details above, your employment or study details, an optional annual income or turnover range, your reasons for applying, your social-service experience, a personal introduction, a passport-size photograph and any supporting document you attach.",
        "Tell us about a donation: your name, email address, mobile number, the amount, the payment date, the bank or UPI transaction reference and an optional payment screenshot. We never ask for and never store your UPI PIN, card number or bank password.",
        "Register for an event: your name, email address and optional mobile number.",
      ],
      "Our hosting and security providers also record technical information such as IP address, browser type and the time of each request, to keep the website running and to stop abuse.",
    ]},
    { heading: "4. How we use it", blocks: [[
      "To create and manage your account and membership, and to issue a membership ID and ID card.",
      "To let the District Representative of your district coordinate volunteers there.",
      "To review District Representative applications and, if an applicant is appointed, to publish their public profile.",
      "To match a donation with the Foundation's bank records and send an acknowledgement.",
      "To send messages about things you did on the website, and announcements if you agreed to receive them.",
      "To keep the website secure, prevent duplicate or fraudulent registrations and meet legal obligations.",
    ],
      "We do not sell personal information, and we do not use it for advertising.",
    ]},
    { heading: "5. Consent", blocks: [
      "We collect the information above with your consent, which you give by ticking the declaration on each form. You can withdraw consent at any time by writing to us (section 12). Withdrawing consent does not affect what was done before, and it may mean we can no longer keep your membership or application active.",
    ]},
    { heading: "6. Children", blocks: [
      // REVIEW: confirm the age rule and whether any programme will register children with verifiable parental consent.
      "Registration on this website is for people aged 18 or over. We do not knowingly collect personal information from children through registration forms. If you believe a child has registered, write to us and we will remove the record.",
    ]},
    { heading: "7. Photographs and public profiles", blocks: [[
      "Volunteer photographs are stored privately and used on the volunteer's ID card. They are visible to the volunteer, the District Representative of their district and the Foundation's administrators.",
      "When a District Representative is appointed, their name, designation, district, photograph and introduction are published on this website. Their email address and phone number are published only if they choose to show official contact details. Their house address, date of birth, income details and application are never published.",
      "Photographs and videos of Foundation activities and events are published on this website and may show participants. If you appear in one and want it removed, write to us.",
    ]]},
    { heading: "8. Email and WhatsApp messages", blocks: [
      "We send email about your own actions: registration, your ID card, an application, an event you registered for, or a donation you told us about. These messages are part of the service.",
      "We send announcements by email only if you agreed to be contacted, and every announcement has a link to stop them. We send WhatsApp messages only if you ticked the WhatsApp option on a form. You can ask us to stop either at any time.",
    ]},
    { heading: "9. Who we share information with", blocks: [
      "Within the Foundation, access depends on role: a District Representative sees the volunteers of their own district only; donation records and District Representative applications are visible only to the Foundation's founder-level administrators.",
      "We use the following service providers, which process information on our behalf:",
      [
        "Supabase: database, sign-in and file storage.",
        "Cloudflare: media storage and delivery and protection against automated abuse, where enabled.",
        "Our website hosting provider.",
        "Resend: sending email.",
        "The WhatsApp Business Platform (Meta): sending WhatsApp messages to people who opted in.",
        "Google: only if you choose to sign in with Google.",
        "OpenStreetMap: map images are loaded from its servers, which see your IP address when a map is shown.",
      ],
      // REVIEW: cross-border transfer wording, and whether written contracts with processors are in place.
      "Some of these providers store or process information on servers outside India. We may also disclose information when the law requires it.",
    ]},
    { heading: "10. Storage and security", blocks: [[
      "Connections to this website are encrypted.",
      "ID photographs, application documents and payment screenshots are kept in private storage and opened only through short-lived links for people who are allowed to see them.",
      "Access to personal information inside the administration panel is limited by role and enforced in the database.",
      "Changes to roles, memberships, appointments and donation records are written to an audit log.",
    ],
      "No system is completely secure. If a breach affects your personal information, we will inform you and the authorities as the law requires.",
    ]},
    { heading: "11. How long we keep information", blocks: [
      // REVIEW: set specific retention periods (members, unsuccessful applications, donation records) with the Foundation's legal and accounting advisers.
      "We keep personal information only for as long as it is needed for the purpose it was collected for, or as the law requires. Membership records are kept while the membership is active. Donation records are kept for as long as accounting and tax law requires. Application records that are not taken forward are deleted when they are no longer needed.",
    ]},
    { heading: "12. Your choices and rights", blocks: [
      "You can see and update most of your details by signing in to your account. You can also ask us to:",
      [
        "tell you what personal information we hold about you;",
        "correct or complete it;",
        "delete it, where we are not required by law to keep it;",
        "withdraw a consent you gave;",
        "record a person you nominate to exercise these rights if you are unable to.",
      ],
      `Write to ${mail} from the email address registered with us. We may need to confirm your identity. We will answer as soon as we reasonably can and within the time the law allows.`,
    ]},
    { heading: "13. Suspension and deletion of accounts", blocks: [
      "A membership can be suspended or closed by the Foundation or, for volunteers, by the District Representative of their district, for example for breach of the website terms or Foundation policies. A suspended or closed membership's ID card stops being valid immediately. You can ask us to close your account and delete your information at any time; some records may be kept where the law requires or to record why a membership was closed.",
    ]},
    { heading: "14. Complaints", blocks: [
      // REVIEW: name the person responsible for grievances and a response time once decided.
      `If you are unhappy with how we handled your personal information, write to ${mail} with the subject “Privacy complaint”. If we do not resolve it, you may approach the Data Protection Board of India in the manner the law provides.`,
    ]},
    { heading: "15. Changes to this policy", blocks: [
      "We may update this policy as the website or the law changes. The date at the top shows when it was last changed. Significant changes will be announced on this website.",
    ]},
  ];
}

export function termsAndConditions(s: Settings): LegalSection[] {
  const mail = contact(s);
  return [
    { heading: "1. About these terms", blocks: [
      `These terms apply to your use of this website, run by ${identity(s)} (“the Foundation”, “we”). By using the website you agree to them. If you do not agree, please do not use it.`,
    ]},
    { heading: "2. Using the website", blocks: [
      "You may browse the website freely. Information here is published in good faith to describe the Foundation's work; it may change and may contain errors, which we correct when we learn of them.",
    ]},
    { heading: "3. Accounts and registration", blocks: [[
      "You must be 18 or older to register.",
      "Give true and complete information and keep it up to date.",
      "Keep your password private. You are responsible for what is done through your account. Tell us at once if you think someone else has used it.",
      "One person may hold one membership. Duplicate registrations may be removed.",
    ]]},
    { heading: "4. Volunteers", blocks: [
      // REVIEW: volunteer status, liability during activities, and any code of conduct the Foundation adopts.
      "Volunteering with the Foundation is voluntary and unpaid. Registering as a volunteer does not create employment, agency or partnership with the Foundation. Volunteers take part in activities at the invitation of the Foundation or their District Representative and are expected to act lawfully, safely and respectfully.",
      "A volunteer ID card shows that a person is a registered volunteer on the date it is checked. It does not authorise the holder to collect money, sign documents or make commitments on behalf of the Foundation. Anyone can check a card by scanning its QR code.",
    ]},
    { heading: "5. District Representatives", blocks: [
      "District Representatives are appointed by the Foundation's founder after an application and may be suspended or removed at any time. A District Representative agrees to:",
      [
        "use the district dashboard only for the Foundation's work and only for their own district;",
        "keep volunteers' personal details confidential and use them only to coordinate Foundation activities;",
        "publish only accurate reports, photographs and videos of real Foundation activities, with the permission of the people shown where that is needed;",
        "not collect donations in cash or into any account other than the Foundation's official account shown on this website;",
        "follow the Foundation's instructions and the law.",
      ],
    ]},
    { heading: "6. Photographs, videos and other content you provide", blocks: [
      // REVIEW: scope of the licence and consent for images of identifiable people, especially children.
      "If you upload or send us photographs, videos or text, you confirm that you have the right to share them and, where people can be identified, that they agreed. You keep ownership of your content and give the Foundation permission, free of charge, to use, edit and publish it on this website and in the Foundation's communications about its work. Ask us if you want something removed.",
    ]},
    { heading: "7. The Foundation's content", blocks: [
      "The Foundation's name, logo, text, photographs and videos on this website belong to the Foundation or are used with permission. You may share links and quote short extracts with credit. Please ask before reusing photographs or the logo.",
    ]},
    { heading: "8. What you must not do", blocks: [[
      "Give false information or pretend to be someone else, including a Foundation representative.",
      "Use another person's account, or try to reach parts of the website or data you are not allowed to see.",
      "Collect other people's personal information from the website.",
      "Upload unlawful, offensive, misleading or infringing material, or software intended to cause harm.",
      "Interfere with the website's operation or security, or send automated requests in bulk.",
      "Use the Foundation's name, logo or an ID card to collect money or for personal or commercial gain.",
    ]]},
    { heading: "9. Donations and acknowledgements", blocks: [
      "Donations are voluntary. They are paid directly to the Foundation's bank account by UPI or bank transfer, using the details shown on the Donate page; this website does not process payments. Please check the account name before you pay.",
      "A donation is recorded as received only after the Foundation has confirmed it in its bank records. Submitting the confirmation form or a screenshot is not proof of receipt. A written acknowledgement is issued after verification.",
      "Contributions support the Foundation's work as a whole. The programmes described on the Donate page are examples of that work; a contribution is not reserved for a particular programme unless the Foundation confirms this to you in writing.",
      // REVIEW: tax wording once registrations are verified; refund policy; whether foreign contributions may be accepted.
      "Unless an acknowledgement expressly says otherwise, it is not a certificate for claiming an income-tax deduction. At present the Foundation accepts contributions in Indian rupees from bank accounts in India only.",
      `If you paid by mistake or paid twice, write to ${mail} with the transaction reference and we will review it.`,
    ]},
    { heading: "10. Third-party services and links", blocks: [
      "The website relies on services provided by others, including hosting, database, storage, email, messaging, sign-in and maps, and may link to other websites. We are not responsible for the content or practices of services we do not control. Your UPI app and bank are governed by their own terms.",
    ]},
    { heading: "11. Limitation of liability", blocks: [
      // REVIEW: enforceability and wording of the limitation under Indian law.
      "The website is provided as it is. To the extent the law allows, the Foundation is not liable for indirect or consequential loss arising from use of the website, from its being unavailable, or from reliance on information published on it. Nothing in these terms limits liability that cannot be limited by law.",
    ]},
    { heading: "12. Suspension and termination", blocks: [
      "We may suspend or close an account or membership, remove content, or withdraw an appointment if these terms or Foundation policies are broken, if information given was false, or if it is needed to protect people or the Foundation. You may close your account at any time by writing to us.",
    ]},
    { heading: "13. Changes to these terms", blocks: [
      "We may change these terms. The date at the top shows the latest version. If you continue to use the website after a change, the new terms apply.",
    ]},
    { heading: "14. Law and contact", blocks: [
      // REVIEW: governing law and jurisdiction clause.
      "These terms are governed by the laws of India. Courts in Chennai, Tamil Nadu have jurisdiction over disputes about them.",
      `Questions about these terms can be sent to ${mail}.`,
    ]},
  ];
}