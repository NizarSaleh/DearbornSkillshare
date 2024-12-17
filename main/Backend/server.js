const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'your_secret_key'; // Use a secure secret key for JWT signing

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Connect to SQLite database
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite DB');
});


// Create tables if they do not exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    isActive BOOLEAN DEFAULT 1,
    isAdmin BOOLEAN DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    files TEXT,
    username TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (postId) REFERENCES posts (id),
    FOREIGN KEY (userId) REFERENCES users (id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commentId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (commentId) REFERENCES comments (id),
    FOREIGN KEY (userId) REFERENCES users (id)
  )
`);


const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    db.get('SELECT id, isAdmin FROM users WHERE id = ?', [user.id], (dbErr, row) => {
      if (dbErr) {
        console.error('Error verifying user role:', dbErr.message);
        return res.status(500).json({ error: 'Failed to verify user role.' });
      }

      if (!row) return res.status(404).json({ error: 'User not found.' });

      req.user = { id: row.id, isAdmin: row.isAdmin === 1 }; // Ensure `isAdmin` is a boolean
      console.log('Authenticated user:', req.user); // Debug: Log authenticated user details
      next();
    });
  });
};




// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Add a comment to a post
app.post('/api/comments', authenticate, (req, res) => {
  const { postId, content } = req.body;
  const userId = req.user.id;

  if (!postId || !content) {
    return res.status(400).json({ error: 'Post ID and content are required.' });
  }

  const query = `INSERT INTO comments (postId, userId, content) VALUES (?, ?, ?)`;
  db.run(query, [postId, userId, content], function (err) {
    if (err) {
      console.error('Error saving comment:', err.message);
      return res.status(500).json({ error: 'Failed to save comment.' });
    }
    res.json({
      id: this.lastID,
      postId,
      userId,
      content,
      createdAt: new Date().toISOString(),
    });
  });
});

// Get comments for a post
app.get('/api/comments/:postId', authenticate, (req, res) => {
  const { postId } = req.params;

  const query = `
    SELECT c.*, u.name as username 
    FROM comments c 
    JOIN users u ON c.userId = u.id 
    WHERE c.postId = ?
  `;

  db.all(query, [postId], (err, rows) => {
    if (err) {
      console.error('Error fetching comments:', err.message);
      return res.status(500).json({ error: 'Failed to fetch comments.' });
    }
    res.json(rows);
  });
});

// Routes

// Create a new user (Signup)
// Get all users (Admin only)
app.get('/api/users', authenticate, (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'You are not authorized to access this resource.' });
  }

  const query = 'SELECT id, name, email, zipcode, skill1, skill2, skill3, isActive, isAdmin FROM users';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      return res.status(500).json({ error: 'Failed to fetch users.' });
    }

    res.json(rows);
  });
});





// User login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const query = 'SELECT id, name, email, isActive FROM users WHERE email = ? AND password = ?';
  db.get(query, [email, password], (err, user) => {
    if (err) {
      console.error('Error logging in:', err.message);
      return res.status(500).json({ error: 'Failed to log in.' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
});


// Create a new post with file uploads
app.post('/api/posts', authenticate, upload.array('files', 5), (req, res) => {
  const { category, content } = req.body;
  const userId = req.user.id;
  const username = req.user.name;

  if (!category || !content) {
    return res.status(400).json({ error: 'Category and content are required.' });
  }

  const fileUrls = req.files.map((file) => `/uploads/${file.filename}`); // Save relative paths

  const query = `INSERT INTO posts (userId, category, content, files, username) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [userId, category, content, JSON.stringify(fileUrls), username], function (err) {
    if (err) {
      console.error('Error saving post:', err.message);
      return res.status(500).json({ error: 'Failed to save post.' });
    }
    res.json({ id: this.lastID, category, content, files: fileUrls });
  });
});


// Get posts by category (Only for creator and admin)
app.get('/api/posts/:category?', authenticate, (req, res) => {
  const { category } = req.params;

  let query = `
    SELECT p.*, u.name AS username
    FROM posts p
    JOIN users u ON p.userId = u.id
  `;
  const queryParams = [];

  if (category) {
    query += ` WHERE p.category = ?`;
    queryParams.push(category);
  }

  db.all(query, queryParams, (err, rows) => {
    if (err) {
      console.error('Error fetching posts:', err.message);
      return res.status(500).json({ error: 'Failed to fetch posts.' });
    }

    rows.forEach((row) => {
      if (row.files) row.files = JSON.parse(row.files); // Parse file paths
    });

    res.json(rows);
  });
});




// Delete a post (Only for creator and admin)
app.delete('/api/posts/:id', authenticate, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.isAdmin;

  console.log('DELETE request for post:', postId, 'by user:', userId, 'isAdmin:', isAdmin);

  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) {
      console.error('Error fetching post:', err.message);
      return res.status(500).json({ error: 'Failed to fetch post.' });
    }

    if (!post) {
      console.error('Post not found:', postId);
      return res.status(404).json({ error: 'Post not found.' });
    }

    console.log('Fetched post:', post);

    // Allow admins to delete any post
    if (isAdmin) {
      console.log('Admin attempting to delete post:', postId);
      db.run('DELETE FROM posts WHERE id = ?', [postId], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting post:', deleteErr.message);
          return res.status(500).json({ error: 'Failed to delete post.' });
        }
        console.log('Post deleted by admin:', postId);
        res.json({ message: 'Post deleted successfully by admin.' });
      });
      return;
    }

    // Allow post owner to delete
    if (parseInt(post.userId) === parseInt(userId)) {
      console.log('Post owner attempting to delete post:', postId);
      db.run('DELETE FROM posts WHERE id = ?', [postId], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting post:', deleteErr.message);
          return res.status(500).json({ error: 'Failed to delete post.' });
        }
        console.log('Post deleted by owner:', postId);
        res.json({ message: 'Post deleted successfully by owner.' });
      });
      return;
    }

    console.error('User not authorized to delete post:', postId);
    res.status(403).json({ error: 'You are not authorized to delete this post.' });
  });
});


// Delete a comment
app.delete('/api/comments/:id', authenticate, (req, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.isAdmin;

  db.get('SELECT * FROM comments WHERE id = ?', [commentId], (err, comment) => {
    if (err) {
      console.error('Error fetching comment:', err.message);
      return res.status(500).json({ error: 'Failed to fetch comment.' });
    }

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Allow deletion if user is the creator or an admin
    if (isAdmin || parseInt(comment.userId) === parseInt(userId)) {
      db.run('DELETE FROM comments WHERE id = ?', [commentId], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting comment:', deleteErr.message);
          return res.status(500).json({ error: 'Failed to delete comment.' });
        }
        res.json({ message: 'Comment deleted successfully.' });
      });
    } else {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }
  });
});


app.post('/api/profile', authenticate, upload.single('profileImage'), (req, res) => {
  const { firstName, lastName, zipCode, email, aboutMe } = req.body;
  const userId = req.user.id;

  const profileImage = req.file
    ? `/uploads/${req.file.filename}`
    : '/uploads/logo.jpg'; // Default if no image uploaded

  const query = `
    UPDATE users 
    SET name = ?, email = ?, zipcode = ?, aboutMe = ?, profileImage = ?
    WHERE id = ?
  `;
  db.run(
    query,
    [`${firstName} ${lastName}`, email, zipCode, aboutMe, profileImage, userId],
    function (err) {
      if (err) {
        console.error('Error updating profile:', err.message);
        return res.status(500).json({ error: 'Failed to update profile.' });
      }
      res.json({ message: 'Profile updated successfully!', profileImage });
    }
  );
});


app.post('/api/users', (req, res) => {
  const { name, email, password, zipcode, skill1, skill2, skill3 } = req.body;

  if (!name || !email || !password || !zipcode) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const query = `
    INSERT INTO users (name, email, password, zipcode, skill1, skill2, skill3)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(query, [name, email, password, zipcode, skill1, skill2, skill3], function (err) {
    if (err) {
      console.error('Error saving user:', err.message);
      return res.status(500).json({ error: 'Failed to save user.' });
    }
    res.json({ id: this.lastID, name, email, zipcode, skill1, skill2, skill3 });
  });
});


app.post('/api/replies', authenticate, (req, res) => {
  const { commentId, content } = req.body;
  const userId = req.user.id;

  if (!commentId || !content) {
    return res.status(400).json({ error: 'Comment ID and content are required.' });
  }

  const query = `INSERT INTO replies (commentId, userId, content) VALUES (?, ?, ?)`;
  db.run(query, [commentId, userId, content], function (err) {
    if (err) {
      console.error('Error saving reply:', err.message);
      return res.status(500).json({ error: 'Failed to save reply.' });
    }
    res.json({
      id: this.lastID,
      commentId,
      userId,
      content,
      createdAt: new Date().toISOString(),
    });
  });
});

app.get('/api/replies/:commentId', authenticate, (req, res) => {
  const { commentId } = req.params;

  const query = `
    SELECT r.*, u.name as username 
    FROM replies r 
    JOIN users u ON r.userId = u.id 
    WHERE r.commentId = ?
  `;

  db.all(query, [commentId], (err, rows) => {
    if (err) {
      console.error('Error fetching replies:', err.message);
      return res.status(500).json({ error: 'Failed to fetch replies.' });
    }
    res.json(rows);
  });
});

app.delete('/api/replies/:id', authenticate, (req, res) => {
  const replyId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.isAdmin;

  db.get('SELECT * FROM replies WHERE id = ?', [replyId], (err, reply) => {
    if (err) {
      console.error('Error fetching reply:', err.message);
      return res.status(500).json({ error: 'Failed to fetch reply.' });
    }

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    // Allow deletion if user is the creator or an admin
    if (isAdmin || parseInt(reply.userId) === parseInt(userId)) {
      db.run('DELETE FROM replies WHERE id = ?', [replyId], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting reply:', deleteErr.message);
          return res.status(500).json({ error: 'Failed to delete reply.' });
        }
        res.json({ message: 'Reply deleted successfully.' });
      });
    } else {
      return res.status(403).json({ error: 'You are not authorized to delete this reply.' });
    }
  });
});

app.get('/api/users/:id', authenticate, (req, res) => {
  const userId = req.params.id;

  const query = `SELECT name, email, zipcode, aboutMe, profileImage FROM users WHERE id = ?`;
  db.get(query, [userId], (err, row) => {
    if (err) {
      console.error('Error fetching user data:', err.message);
      return res.status(500).json({ error: 'Failed to fetch user data.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(row); // Return the user details
  });
});



// Start the server
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
