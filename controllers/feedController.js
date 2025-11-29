const db = require('../config/db');
const sendNotification = require('../services/notificationService'); // &lt;--- IMPORT THIS

// Create Post
exports.createPost = async (req, res) => {
    try {
        const { content, media } = req.body; // 'media' is an array: [{ url: '...', type: 'image' }]
        const userId = req.user.id;

        // A. Create the Post
        const [result] = await db.execute(
            'INSERT INTO posts (user_id, content) VALUES (?, ?)',
            [userId, content]
        );
        const postId = result.insertId;

        // B. Insert Media (if any)
        if (media && media.length > 0) {
            const values = media.map(m => [postId, m.url, m.type]);
            // Bulk Insert for performance
            await db.query(
                'INSERT INTO post_media (post_id, url, type) VALUES ?',
                [values]
            );
        }

        res.status(201).json({ message: 'Posted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// 1. LIKE POST (Updated with Notification)
exports.likePost = async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.user.id;

        // 1. Check if already liked
        const [exists] = await db.execute('SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, postId]);

        if (exists.length > 0) {
            // UNLIKE: Remove the record
            await db.execute('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
            return res.json({ message: 'Unliked', status: 'unliked' });
        } else {
            // LIKE: Add the record
            await db.execute('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
            
            // Send Notification (Only if not own post)
            const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
            if (post[0].user_id !== userId) {
                await sendNotification(post[0].user_id, "New Like ❤️", `${req.user.full_name} liked your post.`, "like", postId, "/feed");
            }
            return res.json({ message: 'Liked', status: 'liked' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. COMMENT POST (Updated with Notification)
// 3. POST COMMENT / REPLY (Ensuring Parent ID works)
exports.commentPost = async (req, res) => {
    try {
        const { postId, comment, parentId } = req.body; // parentId is for Replies
        const userId = req.user.id;

        await db.execute(
            'INSERT INTO post_comments (post_id, user_id, comment_text, parent_id) VALUES (?, ?, ?, ?)',
            [postId, userId, comment, parentId || null]
        );

        // Notification Logic
        // If it's a reply, notify the comment owner. If it's a comment, notify post owner.
        if (parentId) {
            const [parent] = await db.execute('SELECT user_id FROM post_comments WHERE id = ?', [parentId]);
            if (parent[0].user_id !== userId) {
                await sendNotification(parent[0].user_id, "New Reply ↩️", `${req.user.full_name} replied to you.`, "comment", postId, "/feed");
            }
        } else {
            const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [postId]);
            if (post[0].user_id !== userId) {
                await sendNotification(post[0].user_id, "New Comment 💬", `${req.user.full_name} commented on your post.`, "comment", postId, "/feed");
            }
        }

        res.json({ message: 'Comment added' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. GET FEED (Now fetches media array)
exports.getFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const query = `
            SELECT
                p.*,
                u.full_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked_by_me,
                
                -- Aggregating Media
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT('url', pm.url, 'type', pm.type)
                    )
                    FROM post_media pm
                    WHERE pm.post_id = p.id
                ) as media
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [posts] = await db.query(query, [req.user.id, pageSize + 1, offset]);
        const hasMore = posts.length > pageSize;
        if (hasMore) {
            posts.pop(); // Remove the extra item used to check for more
        }
        res.json({ posts, hasMore, page, pageSize });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// New Function: getComments (Fetch Comments & Replies)
// 1. GET COMMENTS (Updated to show Likes Count & Reply Structure)
exports.getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        const currentUserId = req.user.id;

        const query = `
            SELECT c.*, u.full_name, u.avatar_url,
            (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes_count,
            EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked_by_me
            FROM post_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `;

        const [comments] = await db.query(query, [currentUserId, postId]);
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. LIKE A COMMENT (New Feature)
exports.likeComment = async (req, res) => {
    try {
        const { commentId } = req.body;
        const userId = req.user.id;

        // Check if already liked
        const [exists] = await db.execute(
            'SELECT * FROM comment_likes WHERE user_id = ? AND comment_id = ?',
            [userId, commentId]
        );

        if (exists.length > 0) {
            // UNLIKE
            await db.execute('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [userId, commentId]);
            return res.json({ status: 'unliked' });
        } else {
            // LIKE
            await db.execute('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)', [userId, commentId]);
            
            // Notification Logic
            const [comment] = await db.execute('SELECT user_id, post_id FROM post_comments WHERE id = ?', [commentId]);
            if (comment[0].user_id !== userId) {
                await sendNotification(
                    comment[0].user_id,
                    "Comment Liked ❤️",
                    `${req.user.full_name} liked your comment.`,
                    "like",
                    comment[0].post_id, // Link back to the post
                    "/feed"
                );
            }

            return res.json({ status: 'liked' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// DELETE MY POST
exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Check ownership
        const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [id]);
        
        if (post.length === 0) return res.status(404).json({ message: 'Post not found' });
        if (post[0].user_id !== userId) return res.status(403).json({ message: 'Not authorized' });

        // 2. Delete
        await db.execute('DELETE FROM posts WHERE id = ?', [id]);
        res.json({ message: 'Post deleted' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};