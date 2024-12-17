import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logo from './logo.jpg';
import electronicsIcon from './electronics.png';
import appliancesIcon from './appliances.png';
import mechanicsIcon from './mech.png';
import { jwtDecode } from 'jwt-decode';

function App() {
  const [page, setPage] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [posts, setPosts] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  const [comments, setComments] = useState({});
  const [users, setUsers] = useState([]); // Admin user list
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [replies, setReplies] = useState({});
  const [profileImage, setProfileImage] = useState(null);

  const adminCredentials = {
    email: "admin@example.com",
    password: "adminpass",
  };
  
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    zipCode: '',
    email: '',
    aboutMe: '',
  });
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prevProfile) => ({ ...prevProfile, [name]: value }));
  };

  const handleProfileImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(URL.createObjectURL(file));
    }
  };

  const handleAdminLogin = async (email, password) => {
    if (email === adminCredentials.email && password === adminCredentials.password) {
      alert("Welcome, Admin!");
      setPage("admin");
      setLoggedInUser({ name: "Admin", isAdmin: true });
      return true;
    } else {
      alert("Invalid admin credentials.");
      return false;
    }
  };
  
  const handleDeleteReply = async (replyId, commentId) => {
    const token = localStorage.getItem('token'); // Auth token
    try {
      await axios.delete(`http://localhost:5000/api/replies/${replyId}`, {
        headers: {
          Authorization: `Bearer ${token}`, // Authorization header
        },
      });
  
      // Update the replies state to remove the deleted reply
      setReplies((prevReplies) => ({
        ...prevReplies,
        [commentId]: prevReplies[commentId].filter((reply) => reply.id !== replyId),
      }));
  
      alert('Reply deleted successfully.');
    } catch (error) {
      console.error('Error deleting reply:', error.message);
      alert('Failed to delete reply.');
    }
  };

  const fetchReplies = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/replies/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      setReplies((prevReplies) => ({
        ...prevReplies,
        [commentId]: response.data,
      }));
    } catch (error) {
      console.error('Error fetching replies:', error.message);
    }
  };

  const handleAddReply = async (commentId, replyText) => {
    if (!replyText.trim()) return alert('Reply cannot be empty.');
  
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/replies',
        { commentId, content: replyText },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      const newReply = response.data;
  
      setReplies((prevReplies) => ({
        ...prevReplies,
        [commentId]: [...(prevReplies[commentId] || []), newReply],
      }));
    } catch (error) {
      console.error('Error adding reply:', error.message);
      alert('Failed to add reply.');
    }
  };
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token); // Correct usage
        setLoggedInUser(decoded);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);
  
  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/login', { email, password });
      const { token } = response.data;
      localStorage.setItem('token', token);
  
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded);
      setIsLoggedIn(true);
  
      return true;
    } catch (error) {
      console.error('Error logging in:', error.response?.data || error.message);
      alert(error.response?.data?.error || 'Failed to log in. Please check your credentials.');
      return false;
    }
  };
  
  const handleDeleteComment = async (commentId, postId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      // Update the comments state
      setComments((prevComments) => ({
        ...prevComments,
        [postId]: prevComments[postId].filter((comment) => comment.id !== commentId),
      }));
  
      alert('Comment deleted successfully.');
    } catch (error) {
      console.error('Error deleting comment:', error.message);
      alert('Failed to delete comment.');
    }
  };
  
  // Fetch users for Admin Dashboard
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token'); // Retrieve the JWT token
      const response = await axios.get('http://localhost:5000/api/users', {
        headers: {
          Authorization: `Bearer ${token}`, // Include Authorization header
        },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to load users.');
    }
  };
  
  useEffect(() => {
    if (page === 'category' && selectedCategory) {
      fetchPosts(selectedCategory);
    }
  }, [page, selectedCategory]);
  
  const handleProfileSave = async (e) => {
    e.preventDefault();
  
    const formData = new FormData();
    formData.append('firstName', profile.firstName);
    formData.append('lastName', profile.lastName);
    formData.append('zipCode', profile.zipCode);
    formData.append('email', profile.email);
    formData.append('aboutMe', profile.aboutMe);
  
    if (profileImage) {
      const blob = await fetch(profileImage).then((res) => res.blob());
      formData.append('profileImage', blob, 'profile.jpg');
    }
  
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/api/profile', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      // Re-fetch updated user data
      const response = await axios.get(`http://localhost:5000/api/users/${loggedInUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      setLoggedInUser(response.data); // Update user state with new data
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error.message);
      alert('Failed to update profile.');
    }
  };
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/users/${loggedInUser.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile({
          firstName: response.data.name.split(' ')[0] || '',
          lastName: response.data.name.split(' ')[1] || '',
          zipCode: response.data.zipcode || '',
          email: response.data.email || '',
          aboutMe: response.data.aboutMe || '',
        });
        setProfileImage(response.data.profileImage || '/uploads/logo.jpg');
      } catch (error) {
        console.error('Error fetching profile:', error.message);
      }
    };
  
    if (loggedInUser) fetchUserProfile();
  }, [loggedInUser]);
  
  // Fetch comments for all posts in the selected category
  const fetchCommentsForPosts = async (categoryPosts) => {
    const token = localStorage.getItem('token');
    try {
      const allComments = {};
      for (const post of categoryPosts) {
        const response = await axios.get(`http://localhost:5000/api/comments/${post.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        allComments[post.id] = response.data;
      }
      setComments(allComments);
    } catch (error) {
      console.error('Error fetching comments:', error.message);
    }
  };
  
  // Extend fetchPosts to fetch comments as well
  const fetchPosts = async (category) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/posts/${category}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const categoryPosts = response.data;
  
      setPosts((prevPosts) => ({
        ...prevPosts,
        [category]: categoryPosts,
      }));
  
      // Fetch comments for all posts in the category
      fetchCommentsForPosts(categoryPosts);
    } catch (error) {
      console.error('Error fetching posts:', error.message);
      alert('Failed to load posts.');
    }
  };
  
  const [showReplies, setShowReplies] = useState({});

  const toggleReplies = (commentId) => {
    setShowReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  useEffect(() => {
    if (page === 'admin') {
      fetchUsers();
    } else if (page === 'category' && selectedCategory) {
      fetchPosts(selectedCategory);
    }
  }, [page, selectedCategory]);
  
  useEffect(() => {
    if (page === 'category' && selectedCategory) {
      fetchPosts(selectedCategory);
    }
  }, [page, selectedCategory]);
  
  useEffect(() => {
    const preloadPosts = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/posts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPosts(
          response.data.reduce((acc, post) => {
            acc[post.category] = acc[post.category] || [];
            acc[post.category].push(post);
            return acc;
          }, {})
        );
      } catch (error) {
        console.error('Error preloading posts:', error.message);
      }
    };
  
    if (isLoggedIn) {
      preloadPosts();
    }
  }, [isLoggedIn]);
  
  // Toggle user activation
  const toggleUserActivation = async (userId, currentStatus) => {
    try {
      await axios.patch(`http://localhost:5000/api/users/${userId}`, {
        isActive: !currentStatus,
      });
  
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, isActive: !currentStatus } : user
        )
      );
      alert(`User account ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status.');
    }
  };

  const handleNavigate = (targetPage) => {
    if (targetPage === 'admin' && (!loggedInUser || !loggedInUser.isAdmin)) {
      setPage('adminLogin');
    } else {
      setPage(targetPage);
    }
  };
  
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setPage('category');
  };

  const handleModalToggle = () => setModalOpen(!isModalOpen);

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!loggedInUser) {
      alert('You must be logged in to post.');
      return;
    }

    const postContent = e.target.elements['postContent'].value;
    const files = e.target.elements['fileUpload'].files;

    if (!postContent.trim()) return alert('Post content cannot be empty!');

    const formData = new FormData();
    formData.append('category', selectedCategory);
    formData.append('content', postContent);
    Array.from(files).forEach((file) => formData.append('files', file));

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/posts', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setPosts((prevPosts) => ({
        ...prevPosts,
        [selectedCategory]: [
          ...(prevPosts[selectedCategory] || []),
          { ...response.data, date: new Date().toLocaleDateString() },
        ],
      }));
      setModalOpen(false);
      e.target.reset();
    } catch (error) {
      console.error('Error saving post:', error);
      alert('Failed to save post.');
    }
  };

  const handleImageNav = (postId, category, direction) => {
    setCurrentImageIndex((prevState) => {
      const newState = { ...prevState };
      const totalImages = posts[category]?.find((post) => post.id === postId).files.length;
      const newIndex = (newState[postId] || 0) + direction;
      newState[postId] = (newIndex + totalImages) % totalImages;
      return newState;
    });
  };

  const handleAddComment = async (postId, category, commentText) => {
    if (!commentText.trim()) return alert('Comment cannot be empty.');
  
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/comments',
        { postId, content: commentText },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      const newComment = response.data;
  
      setComments((prevComments) => ({
        ...prevComments,
        [postId]: [...(prevComments[postId] || []), newComment],
      }));
    } catch (error) {
      console.error('Error adding comment:', error.message);
      alert('Failed to add comment.');
    }
  };
  
  const fetchComments = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/comments/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      setComments((prevComments) => ({
        ...prevComments,
        [postId]: response.data,
      }));
    } catch (error) {
      console.error('Error fetching comments:', error.message);
      alert('Failed to fetch comments.');
    }
  };
  
  const handleDeletePost = async (postId, category) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this post?");
    if (!confirmDelete) return;

    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPosts((prevPosts) => ({
        ...prevPosts,
        [category]: prevPosts[category].filter((post) => post.id !== postId),
      }));

      alert('Post deleted successfully.');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post.');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const selectedSkills = Array.from(formData.getAll('skills'));

    const [skill1, skill2, skill3] = [
      selectedSkills[0] || 'None',
      selectedSkills[1] || 'None',
      selectedSkills[2] || 'None',
    ];

    const userData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      zipcode: formData.get('zipcode'),
      skill1,
      skill2,
      skill3,
    };

    try {
      await axios.post('http://localhost:5000/api/users', userData);
      alert('User registered successfully!');
      setPage('community');
    } catch (error) {
      console.error('Error during sign-up:', error);
      alert('Failed to register user.');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <nav className="navbar">
          <ul>
            <li><button className="nav-link" onClick={() => handleNavigate('home')}>Home</button></li>
            <li><button className="nav-link" onClick={() => handleNavigate('profile')}>Profile</button></li>
            <li><button className="nav-link" onClick={() => handleNavigate('about')}>About</button></li>
            <li><button className="nav-link" onClick={() => handleNavigate('community')}>Community</button></li>
            <li><button className="nav-link" onClick={() => handleNavigate('admin')}>Admin</button></li>
          </ul>

          {loggedInUser && (
            <div className="nav-user-wrapper">
              <li className="nav-user">Welcome {loggedInUser.name}!</li>
              <li>
                <button
                  className="nav-link logout-button"
                  onClick={() => {
                    setLoggedInUser(null);
                    setIsLoggedIn(false);
                    localStorage.removeItem('token');
                    setPage('home');
                  }}
                >
                  Log Out
                </button>
              </li>
            </div>
          )}
        </nav>
      </header>

      {page === 'home' && (
        <main className="main-content">
          <div className="logo">
            <img src={logo} alt="SkillShare Dearborn Logo" />
          </div>
          {loggedInUser && <h2 className="welcome-message">Welcome, {loggedInUser.name}!</h2>}
          <p>Register as a Resident or Log In Below:</p>
          <div className="buttons">
            <button className="button" onClick={() => handleNavigate('signup')}>Register</button>
            <button className="button" onClick={() => handleNavigate('login')}>Log In</button>
          </div>
        </main>
      )}

      {page === 'about' && (
        <main className="about-page">
          <div className="about-content">
            <img src={logo} alt="SkillShare Dearborn Logo" className="about-logo" />
            <section className="about-section">
              <h1>About Us</h1>
              <p>
                Welcome to SkillShare Dearborn! Our platform is dedicated to fostering community connections and promoting sustainability by addressing the growing need for accessible repair solutions in Dearborn. We provide an open forum where residents can seek advice, share repair knowledge, and connect with local businesses for trusted repair services.
              </p>
              <p>
                At SkillShare Dearborn, we aim to reduce waste, encourage the sharing of repair skills, and strengthen relationships within our community. By empowering residents to collaborate and support one another, we help promote sustainability, reduce waste by promoting repairs over replacements, invest in the local economy, and build a stronger, more connected Dearborn by sharing our knowledge. Join us in making a difference—one repair at a time!
              </p>
            </section>
          </div>
          <button
            className="button back-button"
            onClick={() => handleNavigate('home')}
          >
            Back to Home
          </button>
        </main>
      )}

      {page === 'profile' && (
        <main className="profile-page">
          <div className="profile-header">
            <div className="profile-image-container">
              <img
                src={profileImage || logo}
                alt="Profile"
                className="profile-image"
              />
              <button
                className="button change-button"
                onClick={() => document.getElementById('profile-pic').click()}
              >
                Change
              </button>
              <input
                type="file"
                id="profile-pic"
                accept="image/*"
                onChange={handleProfileImageUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className="profile-info">
              <h2>{loggedInUser?.name || "User Name"}</h2>
              <p><strong>Email:</strong> {profile.email || loggedInUser?.email}</p>
              <p><strong>ZIP Code:</strong> {profile.zipCode || "N/A"}</p>
              <p><strong>About Me:</strong> {profile.aboutMe || "N/A"}</p>
              <button
                className="button edit-profile-button"
                onClick={() => setPage('editProfile')}
              >
                Edit Profile
              </button>
            </div>
          </div>
        </main>
      )}

      {page === 'editProfile' && (
        <main className="profile-page">
          <h1>Edit Profile</h1>
          <form onSubmit={handleProfileSave}>
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={profile.firstName}
              onChange={handleInputChange}
              className="form-input"
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={profile.lastName}
              onChange={handleInputChange}
              className="form-input"
            />
            <input
              type="text"
              name="zipCode"
              placeholder="ZIP Code"
              value={profile.zipCode}
              onChange={handleInputChange}
              className="form-input"
            />
            <textarea
              name="aboutMe"
              placeholder="About Me"
              value={profile.aboutMe}
              onChange={handleInputChange}
              className="form-textarea"
            />
            <button type="submit" className="button save-button">Save Changes</button>
          </form>
        </main>
      )}

      {page === 'community' && (
        <main className="community-content">
          <h1>Find a Community Repair Forum</h1>
          <div className="community-categories">
            <div className="community-item" onClick={() => handleCategoryClick('Mechanics')}>
              <img src={mechanicsIcon} alt="Mechanics" />
              <p>Mechanics</p>
            </div>
            <div className="community-item" onClick={() => handleCategoryClick('Electronics')}>
              <img src={electronicsIcon} alt="Electronics" />
              <p>Electronics</p>
            </div>
            <div className="community-item" onClick={() => handleCategoryClick('Home Appliances')}>
              <img src={appliancesIcon} alt="Home Appliances" />
              <p>Home Appliances</p>
            </div>
          </div>
        </main>
      )}

      {page === 'category' && selectedCategory && (
        <main className="category-content">
          <div className="community-logo">
            <img
              src={
                selectedCategory === 'Mechanics'
                  ? mechanicsIcon
                  : selectedCategory === 'Electronics'
                  ? electronicsIcon
                  : appliancesIcon
              }
              alt={selectedCategory}
            />
            <h2>{selectedCategory} Forum</h2>
          </div>
          <div className="posts">
            {posts[selectedCategory]?.length > 0 ? (
              posts[selectedCategory].map((post) => (
                <div key={post.id} className="post">
                  <div className="image-slider">
                    {post.files?.length > 1 && (
                      <button
                        className="arrow left-arrow"
                        onClick={() => handleImageNav(post.id, selectedCategory, -1)}
                      >
                        &lt;
                      </button>
                    )}

                    {post.files?.length > 0 ? (
                      <img
                        src={`http://localhost:5000${post.files[currentImageIndex[post.id] || 0]}`}
                        alt="Post content"
                        className="post-image"
                        onError={(e) => {
                          e.target.src = 'default-image.png';
                        }}
                      />
                    ) : (
                      <img
                        src="default-image.png"
                        alt="Default content"
                        className="post-image"
                      />
                    )}

                    {post.files?.length > 1 && (
                      <button
                        className="arrow right-arrow"
                        onClick={() => handleImageNav(post.id, selectedCategory, 1)}
                      >
                        &gt;
                      </button>
                    )}
                  </div>
                  <div className="post-content">
                    <p className="post-text">{post.content}</p>
                    <div className="post-footer">
                      <span className="post-username">By {post.username}</span>
                      <span className="post-date">{post.date}</span>
                      {(loggedInUser?.id === post.userId || loggedInUser?.isAdmin) && (
                        <button
                          className="delete-button"
                          onClick={() => handleDeletePost(post.id, selectedCategory)}
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <div className="comments-section">
                      <h3>Comments:</h3>
                      <ul className="comments-list">
                        {comments[post.id]?.map((comment) => (
                          <li key={comment.id} className="comment">
                            <p className="comment-text">{comment.content}</p>
                            <div className="comment-footer">
                              <span>{comment.username}</span>
                              <span>{new Date(comment.createdAt).toLocaleString()}</span>
                              <button
                                onClick={() => {
                                  toggleReplies(comment.id);
                                  if (!showReplies[comment.id]) fetchReplies(comment.id);
                                }}
                                className="toggle-replies-button"
                              >
                                {showReplies[comment.id] ? 'Hide Replies' : 'View Replies'}
                              </button>
                              {(loggedInUser?.id === comment.userId || loggedInUser?.isAdmin) && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                  className="delete-comment-button"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            {showReplies[comment.id] && (
                              <ul className="replies-list">
                                {replies[comment.id]?.map((reply) => (
                                  <li key={reply.id} className="reply">
                                    <p className="reply-text">{reply.content}</p>
                                    <div className="reply-footer">
                                      <span>{reply.username}</span>
                                      <span>{new Date(reply.createdAt).toLocaleString()}</span>
                                      {(loggedInUser?.id === reply.userId || loggedInUser?.isAdmin) && (
                                        <button
                                          onClick={() => handleDeleteReply(reply.id, comment.id)}
                                          className="delete-reply-button"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                ))}
                                <form
                                  className="add-reply-form"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const replyText = e.target.elements['replyInput'].value;
                                    handleAddReply(comment.id, replyText);
                                    e.target.reset();
                                  }}
                                >
                                  <input
                                    type="text"
                                    name="replyInput"
                                    placeholder="Add a reply..."
                                    className="reply-input"
                                  />
                                  <button type="submit" className="reply-button">Reply</button>
                                </form>
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>

                      <form
                        className="add-comment-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const commentText = e.target.elements['commentInput'].value;
                          handleAddComment(post.id, selectedCategory, commentText);
                          e.target.reset();
                        }}
                      >
                        <input
                          type="text"
                          name="commentInput"
                          placeholder="Add a comment..."
                          className="comment-input"
                        />
                        <button type="submit" className="comment-button">Comment</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-posts">
                <p>No Posts Yet</p>
              </div>
            )}
          </div>
          <button className="add-button" onClick={handleModalToggle}>+</button>
          {isModalOpen && (
            <div className="modal">
              <div className="modal-content">
                <h2>Create a Post in {selectedCategory}</h2>
                <form onSubmit={handleFormSubmit}>
                  <textarea
                    name="postContent"
                    placeholder={`Connect with the ${selectedCategory} community here...`}
                    className="form-textarea"
                    required
                  ></textarea>
                  <div className="form-actions">
                    <input type="file" name="fileUpload" className="form-file" multiple />
                    <button type="submit" className="popup-submit-button">Submit</button>
                  </div>
                </form>
                <button className="popup-close-button" onClick={handleModalToggle}>Close</button>
              </div>
            </div>
          )}
        </main>
      )}

      {page === 'adminLogin' && (
        <main className="main-content login-form">
          <div className="logo">
            <img src={require('./adminpage.png')} alt="Admin Logo" />
          </div>
          <h1>Admin Log In</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = e.target.elements['email'].value;
              const password = e.target.elements['password'].value;

              const success = handleAdminLogin(email, password);
              if (success) {
                setPage("admin");
              }
            }}
          >
            <input type="email" name="email" placeholder="Admin Email" className="form-input" required />
            <input type="password" name="password" placeholder="Password" className="form-input" required />
            <button type="submit" className="button">Log In</button>
          </form>
          <button className="button back-button" onClick={() => handleNavigate('home')}>
            Back
          </button>
        </main>
      )}

      {page === 'admin' && loggedInUser?.isAdmin && (
        <main className="admin-content">
          <h1>Admin Dashboard</h1>
          <section>
            <h2>Registered Users</h2>
            {users.length > 0 ? (
              users.map((user) => (
                <div key={user.id} className="admin-user">
                  <p><strong>Name:</strong> {user.name}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Zipcode:</strong> {user.zipcode}</p>
                  <p><strong>Skills:</strong> {user.skill1}, {user.skill2}, {user.skill3}</p>
                  <p><strong>Status:</strong> {user.isActive ? 'Active' : 'Inactive'}</p>
                  <button
                    onClick={() => toggleUserActivation(user.id, user.isActive)}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))
            ) : (
              <p>No users found.</p>
            )}
          </section>
        </main>
      )}

{page === 'signup' && (
  <main className="main-content signup-form">
    <div className="logo">
      <img src={logo} alt="SkillShare Dearborn Logo" />
    </div>
    {/* Removed <h1>Sign Up Here!</h1> and all text above the input fields */}

    <form onSubmit={handleSignUp} className="signup-form">
      <div className="form-group">
        {/* Removed the label for "Full Name" */}
        <input
          type="text"
          id="name"
          name="name"
          placeholder="Full Name"
          className="form-input"
          required
        />
      </div>
      <div className="form-group">
        {/* Removed the label for "Email Address" */}
        <input
          type="email"
          id="email"
          name="email"
          placeholder="Email Address"
          className="form-input"
          required
        />
      </div>
      <div className="form-group">
        {/* Removed the label for "Password" */}
        <input
          type="password"
          id="password"
          name="password"
          placeholder="Password"
          className="form-input"
          required
        />
      </div>
      <div className="form-group">
        {/* Removed the label for "Zipcode" */}
        <input
          type="text"
          id="zipcode"
          name="zipcode"
          placeholder="Zipcode"
          className="form-input"
          required
        />
      </div>
      <div className="form-group">
        {/* Removed the "Select Your Skills" label and any descriptive text */}
        <div>
          <label>
            <input type="checkbox" name="skills" value="Mechanics" /> Mechanics
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" name="skills" value="Electronics" /> Electronics
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" name="skills" value="Home Appliances" /> Home Appliances
          </label>
        </div>
      </div>
      <button type="submit" className="button form-submit-button">Register</button>
    </form>
    <button className="button back-button" onClick={() => handleNavigate('home')}>Back</button>
  </main>
)}


      {page === 'login' && (
        <main className="main-content login-form">
          <div className="logo">
            <img src={logo} alt="SkillShare Dearborn Logo" />
          </div>
          <h1>Log In</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const email = e.target.elements['email'].value;
              const password = e.target.elements['password'].value;

              const success = await handleLogin(email, password);

              if (success) {
                setPage('community');
              }
            }}
          >
            <input type="email" name="email" placeholder="Email Address" className="form-input" required />
            <input type="password" name="password" placeholder="Password" className="form-input" required />
            <button type="submit" className="button">Log In</button>
          </form>

          <button className="button back-button" onClick={() => handleNavigate('home')}>
            Back
          </button>
        </main>
      )}
    </div>
  );
}

export default App;
