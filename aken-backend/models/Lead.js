// PostgreSQL repository for the leads table (was: Mongoose Lead model).
// Rebuilds the embedded `emailNotifications` / `whatsappNotifications`
// sub-documents and the `notes` array so the API contract is unchanged.
const { createRepository } = require("./createRepository");

const notificationDefaults = {
  adminNotifiedAt: null,
  clientAcknowledgedAt: null,
  lastAttemptAt: null,
  attemptCount: 0,
  lastError: null,
  lastErrorDetails: null,
};

const Lead = createRepository({
  table: "leads",
  fieldMap: {
    id: "_id",
    contact_person: "contactPerson",
    email: "email",
    company_name: "companyName",
    phone: "phone",
    message: "message",
    service_type: "serviceType",
    project_location: "projectLocation",
    estimated_tonnage: "estimatedTonnage",
    project_type: "projectType",
    timeline: "timeline",
    utm_source: "utmSource",
    utm_medium: "utmMedium",
    utm_campaign: "utmCampaign",
    utm_term: "utmTerm",
    utm_content: "utmContent",
    gclid: "gclid",
    fbclid: "fbclid",
    msclkid: "msclkid",
    landing_page: "landingPage",
    referrer_url: "referrerUrl",
    status: "status",
    owner: "owner",
    owner_id: "ownerId",
    owner_assigned_at: "ownerAssignedAt",
    deal_value: "dealValue",
    probability: "probability",
    created_at: "createdAt",
    updated_at: "updatedAt",
  },
  relations: {
    ownerId: {
      table: "users",
      rowMap: {
        id: "_id",
        name: "name",
        email: "email",
        role: "role",
      },
    },
  },
  subTables: {
    emailNotifications: {
      table: "lead_email_notifications",
      fkMap: { lead_id: "leadId" },
      // B2: atomic INSERT ... ON CONFLICT (lead_id) DO UPDATE via RPC.
      // Replaces the race-prone SELECT -> INSERT for every notification
      // write (workers, save(), retry endpoints). No schema change.
      upsertRpc: "upsert_lead_email_notification",
      incrementColumn: "attempt_count",
      rowMap: {
        admin_notified_at: "adminNotifiedAt",
        client_acknowledged_at: "clientAcknowledgedAt",
        last_attempt_at: "lastAttemptAt",
        attempt_count: "attemptCount",
        last_error: "lastError",
        last_error_details: "lastErrorDetails",
      },
    },
    whatsappNotifications: {
      table: "lead_whatsapp_notifications",
      fkMap: { lead_id: "leadId" },
      // B2: atomic INSERT ... ON CONFLICT (lead_id) DO UPDATE via RPC.
      upsertRpc: "upsert_lead_whatsapp_notification",
      incrementColumn: "attempt_count",
      rowMap: {
        admin_notified_at: "adminNotifiedAt",
        client_acknowledged_at: "clientAcknowledgedAt",
        last_attempt_at: "lastAttemptAt",
        attempt_count: "attemptCount",
        last_error: "lastError",
        last_error_details: "lastErrorDetails",
        last_fallback_url: "lastFallbackUrl",
      },
    },
  },
  joins: [
    {
      apiName: "notes",
      table: "lead_notes",
      fkColumn: "lead_id",
      cardinality: "1:N",
      orderBy: { created_at: 1 },
      rowMap: {
        id: "_id",
        text: "text",
        added_by: "addedBy",
        created_at: "createdAt",
      },
    },
    {
      apiName: "emailNotifications",
      table: "lead_email_notifications",
      fkColumn: "lead_id",
      cardinality: "1:1",
      defaults: notificationDefaults,
      rowMap: {
        admin_notified_at: "adminNotifiedAt",
        client_acknowledged_at: "clientAcknowledgedAt",
        last_attempt_at: "lastAttemptAt",
        attempt_count: "attemptCount",
        last_error: "lastError",
        last_error_details: "lastErrorDetails",
      },
    },
    {
      apiName: "whatsappNotifications",
      table: "lead_whatsapp_notifications",
      fkColumn: "lead_id",
      cardinality: "1:1",
      defaults: { ...notificationDefaults, lastFallbackUrl: null },
      rowMap: {
        admin_notified_at: "adminNotifiedAt",
        client_acknowledged_at: "clientAcknowledgedAt",
        last_attempt_at: "lastAttemptAt",
        attempt_count: "attemptCount",
        last_error: "lastError",
        last_error_details: "lastErrorDetails",
        last_fallback_url: "lastFallbackUrl",
      },
    },
  ],
});

module.exports = Lead;
