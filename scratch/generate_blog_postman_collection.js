const fs = require('fs');
const path = require('path');

function createRequest({
  name,
  method,
  pathSegments,
  queryParams = [],
  body = null,
  tokenVar = null,
  isMultipart = false,
  description = '',
  testScript = ''
}) {
  const urlObj = {
    raw: `{{baseUrl}}/${pathSegments.join('/')}${queryParams.length ? '?' + queryParams.map(q => `${q.key}=${q.value}`).join('&') : ''}`,
    host: ['{{baseUrl}}'],
    path: pathSegments.map(seg => seg.startsWith(':') ? `{{${seg.slice(1)}}}` : seg),
  };

  if (queryParams.length) {
    urlObj.query = queryParams.map(q => ({
      key: q.key,
      value: q.value,
      description: q.description || ''
    }));
  }

  const headers = [
    { key: 'Accept', value: 'application/json', type: 'text' }
  ];

  if (tokenVar) {
    headers.push({
      key: 'Authorization',
      value: `Bearer {{${tokenVar}}}`,
      type: 'text'
    });
  }

  let requestBody = undefined;
  if (isMultipart) {
    requestBody = {
      mode: 'formdata',
      formdata: body || []
    };
  } else if (body) {
    headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
    requestBody = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: { language: 'json' }
      }
    };
  }

  const events = [];
  if (testScript) {
    events.push({
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: testScript.split('\n')
      }
    });
  }

  return {
    name,
    request: {
      method,
      header: headers,
      body: requestBody,
      url: urlObj,
      description
    },
    event: events,
    response: []
  };
}

const collection = {
  info: {
    _postman_id: "tebeka-blog-service-rbac-collection-v1",
    name: "Tebeka Portal - Blog Service (Role-Based API Collection)",
    description: "Production-grade, end-to-end Postman collection for Tebeka Portal Blog & Editorial Engine. Structured by RBAC Role: Public/Anonymous Visitor, Attorney Author, Client/Reader Community, and Admin/Moderator.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    // ═════════════════════════════════════════════════════════════════════════
    // FOLDER 1: 🌐 Role: Public / Anonymous Visitor
    // ═════════════════════════════════════════════════════════════════════════
    {
      name: "1. 🌐 Role: Public / Anonymous Visitor",
      description: "Open endpoints accessible to unauthenticated public visitors for blog discovery, category browsing, article reading, and social sharing.",
      item: [
        createRequest({
          name: "1.1 GET Public Published Blogs (Filter & Search)",
          method: "GET",
          pathSegments: ["public", "blogs"],
          queryParams: [
            { key: "page", value: "1", description: "Page number" },
            { key: "limit", value: "12", description: "Items per page" },
            { key: "category", value: "Commercial Law", description: "Filter by category slug/name" },
            { key: "tag", value: "M&A", description: "Filter by tag" },
            { key: "search", value: "Commercial", description: "Full-text search in title, excerpt, and content" },
            { key: "sortBy", value: "newest", description: "Sorting: newest | popular | most_liked | most_viewed" }
          ],
          description: "Returns paginated list of published articles with author and category info."
        }),
        createRequest({
          name: "1.2 GET Public Blog Categories",
          method: "GET",
          pathSegments: ["public", "blog-categories"],
          description: "Lists all active blog categories along with live publishedPostCount counters."
        }),
        createRequest({
          name: "1.3 GET Public Blog Post by Slug or ID",
          method: "GET",
          pathSegments: ["public", "blogs", ":blogSlug"],
          description: "Fetches full published article details. Automatically increments view count and returns comments tree.",
          testScript: `
if (pm.response.code === 200) {
  var data = pm.response.json();
  pm.environment.set("blogId", data.id);
  pm.environment.set("blogSlug", data.slug);
}
`
        }),
        createRequest({
          name: "1.4 GET Public Comments for Blog Post",
          method: "GET",
          pathSegments: ["public", "blogs", ":blogId", "comments"],
          queryParams: [
            { key: "page", value: "1", description: "Page number" },
            { key: "limit", value: "20", description: "Number of top-level comments per page" }
          ],
          description: "Retrieves top-level approved comments and their nested replies."
        }),
        createRequest({
          name: "1.5 POST Record Article Share",
          method: "POST",
          pathSegments: ["blogs", ":blogId", "share"],
          body: {
            platform: "TELEGRAM"
          },
          description: "Records an article share to LinkedIn, Telegram, Twitter, Facebook, or Direct Link. Open to all users."
        })
      ]
    },

    // ═════════════════════════════════════════════════════════════════════════
    // FOLDER 2: ⚖️ Role: Attorney / Author
    // ═════════════════════════════════════════════════════════════════════════
    {
      name: "2. ⚖️ Role: Attorney / Author",
      description: "Authoring workflows for attorneys: creating drafts, updating articles, submitting drafts for admin moderation, and tracking personal article statistics.",
      item: [
        createRequest({
          name: "2.1 POST Create Blog Post (Draft)",
          method: "POST",
          pathSegments: ["blogs"],
          tokenVar: "attorneyAuthToken",
          body: {
            title: "Ethiopian Commercial Code Reform: Guidelines for Cross-Border M&A",
            content: "The revised Ethiopian Commercial Code introduces groundbreaking modernizations for private limited companies and corporate structuring in Addis Ababa. Here are key legal considerations for foreign investors...",
            excerpt: "Key takeaways and legal updates on the newly revised Commercial Code.",
            categoryId: "{{categoryId}}",
            caseCategory: "Commercial Law",
            tags: ["Commercial Law", "M&A", "Foreign Investment"],
            isFeatured: false,
            submitForReview: false
          },
          description: "Creates a new blog post in DRAFT status.",
          testScript: `
if (pm.response.code === 201 || pm.response.code === 200) {
  var data = pm.response.json();
  pm.environment.set("blogId", data.id);
  pm.environment.set("blogSlug", data.slug);
}
`
        }),
        createRequest({
          name: "2.2 POST Create Blog Post with Featured Image (Multipart)",
          method: "POST",
          pathSegments: ["blogs"],
          tokenVar: "attorneyAuthToken",
          isMultipart: true,
          body: [
            { key: "title", value: "Arbitration Clauses in Ethiopian Construction Contracts", type: "text" },
            { key: "content", value: "Arbitration remains the preferred mechanism for resolving dispute in large scale infrastructure projects in Ethiopia...", type: "text" },
            { key: "excerpt", value: "Legal insights on drafting effective arbitration clauses under Ethiopian law.", type: "text" },
            { key: "caseCategory", value: "Arbitration", type: "text" },
            { key: "tags", value: "Arbitration, Construction Law, Dispute Resolution", type: "text" },
            { key: "submitForReview", value: "false", type: "text" },
            { key: "featuredImage", type: "file", src: "" }
          ],
          description: "Uploads a blog post with an image attachment (JPEG, PNG, WebP up to 5MB)."
        }),
        createRequest({
          name: "2.3 GET My Blogs List (Attorney Workspace)",
          method: "GET",
          pathSegments: ["blogs", "my-blogs"],
          tokenVar: "attorneyAuthToken",
          queryParams: [
            { key: "status", value: "DRAFT", description: "Filter by status: DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED" },
            { key: "page", value: "1", description: "Page number" },
            { key: "limit", value: "10", description: "Limit" }
          ],
          description: "Lists all articles authored by the authenticated attorney with reaction and comment counters."
        }),
        createRequest({
          name: "2.4 PATCH Update My Blog Post",
          method: "PATCH",
          pathSegments: ["blogs", ":blogId"],
          tokenVar: "attorneyAuthToken",
          body: {
            title: "Ethiopian Commercial Code Reform: Guidelines for Cross-Border M&A (Updated)",
            excerpt: "Updated guidance incorporating Ministry of Trade registration regulations.",
            tags: ["Commercial Law", "M&A", "Trade Ministry"]
          },
          description: "Updates content, title, tags, or excerpt of an existing draft or rejected article."
        }),
        createRequest({
          name: "2.5 POST Submit Blog Post for Editorial Review",
          method: "POST",
          pathSegments: ["blogs", ":blogId", "submit-for-review"],
          tokenVar: "attorneyAuthToken",
          description: "Submits draft or revised article to admin moderation queue. Sets status to PENDING_REVIEW and sends in-app notification to administrators."
        }),
        createRequest({
          name: "2.6 DELETE Delete My Blog Post",
          method: "DELETE",
          pathSegments: ["blogs", ":blogId"],
          tokenVar: "attorneyAuthToken",
          description: "Allows authors to delete their own unapproved or draft articles."
        })
      ]
    },

    // ═════════════════════════════════════════════════════════════════════════
    // FOLDER 3: 👤 Role: Client / Reader Community
    // ═════════════════════════════════════════════════════════════════════════
    {
      name: "3. 👤 Role: Client / Reader Community",
      description: "Interactive social endpoints for registered clients and portal users (liking, commenting, threaded discussions).",
      item: [
        createRequest({
          name: "3.1 POST Toggle Like / Unlike on Article",
          method: "POST",
          pathSegments: ["blogs", ":blogId", "like"],
          tokenVar: "clientAuthToken",
          description: "Idempotently toggles article like. Returns { liked: boolean, likesCount: number }. Alerts article author on first like."
        }),
        createRequest({
          name: "3.2 POST Add Top-Level Comment",
          method: "POST",
          pathSegments: ["blogs", ":blogId", "comments"],
          tokenVar: "clientAuthToken",
          body: {
            content: "Excellent analysis! Does the new legislation mandate specific quorum requirements for private limited company board meetings?"
          },
          description: "Posts a top-level comment on the article.",
          testScript: `
if (pm.response.code === 201 || pm.response.code === 200) {
  var data = pm.response.json();
  pm.environment.set("commentId", data.id);
}
`
        }),
        createRequest({
          name: "3.3 POST Reply to Comment (Threaded)",
          method: "POST",
          pathSegments: ["blogs", ":blogId", "comments"],
          tokenVar: "attorneyAuthToken",
          body: {
            content: "Thank you Sara! Under Article 324, board meetings require a quorum of at least 50% voting shareholders unless otherwise specified in the articles of association.",
            parentId: "{{commentId}}"
          },
          description: "Creates a nested reply to an existing comment. Automatically alerts parent commenter."
        }),
        createRequest({
          name: "3.4 DELETE Delete My Comment",
          method: "DELETE",
          pathSegments: ["blogs", "comments", ":commentId"],
          tokenVar: "clientAuthToken",
          description: "Deletes a comment authored by the authenticated user and decrements the post commentsCount."
        })
      ]
    },

    // ═════════════════════════════════════════════════════════════════════════
    // FOLDER 4: 🛡️ Role: Admin / Moderator
    // ═════════════════════════════════════════════════════════════════════════
    {
      name: "4. 🛡️ Role: Admin / Moderator",
      description: "Administrative controls for blog categories, moderation queues, editorial approvals, rejections with feedback, and direct portal announcements.",
      item: [
        // Subfolder 4.1: Categories
        {
          name: "4.1 Blog Category Governance",
          item: [
            createRequest({
              name: "4.1.1 POST Create Blog Category",
              method: "POST",
              pathSegments: ["admin", "blog-categories"],
              tokenVar: "adminAuthToken",
              body: {
                name: "Corporate Governance & M&A",
                description: "Insights on corporate law, foreign investment, and joint ventures in Ethiopia.",
                isActive: true
              },
              description: "Creates a new category for organizing legal articles.",
              testScript: `
if (pm.response.code === 201 || pm.response.code === 200) {
  var data = pm.response.json();
  pm.environment.set("categoryId", data.id);
}
`
            }),
            createRequest({
              name: "4.1.2 GET All Categories (Admin View)",
              method: "GET",
              pathSegments: ["admin", "blog-categories"],
              tokenVar: "adminAuthToken",
              description: "Returns all categories including inactive ones with post counts."
            }),
            createRequest({
              name: "4.1.3 GET Category by ID",
              method: "GET",
              pathSegments: ["admin", "blog-categories", ":categoryId"],
              tokenVar: "adminAuthToken",
              description: "Fetches category details by UUID."
            }),
            createRequest({
              name: "4.1.4 PATCH Update Blog Category",
              method: "PATCH",
              pathSegments: ["admin", "blog-categories", ":categoryId"],
              tokenVar: "adminAuthToken",
              body: {
                description: "Updated overview of commercial litigation and corporate governance in Ethiopia.",
                isActive: true
              },
              description: "Modifies category name, description, icon URL, or status."
            }),
            createRequest({
              name: "4.1.5 DELETE Delete / Deactivate Category",
              method: "DELETE",
              pathSegments: ["admin", "blog-categories", ":categoryId"],
              tokenVar: "adminAuthToken",
              description: "Deletes empty category or soft-deactivates category if it contains published articles."
            })
          ]
        },

        // Subfolder 4.2: Editorial Moderation Queue
        {
          name: "4.2 Editorial Moderation & Approval Queue",
          item: [
            createRequest({
              name: "4.2.1 GET Admin Moderation Queue",
              method: "GET",
              pathSegments: ["admin", "blogs"],
              tokenVar: "adminAuthToken",
              queryParams: [
                { key: "status", value: "PENDING_REVIEW", description: "PENDING_REVIEW | DRAFT | PUBLISHED | REJECTED" },
                { key: "search", value: "", description: "Search by title, content, or author" },
                { key: "page", value: "1", description: "Page number" },
                { key: "limit", value: "15", description: "Limit" }
              ],
              description: "Fetches submitted articles awaiting editorial review."
            }),
            createRequest({
              name: "4.2.2 POST Reject Article with Revision Feedback",
              method: "POST",
              pathSegments: ["admin", "blogs", ":blogId", "reject"],
              tokenVar: "adminAuthToken",
              body: {
                reason: "Please expand on Section 2 regarding the legal prerequisites for foreign branch registrations with the Ministry of Trade."
              },
              description: "Rejects submission with structured guidance. Emits BLOG_POST_REJECTED outbox event and alerts author."
            }),
            createRequest({
              name: "4.2.3 POST Publish Article",
              method: "POST",
              pathSegments: ["admin", "blogs", ":blogId", "publish"],
              tokenVar: "adminAuthToken",
              description: "Approves and publishes article to public portal. Emits BLOG_POST_PUBLISHED event and notifies author via email and push."
            })
          ]
        },

        // Subfolder 4.3: Direct Admin Content & Oversight
        {
          name: "4.3 Direct Admin Content & Oversight",
          item: [
            createRequest({
              name: "4.3.1 POST Create & Publish Direct Admin Article",
              method: "POST",
              pathSegments: ["admin", "blogs"],
              tokenVar: "adminAuthToken",
              body: {
                title: "Ministry of Justice Notice: Legal Representation Guidelines 2026",
                content: "Official communication regarding compliance standards and code of conduct for registered attorneys...",
                excerpt: "Official regulatory notice from the Federal Ministry of Justice.",
                categoryId: "{{categoryId}}",
                isFeatured: true,
                publishImmediately: true,
                tags: ["Ministry of Justice", "Official Notice", "Regulations"]
              },
              description: "Allows admins to publish portal announcements directly without submitting to review queues."
            }),
            createRequest({
              name: "4.3.2 PATCH Admin Update Any Blog Post",
              method: "PATCH",
              pathSegments: ["admin", "blogs", ":blogId"],
              tokenVar: "adminAuthToken",
              body: {
                isFeatured: true,
                excerpt: "Featured: Essential guidance for cross-border transactions."
              },
              description: "Enables admins to feature articles or edit content."
            }),
            createRequest({
              name: "4.3.3 DELETE Admin Delete Any Blog Post",
              method: "DELETE",
              pathSegments: ["admin", "blogs", ":blogId"],
              tokenVar: "adminAuthToken",
              description: "Administrative removal of any blog post from the system."
            }),
            createRequest({
              name: "4.3.4 DELETE Admin Delete Inappropriate Comment",
              method: "DELETE",
              pathSegments: ["blogs", "comments", ":commentId"],
              tokenVar: "adminAuthToken",
              description: "Moderation removal of spam or abusive comments by an administrator."
            })
          ]
        }
      ]
    }
  ]
};

const outputPath = path.resolve(__dirname, '../postman/Tebeka_Blog_Service_Postman_Collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');
console.log('✅ Created role-based Postman collection at:', outputPath);
