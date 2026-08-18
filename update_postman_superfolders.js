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

const superfolderCollection = {
  info: {
    _postman_id: "c9aacac0-2907-48cd-9dc9-f53779773b30",
    name: "Tebeka Portal — Postman Collection v3.0 (Hierarchical Role Superfolders)",
    description: "Hierarchical Role-Based Superfolders and Service Subfolders for Tebeka Portal Backend (v3.0). Structured into Anonymous/Public, Client Role, Attorney Role, Administrator Role, and Shared System Services.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    // 📁 01. Public & Common Services (Anonymous Role)
    {
      name: "01. Public & Common Services (Anonymous Role)",
      description: "Superfolder for unauthenticated public portal endpoints.",
      item: [
        {
          name: "1.1 Authentication & Self-Registration Service",
          item: [
            makeReq("1.1.1 POST Register Client Account (4-Step Data)", "POST", "auth/register", {
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
            makeReq("1.1.2 POST Register Attorney Account (5-Step Data)", "POST", "auth/register", {
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
            makeReq("1.1.3 POST Request Phone OTP", "POST", "auth/request-otp", {
              phone: "+251911223344",
              purpose: "SIGNUP"
            }, false),
            makeReq("1.1.4 POST Verify Phone OTP", "POST", "auth/verify-otp", {
              phone: "+251911223344",
              code: "123456"
            }, false),
            makeReq("1.1.5 POST Sign In (Email or Phone)", "POST", "auth/sign-in", {
              identifier: "attorney.test@tebeka.et",
              password: "SecureAttorneyPassword123!"
            }, false),
            makeReq("1.1.6 POST Refresh Access Token", "POST", "auth/refresh-token", {
              refreshToken: "{{refreshToken}}"
            }, false),
            makeReq("1.1.7 POST Sign Out Session", "POST", "auth/sign-out", null, true)
          ]
        },
        {
          name: "1.2 Public CMS Pages & Site Metadata Service",
          item: [
            makeReq("1.2.1 GET Public CMS Pages", "GET", "public/pages", null, false),
            makeReq("1.2.2 GET Terms of Service Page", "GET", "public/pages/terms-of-service", null, false),
            makeReq("1.2.3 GET Sitemap XML", "GET", "public/sitemap.xml", null, false),
            makeReq("1.2.4 GET Site Metadata & Security Headers", "GET", "public/site-metadata", null, false)
          ]
        },
        {
          name: "1.3 Public Legal Resources & Insights Service",
          item: [
            makeReq("1.3.1 GET Public Legal Resources", "GET", "public/legal-resources", null, false),
            makeReq("1.3.2 GET Public Blog Posts", "GET", "public/blog-posts", null, false),
            makeReq("1.3.3 GET Public Blog Post by Slug", "GET", "public/blog-posts/commercial-litigation-addis-ababa", null, false)
          ]
        },
        {
          name: "1.4 Public Support Contact Ticket Service",
          item: [
            makeReq("1.4.1 POST Public Contact Form (Rate Limited 3/10m)", "POST", "public/contact", {
              name: "Abebe Bikila",
              email: "abebe@example.com",
              phone: "+251911000000",
              subject: "Legal Advice Inquiry",
              message: "Hello Tebeka support, I would like to inquire about attorney consultation procedures."
            }, false)
          ]
        }
      ]
    },

    // 📁 02. Client Role Superfolder
    {
      name: "02. Client Role Superfolder",
      description: "Superfolder for Client role endpoints.",
      item: [
        {
          name: "2.1 Profile & Account Management Service",
          item: [
            makeReq("2.1.1 GET My Client Profile", "GET", "users/me/profile", null, true),
            makeReq("2.1.2 PATCH Update My Client Profile", "PATCH", "users/me/profile", {
              firstName: "Dawit",
              lastName: "Tadesse",
              address: "Bole Medhanialem",
              city: "Addis Ababa",
              nationalIdNumber: "ETH-ID-998877",
              preferredLanguage: "am"
            }, true),
            makeReq("2.1.3 POST Upload Profile Avatar (Multipart / JSON)", "POST", "users/me/avatar", null, true, true),
            makeReq("2.1.4 DELETE Profile Avatar", "DELETE", "users/me/avatar", null, true),
            makeReq("2.1.5 PATCH Update Email", "PATCH", "users/me/email", {
              email: "new.dawit@tebeka.et"
            }, true)
          ]
        },
        {
          name: "2.2 Attorney Discovery & Search Service",
          item: [
            makeReq("2.2.1 GET Search Verified Attorneys", "GET", "discovery/attorneys/search?q=corporate&city=Addis+Ababa", null, false),
            makeReq("2.2.2 GET Verified Attorney Details", "GET", "discovery/attorneys/{{attorneyId}}", null, false)
          ]
        },
        {
          name: "2.3 Consultation Booking Service",
          item: [
            makeReq("2.3.1 POST Create Consultation Booking", "POST", "bookings", {
              attorneyId: "{{attorneyId}}",
              bookingDate: "2026-09-10",
              startTime: "10:00",
              endTime: "11:00",
              consultationType: "VIDEO",
              issueBrief: "Consultation regarding contract dispute resolution"
            }, true),
            makeReq("2.3.2 GET My Bookings", "GET", "bookings", null, true),
            makeReq("2.3.3 GET Booking Details", "GET", "bookings/{{bookingId}}", null, true)
          ]
        },
        {
          name: "2.4 Case Management Service",
          item: [
            makeReq("2.4.1 POST Open Legal Case", "POST", "cases", {
              attorneyId: "{{attorneyId}}",
              bookingId: "{{bookingId}}",
              title: "Commercial Contract Breach Case",
              description: "Full legal representation for commercial agreement enforcement.",
              priority: "HIGH"
            }, true),
            makeReq("2.4.2 GET My Cases", "GET", "cases", null, true),
            makeReq("2.4.3 GET Case Details", "GET", "cases/{{caseId}}", null, true)
          ]
        },
        {
          name: "2.5 Payment & Review Services",
          item: [
            makeReq("2.5.1 POST Create Payment", "POST", "payments", {
              bookingId: "{{bookingId}}",
              payeeId: "{{attorneyId}}",
              amount: 1500,
              provider: "TELEBIRR"
            }, true),
            makeReq("2.5.2 POST Submit Verified Attorney Review", "POST", "reviews", {
              bookingId: "{{bookingId}}",
              attorneyId: "{{attorneyId}}",
              rating: 5,
              comment: "Excellent legal consultation. Very knowledgeable and thorough."
            }, true)
          ]
        }
      ]
    },

    // 📁 03. Attorney Role Superfolder (Pending & Verified)
    {
      name: "03. Attorney Role Superfolder (Pending & Verified)",
      description: "Superfolder for Attorney self-service endpoints.",
      item: [
        {
          name: "3.1 Profile & Verification Status Service",
          item: [
            makeReq("3.1.1 GET My Attorney Profile (Returns ATT-PENDING-YYYY-XXXXX)", "GET", "attorneys/me", null, true),
            makeReq("3.1.2 PATCH Update My Attorney Profile", "PATCH", "attorneys/me", {
              bioEn: "Senior corporate legal advisor with extensive experience in commercial transactions and dispute resolution.",
              city: "Addis Ababa",
              experienceYears: 10,
              consultationFee: 2000,
              officeLocation: "Kazanchis, Sunshine Building 4th Floor",
              lawFirmName: "Haile & Partners Law Firm",
              onlineConsultation: true,
              languages: ["en", "am", "om"]
            }, true),
            makeReq("3.1.3 POST Submit Profile Amendment Reply (Response to Admin Request)", "POST", "attorneys/me/submit-amendment", {
              amendmentReply: "I have updated my office contact details, law firm name, and uploaded the renewed bar license certificate.",
              updatedProfile: {
                lawFirmName: "Haile & Partners Law Firm PLC",
                officeLocation: "Kazanchis, Sunshine Building 4th Floor, Suite 402"
              }
            }, true),
            makeReq("3.1.4 PATCH Publish My Profile", "PATCH", "attorneys/me/publish", null, true),
            makeReq("3.1.5 PATCH Hide My Profile", "PATCH", "attorneys/me/hide", null, true)
          ]
        },
        {
          name: "3.2 Credential & Document Management Service",
          item: [
            makeReq("3.2.1 POST Upload Credential Document (Multipart / JSON)", "POST", "attorneys/{{attorneyId}}/documents", null, true, true),
            makeReq("3.2.2 DELETE Remove Credential Document", "DELETE", "attorney-documents/{{documentId}}", null, true),
            makeReq("3.2.3 GET My Public Credentials", "GET", "attorneys/me/credentials-public", null, true)
          ]
        },
        {
          name: "3.3 Availability & Schedule Management Service",
          item: [
            makeReq("3.3.1 GET My Availability Windows", "GET", "attorneys/me/availability", null, true),
            makeReq("3.3.2 POST Create Availability Slot", "POST", "attorneys/me/availability", {
              weekday: 1,
              startTime: "09:00",
              endTime: "17:00",
              timezone: "Africa/Addis_Ababa",
              isAvailable: true
            }, true),
            makeReq("3.3.3 PATCH Update Availability Slot", "PATCH", "attorneys/me/availability/{{availabilityId}}", {
              startTime: "10:00",
              endTime: "18:00"
            }, true),
            makeReq("3.3.4 DELETE Remove Availability Slot", "DELETE", "attorneys/me/availability/{{availabilityId}}", null, true),
            makeReq("3.3.5 POST Block a Date", "POST", "attorneys/me/block-date", {
              date: "2026-09-15",
              reason: "Court hearing"
            }, true),
            makeReq("3.3.6 POST Set Vacation Period", "POST", "attorneys/me/vacation", {
              startDate: "2026-12-20",
              endDate: "2027-01-05",
              reason: "Holiday break"
            }, true)
          ]
        },
        {
          name: "3.4 Case & Client Management Service",
          item: [
            makeReq("3.4.1 GET My Assigned Cases", "GET", "cases?role=ATTORNEY", null, true),
            makeReq("3.4.2 GET Case Details", "GET", "cases/{{caseId}}", null, true),
            makeReq("3.4.3 POST Upload Case Document (Multipart / JSON)", "POST", "cases/{{caseId}}/documents", null, true, true)
          ]
        },
        {
          name: "3.5 Guarded Profile Change Service",
          item: [
            makeReq("3.5.1 POST Request Guarded Profile Change", "POST", "attorneys/me/request-profile-change", {
              feeBand: "TIER_2",
              barRegistrationNumber: "BAR-2026-9999"
            }, true),
            makeReq("3.5.2 GET My Pending Profile Changes", "GET", "attorneys/me/pending-profile-changes", null, true)
          ]
        }
      ]
    },

    // 📁 04. Administrator Role Superfolder
    {
      name: "04. Administrator Role Superfolder",
      description: "Superfolder for Administrator endpoints.",
      item: [
        {
          name: "4.1 Verification & Maker-Checker Management Service",
          item: [
            makeReq("4.1.1 GET List Verification Cases", "GET", "verifications/cases?status=PENDING_REVIEW", null, true),
            makeReq("4.1.2 GET Get Attorney Case View", "GET", "verifications/cases/{{verificationCaseId}}/attorney-view", null, true),
            makeReq("4.1.3 POST Approve Verification Case (Assigns Permanent ATT-YYYY-XXXXX)", "POST", "verifications/{{verificationCaseId}}/verify", {
              notes: "All credentials, bar registration documents, and identity documents verified successfully."
            }, true),
            makeReq("4.1.4 POST Reject Verification Case", "POST", "verifications/{{verificationCaseId}}/reject", {
              rejectionReason: "Bar license certificate is invalid or expired."
            }, true),
            makeReq("4.1.5 POST Request Additional Information", "POST", "verifications/{{verificationCaseId}}/request-info", {
              additionalInfoRequested: "Please provide a clear scan of your renewed bar registration document."
            }, true),
            makeReq("4.1.6 POST Request Profile Amendment (Pauses SLA)", "POST", "verifications/{{verificationCaseId}}/request-amendment", {
              amendmentNotes: "Please update your law firm office address and re-upload your renewed bar license document.",
              requestedFields: ["lawFirmName", "officeLocation", "barRegistrationUrl"]
            }, true),
            makeReq("4.1.7 POST Approve Guarded Profile Change", "POST", "verifications/{{verificationCaseId}}/guarded-changes/{{changeId}}/approve", null, true),
            makeReq("4.1.8 POST Reject Guarded Profile Change", "POST", "verifications/{{verificationCaseId}}/guarded-changes/{{changeId}}/reject", null, true)
          ]
        },
        {
          name: "4.2 User Account & RBAC Administration Service",
          item: [
            makeReq("4.2.1 GET List Users", "GET", "users?role=CLIENT", null, true),
            makeReq("4.2.2 POST Create User", "POST", "users", {
              email: "new.user@tebeka.et",
              phone: "+251911001122",
              role: "CLIENT",
              password: "SecureUserPassword123!"
            }, true),
            makeReq("4.2.3 GET User Details", "GET", "users/{{userId}}", null, true),
            makeReq("4.2.4 PATCH Update User Status", "PATCH", "users/{{userId}}/status", {
              status: "ACTIVE"
            }, true),
            makeReq("4.2.5 GET List Roles", "GET", "rbac/roles", null, true),
            makeReq("4.2.6 POST Create Role", "POST", "rbac/roles", {
              name: "LEGAL_AUDITOR",
              description: "Auditor role for inspecting compliance and verification logs",
              hierarchyLevel: 2
            }, true)
          ]
        },
        {
          name: "4.3 CMS & Content Management Service",
          item: [
            makeReq("4.3.1 POST Create CMS Admin Page", "POST", "admin/pages", {
              slug: "attorney-code-of-ethics",
              locale: "en",
              title: "Attorney Code of Ethics & Practice Standards",
              body: "Official guidelines for legal practice on Tebeka Portal..."
            }, true),
            makeReq("4.3.2 PATCH Update CMS Admin Page", "PATCH", "admin/pages/{{pageId}}", {
              title: "Updated Attorney Code of Ethics 2026"
            }, true),
            makeReq("4.3.3 DELETE CMS Admin Page", "DELETE", "admin/pages/{{pageId}}", null, true),
            makeReq("4.3.4 POST Create CMS Legal Resource", "POST", "admin/legal-resources", {
              title: "Ethiopian Commercial Code Summary 2026",
              category: "Commercial Law",
              content: "Comprehensive breakdown of key commercial proclamations and corporate governance rules in Ethiopia.",
              tags: ["commercial", "business", "proclamation"],
              isPublic: true
            }, true),
            makeReq("4.3.5 POST Create CMS Blog Post", "POST", "admin/blog-posts", {
              title: "Navigating Legal Dispute Resolution in Addis Ababa",
              slug: "navigating-dispute-resolution-addis-ababa",
              excerpt: "Key strategies for clients and businesses navigating arbitration and litigation.",
              content: "Commercial dispute resolution requires clear contract drafting and early legal consultation...",
              category: "Dispute Resolution",
              tags: ["arbitration", "litigation"],
              isPublished: true
            }, true)
          ]
        },
        {
          name: "4.4 Support Ticket Management Service",
          item: [
            makeReq("4.4.1 GET List Contact Support Tickets", "GET", "admin/contact", null, true),
            makeReq("4.4.2 GET Contact Ticket Details", "GET", "admin/contact/{{ticketId}}", null, true),
            makeReq("4.4.3 POST Reply Contact Ticket", "POST", "admin/contact/{{ticketId}}/reply", {
              reply: "Thank you for reaching out. A Tebeka support specialist will assist you with your consultation request."
            }, true)
          ]
        }
      ]
    },

    // 📁 05. Core System & Shared Storage Services
    {
      name: "05. Core System & Shared Storage Services",
      description: "Superfolder for shared file storage, binary streaming, and messaging services.",
      item: [
        {
          name: "5.1 Storage & File Manager Service",
          item: [
            makeReq("5.1.1 POST Upload General File (Multipart / JSON)", "POST", "files/upload", null, true, true),
            makeReq("5.1.2 GET Get File Metadata", "GET", "files/{{fileId}}", null, true),
            makeReq("5.1.3 GET Stream Download File", "GET", "files/{{fileId}}/download", null, true),
            makeReq("5.1.4 GET Get Signed Download URL", "GET", "files/{{fileId}}/signed-url", null, true),
            makeReq("5.1.5 DELETE Delete File", "DELETE", "files/{{fileId}}", null, true)
          ]
        },
        {
          name: "5.2 Communication & Notification Services",
          item: [
            makeReq("5.2.1 GET List Conversations", "GET", "conversations", null, true),
            makeReq("5.2.2 POST Send Message in Conversation", "POST", "conversations/{{conversationId}}/messages", {
              message: "Hello, here is the legal agreement document for review.",
              attachmentKey: "cases/legal_agreement-12345.pdf"
            }, true),
            makeReq("5.2.3 GET Notifications Center", "GET", "notifications", null, true)
          ]
        }
      ]
    }
  ]
};

fs.writeFileSync(collectionPath, JSON.stringify(superfolderCollection, null, 2), 'utf8');
console.log('✅ Tebeka_User_Service_Postman_Collection.json successfully updated with Hierarchical Superfolders!');
console.log(`   Created ${superfolderCollection.item.length} Top-Level Role Superfolders containing service subfolders.`);
