from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for React

# Initialize the database
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.json
    title = data['title']
    description = data['description']
    category = data['category']
    created_at = datetime.now()

    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('INSERT INTO posts (title, description, category, created_at) VALUES (?, ?, ?, ?)',
                   (title, description, category, created_at))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Post created successfully!'}), 201

@app.route('/api/posts', methods=['GET'])
def get_posts():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, description, category, created_at FROM posts ORDER BY created_at DESC')
    posts = cursor.fetchall()
    conn.close()

    return jsonify(posts)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
