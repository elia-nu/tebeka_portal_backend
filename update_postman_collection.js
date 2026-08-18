const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, 'Tebeka_User_Service_Postman_Collection.json');

function makeReq(name, method, urlPath, body = null, isAuth = true, isMultipart = false) {
  const pathParts = urlPath.split('/').filter(Boolean);
  const rawUrl = `{{baseUrl}}/${urlPath}`;

  const headers = [];
  if (isAuth) {
    headers.push({ key: 'Authorization', value: 'Bearer {{accessToken}}', type: 'text' });
  }

  const req = {
    name,
    request: {
      method,
      header: headers,
      url: {
        raw: rawUrl,
        host: ['{{baseUrl}}'],
        path: pathParts,
      },
    },
    response: [],
  };

  if (isMultipart) {
    req.request.body = {
      mode: 'formdata',
      formdata: [
        { key: 'file', type: 'file', src: [] },
        { key: 'credentialType', value: 'BAR_CERTIFICATE', type: 'text' },
      ],
    };
  } else if (body) {
    headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
    req.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return req;
}

const updatedCollection = {
  info: {
    _postman_id: "c9aacac0-2907-48cd-9dc9-f53779773b30",
    name: "Tebeka Portal — User Service API v3.0 Collection",
    description: "Role-Based and Functionality-Organized Postman Collection for Tebeka Portal User Service Backend (v3.0). Includes multi-step registration payloads, attorney amendment workflows, CMS legal resources & blog posts, file storage streams/signed URLs, and RBAC admin controls.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "01. Public & Unauthenticated Portal Flow",
      description: "Endpoints accessible to anonymous visitors without authentication (CMS pages, sitemap, contact form, legal resources, blog posts).",
      item: [
        makeReq("1.1 GET Public CMS Pages", "GET", "public/pages", null, false),
        makeReq("1.2 GET Public Page by Slug", "GET", "public/pages/terms-of-service", null, false),
        makeReq("1.3 GET Sitemap XML", "GET", "public/sitemap.xml", null, false),
        makeReq("1.4 GET Site Metadata & Security Headers", "GET", "public/site-metadata", null, false),
        makeReq("1.5 POST Public Contact Form (Rate Limited 3/10m)", "POST", "public/contact", {
          name: "Abebe Bikila",
          email: "abebe@example.com",
          phone: "+251911000000",
          subject: "Legal Advice Inquiry",
          message: "Hello Tebeka support, I would like to inquire about attorney consultation procedures."
        }, false),
        makeReq("1.6 GET Public Legal Resources", "GET", "public/legal-resources", null, false),
        makeReq("1.7 GET Public Blog Posts", "GET", "public/blog-posts", null, false),
        makeReq("1.8 GET Public Blog Post by Slug", "GET", "public/blog-posts/commercial-litigation-addis-ababa", null, false)
      ]
    },
    {
      name: "02. Authentication & Self-Registration Flow",
      description: "Client & Attorney multi-step self-registration, phone OTP validation, sign-in, token refresh, and sign-out.",
      item: [
        makeReq("2.1 POST Register Client Account (Multi-Step Payload)", "POST", "auth/register", {
          role: "CLIENT",
          phone: "+251911223344",
          email: "client.test@tebeka.et",
          password: "SecureClientPassword123!",
          firstName: "Dawit",
          lastName: "Tadesse",
          nationalIdNumber: "ETH-ID-998877",
          address: "Bole Sub City, Woreda 03",
          city: "Addis Ababa",
          preferredLanguage: "en",
          communicationPreference: "EMAIL"
        }, false),
        makeReq("2.2 POST Register Attorney Account (Multi-Step Payload)", "POST", "auth/register", {
          role: "ATTORNEY",
          phone: "+251922334455",
          email: "attorney.test@tebeka.et",
          password: "SecureAttorneyPassword123!",
          fullName: "Tigist Haile",
          licenseNumber: "LIC-ETH-2026-8888",
          experienceYears: 8,
          officeLocation: "Kazanchis, Addis Ababa",
          lawFirmName: "Tigist & Associates Law Office",
          practiceAreas: ["pa-1", "pa-2"],
          languages: ["en", "am"],
          bioEn: "Corporate legal consultant specializing in commercial dispute resolution.",
          consultationFee: 1500,
          onlineConsultation: true,
          nationalIdNumber: "ETH-ID-445566"
        }, false),
        makeReq("2.3 POST Request Phone OTP", "POST", "auth/request-otp", {
          phone: "+251911223344",
          purpose: "SIGNUP"
        }, false),
        makeReq("2.4 POST Verify Phone OTP", "POST", "auth/verify-otp", {
          phone: "+251911223344",
          code: "123456"
        }, false),
        makeReq("2.5 POST Sign In (Email or Phone)", "POST", "auth/sign-in", {
          identifier: "attorney.test@tebeka.et",
          password: "SecureAttorneyPassword123!"
        }, false),
        makeReq("2.6 POST Refresh Access Token", "POST", "auth/refresh-token", {
          refreshToken: "{{refreshToken}}"
        }, false),
        makeReq("2.7 POST Sign Out Session", "POST", "auth/sign-out", null, true)
      ]
    },
    {
      name: "03. Client Role Self-Service Flow",
      description: "Client profile fetching, profile updates, avatar photo uploads, and credential file management.",
      item: [
        makeReq("3.1 GET My Client Profile", "GET", "users/me/profile", null, true),
        makeReq("3.2 PATCH Update My Client Profile", "PATCH", "users/me/profile", {
          firstName: "Dawit",
          lastName: "Tadesse",
          address: "Bole Medhanialem",
          city: "Addis Ababa",
          nationalIdNumber: "ETH-ID-998877",
          preferredLanguage: "am"
        }, true),
        makeReq("3.3 POST Upload Profile Avatar (Multipart / JSON)", "POST", "users/me/avatar", null, true, true),
        makeReq("3.4 DELETE Profile Avatar", "DELETE", "users/me/avatar", null, true),
        makeReq("3.5 PATCH Update Email", "PATCH", "users/me/email", {
          email: "new.dawit@tebeka.et"
        }, true)
      ]
    },
    {
      name: "04. Attorney Role Self-Service Flow (Pending & Verified)",
      description: "Attorney profile management, pending status viewing, amendment response submissions, and credential document management.",
      item: [
        makeReq("4.1 GET My Attorney Profile (Returns Profile & Status)", "GET", "attorneys/me", null, true),
        makeReq("4.2 PATCH Update My Attorney Profile", "PATCH", "attorneys/me", {
          bioEn: "Senior corporate legal advisor with extensive experience in commercial transactions and dispute resolution.",
          city: "Addis Ababa",
          experienceYears: 10,
          consultationFee: 2000,
          officeLocation: "Kazanchis, Sunshine Building 4th Floor",
          lawFirmName: "Haile & Partners Law Firm",
          onlineConsultation: true,
          languages: ["en", "am", "om"]
        }, true),
        makeReq("4.3 POST Submit Profile Amendment Reply (Response to Admin Request)", "POST", "attorneys/me/submit-amendment", {
          amendmentReply: "I have updated my office contact details, law firm name, and uploaded the renewed bar license certificate.",
          updatedProfile: {
            lawFirmName: "Haile & Partners Law Firm PLC",
            officeLocation: "Kazanchis, Sunshine Building 4th Floor, Suite 402"
          }
        }, true),
        makeReq("4.4 POST Upload Credential Document (Multipart / JSON)", "POST", "attorneys/{{attorneyId}}/documents", null, true, true),
        makeReq("4.5 DELETE Remove Credential Document", "DELETE", "attorney-documents/{{documentId}}", null, true),
        makeReq("4.6 GET My Public Credentials", "GET", "attorneys/me/credentials-public", null, true),
        makeReq("4.7 POST Request Guarded Profile Change", "POST", "attorneys/me/request-profile-change", {
          feeBand: "TIER_2",
          barRegistrationNumber: "BAR-2026-9999"
        }, true),
        makeReq("4.8 GET My Pending Profile Changes", "GET", "attorneys/me/pending-profile-changes", null, true)
      ]
    },
    {
      name: "05. Administrative & Verification Flow (Admin Role)",
      description: "Admin verification case reviews, attorney approval/rejection, profile amendment requests, guarded change approvals, and CMS content publishing.",
      item: [
        makeReq("5.1 GET List Verification Cases", "GET", "verifications/cases?status=PENDING_REVIEW", null, true),
        makeReq("5.2 GET Get Attorney Case View", "GET", "verifications/cases/{{verificationCaseId}}/attorney-view", null, true),
        makeReq("5.3 POST Approve Verification Case (Assigns Permanent Account Number)", "POST", "verifications/{{verificationCaseId}}/verify", {
          notes: "All credentials, bar registration documents, and identity documents verified successfully."
        }, true),
        makeReq("5.4 POST Reject Verification Case", "POST", "verifications/{{verificationCaseId}}/reject", {
          rejectionReason: "Bar license certificate is invalid or expired."
        }, true),
        makeReq("5.5 POST Request Additional Information", "POST", "verifications/{{verificationCaseId}}/request-info", {
          additionalInfoRequested: "Please provide a clear scan of your renewed bar registration document."
        }, true),
        makeReq("5.6 POST Request Profile Amendment (Pauses SLA)", "POST", "verifications/{{verificationCaseId}}/request-amendment", {
          amendmentNotes: "Please update your law firm office address and re-upload your renewed bar license document.",
          requestedFields: ["lawFirmName", "officeLocation", "barRegistrationUrl"]
        }, true),
        makeReq("5.7 POST Approve Guarded Profile Change", "POST", "verifications/{{verificationCaseId}}/guarded-changes/{{changeId}}/approve", null, true),
        makeReq("5.8 POST Reject Guarded Profile Change", "POST", "verifications/{{verificationCaseId}}/guarded-changes/{{changeId}}/reject", null, true),
        makeReq("5.9 POST Create CMS Legal Resource", "POST", "admin/legal-resources", {
          title: "Ethiopian Commercial Code Summary 2026",
          category: "Commercial Law",
          content: "Comprehensive breakdown of key commercial proclamations and corporate governance rules in Ethiopia.",
          tags: ["commercial", "business", "proclamation"],
          isPublic: true
        }, true),
        makeReq("5.10 POST Create CMS Blog Post", "POST", "admin/blog-posts", {
          title: "Navigating Legal Dispute Resolution in Addis Ababa",
          slug: "navigating-dispute-resolution-addis-ababa",
          excerpt: "Key strategies for clients and businesses navigating arbitration and litigation.",
          content: "Commercial dispute resolution requires clear contract drafting and early legal consultation...",
          category: "Dispute Resolution",
          tags: ["arbitration", "litigation"],
          isPublished: true
        }, true),
        makeReq("5.11 GET List Contact Support Tickets", "GET", "admin/contact", null, true),
        makeReq("5.12 POST Reply Contact Ticket", "POST", "admin/contact/{{ticketId}}/reply", {
          reply: "Thank you for reaching out. A Tebeka support specialist will assist you with your consultation request."
        }, true)
      ]
    },
    {
      name: "06. Storage & File Management Flow",
      description: "Centralized file upload, metadata lookup, binary streaming download, signed URL generation, and deletion.",
      item: [
        makeReq("6.1 POST Upload General File (Multipart / JSON)", "POST", "files/upload", null, true, true),
        makeReq("6.2 GET Get File Metadata", "GET", "files/{{fileId}}", null, true),
        makeReq("6.3 GET Stream Download File", "GET", "files/{{fileId}}/download", null, true),
        makeReq("6.4 GET Get Signed Download URL", "GET", "files/{{fileId}}/signed-url", null, true),
        makeReq("6.5 DELETE Delete File", "DELETE", "files/{{fileId}}", null, true)
      ]
    },
    {
      name: "07. User & RBAC Management Flow (Admin Role)",
      description: "User account management, status toggle, role creation, and permission assignment.",
      item: [
        makeReq("7.1 GET List Users", "GET", "users?role=CLIENT", null, true),
        makeReq("7.2 POST Create User", "POST", "users", {
          email: "new.user@tebeka.et",
          phone: "+251911001122",
          role: "CLIENT",
          password: "SecureUserPassword123!"
        }, true),
        makeReq("7.3 GET User Details", "GET", "users/{{userId}}", null, true),
        makeReq("7.4 PATCH Update User Status", "PATCH", "users/{{userId}}/status", {
          status: "ACTIVE"
        }, true),
        makeReq("7.5 GET List Roles", "GET", "rbac/roles", null, true),
        makeReq("7.6 POST Create Role", "POST", "rbac/roles", {
          name: "LEGAL_AUDITOR",
          description: "Auditor role for inspecting compliance and verification logs",
          hierarchyLevel: 2
        }, true)
      ]
    }
  ]
};

fs.writeFileSync(collectionPath, JSON.stringify(updatedCollection, null, 2), 'utf8');
console.log('✅ Tebeka_User_Service_Postman_Collection.json successfully updated!');
console.log(`   Organized into ${updatedCollection.item.length} role-based & functionality-focused folders.`);
