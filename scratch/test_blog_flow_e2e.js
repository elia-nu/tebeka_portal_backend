require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

const BASE_URL = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3001/api/v1';

let adminToken = '';
let attorneyToken = '';
let clientToken = '';

async function request(url, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [ASSERTION FAILED]: ${message}`);
    throw new Error(message);
  }
  console.log(`   ✅ [PASS] ${message}`);
}

async function runBlogE2ETest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE ROLE-BASED BLOG SERVICE E2E TEST');
  console.log('   Target Gateway:', BASE_URL);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const timestamp = Date.now();
  const attorneyEmail = `attorney.blog.${timestamp}@tebekalaw.et`;
  const clientEmail = `client.blog.${timestamp}@gmail.com`;
  const defaultPassword = 'Password@123';

  let attorneyUserId = null;
  let attorneyProfileId = null;
  let clientUserId = null;

  let createdCategoryId = null;
  let createdBlogId = null;
  let createdBlogSlug = null;
  let clientCommentId = null;
  let attorneyReplyId = null;
  let adminBlogId = null;

  try {
    // ════════════════════════════════════════════════════════════════════════════
    // STEP 0: Authentication Setup for Roles (Admin, Attorney, Client)
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 0: User Setup & Authentication ---');

    // 0.1 Admin Login
    const adminLoginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@tebeka.et', password: 'Password@123' })
    });
    assert(adminLoginRes.ok, `Admin authenticated successfully (HTTP ${adminLoginRes.status})`);
    adminToken = adminLoginRes.data.token || adminLoginRes.data.accessToken;
    assert(!!adminToken, 'Admin token acquired');

    // 0.2 Setup Test Attorney User & Profile
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const attorneyUser = await prisma.user.create({
      data: {
        email: attorneyEmail,
        phone: `+251921${Math.floor(100000 + Math.random() * 900000)}`,
        name: `Dr. Dawit Desalegn (${timestamp})`,
        passwordHash,
        role: 'ATTORNEY',
        status: 'ACTIVE',
        attorneyProfile: {
          create: {
            slug: `dr-dawit-${timestamp}`,
            fullName: `Dr. Dawit Desalegn`,
            licenseNumber: `LIC-ETH-BLOG-${timestamp}`,
            barRegistrationNumber: `BAR-ETH-BLOG-${timestamp}`,
            city: 'Addis Ababa',
            practiceAreas: ['Commercial Law', 'Arbitration', 'Corporate Tax'],
            bio: 'Senior corporate attorney and legal scholar.',
            verificationStatus: 'APPROVED',
            status: 'ACTIVE',
            hasVerifiedBadge: true,
          }
        }
      },
      include: { attorneyProfile: true }
    });
    attorneyUserId = attorneyUser.id;
    attorneyProfileId = attorneyUser.attorneyProfile.id;
    console.log(`   Created Test Attorney ID: ${attorneyProfileId} (User: ${attorneyUserId})`);

    // Attorney Login
    const attorneyLoginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: attorneyEmail, password: defaultPassword })
    });
    assert(attorneyLoginRes.ok, `Attorney authenticated successfully (HTTP ${attorneyLoginRes.status})`);
    attorneyToken = attorneyLoginRes.data.token || attorneyLoginRes.data.accessToken;
    assert(!!attorneyToken, 'Attorney token acquired');

    // 0.3 Setup Test Client User
    const clientUser = await prisma.user.create({
      data: {
        email: clientEmail,
        phone: `+251931${Math.floor(100000 + Math.random() * 900000)}`,
        name: `Sara Tesfaye (${timestamp})`,
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
      }
    });
    clientUserId = clientUser.id;
    console.log(`   Created Test Client User ID: ${clientUserId}`);

    // Client Login
    const clientLoginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: clientEmail, password: defaultPassword })
    });
    assert(clientLoginRes.ok, `Client authenticated successfully (HTTP ${clientLoginRes.status})`);
    clientToken = clientLoginRes.data.token || clientLoginRes.data.accessToken;
    assert(!!clientToken, 'Client token acquired\n');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 1: Admin Blog Categories CRUD
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 1: Admin Blog Categories CRUD ---');

    // 1.1 POST /admin/blog-categories
    const catName = `Corporate Governance & M&A ${timestamp}`;
    const createCatRes = await request(`${BASE_URL}/admin/blog-categories`, {
      method: 'POST',
      body: JSON.stringify({
        name: catName,
        description: 'Legal updates and insights on corporate law and transactions in Ethiopia.',
        isActive: true
      })
    }, adminToken);
    assert(createCatRes.status === 201 || createCatRes.status === 200, `Admin created blog category (HTTP ${createCatRes.status})`);
    createdCategoryId = createCatRes.data.id;
    assert(!!createdCategoryId, `Category created with ID: ${createdCategoryId}`);

    // 1.2 GET /admin/blog-categories
    const listCatsRes = await request(`${BASE_URL}/admin/blog-categories`, {}, adminToken);
    assert(listCatsRes.ok, `Admin fetched all categories (HTTP ${listCatsRes.status})`);
    const foundCat = (Array.isArray(listCatsRes.data) ? listCatsRes.data : listCatsRes.data.items || []).find(c => c.id === createdCategoryId);
    assert(!!foundCat, 'Found newly created category in admin category list');

    // 1.3 GET /admin/blog-categories/:id
    const getCatRes = await request(`${BASE_URL}/admin/blog-categories/${createdCategoryId}`, {}, adminToken);
    assert(getCatRes.ok && getCatRes.data.id === createdCategoryId, `Admin fetched category by ID`);

    // 1.4 PATCH /admin/blog-categories/:id
    const updatedDesc = 'Comprehensive legal analysis on corporate governance, M&A and regulatory compliance.';
    const updateCatRes = await request(`${BASE_URL}/admin/blog-categories/${createdCategoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: updatedDesc })
    }, adminToken);
    assert(updateCatRes.ok && updateCatRes.data.description === updatedDesc, `Admin updated category description\n`);

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 2: Attorney Blog Authoring, Drafts & Submission
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 2: Attorney Blog Authoring Workflow ---');

    // 2.1 POST /blogs (Attorney creates DRAFT)
    const blogTitle = `Ethiopian Commercial Code Reform: Key Takeaways for Foreign Investors ${timestamp}`;
    const blogContent = `The revised Ethiopian Commercial Code introduces groundbreaking modernizations for private limited companies, shareholders rights, and dispute resolutions in corporate structuring. Investors must pay close attention to new governance mandates.`;
    const createBlogRes = await request(`${BASE_URL}/blogs`, {
      method: 'POST',
      body: JSON.stringify({
        title: blogTitle,
        content: blogContent,
        excerpt: 'Key takeaways and legal updates on the newly revised Commercial Code.',
        categoryId: createdCategoryId,
        caseCategory: 'Commercial Law',
        tags: ['Commercial Law', 'Foreign Investment', 'M&A'],
        submitForReview: false
      })
    }, attorneyToken);

    assert(createBlogRes.status === 201 || createBlogRes.status === 200, `Attorney created draft blog post (HTTP ${createBlogRes.status})`);
    createdBlogId = createBlogRes.data.id;
    createdBlogSlug = createBlogRes.data.slug;
    assert(createBlogRes.data.status === 'DRAFT', `Initial status is correctly DRAFT`);
    console.log(`   Draft Blog ID: ${createdBlogId}, Slug: ${createdBlogSlug}`);

    // 2.2 GET /blogs/my-blogs (Attorney verifies draft in personal list)
    const myBlogsRes = await request(`${BASE_URL}/blogs/my-blogs?status=DRAFT`, {}, attorneyToken);
    assert(myBlogsRes.ok, `Attorney retrieved my-blogs list`);
    const myDraft = (myBlogsRes.data.items || []).find(b => b.id === createdBlogId);
    assert(!!myDraft, 'Draft blog appears in attorney my-blogs response');

    // 2.3 PATCH /blogs/:id (Attorney updates draft)
    const updatedExcerpt = 'Updated: An essential overview for cross-border joint ventures.';
    const updateBlogRes = await request(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'PATCH',
      body: JSON.stringify({ excerpt: updatedExcerpt })
    }, attorneyToken);
    assert(updateBlogRes.ok && updateBlogRes.data.excerpt === updatedExcerpt, `Attorney successfully updated draft post`);

    // 2.4 POST /blogs/:id/submit-for-review (Attorney submits draft for moderation)
    const submitReviewRes = await request(`${BASE_URL}/blogs/${createdBlogId}/submit-for-review`, {
      method: 'POST'
    }, attorneyToken);
    assert(submitReviewRes.ok, `Attorney submitted blog for moderation review (HTTP ${submitReviewRes.status})`);
    assert(submitReviewRes.data.status === 'PENDING_REVIEW', `Blog status transitioned to PENDING_REVIEW\n`);

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 3: Admin Moderation Queue, Rejection & Approval
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 3: Admin Moderation Queue & Review Workflow ---');

    // 3.1 GET /admin/blogs?status=PENDING_REVIEW (Admin checks queue)
    const adminQueueRes = await request(`${BASE_URL}/admin/blogs?status=PENDING_REVIEW`, {}, adminToken);
    assert(adminQueueRes.ok, `Admin fetched pending review blogs queue`);
    const pendingBlog = (adminQueueRes.data.items || []).find(b => b.id === createdBlogId);
    assert(!!pendingBlog, 'Pending blog visible in admin moderation queue');

    // 3.2 POST /admin/blogs/:id/reject (Admin requests changes/rejection)
    const rejectReason = 'Please elaborate on Section 3 regarding the registration of foreign branches.';
    const rejectRes = await request(`${BASE_URL}/admin/blogs/${createdBlogId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectReason })
    }, adminToken);
    assert(rejectRes.ok, `Admin rejected blog with feedback (HTTP ${rejectRes.status})`);
    assert(rejectRes.data.status === 'REJECTED' && rejectRes.data.rejectionReason === rejectReason, `Blog status updated to REJECTED with reason recorded`);

    // 3.3 Attorney modifies and resubmits
    const revisedContent = blogContent + ' Section 3 has now been expanded with registration procedures with the Ministry of Trade.';
    const resubmitPatchRes = await request(`${BASE_URL}/blogs/${createdBlogId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: revisedContent })
    }, attorneyToken);
    assert(resubmitPatchRes.ok, `Attorney revised content based on feedback`);

    const resubmitRes = await request(`${BASE_URL}/blogs/${createdBlogId}/submit-for-review`, {
      method: 'POST'
    }, attorneyToken);
    assert(resubmitRes.ok && resubmitRes.data.status === 'PENDING_REVIEW', `Attorney resubmitted blog for review`);

    // 3.4 POST /admin/blogs/:id/publish (Admin approves and publishes)
    const publishRes = await request(`${BASE_URL}/admin/blogs/${createdBlogId}/publish`, {
      method: 'POST'
    }, adminToken);
    assert(publishRes.ok, `Admin published the blog post (HTTP ${publishRes.status})`);
    assert(publishRes.data.status === 'PUBLISHED', `Blog status is now PUBLISHED`);
    assert(!!publishRes.data.publishedAt, `publishedAt timestamp set: ${publishRes.data.publishedAt}\n`);

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 4: Public Consumption & Discovery
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 4: Public Endpoints & Discovery ---');

    // 4.1 GET /public/blogs (Public listing)
    const publicListRes = await request(`${BASE_URL}/public/blogs?search=Commercial+Code&sortBy=newest`);
    assert(publicListRes.ok, `Public visitor listed published blogs (HTTP ${publicListRes.status})`);
    const foundPublicPost = (publicListRes.data.items || []).find(b => b.id === createdBlogId);
    assert(!!foundPublicPost, 'Published blog is discoverable in public search results');

    // 4.2 GET /public/blog-categories
    const publicCatsRes = await request(`${BASE_URL}/public/blog-categories`);
    assert(publicCatsRes.ok, `Public visitor fetched blog categories`);
    const pubCat = (publicCatsRes.data || []).find(c => c.id === createdCategoryId);
    assert(!!pubCat, 'Created category is visible publicly');
    assert(pubCat.publishedPostCount >= 1, `Category publishedPostCount correctly incremented to ${pubCat.publishedPostCount}`);

    // 4.3 GET /public/blogs/:slugOrId (Public detail by slug)
    const publicDetailRes = await request(`${BASE_URL}/public/blogs/${createdBlogSlug}`);
    assert(publicDetailRes.ok, `Public visitor fetched blog by slug "${createdBlogSlug}"`);
    assert(publicDetailRes.data.id === createdBlogId, 'Returned blog matches target ID');
    assert(publicDetailRes.data.author && publicDetailRes.data.author.name.includes('Dawit'), 'Includes author info');
    assert(publicDetailRes.data.viewsCount >= 1, `Views count was incremented (viewsCount: ${publicDetailRes.data.viewsCount})`);

    // 4.4 GET /public/blogs/:id/comments (Empty initially)
    const initialCommentsRes = await request(`${BASE_URL}/public/blogs/${createdBlogId}/comments`);
    assert(initialCommentsRes.ok, `Public visitor fetched blog comments`);
    assert(initialCommentsRes.data.total === 0, 'Initially 0 comments\n');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 5: Community Social Interactions (Likes, Comments, Shares)
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 5: Social Interactions (Likes, Comments, Shares) ---');

    // 5.1 POST /blogs/:id/like (Client likes)
    const likeRes1 = await request(`${BASE_URL}/blogs/${createdBlogId}/like`, {
      method: 'POST'
    }, clientToken);
    assert(likeRes1.ok && likeRes1.data.liked === true && likeRes1.data.likesCount === 1, `Client liked the blog (likesCount: 1)`);

    // 5.2 POST /blogs/:id/like (Client unlikes)
    const unlikeRes = await request(`${BASE_URL}/blogs/${createdBlogId}/like`, {
      method: 'POST'
    }, clientToken);
    assert(unlikeRes.ok && unlikeRes.data.liked === false && unlikeRes.data.likesCount === 0, `Client unliked the blog (likesCount: 0)`);

    // 5.3 POST /blogs/:id/like (Client re-likes)
    const relikeRes = await request(`${BASE_URL}/blogs/${createdBlogId}/like`, {
      method: 'POST'
    }, clientToken);
    assert(relikeRes.ok && relikeRes.data.liked === true && relikeRes.data.likesCount === 1, `Client re-liked the blog (likesCount: 1)`);

    // 5.4 POST /blogs/:id/comments (Client adds top-level comment)
    const commentRes = await request(`${BASE_URL}/blogs/${createdBlogId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'This is an insightful summary! Does the new code specify deadlines for board resolutions?'
      })
    }, clientToken);
    assert(commentRes.status === 201 || commentRes.status === 200, `Client added top-level comment (HTTP ${commentRes.status})`);
    clientCommentId = commentRes.data.id;
    assert(!!clientCommentId, `Comment created with ID: ${clientCommentId}`);

    // 5.5 POST /blogs/:id/comments (Attorney replies to client comment)
    const replyRes = await request(`${BASE_URL}/blogs/${createdBlogId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'Thank you Sara! Under Article 324, ordinary board resolutions must be minuted within 15 days.',
        parentId: clientCommentId
      })
    }, attorneyToken);
    assert(replyRes.status === 201 || replyRes.status === 200, `Attorney replied to comment (HTTP ${replyRes.status})`);
    attorneyReplyId = replyRes.data.id;
    assert(replyRes.data.parentId === clientCommentId, 'Reply parentId links to client comment');

    // 5.6 GET /public/blogs/:id/comments (Verify nested comments structure)
    const commentsListRes = await request(`${BASE_URL}/public/blogs/${createdBlogId}/comments`);
    assert(commentsListRes.ok, `Public retrieved comments tree`);
    const topComment = (commentsListRes.data.items || []).find(c => c.id === clientCommentId);
    assert(!!topComment, 'Top-level comment found in comments tree');
    assert(topComment.replies && topComment.replies.length >= 1, `Top-level comment contains reply (replies count: ${topComment.replies.length})`);

    // 5.7 POST /blogs/:id/share (Public records share to LinkedIn & Telegram)
    const shareRes1 = await request(`${BASE_URL}/blogs/${createdBlogId}/share`, {
      method: 'POST',
      body: JSON.stringify({ platform: 'LINKEDIN' })
    });
    assert(shareRes1.ok && shareRes1.data.sharesCount >= 1, `Recorded share to LinkedIn (sharesCount: ${shareRes1.data.sharesCount})`);

    const shareRes2 = await request(`${BASE_URL}/blogs/${createdBlogId}/share`, {
      method: 'POST',
      body: JSON.stringify({ platform: 'TELEGRAM' })
    });
    assert(shareRes2.ok && shareRes2.data.sharesCount >= 2, `Recorded share to Telegram (sharesCount: ${shareRes2.data.sharesCount})`);

    // 5.8 DELETE /blogs/comments/:commentId (Client deletes their reply/comment)
    const deleteReplyRes = await request(`${BASE_URL}/blogs/comments/${attorneyReplyId}`, {
      method: 'DELETE'
    }, attorneyToken);
    assert(deleteReplyRes.ok, `Attorney deleted their reply comment (HTTP ${deleteReplyRes.status})\n`);

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 6: Admin Direct Blog Creation, Update & Deletion
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 6: Admin Direct Blog Creation & Cleanup ---');

    // 6.1 POST /admin/blogs (Admin creates blog with publishImmediately = true)
    const adminBlogTitle = `Ministry of Justice Legal Notice on Foreign Law Firms ${timestamp}`;
    const createAdminBlogRes = await request(`${BASE_URL}/admin/blogs`, {
      method: 'POST',
      body: JSON.stringify({
        title: adminBlogTitle,
        content: `Official guidelines and operational boundaries for international joint legal advisory initiatives.`,
        excerpt: `Official guidelines from the Ministry of Justice.`,
        categoryId: createdCategoryId,
        publishImmediately: true,
        isFeatured: true,
        tags: ['Ministry of Justice', 'Regulatory Notice']
      })
    }, adminToken);
    assert(createAdminBlogRes.status === 201 || createAdminBlogRes.status === 200, `Admin created directly published blog (HTTP ${createAdminBlogRes.status})`);
    adminBlogId = createAdminBlogRes.data.id;
    assert(createAdminBlogRes.data.status === 'PUBLISHED', 'Admin post published immediately');

    // 6.2 PATCH /admin/blogs/:id (Admin updates blog)
    const updateAdminBlogRes = await request(`${BASE_URL}/admin/blogs/${adminBlogId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        excerpt: 'Updated official regulatory guidelines.'
      })
    }, adminToken);
    assert(updateAdminBlogRes.ok, `Admin updated blog metadata`);

    // 6.3 DELETE /admin/blogs/:id (Admin deletes blog)
    const deleteAdminBlogRes = await request(`${BASE_URL}/admin/blogs/${adminBlogId}`, {
      method: 'DELETE'
    }, adminToken);
    assert(deleteAdminBlogRes.ok, `Admin deleted test blog (HTTP ${deleteAdminBlogRes.status})`);

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL BLOG SERVICE E2E FLOWS PASSED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup temporary test data
    console.log('\n--- Cleaning up temporary test records ---');
    try {
      if (createdBlogId) {
        await prisma.blogShare.deleteMany({ where: { blogId: createdBlogId } });
        await prisma.blogLike.deleteMany({ where: { blogId: createdBlogId } });
        await prisma.blogComment.deleteMany({ where: { blogId: createdBlogId } });
        await prisma.blogPost.deleteMany({ where: { id: createdBlogId } });
      }
      if (createdCategoryId) {
        await prisma.blogCategory.deleteMany({ where: { id: createdCategoryId } });
      }
      if (attorneyUserId) {
        await prisma.attorneyProfile.deleteMany({ where: { userId: attorneyUserId } });
        await prisma.user.deleteMany({ where: { id: attorneyUserId } });
      }
      if (clientUserId) {
        await prisma.user.deleteMany({ where: { id: clientUserId } });
      }
      console.log('   Cleanup completed.');
    } catch (cleanErr) {
      console.warn('   Cleanup warning:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runBlogE2ETest();
