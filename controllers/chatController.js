const db = require('../config/db');
const sendNotification = require('../services/notificationService'); 

// Get My Conversations
// exports.getConversations = async (req, res) => {
//     try {
//         const currentUserId = req.user.id;
//         const page = parseInt(req.query.page) || 1;
//         const pageSize = parseInt(req.query.pageSize) || 10;
//         const offset = (page - 1) * pageSize;

//         const query = `
//             SELECT
//                 c.id as conversation_id,
//                 c.type,
                
//                 -- LOGIC FOR NAME
//                 CASE
//                     WHEN c.type = 'group' THEN c.group_name
//                     ELSE (
//                         SELECT full_name FROM users u
//                         JOIN conversation_participants cp2 ON u.id = cp2.user_id
//                         WHERE cp2.conversation_id = c.id AND cp2.user_id != ? -- Exclude Self
//                         LIMIT 1
//                     )
//                 END as chat_name,

//                 -- LOGIC FOR IMAGE
//                 CASE
//                     WHEN c.type = 'group' THEN c.group_image
//                     ELSE (
//                         SELECT avatar_url FROM users u
//                         JOIN conversation_participants cp2 ON u.id = cp2.user_id
//                         WHERE cp2.conversation_id = c.id AND cp2.user_id != ? -- Exclude Self
//                         LIMIT 1
//                     )
//                 END as chat_image,

//                 m.content as last_message,
//                 m.created_at as last_message_time

//             FROM conversation_participants cp
//             JOIN conversations c ON cp.conversation_id = c.id
//             LEFT JOIN messages m ON c.id = m.conversation_id AND m.id = (
//                 SELECT MAX(id) FROM messages WHERE conversation_id = c.id
//             )
//             WHERE cp.user_id = ? -- Only get chats for Current User
//             ORDER BY m.created_at DESC
//             LIMIT ? OFFSET ?
//         `;

//         const [chats] = await db.execute(query, [currentUserId, currentUserId, currentUserId, pageSize + 1, offset]);
//         const hasMore = chats.length > pageSize;
//         if (hasMore) {
//             chats.pop(); // Remove the extra item used to check for more
//         }
//         res.json({ chats, hasMore });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: error.message });
//     }
// };


exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const limit = pageSize + 1; 
        
        // Arguments array for the 5 placeholders: [user_id, user_id, user_id, limit, offset]
        const args = [currentUserId, currentUserId, currentUserId, limit, offset];

        const query = `
            WITH LastMessages AS (
                -- CTE 1: Find the ID of the latest message for each conversation
                SELECT
                    conversation_id,
                    MAX(id) AS max_message_id
                FROM messages
                GROUP BY conversation_id
            )
            
            SELECT
                c.id as conversation_id,
                c.type,
                
                -- LOGIC FOR NAME
                CASE
                    WHEN c.type = 'group' THEN c.group_name
                    ELSE (
                        SELECT full_name FROM users u
                        JOIN conversation_participants cp2 ON u.id = cp2.user_id
                        WHERE cp2.conversation_id = c.id AND cp2.user_id != ? -- Placeholder 1
                        LIMIT 1
                    )
                END as chat_name,

                -- LOGIC FOR IMAGE
                CASE
                    WHEN c.type = 'group' THEN c.group_image
                    ELSE (
                        SELECT avatar_url FROM users u
                        JOIN conversation_participants cp2 ON u.id = cp2.user_id
                        WHERE cp2.conversation_id = c.id AND cp2.user_id != ? -- Placeholder 2
                        LIMIT 1
                    )
                END as chat_image,

                m.content as last_message,
                m.created_at as last_message_time

            FROM conversation_participants cp
            JOIN conversations c ON cp.conversation_id = c.id
            -- LEFT JOIN to get the latest message content
            LEFT JOIN LastMessages lm ON c.id = lm.conversation_id
            LEFT JOIN messages m ON lm.max_message_id = m.id

            WHERE cp.user_id = ? -- Placeholder 3
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ? -- Placeholder 4 and 5
        `;

        // *** THE CRITICAL CHANGE: Use db.query() instead of db.execute() ***
        const [chats] = await db.query(query, args);

        const hasMore = chats.length > pageSize;
        if (hasMore) {
            chats.pop(); // Remove the extra item used to check for more
        }
        res.json({ chats, hasMore, page, pageSize });
    } catch (error) {
        console.error(error);
        // It's good practice to check if db.query returns the full error object structure
        const errorMessage = error.sqlMessage || error.message; 
        res.status(500).json({ message: errorMessage });
    }
};

// Get Messages inside a specific Chat
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const [messages] = await db.execute(
            `SELECT m.*, u.full_name as sender_name 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.conversation_id = ? 
             ORDER BY m.created_at ASC`, 
            [conversationId]
        );
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// NEW: Start a chat with a specific user
exports.startChat = async (req, res) => {
    try {
        const myId = req.user.id;
        const targetId = req.body.target_user_id;

        // 1. Check if a private conversation already exists
        // We look for a conversation that has BOTH users as participants
        const [existing] = await db.execute(`
            SELECT c.id
            FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE c.type = 'private'
            AND cp1.user_id = ?
            AND cp2.user_id = ?
            LIMIT 1
        `, [myId, targetId]);

        if (existing.length > 0) {
            // FOUND EXISTING! Return it immediately.
            return res.json({ conversation_id: existing[0].id, isNew: false });
        }

        // 2. If NOT exists, create a new one
        const [newConv] = await db.execute("INSERT INTO conversations (type) VALUES ('private')");
        const convId = newConv.insertId;

        await db.execute("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
            [convId, myId, convId, targetId]);

        res.json({ conversation_id: convId, isNew: true });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};