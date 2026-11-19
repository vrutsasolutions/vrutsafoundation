import { eventStatus, formatDate, formatDateTime } from "./utils";

/* One description per admin module. The generic list page, form and save action
   are driven by this file, so adding a field is a one-line change. Access here only
   decides what the interface offers; Row Level Security enforces it. */

export type Field = {
  name: string; label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "checkbox" | "select" | "ref" | "file" | "user";
  required?: boolean; help?: string; rows?: number; default?: string;
  options?: { value: string; label: string }[];
  ref?: "districts" | "states" | "categories" | "roles" | "events" | "activities";
  accept?: string; folder?: string; nullable?: boolean;
};
export type Resource = {
  key: string; table: string; title: string; singular: string; intro: string;
  access: "super" | "manager" | "staff";
  districtScoped?: boolean; slugFrom?: string; publishable?: boolean;
  select: string; orderBy: [string, boolean];
  columns: { label: string; render: (row: any) => string }[];
  fields: Field[]; media?: "activity_id" | "event_id";
};

const IMG = "image/jpeg,image/png,image/webp";
const IMG_GIF = `${IMG},image/gif`;
const PUBLISH: Field = {
  name: "publish_status", label: "Visibility", type: "select", default: "draft",
  options: [{ value: "draft", label: "Draft (not visible)" }, { value: "published", label: "Publish" }],
  help: "Depending on the founder's publishing setting, Publish may send this for approval first.",
};
const statusLabel: Record<string, string> = { draft: "Draft", pending: "Waiting for approval", published: "Published" };

export const RESOURCES: Record<string, Resource> = {
  activities: {
    key: "activities", table: "activities", title: "Activities", singular: "activity", access: "staff",
    intro: "The visual record of the foundation's work. Add photographs and videos after saving.",
    districtScoped: true, slugFrom: "title", publishable: true, media: "activity_id",
    select: "*, districts(name), categories(name)", orderBy: ["activity_date", false],
    columns: [
      { label: "Title", render: (r) => r.title },
      { label: "Date", render: (r) => formatDate(r.activity_date) },
      { label: "District", render: (r) => r.districts?.name ?? "Foundation-wide" },
      { label: "Status", render: (r) => statusLabel[r.publish_status] },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "summary", label: "Short description", type: "textarea", rows: 2, help: "Shown on cards. One or two sentences." },
      { name: "description", label: "Full description", type: "textarea", rows: 8 },
      { name: "category_id", label: "Category", type: "ref", ref: "categories", nullable: true },
      { name: "activity_date", label: "Date", type: "date", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "district_id", label: "District", type: "ref", ref: "districts", nullable: true },
      { name: "cover_url", label: "Cover photograph or GIF", type: "file", accept: IMG_GIF, folder: "activities" },
      { name: "related_event_id", label: "Related event", type: "ref", ref: "events", nullable: true },
      PUBLISH,
    ],
  },
  events: {
    key: "events", table: "events", title: "Events", singular: "event", access: "manager",
    intro: "Upcoming, Completed and Cancelled are worked out from the date and the cancel switch.",
    districtScoped: true, slugFrom: "title", publishable: true, media: "event_id",
    select: "*, districts(name)", orderBy: ["starts_at", false],
    columns: [
      { label: "Title", render: (r) => r.title },
      { label: "Starts", render: (r) => formatDateTime(r.starts_at) },
      { label: "District", render: (r) => r.districts?.name ?? "Foundation-wide" },
      { label: "Event", render: (r) => ({ upcoming: "Upcoming", completed: "Completed", cancelled: "Cancelled" }[eventStatus(r)]) },
      { label: "Status", render: (r) => statusLabel[r.publish_status] },
    ],
    fields: [
      { name: "title", label: "Event title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 6 },
      { name: "poster_url", label: "Poster", type: "file", accept: IMG, folder: "events" },
      { name: "starts_at", label: "Starts (Indian time)", type: "datetime", required: true },
      { name: "ends_at", label: "Ends (Indian time)", type: "datetime" },
      { name: "venue", label: "Venue", type: "text" },
      { name: "district_id", label: "District", type: "ref", ref: "districts", nullable: true },
      { name: "lat", label: "Venue latitude", type: "number", help: "Optional. Adds the venue to the map. Use a public venue only." },
      { name: "lng", label: "Venue longitude", type: "number" },
      { name: "contact_name", label: "Contact person", type: "text" },
      { name: "contact_phone", label: "Contact phone (shown publicly)", type: "text" },
      { name: "coordinators", label: "Event coordinators", type: "text", help: "Names, separated by commas." },
      { name: "registration_mode", label: "Registration", type: "select", default: "none", options: [
        { value: "none", label: "No registration" }, { value: "form", label: "Registration form on this website" },
        { value: "link", label: "External registration link" }] },
      { name: "registration_url", label: "External registration link", type: "text" },
      { name: "is_cancelled", label: "This event is cancelled", type: "checkbox" },
      { name: "highlights", label: "Results and highlights (after the event)", type: "textarea", rows: 4 },
      { name: "report_url", label: "Event report (PDF)", type: "file", accept: "application/pdf", folder: "reports" },
      PUBLISH,
    ],
  },
  media: {
    key: "media", table: "activity_media", title: "Media", singular: "media item", access: "staff",
    intro: "Every photograph and video attached to activities and events. The quickest way to add many files is from the activity or event itself.",
    select: "*, activities(title), events(title)", orderBy: ["created_at", false],
    columns: [
      { label: "Type", render: (r) => (r.media_type === "video" ? "Video" : "Photograph") },
      { label: "Attached to", render: (r) => r.activities?.title ?? r.events?.title ?? "" },
      { label: "Caption", render: (r) => r.caption ?? "" },
      { label: "Added", render: (r) => formatDate(r.created_at) },
    ],
    fields: [
      { name: "activity_id", label: "Activity", type: "ref", ref: "activities", nullable: true },
      { name: "event_id", label: "Event", type: "ref", ref: "events", nullable: true, help: "Choose an activity or an event." },
      { name: "media_type", label: "Type", type: "select", default: "image", options: [{ value: "image", label: "Photograph" }, { value: "video", label: "Video" }] },
      { name: "url", label: "File or video link", type: "file", required: true, accept: `${IMG_GIF},video/mp4,video/webm`, folder: "library", help: "Upload a file, or paste a YouTube link." },
      { name: "caption", label: "Caption", type: "text" },
      { name: "sort_order", label: "Order", type: "number", default: "0" },
    ],
  },
  appointments: {
    key: "appointments", table: "regional_appointments", title: "Leadership appointments", singular: "appointment", access: "super",
    intro: "Appoint, change, deactivate or reassign representatives. An active, public appointment appears on the network page straight away.",
    select: "*, districts(name), states(name), roles(name,rank), profiles!regional_appointments_user_id_fkey(email)", orderBy: ["appointed_on", false],
    columns: [
      { label: "Name", render: (r) => r.full_name },
      { label: "Role", render: (r) => r.designation || r.roles?.name },
      { label: "Area", render: (r) => r.districts?.name ?? r.states?.name ?? "Central" },
      { label: "Appointed", render: (r) => formatDate(r.appointed_on) },
      { label: "Status", render: (r) => (r.status === "active" ? (r.is_public ? "Active, public" : "Active, hidden") : "Inactive") },
    ],
    fields: [
      { name: "full_name", label: "Name", type: "text", required: true },
      { name: "role_key", label: "Role", type: "ref", ref: "roles", required: true },
      { name: "state_id", label: "State", type: "ref", ref: "states", nullable: true, help: "Required for state roles." },
      { name: "district_id", label: "District", type: "ref", ref: "districts", nullable: true, help: "Required for district roles." },
      { name: "designation", label: "Designation shown publicly", type: "text", help: "Leave empty to show the role name." },
      { name: "photo_url", label: "Profile photograph", type: "file", accept: IMG, folder: "people" },
      { name: "bio", label: "Short introduction", type: "textarea", rows: 3 },
      { name: "experience", label: "Social service experience", type: "textarea", rows: 4 },
      { name: "responsibilities", label: "Assigned responsibilities", type: "textarea", rows: 3 },
      { name: "appointed_on", label: "Appointment date", type: "date", required: true },
      { name: "email", label: "Email", type: "text", help: "Used for the appointment notification." },
      { name: "phone", label: "Phone", type: "text" },
      { name: "show_contact", label: "Show email and phone publicly (only with the person's consent)", type: "checkbox" },
      { name: "whatsapp_opt_in", label: "This person agreed to WhatsApp messages", type: "checkbox" },
      { name: "user_id", label: "Login account email", type: "user", help: "Optional. Linking a registered account gives that person the admin rights of this role in this area." },
      { name: "status", label: "Status", type: "select", default: "active", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive (removes admin rights)" }] },
      { name: "is_public", label: "Show on the public network page", type: "checkbox", default: "true" },
      { name: "is_featured", label: "Feature on the homepage (up to five are shown)", type: "checkbox" },
      { name: "featured_order", label: "Homepage order", type: "number", default: "0" },
    ],
  },
  districts: {
    key: "districts", table: "districts", title: "Districts", singular: "district", access: "super",
    intro: "The districts shown on the network page and available in every district menu.",
    slugFrom: "name", select: "*, states(name)", orderBy: ["name", true],
    columns: [
      { label: "District", render: (r) => r.name }, { label: "State", render: (r) => r.states?.name ?? "" },
      { label: "On map", render: (r) => (r.lat && r.lng ? "Yes" : "No coordinates") },
      { label: "Status", render: (r) => (r.is_active ? "Active" : "Hidden") },
    ],
    fields: [
      { name: "state_id", label: "State", type: "ref", ref: "states", required: true },
      { name: "name", label: "District name", type: "text", required: true },
      { name: "lat", label: "Latitude", type: "number" }, { name: "lng", label: "Longitude", type: "number" },
      { name: "office_address", label: "Official district office address", type: "textarea", rows: 2, help: "Official offices only. Never a representative's home address." },
      { name: "is_active", label: "Show this district", type: "checkbox", default: "true" },
    ],
  },
  states: {
    key: "states", table: "states", title: "States", singular: "state", access: "super",
    intro: "States the foundation works in.", select: "*", orderBy: ["name", true],
    columns: [{ label: "State", render: (r) => r.name }, { label: "Code", render: (r) => r.code ?? "" }, { label: "Status", render: (r) => (r.is_active ? "Active" : "Hidden") }],
    fields: [
      { name: "name", label: "State name", type: "text", required: true }, { name: "code", label: "Short code", type: "text" },
      { name: "is_active", label: "Show this state", type: "checkbox", default: "true" },
    ],
  },
  categories: {
    key: "categories", table: "categories", title: "Focus areas", singular: "focus area", access: "super",
    intro: "The foundation's programme categories. They appear on the homepage and as the activity filter.",
    slugFrom: "name", select: "*", orderBy: ["sort_order", true],
    columns: [{ label: "Name", render: (r) => r.name }, { label: "Order", render: (r) => String(r.sort_order) }, { label: "Status", render: (r) => (r.is_active ? "Shown" : "Hidden") }],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 3 },
      { name: "image_url", label: "Photograph", type: "file", accept: IMG, folder: "categories" },
      { name: "sort_order", label: "Order", type: "number", default: "0" },
      { name: "is_active", label: "Show on the website", type: "checkbox", default: "true" },
    ],
  },
  slides: {
    key: "slides", table: "hero_slides", title: "Homepage carousel", singular: "slide", access: "super",
    intro: "The four slides at the top of the homepage. Each one is a headline over a large photograph, GIF or short video of real foundation work. Landscape media at least 1600 pixels wide works best. Untick Active to keep a slide as a draft, and use Preview to see it before publishing.",
    select: "*", orderBy: ["sort_order", true],
    columns: [
      { label: "Heading", render: (r) => r.title ?? "(no heading)" }, { label: "Type", render: (r) => (r.media_type === "video" ? "Video" : "Image or GIF") },
      { label: "Order", render: (r) => String(r.sort_order) },
      { label: "Status", render: (r) => slideStatus(r) },
    ],
    fields: [
      { name: "image_url", label: "Image, GIF or video", type: "file", required: true, accept: `${IMG_GIF},video/mp4,video/webm`, folder: "slides" },
      { name: "media_type", label: "Media type", type: "select", default: "image", options: [{ value: "image", label: "Image or GIF" }, { value: "video", label: "Video (plays muted, in a loop)" }] },
      { name: "focus", label: "Keep this part in view when the picture is cropped", type: "select", default: "center", options: [
        { value: "center", label: "Centre" }, { value: "top", label: "Top (faces near the top)" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }],
        help: "Phones show a taller crop than computers. Choose where the important part of the picture is." },
      { name: "title", label: "Main heading", type: "text", help: "A few words. Shown large above the picture." },
      { name: "subtitle", label: "Supporting description", type: "textarea", rows: 2 },
      { name: "cta_label", label: "First button text (optional)", type: "text", help: "For example: Our activities" },
      { name: "link_url", label: "First button link", type: "text", help: "For example /activities" },
      { name: "cta2_label", label: "Second button text (optional)", type: "text", help: "For example: Donate now" },
      { name: "cta2_url", label: "Second button link", type: "text", help: "For example /donate" },
      { name: "sort_order", label: "Order (1 to 4, lowest first)", type: "number", default: "1" },
      { name: "publish_from", label: "Start showing on the homepage from (optional, Indian time)", type: "datetime",
        help: "Leave empty to show the slide as soon as it is saved. This is not the date of the event." },
      { name: "publish_until", label: "Stop showing on the homepage after (optional, Indian time)", type: "datetime",
        help: "Leave empty to keep the slide on the homepage until you switch it off. After this moment the slide disappears from the homepage." },
      { name: "is_active", label: "Active (shown on the homepage)", type: "checkbox", default: "true" },
    ],
  },
  programmes: {
    key: "programmes", table: "donation_programmes", title: "Donation programmes", singular: "programme", access: "super",
    intro: "The cards under “What your donations support” on the Donate page. Use real photographs of the foundation's own work.",
    select: "*", orderBy: ["sort_order", true],
    columns: [
      { label: "Programme", render: (r) => r.title }, { label: "Photograph", render: (r) => (r.image_url ? "Added" : "None yet") },
      { label: "Order", render: (r) => String(r.sort_order) }, { label: "Status", render: (r) => (r.is_active ? "Shown" : "Hidden") },
    ],
    fields: [
      { name: "title", label: "Heading", type: "text", required: true },
      { name: "description", label: "Short explanation", type: "textarea", rows: 3 },
      { name: "image_url", label: "Photograph", type: "file", accept: IMG, folder: "programmes" },
      { name: "link_url", label: "Learn more link (optional)", type: "text", help: "For example /activities?category=… or a full web address" },
      { name: "sort_order", label: "Order", type: "number", default: "0" },
      { name: "is_active", label: "Show on the Donate page", type: "checkbox", default: "true" },
    ],
  },
};

export const canAccess = (r: Resource, s: { isSuper: boolean; isManager: boolean; isStaff: boolean }) =>
  r.access === "super" ? s.isSuper : r.access === "manager" ? s.isManager : s.isStaff;

/** Why a carousel slide is or is not on the homepage right now. Same rule as getHeroSlides in lib/data.ts. */
export function slideStatus(r: { is_active?: boolean; publish_from?: string | null; publish_until?: string | null }) {
  if (!r.is_active) return "Off (draft)";
  if (r.publish_from && new Date(r.publish_from) > new Date()) return `Scheduled from ${formatDateTime(r.publish_from)}`;
  if (r.publish_until && new Date(r.publish_until) < new Date()) return `Not shown: "Stop showing after" was ${formatDateTime(r.publish_until)}`;
  return "Live on the homepage";
}