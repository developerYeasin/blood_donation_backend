// controllers/userController.js
const db = require("../config/db");

// Get My Profile
exports.getMe = async (req, res) => {
  try {
    // Updated Query: Select ALL profile fields (except password)
    const [user] = await db.execute(
      `SELECT
                id,
                full_name,
                email,
                phone_number,
                blood_group,
                city,
                address,
                avatar_url,
                bio,
                gender,
                dob,
                cover_image_url,
                is_available_for_donate,
                created_at
             FROM users
             WHERE id = ?`,
      [req.user.id]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search Donors (By Blood Group & Location)
// exports.searchDonors = async (req, res) => {
//   try {
//     const { blood_group, city } = req.query;
//     const page = parseInt(req.query.page) || 1;
//     const pageSize = parseInt(req.query.pageSize) || 10;
//     const offset = (page - 1) * pageSize;
//     const currentUserId = req.user.id; // Get logged in user ID

//     // Base Query: ALWAYS exclude the current user (id != ?)
//     let sql = `
//             SELECT id, full_name, blood_group, phone_number, city, avatar_url
//             FROM users
//             WHERE id != ? AND is_available_for_donate = 1
//         `;

//     const params = [currentUserId];

//     // Filter by Blood Group (only if specific group selected)
//     if (blood_group && blood_group !== "All") {
//       sql += ` AND blood_group = ?`;
//       params.push(blood_group);
//     }

//     // Filter by City (optional)
//     if (city) {
//       sql += ` AND city LIKE ?`;
//       params.push(`%${city}%`);
//     }

//     sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
//     params.push(pageSize + 1, offset); // Fetch one more to check for 'hasMore'

//     const [donors] = await db.execute(sql, params);
//     const hasMore = donors.length > pageSize;
//     if (hasMore) {
//       donors.pop(); // Remove the extra item
//     }
//     res.json({ donors, hasMore });
//   } catch (error) {
//     console.log("error >> ", error);
//     res.status(500).json({ message: error.message });
//   }
// };

exports.searchDonors = async (req, res) => {
    try {
        // Ensure you are pulling all parameters from the query string
        const { blood_group, city, radius_km, latitude, longitude } = req.query;
        
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 5; // Assuming 5 based on your URL example
        const offset = (page - 1) * pageSize;
        const currentUserId = req.user.id; // Get logged in user ID

        // Initialize SQL and Params
        let sql = `
            SELECT id, full_name, blood_group, phone_number, city, avatar_url
            FROM users
            WHERE id != ? AND is_available_for_donate = 1
        `;

        // Start parameters array with the mandatory currentUserId
        const params = [currentUserId]; 

        // --- 1. Filter by Blood Group ---
        if (blood_group && blood_group !== "All") {
            sql += ` AND blood_group = ?`;
            params.push(blood_group);
        }

        // --- 2. Filter by City ---
        if (city) {
            sql += ` AND city LIKE ?`;
            params.push(`%${city}%`);
        }
        
        // --- 3. Filter by Location (This part uses 4 placeholders, making 7 total) ---
        if (latitude && longitude && radius_km) {
            // Note: I'm using 'latitude' and 'longitude' as your database column names here.
            sql += `
                AND (
                    6371 * acos(
                        cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + 
                        sin(radians(?)) * sin(radians(latitude))
                    )
                ) <= ?
            `; 
            // Adding 4 parameters: latitude, longitude, latitude, radius_km
            // These must be added as strings/numbers, NOT the column names.
            params.push(latitude, longitude, latitude, radius_km); 
        }

        // --- Final Query Construction (Always executed) ---
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        // Add pagination parameters (always 2: LIMIT and OFFSET)
        params.push(pageSize + 1, offset); // Fetch one more to check for 'hasMore'

        // Log parameters for verification before execution
        console.log("Final SQL:", sql);
        console.log("Final Params:", params);
        
        // *** THE CRITICAL CHANGE: Use db.query() instead of db.execute() ***
        const [donors] = await db.query(sql, params); 
        
        const hasMore = donors.length > pageSize;
        if (hasMore) {
            donors.pop(); // Remove the extra item
        }
        res.json({ donors, hasMore, page, pageSize });
    } catch (error) {
        console.error("error >> ", error);
        // It's good practice to check if db.query returns the full error object structure
        const errorMessage = error.sqlMessage || error.message; 
        res.status(500).json({ message: errorMessage });
    }
};

// 3. Update Profile (Bio, City, Availability)
// 3. Update Profile (Bio, City, Availability, Photo)
// 3. Update Profile
exports.updateProfile = async (req, res) => {
    try {
        // Add cover_image_url to the destructured body
        const { full_name, bio, city, is_available_for_donate, phone_number, avatar_url, cover_image_url } = req.body;
        
        await db.execute(
            `UPDATE users SET
                full_name=?,
                bio=?,
                city=?,
                is_available_for_donate=?,
                phone_number=?,
                avatar_url=?,
                cover_image_url=?  -- <--- NEW FIELD
             WHERE id=?`,
            [
                full_name,
                bio,
                city,
                is_available_for_donate,
                phone_number,
                avatar_url,
                cover_image_url,   // <--- NEW VALUE
                req.user.id
            ]
        );

        // Fetch updated user including the new cover_image_url
        const [updatedUser] = await db.execute(
            'SELECT id, full_name, email, phone_number, blood_group, city, bio, avatar_url, cover_image_url, is_available_for_donate, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({ message: 'Profile updated successfully', user: updatedUser[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// 4. Get User's Own Posts (Timeline)
exports.getMyPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
            SELECT
                p.*,
                u.full_name,
                u.avatar_url,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked_by_me,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT('url', pm.url, 'type', pm.type)
                    )
                    FROM post_media pm
                    WHERE pm.post_id = p.id
                ) as media
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const [posts] = await db.query(query + ` LIMIT ? OFFSET ?`, [
      userId,
      userId,
      pageSize + 1,
      offset,
    ]);
    const hasMore = posts.length > pageSize;
    if (hasMore) {
      posts.pop(); // Remove the extra item
    }
    res.json({ posts, hasMore, page, pageSize });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: error.message });
  }
};
